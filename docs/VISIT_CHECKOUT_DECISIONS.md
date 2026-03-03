# Visit Check-out Decision Lock (BatuFlow)

**Status:** Locked for implementation  
**Date:** 2026-03-03  
**Branch:** `feature/visit-checkout-lifecycle`

This document freezes operational decisions for Visit Check-out so implementation, QA, and reporting use one source of truth.

---

## 1) KPI Definition: “Today Visits”

**Decision:** **Today Visits = visits started (check-in created) on local business date**.

**Rationale (operations):**
- Field teams and supervisors start their day by checking “how many outlets were visited today”; this is an activity/coverage KPI, not a completion KPI.
- Completed-only would undercount same-day effort when checkout is delayed (network, overtime, cross-day finish).
- We will add a separate KPI for quality/completion tracking:
  - **Completed Today** (checkout timestamp today)
  - **Completion Rate** = completed / started

---

## 2) Checkout Permission Matrix

**Decision:**
- **STAFF:** can checkout **only own active visits**.
- **MANAGER:** can checkout own visits + force-checkout direct-team visits (with mandatory reason).
- **ADMIN:** can checkout any active visit (with mandatory reason).

**Rules:**
- Force-checkout must store `override_by`, `override_reason`, and audit event.
- Staff cannot checkout another staff’s visit even in same branch.

---

## 3) GPS Policy for Checkout

**Decision:** **Soft-required with reason fallback**.

**Behavior:**
- App attempts GPS capture at checkout.
- If GPS available: save lat/lng + accuracy.
- If GPS unavailable/denied: checkout still allowed **only** with reason code:
  - `GPS_DENIED`, `GPS_TIMEOUT`, `DEVICE_ERROR`, `NO_SIGNAL`.

**Rationale:**
- Hard-required causes operational blocking in weak-signal areas.
- Optional without reason weakens accountability.

---

## 4) Stale Active-Visit Policy

**Decision:** Active visit auto-stales after **12 hours** from check-in if no checkout.

**Behavior:**
- System marks status `STALE_OPEN` via scheduled job.
- Stale visits cannot be used for new SO gating logic once check-in validity window is exceeded.
- Manager/Admin can close stale visit via force-checkout with reason `STALE_CLOSURE`.

**Note:** Existing 8-hour check-in validity for SO creation remains unchanged; 12-hour stale policy is for lifecycle cleanup/reporting.

---

## 5) Cross-day Checkout & Reporting Behavior

**Decision:**
- A visit belongs to **Start Date** for “Today Visits / coverage” metrics.
- Checkout completion contributes to **Checkout Date** for completion metrics.

**Reporting model:**
- Keep both `checkin_date` and `checkout_date` dimensions.
- Cross-day visits are not re-assigned; they are reported as:
  - started on Day N
  - completed on Day N+1 (if applicable)

---

## 6) Backward Compatibility for Old Visits

**Decision:** Old rows without checkout fields remain valid historical data.

**Rules:**
- New nullable columns added for checkout data.
- Legacy visits default to logical status `CHECKED_IN`/`OPEN` depending on existing status mapping.
- No mandatory backfill for photo/GPS checkout fields.
- Reports must handle `checkout_at IS NULL` safely.

---

## 7) Photo Storage Policy for Checkout Photo

**Decision:**
- Checkout photo required for normal checkout; optional for manager/admin force-checkout.
- Store under `/uploads/visits/checkout/YYYY/MM/`.
- Max size **1 MB**, JPEG/WebP accepted.
- Apply server-side watermark (timestamp + user + customer code).
- Retention follows existing visit-photo retention policy (no separate shorter retention).

---

## 8) Audit Trail Event Requirements

**Decision:** Required events:
1. `VISIT_CHECKOUT_SUCCESS`
2. `VISIT_CHECKOUT_FORCE`
3. `VISIT_CHECKOUT_GPS_MISSING`
4. `VISIT_MARKED_STALE`
5. `VISIT_REOPENED` (if reopen flow is allowed later)

