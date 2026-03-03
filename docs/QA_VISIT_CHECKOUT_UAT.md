# QA UAT - Visit Checkout Lifecycle

**Scope:** Checkout lifecycle, permission matrix, stale behavior, and reporting semantics  
**Branch:** `feature/visit-checkout-lifecycle`  
**Date:** 2026-03-03

---

## 1) Preconditions

Prepare test data/users:
- `staff_a` (STAFF)
- `staff_b` (STAFF)
- `manager_x` (MANAGER)
- `admin_x` (ADMIN)
- customer owned by `staff_a`

Prepare scenarios:
- at least one active visit for `staff_a`
- one visit old enough to pass stale threshold (>12h) if possible

API/tools:
- endpoint under test: `POST /api/visits/[id]/check-out`
- list check: `GET /api/visits`

---

## 2) Positive Flow Tests

### TC-P01 Staff normal checkout success
1. Login as `staff_a`.
2. Ensure own active visit exists (`status=OPEN`, no `checkoutAt`).
3. Submit checkout with valid photo + GPS (`lat/lng`).
4. Verify response success.
5. Verify visit becomes `CHECKED_OUT` and `checkoutAt` set.
6. Verify `GET /api/visits` item has lifecycle:
   - `status=CHECKED_OUT`
   - `isCompleted=true`
   - `durationMinutes` populated

### TC-P02 GPS missing with valid reason
1. Login as `staff_a`.
2. Start a new active visit.
3. Submit checkout without GPS coordinates, with `gpsReasonCode` (e.g. `GPS_DENIED`).
4. Verify success.
5. Verify lifecycle still `CHECKED_OUT`, and reason saved.

### TC-P03 Manager force-checkout another staff visit
1. Login as `manager_x`.
2. Use active visit owned by `staff_b`.
3. Submit checkout with `overrideReason`.
4. Verify success.
5. Verify `overrideBy` and `overrideReason` set.

### TC-P04 Cross-day completion semantics
1. Use a visit with `checkInAt` on Day N and checkout on Day N+1 (or simulate via `checkoutAt`).
2. Verify `GET /api/visits` lifecycle contains:
   - `checkInDate = Day N`
   - `checkoutDate = Day N+1`
   - `isCrossDay = true`
3. Confirm reporting interpretation:
   - counted in Started on Day N
   - counted in Completed on Day N+1

---

## 3) Negative Flow Tests (Must Pass)

### TC-N01 STAFF checkout other STAFF visit
1. Login as `staff_a`.
2. Attempt checkout on active visit owned by `staff_b`.
3. Expect **403 Forbidden**.

### TC-N02 Checkout on already closed visit
1. Use visit already `CHECKED_OUT`.
2. Attempt another checkout.
3. Expect validation/business error (`Visit already checked out`).

### TC-N03 Missing GPS + no reason
1. Use active own visit.
2. Submit checkout without GPS and without `gpsReasonCode`.
3. Expect blocked with clear error.

### TC-N04 Invalid photo format / size
1. Submit checkout with unsupported file type or file >1MB.
2. Expect request blocked with validation error.

### TC-N05 Duplicate submit race
1. Trigger two checkout requests for same active visit in short interval.
2. Expect one success and one reject (already checked out/conflict), no duplicate close.

### TC-N06 MANAGER/ADMIN force checkout without reason
1. Login as manager/admin.
2. Checkout non-owned active visit without `overrideReason`.
3. Expect blocked (`Override reason is required`).

### TC-N07 Non-existent visit
1. Checkout with random UUID not present.
2. Expect **404 Not Found**.

### TC-N08 Cross-tenant out-of-scope visit
1. Attempt checkout for visit outside actor scope/tenant.
2. Expect **404 Not Found** (scope-safe behavior).

### TC-N09 STAFF checkout stale visit
1. Use visit transitioned to `STALE_OPEN`.
2. Attempt checkout as visit owner STAFF.
3. Expect **403** (requires privileged force flow with reason).

### TC-N10 Offline stale update conflict
1. Simulate delayed/offline checkout submit after visit already closed by another actor.
2. Expect graceful rejection/conflict (no data corruption).

---

## 4) Reporting Verification Checklist

After running cases, verify `GET /api/visits` lifecycle payload for sampled rows:
- `status` aligns with state transition
- `checkInDate` and `checkoutDate` are populated correctly
- `isCompleted` true only when `checkoutAt` exists
- `isCrossDay` true only when dates differ and completion exists
- `durationMinutes` null for open visits, numeric for completed visits

---

## 5) Exit Criteria

UAT pass when:
- All positive tests pass.
- All negative tests enforce expected guardrails/status codes.
- Lifecycle fields support KPI split:
  - Today Visits (Started) by `checkInDate`
  - Completed Today by `checkoutDate`
  - Completion Rate = completed / started
