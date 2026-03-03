# QA Visit Checkout Final (Wave C Integrator)

- Date: 2026-03-03 (Asia/Jakarta)
- Branch: `feature/visit-checkout-lifecycle`
- Base: `main`
- Verdict: **GO**

## 1) Branch Sync + A/B Commit Presence

- Sync status vs `origin/main`: `0 behind / 6 ahead`
- Verified Wave A/B chain exists on branch:
  - `c8a6d72` docs: lock visit checkout implementation decisions
  - `401285c` feat(visit): add checkout lifecycle db fields and service guards
  - `f717b91` feat(visits): add checkout API route and lifecycle fields
  - `00dc99b` docs(visits): align checkout lifecycle reporting and UAT coverage
  - `ec7e267` feat(sales-mobile): add active-visit checkout flow
  - `2155095` feat(visits): add lifecycle filters and checkout details in web visits

## 2) Full Validation

### Build
- Command: `npm run build`
- Result: ✅ PASS
- Evidence highlights:
  - Next.js build compiled successfully
  - Route present: `/api/visits/[id]/check-out`
  - Route present: `/sales-mobile/visits/[id]/checkout`
  - Route present: `/sales/visits`

### Test
- Command: `npm test`
- Result: ✅ PASS
- Summary: `5 passed files, 15 passed tests`

## 3) Targeted Regression Checks

### A. sales-mobile check-in still works
- Verified check-in form still posts to existing endpoint:
  - `src/app/sales-mobile/visits/new/sales-visit-checkin-form.tsx` → `POST /api/visits/check-in`
- API route remains intact:
  - `src/app/api/visits/check-in/route.ts`
- No build/test regressions detected.
- Status: ✅ OK

### B. sales-mobile checkout flow works with new API contract
- Mobile checkout form posts to new endpoint:
  - `src/app/sales-mobile/visits/[id]/checkout/sales-visit-checkout-form.tsx` → `POST /api/visits/{id}/check-out`
- Contract enforcement and payload validation verified in route:
  - `src/app/api/visits/[id]/check-out/route.ts`
  - Validates GPS pair / gpsReasonCode, photo mime/size, optional override and checkoutAt.
- Service behavior covered by tests:
  - `src/services/__tests__/visit-checkout.service.test.ts` (success, duplicate block, auth block, GPS reason required, manager override)
- Status: ✅ OK

### C. web visits page compiles with new columns/filters
- Web visits page includes lifecycle + checkout details columns and filters:
  - `src/app/(dashboard)/sales/visits/page.tsx`
  - Columns: status, checkOutAt, duration, checkoutDetails
  - Filters: status, salesperson (non-STAFF), dateFrom/dateTo
- Build passed including `/sales/visits` route.
- Status: ✅ OK

### D. STAFF role-scope behavior not regressed
- Scope enforcement test passed:
  - `src/services/__tests__/scope-enforcement.service.test.ts`
  - Asserts `VisitService.listVisits` forces `salespersonId` to staff viewer id.
- Checkout service test also verifies unauthorized staff checkout is blocked (403).
- Status: ✅ OK

## 4) Risks, Migration, Rollback

### Migration note
- Feature depends on checkout lifecycle fields being present in DB schema (already included in branch history).

### Risks
- Runtime photo/GPS capture quality remains device/network dependent.
- Middleware deprecation warning (`middleware` -> `proxy`) is non-blocking but should be scheduled.

### Rollback note
- Revert feature branch commits (or PR merge commit) to restore previous visit behavior.
- If schema fields were applied, rollback should preserve backward compatibility for existing check-in flow but may require follow-up migration policy depending on DB governance.

## 5) Final Decision

**GO** — Validation and targeted regressions passed; ready for PR merge review.
