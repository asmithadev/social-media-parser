-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'examiner', 'reviewer');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "involvement_type" AS ENUM ('suspect', 'accused');

-- CreateEnum
CREATE TYPE "device_type" AS ENUM ('macos', 'ios');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('open', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "parse_status" AS ENUM ('pending', 'parsed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" "user_role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "cases" (
    "case_id" SERIAL NOT NULL,
    "case_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by" INTEGER NOT NULL,
    "status" "case_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "case_assignments" (
    "assignment_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_notes" TEXT,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "suspects" (
    "suspect_id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "alias" VARCHAR(150),
    "date_of_birth" DATE,
    "aadhar_number" VARCHAR(12),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspects_pkey" PRIMARY KEY ("suspect_id")
);

-- CreateTable
CREATE TABLE "case_suspects" (
    "case_suspect_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "suspect_id" INTEGER NOT NULL,
    "involvement" "involvement_type" NOT NULL,
    "involvement_details" TEXT,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_suspects_pkey" PRIMARY KEY ("case_suspect_id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "platform_id" SERIAL NOT NULL,
    "platform_name" VARCHAR(30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("platform_id")
);

-- CreateTable
CREATE TABLE "platform_sections" (
    "platform_section_id" SERIAL NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "section_name" VARCHAR(30) NOT NULL,

    CONSTRAINT "platform_sections_pkey" PRIMARY KEY ("platform_section_id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "account_id" SERIAL NOT NULL,
    "suspect_id" INTEGER NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "handle" VARCHAR(150) NOT NULL,
    "platform_account_id" VARCHAR(100),
    "profile_url" TEXT,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "panchnamas" (
    "panchnama_id" SERIAL NOT NULL,
    "panchnama_no" VARCHAR(50) NOT NULL,
    "case_id" INTEGER NOT NULL,
    "examiner_id" INTEGER NOT NULL,
    "authority_ref" VARCHAR(100) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "held_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "panchnamas_pkey" PRIMARY KEY ("panchnama_id")
);

-- CreateTable
CREATE TABLE "capture_sessions" (
    "session_id" SERIAL NOT NULL,
    "panchnama_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "device_type" "device_type" NOT NULL,
    "device_label" VARCHAR(100),
    "tool_version" VARCHAR(30) NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'open',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "capture_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "screenshot_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "platform_section_id" INTEGER NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "sha256_hash" CHAR(64) NOT NULL,
    "parse_status" "parse_status" NOT NULL DEFAULT 'pending',
    "source_url" TEXT,
    "metadata" JSONB,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("screenshot_id")
);

-- CreateTable
CREATE TABLE "witnesses" (
    "witness_id" SERIAL NOT NULL,
    "panchnama_id" INTEGER NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "contact_no" VARCHAR(15),
    "aadhar_number" VARCHAR(12),

    CONSTRAINT "witnesses_pkey" PRIMARY KEY ("witness_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "report_id" SERIAL NOT NULL,
    "panchnama_id" INTEGER NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "file_path" TEXT NOT NULL,
    "sha256_hash" CHAR(64) NOT NULL,
    "generated_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(30),
    "entity_id" INTEGER,
    "detail" TEXT,
    "chain_hash" CHAR(64) NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE UNIQUE INDEX "case_assignments_case_id_user_id_key" ON "case_assignments"("case_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "suspects_aadhar_number_key" ON "suspects"("aadhar_number");

-- CreateIndex
CREATE UNIQUE INDEX "case_suspects_case_id_suspect_id_key" ON "case_suspects"("case_id", "suspect_id");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_platform_name_key" ON "platforms"("platform_name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_sections_platform_id_section_name_key" ON "platform_sections"("platform_id", "section_name");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_suspect_id_platform_id_handle_key" ON "social_accounts"("suspect_id", "platform_id", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_id_platform_account_id_key" ON "social_accounts"("platform_id", "platform_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "panchnamas_panchnama_no_key" ON "panchnamas"("panchnama_no");

-- CreateIndex
CREATE UNIQUE INDEX "screenshots_session_id_platform_section_id_sequence_no_key" ON "screenshots"("session_id", "platform_section_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "witnesses_panchnama_id_aadhar_number_key" ON "witnesses"("panchnama_id", "aadhar_number");

-- CreateIndex
CREATE UNIQUE INDEX "reports_panchnama_id_version_no_key" ON "reports"("panchnama_id", "version_no");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_suspects" ADD CONSTRAINT "case_suspects_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_suspects" ADD CONSTRAINT "case_suspects_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "suspects"("suspect_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sections" ADD CONSTRAINT "platform_sections_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("platform_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "suspects"("suspect_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("platform_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panchnamas" ADD CONSTRAINT "panchnamas_case_id_examiner_id_fkey" FOREIGN KEY ("case_id", "examiner_id") REFERENCES "case_assignments"("case_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_panchnama_id_fkey" FOREIGN KEY ("panchnama_id") REFERENCES "panchnamas"("panchnama_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "social_accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "capture_sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_platform_section_id_fkey" FOREIGN KEY ("platform_section_id") REFERENCES "platform_sections"("platform_section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "witnesses" ADD CONSTRAINT "witnesses_panchnama_id_fkey" FOREIGN KEY ("panchnama_id") REFERENCES "panchnamas"("panchnama_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_panchnama_id_fkey" FOREIGN KEY ("panchnama_id") REFERENCES "panchnamas"("panchnama_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
