# Visit Checkout API Test Notes (Phase A2)

## Covered in this wave

- Service-level checkout tests updated in `src/services/__tests__/visit-checkout.service.test.ts`:
  - Owner checkout success
  - Duplicate checkout blocked
  - STAFF checkout on another STAFF visit returns forbidden error
  - GPS missing without reason is blocked
  - MANAGER force-checkout with reason succeeds and appends checkout notes

## Endpoint contract checks to run manually/integration

1. `POST /api/visits/[id]/check-out`
   - Accepts multipart/form-data
   - GPS can be omitted only when `gpsReasonCode` is provided
   - `photo` accepts jpeg/jpg/webp and max 1 MB
   - Supports optional `notes`, `checkoutAt`, `overrideReason`
2. `GET /api/visits`
   - Preserves existing response fields
   - Adds additive `lifecycle` object per item: `{ status, checkInAt, checkoutAt, checkInDate, checkoutDate, isCompleted, isCrossDay, durationMinutes }`
3. `GET /api/visits/active`
   - Uses OPEN lifecycle semantics (`status=OPEN` and `checkoutAt=null`)

