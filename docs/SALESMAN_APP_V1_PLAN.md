# Salesman App v1 Plan

## Goal
Mobile-first flow for sales field operations:

`check-in -> create order -> submit -> track status`

## Scope (v1)
1. Sales dashboard (today summary + quick actions)
2. Customer list + customer detail
3. Visit check-in (photo + GPS + timestamp)
4. Quick sales order creation
5. My order list + status timeline
6. Offline-lite drafts (local save + retry sync)

## Routes
- `/sales/dashboard`
- `/sales/customers`
- `/sales/customers/[id]`
- `/sales/visits/new`
- `/sales/orders/new`
- `/sales/orders`
- `/sales/orders/[id]`

## API targets
- `GET /api/sales/dashboard`
- `GET /api/sales/customers`
- `GET /api/sales/customers/:id`
- `POST /api/sales/visits/check-in`
- `POST /api/sales/orders`
- `GET /api/sales/orders?mine=true`
- `GET /api/sales/orders/:id`

## Permission baseline
- Role: `STAFF` (salesman)
- Can access own/assigned customers and own orders
- Cannot approve orders/prices
- Cannot modify finance/HR

## Delivery phases
### Sprint 1
- Dashboard
- Customer list/detail
- Visit check-in

### Sprint 2
- Order create flow
- My orders + status
- Drafts + retry sync

### Sprint 3
- Permission hardening
- QA + polish
- UAT with sales team
