# SECURITY_SCOPE_AUDIT

## Scope
Audit of API endpoints under:
- `sales` (implemented as `sales-orders`)
- `sales-mobile`
- `visits`
- `invoices`
- `delivery` (implemented as `delivery-orders`)

Focus: server-side role/ownership checks for STAFF data scoping.

## Endpoint Audit Table

| Endpoint | Method | Expected scope | Current server-side state | State |
|---|---|---|---|---|
| `/api/sales-orders` | GET | STAFF: only own SOs (created by staff or assigned customer). MANAGER/ADMIN: all. | Only `getCurrentUser()` at route; `SalesOrderService.listSOs()` has no viewer-based restriction. STAFF can list broad dataset unless client sends filter. | **GAP** |
| `/api/sales-orders` | POST | STAFF: allowed only for own assigned customer. MANAGER/ADMIN: allowed. | `createSO()` enforces STAFF customer ownership (`customer.salespersonId === userId`). | OK |
| `/api/sales-orders/[id]` | GET | STAFF: own SO only. MANAGER/ADMIN: all. | `getSO(id, viewer)` denies STAFF when `so.createdBy !== viewer.id`. | OK (partial model) |
| `/api/sales-orders/[id]` | PUT | STAFF: own DRAFT SO only. MANAGER/ADMIN: broader by policy. | Route passes user, but `updateSO()` does not check owner/role; only checks status DRAFT. Any authenticated user with ID can update. | **GAP** |
| `/api/sales-orders/[id]/confirm` | POST | STAFF: own SO only. MANAGER/ADMIN: broader by policy. | `confirmSO()` has no ownership/role check; any authenticated user can confirm any DRAFT SO by ID. | **GAP** |
| `/api/sales-orders/[id]/cancel` | POST | STAFF: own SO only. MANAGER/ADMIN: all valid statuses. | `cancelSO()` has no ownership/role check. | **GAP** |
| `/api/sales-orders/[id]/approve` | POST | MANAGER/ADMIN only. | Route enforces `requireRole(["ADMIN","MANAGER"])`. | OK |
| `/api/sales-orders/[id]/reject` | POST | MANAGER/ADMIN only. | Route enforces `requireRole(["ADMIN","MANAGER"])`. | OK |
| `/api/sales-mobile/dashboard` | GET | STAFF: own KPI slice; MANAGER/ADMIN: all. | Route restricts roles; service applies staff scope (`createdBy` / `customer.salespersonId`, visit salesperson filter, invoice scoped by linked SO/customer). | OK |
| `/api/sales-mobile/orders` | POST | STAFF: create order only for own assigned customer. MANAGER/ADMIN: allowed. | Role whitelist at route + `createSO()` ownership check on customer. | OK |
| `/api/visits` | GET | STAFF: own visits only unless manager/admin. | Route only authenticates; `listVisits()` has optional `salespersonId` filter but no forced viewer scope. STAFF can query broad visits. | **GAP** |
| `/api/visits/active` | GET | STAFF: own active visit only. MANAGER/ADMIN: by policy. | Uses `getActiveVisit(customerId, user.id)` so scoped to requesting salesperson. | OK |
| `/api/visits/check-in` | POST | STAFF: check in only on own assigned customer. | `checkIn()` validates customer active + for STAFF enforces `customer.salespersonId === salespersonId`; salespersonId derived from session user. | OK |
| `/api/invoices` | GET | STAFF: only invoices linked to own customers/SOs. MANAGER/ADMIN: all. | Only `getCurrentUser()`; `listInvoices()` has no viewer scope. | **GAP** |
| `/api/invoices` | POST | STAFF: only invoice from own scoped DO/SO/customer (or manager/admin only, depending policy). | `createInvoice()` validates DO status only; no role/ownership scoping to requester. | **GAP** |
| `/api/invoices/[id]` | GET | STAFF: own scoped invoice only. MANAGER/ADMIN: all. | `getInvoice()` has no viewer scope. | **GAP** |
| `/api/invoices/[id]/issue` | POST | Prefer MANAGER/ADMIN (or finance role) due billing state transition. | Only `getCurrentUser()`; `issueInvoice()` no role/ownership restriction. | **GAP** |
| `/api/invoices/[id]/payments` | GET | STAFF: only own scoped invoice payments (or manager/admin only). | Only `getCurrentUser()`; `listPaymentsForInvoice()` no viewer scope. | **GAP** |
| `/api/invoices/aging` | GET | MANAGER/ADMIN only (portfolio-wide AR view). | Only `getCurrentUser()`; `getAgingReport()` is global. | **GAP** |
| `/api/delivery-orders` | GET | STAFF: only DOs linked to own SO/customer. MANAGER/ADMIN: all. | Only `getCurrentUser()`; `listDOs()` no viewer scope. | **GAP** |
| `/api/delivery-orders` | POST | STAFF: only create DO for own scoped SO/customer. MANAGER/ADMIN: allowed. | `createDO()` validates SO existence/status only; no ownership/role check. | **GAP** |
| `/api/delivery-orders/[id]` | GET | STAFF: own scoped DO only. MANAGER/ADMIN: all. | `getDO()` has no viewer scope. | **GAP** |
| `/api/delivery-orders/[id]/confirm` | POST | STAFF: own scoped DO only (or manager/admin/warehouse by policy). | `confirmDO()` enforces status only; no role/ownership check. | **GAP** |

