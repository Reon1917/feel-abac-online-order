# Order Schema Plan

## Objectives
- Capture diner contact + delivery context (preset location or custom pin) at order creation.
- Support admin-friendly IDs (`OR0001`) plus immutable UUIDs.
- Model dual payments (food + courier) with receipt upload, QR payloads, and review timestamps.
- Preserve a full snapshot of menu items/choices/notes per order to stay stable even if menu changes.
- Track status transitions with auditable history for realtime fan-out.
- Enforce business rule: **no refunds in-system after any payment is made**.

## Status Model
- Primary order status (enum-ish text) aligned to current flow:
  - `order_processing` (customer submitted).
  - `awaiting_food_payment`.
  - `food_payment_review` (optional intermediate while admin checks receipt).
  - `order_in_kitchen` after food payment verified.
  - `order_out_for_delivery` can be set once kitchen finishes, regardless of courier payment.
  - `awaiting_delivery_fee_payment` can coexist with `order_out_for_delivery` (courier fee may be unpaid).
  - `delivered` terminal when courier fee paid/verified and delivery confirmed.
  - Escape hatches: `cancelled` / `rejected`.
- Payment status per charge: `pending` (QR shown) → `receipt_uploaded` → `verified` → `failed/rejected`.
- Derived flags on `orders`: `isClosed`, `closedAt`, `cancelledAt`, `resolvedByAdminId` for quick querying; authoritative history lives in `order_events`.

## Tables
- `orders`
  - `id` (uuid pk), `displayId` (text unique, OR-prefixed counter), `cartId` (uuid, snapshot source), `userId` (text nullable), `sessionToken` (text nullable for guest), `status` (text), `totalItems`, `subtotal`, `deliveryFee`, `discountTotal`, `totalAmount`, `currency` (default THB).
  - Contact + delivery: `customerName`, `customerPhone`, `deliveryMode` (`preset`|`custom`), `deliveryLocationId`, `deliveryBuildingId`, `customCondoName`, `customBuildingName`, `customPlaceId`, `customLat`, `customLng`, `deliveryNotes`.
  - Ops metadata: `orderNote` (diner), `adminNote`, `kitchenStartedAt`, `readyAt`, `sentAt`, `deliveredAt`, `closedAt`, `cancelledAt`, `cancelReason`.
  - Courier: `courierVendor`, `courierTrackingUrl`, `courierEtaMinutes`, `courierFee` (numeric, manually input after courier booked; immutable once quoted/QR shown), `courierPaymentStatus` mirror of payment table for quick reads.
  - Timestamps: `createdAt`, `updatedAt`.
- `order_items`
  - Snapshot of cart lines: `orderId` fk, `menuItemId`, `menuItemName`, `menuItemNameMm`, `menuCode`, `basePrice`, `addonsTotal`, `quantity`, `note`, `totalPrice`, `displayOrder`.
- `order_item_choices`
  - `orderItemId` fk, `groupName`, `groupNameMm`, `optionName`, `optionNameMm`, `extraPrice`.
- `order_payments`
  - One row per charge: `id` (uuid), `orderId` fk, `type` (`food`|`courier`), `amount`, `currency`, `status` (payment status above), `qrPayload` (PromptPay string), `qrExpiresAt`, `receiptUrl`, `receiptUploadedAt`, `verifiedAt`, `verifiedByAdminId`, `rejectedReason`, `requestedByAdminId`, `createdAt`, `updatedAt`.
  - Keeps `paymentIntentId`/`promptParseData` text if we store parsed payload for regeneration.
- `order_events`
  - Append-only log for status + payment transitions: `id`, `orderId`, `actorType` (`admin`|`user`|`system`), `actorId`, `eventType` (e.g., `order_submitted`, `status_updated`, `payment_requested`, `receipt_uploaded`, `payment_verified`, `courier_tracking_updated`), `fromStatus`, `toStatus`, `metadata` (json), `createdAt`.
- `order_receipts` (optional if we prefer multiple uploads)
  - Allows multiple receipt attempts: `id`, `orderPaymentId`, `fileUrl`, `uploadedByUserId`, `note`, `createdAt`.

## Data Flow (happy path)
1. Diner submits cart → create `orders` + `order_items` + `order_item_choices` snapshot with `status=order_processing`.
2. Admin reviews card → sets `awaiting_food_payment` and creates `order_payments` row with PromptPay QR payload.
3. Diner uploads receipt → `order_payments.status=receipt_uploaded`; admin verifies → `status=verified`, `orders.status=order_in_kitchen`.
4. Admin marks ready/outbound → set `order_out_for_delivery`; optionally create courier payment request (`awaiting_delivery_fee_payment`) while food travels.
5. Diner pays courier fee (if requested) → admin verifies → confirm `order_out_for_delivery` + courier payment status; set `delivered` + `closedAt` when handed off/confirmed.

## Constraints & Notes
- Generate `displayId` via DB sequence + `OR` prefix to avoid race conditions; keep UUID for relations.
- Always persist localized names + codes from menu snapshot to avoid joins to mutable menu tables.
- Keep amounts as numeric(10,2) THB; totals stored on `orders` for fast reads.
- Courier fee is set only after courier booking (accurate quote) and **cannot be edited** once the first QR/payment request is shown.
- Use `order_events` for audit + realtime payload source; derive notifications from it.
- Store lat/lng with numeric precision similar to `user_profiles` for consistency.

## Open Questions
- None currently; courier fee editability closed (immutable after quote/QR).
