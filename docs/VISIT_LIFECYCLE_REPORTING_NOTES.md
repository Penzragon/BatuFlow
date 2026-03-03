# Visit Lifecycle Reporting Notes

**Status:** Draft for Wave B3 (reporting alignment)  
**Branch:** `feature/visit-checkout-lifecycle`  
**Date:** 2026-03-03

## 1) Purpose

Define how visit lifecycle fields should be interpreted in reporting so KPI numbers stay consistent across dashboard, exports, and ad-hoc analysis.

## 2) Canonical Lifecycle Semantics

A visit has two key timestamps:
- `checkInAt` → start of activity
- `checkoutAt` → completion of activity (nullable)

Lifecycle status intent:
- `OPEN` → started, not completed, still within stale window
- `CHECKED_OUT` → completed
- `STALE_OPEN` → started but not completed after stale threshold

## 3) API Fields for Report Consumers

`GET /api/visits` returns additive `lifecycle` fields per item:
- `status`
- `checkInAt`
- `checkoutAt`
- `checkInDate` (`YYYY-MM-DD`)
- `checkoutDate` (`YYYY-MM-DD`, nullable)
- `isCompleted` (`boolean`)
- `isCrossDay` (`boolean`)
- `durationMinutes` (`number | null`)

These are derived fields for consumer convenience and should be considered report-safe.

## 4) KPI Definitions (Locked)

### A. Today Visits (Started)
Count visits where `checkInDate = report_date`.

### B. Completed Today
Count visits where `checkoutDate = report_date`.

### C. Completion Rate
`Completed / Started` in the same grain (day/branch/salesperson scope).

Recommended behavior:
- If denominator (`Started`) is 0, return `0` or `null` by dashboard standard; avoid divide-by-zero.

## 5) Cross-day Handling

Cross-day visit = `checkInDate != checkoutDate` and `checkoutAt` not null.

Reporting rules:
- Coverage/activity metrics stay on **start date**.
- Completion metrics stay on **checkout date**.
- Do not re-assign start metrics to completion date.

## 6) Open/Stale Monitoring KPIs (Optional but Recommended)

For supervisory hygiene:
- `Open Visits Aging` = open/stale visits grouped by age bucket (`<4h`, `4-8h`, `8-12h`, `>12h`)
- `Stale Open Count` = `status = STALE_OPEN`
- `Force Checkout Count` = visits with `overrideBy` populated

## 7) SQL/BI Mapping Guidance

Minimal modeled columns in semantic layer:
- `visit_id`
- `salesperson_id`
- `customer_id`
- `status`
- `checkin_ts`
- `checkout_ts`
- `checkin_date`
- `checkout_date`
- `is_completed`
- `is_cross_day`
- `duration_minutes`
- `override_by`
- `override_reason`

Derived examples:
- `started_flag = 1`
- `completed_flag = case when checkout_ts is not null then 1 else 0 end`

## 8) Data Quality Checks

Add recurring checks:
1. `status = CHECKED_OUT` but `checkoutAt is null` → invalid
2. `checkoutAt < checkInAt` → invalid
3. `isCrossDay = true` while `checkoutAt is null` → invalid
4. excessive duration outliers (e.g., `> 24h`) → investigate

## 9) Backward Compatibility

Legacy rows with null checkout are valid historical data.

Consumer expectations:
- Null `checkoutAt` is normal for open/legacy visits.
- Do not coerce null completion fields into fake dates.

## 10) UAT Traceability

UAT steps covering these semantics are documented in:
- `docs/QA_VISIT_CHECKOUT_UAT.md`
