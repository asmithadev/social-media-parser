-- Audited writes use READ COMMITTED and a transaction-wide lock. Statement
-- triggers take it before row locks and sequence allocation, so concurrent
-- requests cannot fork the chain or allocate audit IDs out of order.
CREATE FUNCTION fn_audit_lock() RETURNS trigger AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Audited writes require READ COMMITTED isolation';
  END IF;
  PERFORM pg_advisory_xact_lock(7419302601);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_insert_lock
  BEFORE INSERT ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_lock();

-- The versioned JSON array has a fixed field order, explicit nulls, UTF-8
-- encoding and a UTC timestamp with all six stored fractional digits.
CREATE FUNCTION audit_entry_hash(previous_hash text, entry audit_logs)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    'audit-v1', previous_hash, entry.log_id::text, entry.user_id,
    entry.action, entry.entity_type, entry.entity_id, entry.detail,
    to_char(entry.logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  )::text, 'UTF8')), 'hex');
$$;

CREATE FUNCTION fn_audit_hash_entry() RETURNS trigger AS $$
DECLARE
  predecessor audit_logs;
BEGIN
  SELECT * INTO predecessor FROM audit_logs ORDER BY log_id DESC LIMIT 1;
  IF NEW.log_id < 1 OR NEW.log_id <= predecessor.log_id THEN
    RAISE EXCEPTION 'Audit IDs must increase';
  END IF;
  NEW.logged_at := clock_timestamp();
  NEW.chain_hash := audit_entry_hash(
    coalesce(predecessor.chain_hash::text, repeat('0', 64)), NEW
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hash_entry
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_hash_entry();

-- Single-statement verification uses one MVCC snapshot while writers continue.
-- A trusted checkpoint stored outside this DB additionally detects tail removal
-- or a privileged rewrite of the prefix ending at that checkpoint.
CREATE FUNCTION verify_audit_chain(checkpoint_id bigint DEFAULT NULL, checkpoint_hash text DEFAULT NULL)
RETURNS TABLE (
  valid boolean, checked bigint, head_id bigint, head_hash text,
  first_invalid_id bigint, checkpoint_matches boolean
) LANGUAGE sql STABLE AS $$
  WITH entries AS MATERIALIZED (
    SELECT a.*, audit_entry_hash(
      lag(chain_hash::text, 1, repeat('0', 64)) OVER (ORDER BY log_id), a
    ) AS expected_hash
    FROM audit_logs a
  ), summary AS (
    SELECT count(*) AS total,
      min(log_id) FILTER (WHERE chain_hash::text IS DISTINCT FROM expected_hash OR log_id < 1) AS bad_id
    FROM entries
  ), checkpoint AS (
    SELECT CASE
      WHEN checkpoint_id IS NULL AND checkpoint_hash IS NULL THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM entries WHERE log_id = checkpoint_id AND chain_hash::text = checkpoint_hash)
    END AS matches
  )
  SELECT bad_id IS NULL AND coalesce(matches, true), total,
    (SELECT log_id FROM entries ORDER BY log_id DESC LIMIT 1),
    coalesce((SELECT chain_hash::text FROM entries ORDER BY log_id DESC LIMIT 1), repeat('0', 64)),
    bad_id, matches
  FROM summary CROSS JOIN checkpoint;
$$;