## Findings Summary
- **Strong points:**
  - Explicit manager/admin-only checks exist for SO approval/rejection.
  - Staff ownership checks exist in selected flows (`SalesOrderService.createSO`, `SalesOrderService.getSO`, `VisitService.checkIn`, `SalesMobileDashboardService`).
- **Main weakness:**
  - Many list/read/state-transition endpoints rely on authentication only (`getCurrentUser`) without binding query/object access to the requester’s role and ownership.
  - Authorization is inconsistent: some checks are route-level role checks, some are service-level ownership checks, and many endpoints have neither.

## Recommended Fix List (Prioritized)

### P0 (Immediate)
1. **Enforce viewer scope in all sales-orders write/list actions**
   - Add centralized scope enforcement in `SalesOrderService.listSOs/updateSO/confirmSO/cancelSO`.
   - Rule: STAFF can access only records where `createdBy = user.id` OR `customer.salespersonId = user.id` (choose canonical rule and apply consistently).
2. **Lock down delivery-orders by ownership/role**
   - Add viewer context to `listDOs/getDO/createDO/confirmDO` and enforce SO/customer ownership for STAFF.
3. **Lock down invoices by ownership/role**
   - Add viewer context to `listInvoices/getInvoice/createInvoice/issueInvoice/listPaymentsForInvoice/getAgingReport`.
   - At minimum, prevent STAFF from global invoice visibility and unauthorized issuance.

### P1 (High)
1. **Define and codify authorization matrix per endpoint/action**
   - Document exact permissions for STAFF vs MANAGER/ADMIN (and finance/warehouse if applicable).
   - Convert matrix into reusable guards/policy helpers to avoid drift.
2. **Move authorization to shared service-layer guards**
   - Keep route checks lightweight; enforce object-level rules in service methods where DB operations happen.
3. **Add regression tests for scope boundaries**
   - Negative tests: STAFF cannot read/update/confirm/cancel others’ resources.
   - Positive tests: STAFF can operate on own scoped resources.

### P2 (Medium)
1. **Standardize “not found vs forbidden” behavior**
   - Keep leakage-resistant responses consistent across modules.
2. **Audit adjacent endpoints for same pattern**
   - Apply same scope review to payments/reports/dashboard endpoints beyond this target set.
3. **Add audit log metadata for authorization decisions**
   - Include policy decision context (allowed/denied reason) where feasible.

## Notes
- This report is based on code-path inspection of API routes and service methods in current branch.
- No production code changes were made in this audit run.

## Remediation Update (2026-03-03)

### Implemented P0 scope fixes

- **sales-orders**
  - Added STAFF object-scope enforcement in service layer for `listSOs`, `updateSO`, `confirmSO`, `cancelSO`, and aligned `getSO` with canonical access rule:
    - allowed when `createdBy === staff.id` **or** `customer.salespersonId === staff.id`.
  - Route list endpoint now passes viewer context into service.

- **delivery-orders**
  - Added STAFF scope enforcement in service layer for `listDOs`, `getDO`, `createDO`, and `confirmDO` using linked SO/customer ownership.
  - Route list/get endpoints now pass viewer context into service.

- **invoices**
  - Added STAFF scope enforcement in service layer for `listInvoices`, `getInvoice`, `createInvoice`, `issueInvoice` using linked DO -> SO/customer ownership.
  - Added STAFF scope enforcement for invoice payments listing via `PaymentService.listPaymentsForInvoice`.
  - Restricted `getAgingReport` to `ADMIN/MANAGER` with explicit 403.
  - Route list/get/payments/aging endpoints now pass viewer context.

- **visits**
  - Added STAFF scope enforcement in service layer for `listVisits`; STAFF is hard-scoped to own `salespersonId` regardless of query param.
  - Route list endpoint now passes viewer context.

### 403/404 behavior

- For STAFF unauthorized object access in SO/DO/Invoice/Payment object reads and state transitions, service returns **not found** style errors to avoid object existence leakage.
- For restricted portfolio-level report (`/api/invoices/aging`), service returns explicit **403 Forbidden** for non `ADMIN/MANAGER`.

### Regression coverage added

- New focused tests in `src/services/__tests__/scope-enforcement.service.test.ts`:
  - staff scope filter applied on SO listing
  - visit list forced to own salespersonId for STAFF
  - aging report denied for STAFF (403)
  - unauthorized DO access hidden as not found

### Remaining risks / follow-up

- Route-layer error mapping still defaults plain `Error` to 500 unless status is attached. Most scope-deny paths intentionally use not-found errors for leakage resistance, but broader API error normalization (e.g., explicit 404 for all not-found errors) can still be improved globally.
- `sales-mobile` and non-P0 adjacent reporting surfaces should be re-audited for the same viewer-context pattern drift as part of P1/P2.
