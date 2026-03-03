# QA Wave 2 Final (Short Pass)

Date: 2026-03-03 (Asia/Jakarta)
Branch: `hardening/stabilization-v1.1`

## Scope
Final QA pass after Wave 2 security fixes, focused on:
- build/tests
- STAFF scope behavior on selected APIs
- sales-mobile compile/render paths (regression smoke)

## What Was Tested

### 1) Build / Tests
- ✅ `npm run build` passed.
  - Notes: one non-blocking Next.js warning about deprecated `middleware` convention (use `proxy`), but build completed successfully.
- ✅ `npm test` passed.
  - Result: 4 test files, 10 tests passed.

### 2) STAFF Scope Smoke (code-level + endpoint-level feasible)
Reviewed route handlers and service enforcement for:

- Sales Orders
  - `GET /api/sales-orders` and `GET /api/sales-orders/[id]`
  - Route passes `viewer: { id, role }` into service.
  - Service enforces STAFF visibility via createdBy/salesperson ownership checks.

- Delivery Orders
  - `GET /api/delivery-orders` and `GET /api/delivery-orders/[id]`
  - Route passes `viewer` into service.
  - Service enforces STAFF visibility via linked SO ownership checks.

- Invoices
  - `GET /api/invoices`, `GET /api/invoices/[id]`, `GET /api/invoices/[id]/payments`, `GET /api/invoices/aging`
  - Route passes `viewer` into Invoice/Payment services.
  - Service enforces STAFF visibility for list/get/payment access by linked SO ownership.
  - Aging endpoint restricted to ADMIN/MANAGER (STAFF forbidden).

- Visits
  - `GET /api/visits`
  - Route passes `viewer` into service.
  - Service forces `salespersonId = viewer.id` for STAFF.

### 3) Existing automated coverage relevant to scope
- `src/services/__tests__/scope-enforcement.service.test.ts` passes and validates:
  - SO list staff scoping
  - Visit list staff scoping
  - Invoice aging role restriction
  - DO get unauthorized staff access denied

### 4) Sales-mobile regression smoke (compile/render paths)
- ✅ Production build includes and compiles sales-mobile pages/routes:
  - `/sales-mobile`, `/sales-mobile/dashboard`, `/sales-mobile/orders`, `/sales-mobile/orders/[id]`, `/sales-mobile/orders/new`, `/sales-mobile/customers`, `/sales-mobile/customers/[id]`, `/sales-mobile/visits/new`
- No compile-time regression observed in this short pass.

## Pass/Fail Summary
- Build: **PASS**
- Tests: **PASS**
- STAFF scope smoke (target routes/services): **PASS**
- Sales-mobile compile/render-path smoke: **PASS**

## Known Risks / Limits
- This pass is primarily build + unit + code-level scope verification; no full end-to-end authenticated runtime API calls were executed against a seeded environment.
- Next.js warning for deprecated middleware convention is non-blocking now, but should be migrated to avoid future breakage.

## Final Verdict
**GO**