CREATE FUNCTION fn_audit_record_change() RETURNS trigger AS $$
DECLARE
  before_row jsonb;
  after_row jsonb;
  record_row jsonb;
  changed_fields jsonb;
  metadata jsonb;
  event_action text;
  actor_id integer;
  target_id integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  record_row := coalesce(after_row, before_row);
  actor_id := nullif(current_setting('app.audit_user_id', true), '')::integer;
  target_id := (record_row ->> TG_ARGV[1])::integer;

  SELECT coalesce(jsonb_agg(key ORDER BY key), '[]'::jsonb) INTO changed_fields
    FROM jsonb_each(record_row)
    WHERE TG_OP <> 'UPDATE' OR before_row -> key IS DISTINCT FROM after_row -> key;

  -- Only IDs, lifecycle states and evidence digests are copied. Never copy
  -- passwords/hashes, tokens, email, Aadhaar, names, witness details, paths,
  -- source URLs, extracted content, or arbitrary request/metadata objects.
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO metadata
    FROM jsonb_each(record_row)
    WHERE key = ANY (ARRAY[
      'case_id', 'suspect_id', 'account_id', 'panchnama_id', 'examiner_id',
      'session_id', 'platform_id', 'platform_section_id', 'user_id',
      'status', 'parse_status', 'role', 'active', 'sha256_hash',
      'sequence_no', 'version_no', 'generated_by', 'approved_by'
    ]);
  metadata := jsonb_build_object('operation', TG_OP, 'changedFields', changed_fields, 'record', metadata);
  event_action := upper(TG_ARGV[0]) || CASE TG_OP
    WHEN 'INSERT' THEN '_CREATED' WHEN 'UPDATE' THEN '_UPDATED' ELSE '_DELETED' END;

  IF TG_TABLE_NAME = 'capture_sessions' THEN
    IF TG_OP = 'INSERT' THEN event_action := 'CAPTURE_STARTED';
    ELSIF TG_OP = 'UPDATE' AND before_row -> 'status' IS DISTINCT FROM after_row -> 'status' THEN
      event_action := 'CAPTURE_' || upper(record_row ->> 'status');
    END IF;
  ELSIF TG_TABLE_NAME = 'capture_section_outcomes' AND TG_OP <> 'DELETE' THEN
    event_action := 'CAPTURE_SECTION_RECORDED';
  ELSIF TG_TABLE_NAME = 'screenshots' AND TG_OP = 'INSERT' THEN
    event_action := 'SCREENSHOT_CAPTURED';
  ELSIF TG_TABLE_NAME = 'reports' THEN
    IF TG_OP = 'INSERT' THEN event_action := 'REPORT_GENERATED';
    ELSIF TG_OP = 'UPDATE' AND (
      before_row -> 'approved_by' IS DISTINCT FROM after_row -> 'approved_by' OR
      before_row -> 'approved_at' IS DISTINCT FROM after_row -> 'approved_at'
    ) THEN
      event_action := CASE WHEN record_row ->> 'approved_by' IS NULL
        THEN 'REPORT_APPROVAL_REVOKED' ELSE 'REPORT_APPROVED' END;
    END IF;
  END IF;

  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, detail, chain_hash)
    VALUES (actor_id, event_action, TG_ARGV[0], target_id, metadata::text, repeat('0', 64));
  -- A report inserted with an approval is both generated and approved.
  IF TG_TABLE_NAME = 'reports' AND TG_OP = 'INSERT' AND record_row ->> 'approved_by' IS NOT NULL THEN
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, detail, chain_hash)
      VALUES (actor_id, 'REPORT_APPROVED', TG_ARGV[0], target_id, metadata::text, repeat('0', 64));
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ['users', 'user', 'user_id'],
    ['cases', 'case', 'case_id'],
    ['case_assignments', 'case_assignment', 'assignment_id'],
    ['suspects', 'suspect', 'suspect_id'],
    ['case_suspects', 'case_suspect', 'case_suspect_id'],
    ['platforms', 'platform', 'platform_id'],
    ['platform_sections', 'platform_section', 'platform_section_id'],
    ['social_accounts', 'social_account', 'account_id'],
    ['panchnamas', 'panchnama', 'panchnama_id'],
    ['capture_sessions', 'capture_session', 'session_id'],
    ['capture_section_outcomes', 'capture_section', 'session_id'],
    ['screenshots', 'screenshot', 'screenshot_id'],
    ['witnesses', 'witness', 'witness_id'],
    ['reports', 'report', 'report_id']
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_lock()', item[1]);
    EXECUTE format('CREATE TRIGGER trg_audit_record_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_audit_record_change(%L, %L)', item[1], item[2], item[3]);
  END LOOP;
END $$;