**Minimum payload fields:**
- `visit_id`, `customer_id`, `actor_user_id`, `actor_role`, `event_time`
- before/after status
- GPS fields (`lat`, `lng`, `accuracy`, `gps_reason_code`)
- photo path/hash (if present)
- `override_reason` (if force action)

---

## 9) API Error Semantics (Unauthorized Access)

**Decision:**
- **403 Forbidden** when visit exists but actor lacks permission.
- **404 Not Found** when visit ID does not exist or is outside tenant/company scope.

**Rationale:**
- Keeps standard RBAC semantics for internal clients.
- Avoids cross-tenant information leak by returning 404 when resource is not in requester scope.

---

## 10) UAT Negative Cases (Must Pass)

1. STAFF attempts checkout on other staff’s active visit → **403**.
2. Checkout without active visit (already checked out/stale) → validation error.
3. GPS unavailable and no reason selected → blocked.
4. Invalid photo format or >1 MB → blocked with clear message.
5. Duplicate checkout request (double submit) → idempotent handling / single final checkout.
6. Force-checkout by MANAGER/ADMIN without override reason → blocked.
7. Checkout on non-existent visit ID → **404**.
8. Cross-tenant visit ID access → **404**.
9. Stale visit normal checkout by STAFF (after auto-stale) → blocked or requires manager flow as designed.
10. Offline sync sends outdated checkout after visit already closed → rejected gracefully with conflict message.

---

## Implementation Impact

### DB
- Add checkout columns (`checkout_at`, `checkout_photo_path`, `checkout_lat`, `checkout_lng`, `checkout_accuracy`, `gps_reason_code`, `override_by`, `override_reason`, `stale_marked_at`).
- Add status support: `OPEN`, `CHECKED_OUT`, `STALE_OPEN` (or mapped equivalent enum set).
- Indexes for reporting by `checkin_at` and `checkout_at`.

### API
- Add checkout endpoint with RBAC matrix and force-checkout path.
- Enforce error semantics (403/404) and validation for photo/GPS reason.
- Add idempotency guard for duplicate checkout submits.

### UI (Mobile/Web)
- Checkout form: photo + GPS capture + fallback reason selector.
- Manager/Admin UI: force-checkout action with mandatory reason.
- Clear stale/open state indicators and actionable error messages.

### Reporting
- Separate cards/measures: `Today Visits (Started)`, `Completed Today`, `Completion Rate`.
- Cross-day report support using both start and checkout date dimensions.
- Include stale/open aging view for supervisor cleanup.

---

## Implementation Notes (Wave B3 Alignment)

This section aligns decision intent with current implementation shape on branch `feature/visit-checkout-lifecycle`.

- **Lifecycle statuses in code:** `OPEN`, `CHECKED_OUT`, `STALE_OPEN` are implemented in checkout flow and stale-marking logic.
- **Stale transition:** stale marking is currently evaluated lazily during checkout attempt (via service guard), then persisted to `STALE_OPEN` + `staleMarkedAt` when threshold is exceeded.
- **Reporting exposure:** list endpoint (`GET /api/visits`) now exposes additive `lifecycle` fields used by BI/report consumers:
  - `status`
  - `checkInAt`, `checkoutAt`
  - `checkInDate`, `checkoutDate` (ISO date keys)
  - `isCompleted`, `isCrossDay`
  - `durationMinutes`
- **KPI responsibility split:**
  - operational dashboard cards should continue to derive **Today Visits** from `checkInDate`
  - completion cards should derive **Completed Today** from `checkoutDate`
  - **Completion Rate** should use `completed / started` for the same reporting grain/timebox
- **Compatibility:** lifecycle payload additions are additive and non-breaking for existing API consumers.

For report-specific modeling guidance, see `docs/VISIT_LIFECYCLE_REPORTING_NOTES.md`.
