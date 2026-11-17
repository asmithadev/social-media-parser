-- ---------- CHECK constraints ----------
ALTER TABLE "capture_sessions"
  ADD CONSTRAINT "chk_session_times"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

ALTER TABLE "reports"
  ADD CONSTRAINT "chk_report_approver_differs"
  CHECK ("approved_by" IS NULL OR "approved_by" <> "generated_by");

ALTER TABLE "reports"
  ADD CONSTRAINT "chk_report_approval_pair"
  CHECK (("approved_by" IS NULL) = ("approved_at" IS NULL));

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "chk_audit_entity_pair"
  CHECK (("entity_type" IS NULL) = ("entity_id" IS NULL));

ALTER TABLE "suspects"
  ADD CONSTRAINT "chk_suspect_aadhar"
  CHECK ("aadhar_number" IS NULL OR "aadhar_number" ~ '^[0-9]{12}$');

ALTER TABLE "witnesses"
  ADD CONSTRAINT "chk_witness_aadhar"
  CHECK ("aadhar_number" IS NULL OR "aadhar_number" ~ '^[0-9]{12}$');

ALTER TABLE "screenshots"
  ADD CONSTRAINT "chk_screenshot_sequence"
  CHECK ("sequence_no" > 0);

ALTER TABLE "reports"
  ADD CONSTRAINT "chk_report_version"
  CHECK ("version_no" > 0);

-- ---------- Trigger 1: the account's suspect must be linked to the panchnama's case ----------
CREATE OR REPLACE FUNCTION fn_session_suspect_in_case() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "panchnamas" p
    JOIN "social_accounts" a ON a."account_id" = NEW."account_id"
    JOIN "case_suspects" cs ON cs."case_id" = p."case_id" AND cs."suspect_id" = a."suspect_id"
    WHERE p."panchnama_id" = NEW."panchnama_id"
  ) THEN
    RAISE EXCEPTION 'The account''s suspect is not linked to the panchnama''s case'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_suspect_in_case
  BEFORE INSERT OR UPDATE OF "panchnama_id", "account_id" ON "capture_sessions"
  FOR EACH ROW EXECUTE FUNCTION fn_session_suspect_in_case();

-- ---------- Trigger 2: the screenshot's section must belong to the account's platform ----------
CREATE OR REPLACE FUNCTION fn_screenshot_section_matches_platform() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "capture_sessions" s
    JOIN "social_accounts" a ON a."account_id" = s."account_id"
    JOIN "platform_sections" ps ON ps."platform_id" = a."platform_id"
    WHERE s."session_id" = NEW."session_id"
      AND ps."platform_section_id" = NEW."platform_section_id"
  ) THEN
    RAISE EXCEPTION 'The section does not belong to the account''s platform'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_screenshot_section_matches_platform
  BEFORE INSERT OR UPDATE OF "session_id", "platform_section_id" ON "screenshots"
  FOR EACH ROW EXECUTE FUNCTION fn_screenshot_section_matches_platform();

-- ---------- Trigger 3: the examiner of a panchnama must be an active user with role examiner ----------
CREATE OR REPLACE FUNCTION fn_panchnama_examiner_role() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "user_id" = NEW."examiner_id" AND "role" = 'examiner' AND "active" = true
  ) THEN
    RAISE EXCEPTION 'The examiner must be an active user with role examiner'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_panchnama_examiner_role
  BEFORE INSERT OR UPDATE OF "examiner_id" ON "panchnamas"
  FOR EACH ROW EXECUTE FUNCTION fn_panchnama_examiner_role();

-- ---------- Trigger 4: the approver of a report must be a reviewer or admin ----------
CREATE OR REPLACE FUNCTION fn_report_approver_role() RETURNS trigger AS $$
BEGIN
  IF NEW."approved_by" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "user_id" = NEW."approved_by" AND "role" IN ('reviewer', 'admin') AND "active" = true
  ) THEN
    RAISE EXCEPTION 'The approver must be an active reviewer or admin'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_approver_role
  BEFORE INSERT OR UPDATE OF "approved_by" ON "reports"
  FOR EACH ROW EXECUTE FUNCTION fn_report_approver_role();

-- ---------- Trigger 5: audit_logs is append-only ----------
CREATE OR REPLACE FUNCTION fn_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_append_only();

CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_logs_append_only();