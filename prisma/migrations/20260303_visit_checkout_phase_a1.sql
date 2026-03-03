-- Phase A1: Visit check-out lifecycle (DB layer)

DO $$
BEGIN
  CREATE TYPE visit_status AS ENUM ('OPEN', 'CHECKED_OUT', 'STALE_OPEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE gps_reason_code AS ENUM ('GPS_DENIED', 'GPS_TIMEOUT', 'DEVICE_ERROR', 'NO_SIGNAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE customer_visits
  ADD COLUMN IF NOT EXISTS status visit_status,
  ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS checkout_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS checkout_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_reason_code gps_reason_code,
  ADD COLUMN IF NOT EXISTS override_by TEXT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS stale_marked_at TIMESTAMP(3);

UPDATE customer_visits
SET status = CASE
  WHEN checkout_at IS NOT NULL THEN 'CHECKED_OUT'::visit_status
  ELSE 'OPEN'::visit_status
END
WHERE status IS NULL;

ALTER TABLE customer_visits
  ALTER COLUMN status SET DEFAULT 'OPEN',
  ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS customer_visits_checkout_at_idx ON customer_visits(checkout_at);
CREATE INDEX IF NOT EXISTS customer_visits_status_idx ON customer_visits(status);
