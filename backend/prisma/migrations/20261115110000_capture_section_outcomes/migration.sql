CREATE TYPE "capture_section_status" AS ENUM ('captured', 'failed', 'skipped');

CREATE TABLE "capture_section_outcomes" (
  "session_id" INTEGER NOT NULL,
  "platform_section_id" INTEGER NOT NULL,
  "status" "capture_section_status" NOT NULL,
  "reason" TEXT,
  PRIMARY KEY ("session_id", "platform_section_id"),
  FOREIGN KEY ("session_id") REFERENCES "capture_sessions"("session_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("platform_section_id") REFERENCES "platform_sections"("platform_section_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("status" = 'captured' OR ("reason" IS NOT NULL AND btrim("reason") <> ''))
);
