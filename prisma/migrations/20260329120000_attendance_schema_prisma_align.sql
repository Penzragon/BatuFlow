-- Align `attendance` and related objects with prisma/schema.prisma (Attendance + schedule + corrections).
-- Idempotent: safe to run on Neon / preview / prod after older DBs.
-- Run: psql "$DATABASE_URL" -f prisma/migrations/20260329120000_attendance_schema_prisma_align.sql
--   or include in your deployment migrate step.

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_correction_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Schedule table (Phase 1); Prisma EmployeeAttendanceSchedule
CREATE TABLE IF NOT EXISTS employee_attendance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  late_tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Core attendance row shape from Prisma model Attendance (add-only)
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_early_checkout BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_in_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS check_out_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS check_in_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS schedule_start TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS schedule_end TEXT NOT NULL DEFAULT '17:00';

-- Prisma @default(now()) / @updatedAt — required for client; earlier manual migration omitted created_at
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS attendance_employee_id_idx ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance(date);

-- One row per employee per calendar day (Prisma @@unique([employeeId, date]))
CREATE UNIQUE INDEX IF NOT EXISTS attendance_employee_id_date_key ON attendance(employee_id, date);

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_clock_in TIMESTAMP(3),
  requested_clock_out TIMESTAMP(3),
  reason TEXT NOT NULL,
  status attendance_correction_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP(3),
  rejection_reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_employee_status ON attendance_correction_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_correction_attendance ON attendance_correction_requests(attendance_id);
