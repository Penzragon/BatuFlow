-- Attendance Phase 1

DO $$ BEGIN
  CREATE TYPE attendance_correction_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS employee_attendance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  late_tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

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
  ADD COLUMN IF NOT EXISTS schedule_end TEXT NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_clock_in TIMESTAMP,
  requested_clock_out TIMESTAMP,
  reason TEXT NOT NULL,
  status attendance_correction_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_employee_status ON attendance_correction_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_correction_attendance ON attendance_correction_requests(attendance_id);
