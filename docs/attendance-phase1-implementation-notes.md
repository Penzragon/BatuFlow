# Attendance Phase 1 — Implementation Notes

## Wave 0 (Discovery & Decision Lock)
- Existing attendance model existed but lacked:
  - per-employee schedule
  - selfie/GPS evidence
  - early checkout/overtime flags
  - correction request lifecycle
  - hard attendance gate
- Locked defaults:
  - Shift: `08:00–17:00`
  - Late tolerance: `5` minutes
- Flow decisions:
  - Keep attendance gate in auth middleware callback (session-aware).
  - Add dedicated check-in page `/attendance/check-in`.
  - Keep manager/admin review in HR attendance page tabs.

## Wave 1 schema/service
- Schema introduces:
  - `employee_attendance_schedules`
  - `attendance_correction_requests`
  - attendance fields for selfie/GPS/timing flags
- Service introduces:
  - schedule get/set
  - check-in/out with GPS + selfie enforcement
  - gate status helper
  - correction request submit/review

## Wave 2 routing + gate
- Added APIs:
  - `/api/attendance/gate-status`
  - `/api/attendance/schedules`
  - `/api/attendance/corrections`
  - `/api/attendance/corrections/[id]/review`
- Upgraded clock-in/out to multipart form handling for selfie upload.
- Middleware auth callback enforces attendance gate for STAFF/MANAGER/ADMIN.

## Wave 3 UI
- Added `/attendance/check-in` flow (GPS + selfie + check in/out).
- Refactored `/hr/attendance` with tabs:
  - report
  - details
  - schedules
  - corrections (request + review)

## DB sync notes
- Migration SQL file: `prisma/migrations/20260312_attendance_phase1.sql`
- Target DB verification still required on deployment target (local/preview/prod) before rollout.
