# Realtime Ordering (Pusher) Plan

## Objectives
- Deliver low-latency updates between diner and admin for order submission, payment, and courier steps.
- Keep payloads small to control Pusher message counts and cost.
- Provide audible alerts on admin side for every diner-initiated event.

## Channel Topology
- `private-admin-orders` – admins subscribe after auth; receives new orders, receipts, and status changes needing attention.
- `private-order-{displayId}` – per-order channel for diner + relevant admins; carries status/payment updates, tracking link changes, and errors.
- Optional `presence-admin` if we later need operator online status; not required for MVP.
- Auth: reuse existing session/auth; sign Pusher auth via API route; block diners from admin channel.

## Event Types & Payloads
- `order.submitted` (to admin) – `{orderId, displayId, customerName, phone, locationLabel, totalAmount, submittedAt}` triggers admin audio.
- `order.status.changed` (both) – `{orderId, displayId, from, to, actorType, at, note?}` fired whenever we append to `order_events`.
- `payment.requested` (diner) – `{orderId, displayId, type: food|courier, amount, currency, qrPayload, qrExpiresAt}`.
- `payment.receipt_uploaded` (admin) – `{orderId, displayId, type, receiptUrl, uploadedAt}` admin audio.
- `payment.verified` / `payment.rejected` (both) – `{orderId, displayId, type, verifiedAt, reason?}`.
- `courier.tracking.updated` (diner) – `{orderId, displayId, vendor, trackingUrl, etaMinutes?}`.
- `order.closed` (both) – `{orderId, displayId, closedAt, finalStatus}`.
- Keep payload fields flat; no menu item arrays to keep message size down.

## Client Handling
- Admin UI: subscribe to `private-admin-orders`; show toast + play short audio (local asset) for diner-triggered events (`order.submitted`, `payment.receipt_uploaded`). Throttle audio to once per event type per order to avoid noise.
- Diner UI: subscribe to `private-order-{displayId}` post-checkout; update banners/buttons in place (payment prompts, courier payment CTA, status timeline).
- Persist last seen event id in client state to avoid duplicate toasts after reconnect.

## Cost & Reliability
- Prefer batched state fetch after critical events: send lightweight Pusher event then refetch order via API to avoid large payloads.
- Use `order_events` table as source of truth; include event id in payload so clients can de-dupe.
- Keep channel count bounded: per-order channel only while order is active; unsubscribe once `isClosed=true`.
- Use `webhook` from Pusher (if available) later to monitor failures and reconcile missed events.

## Admin Audio Cues
- Store short mp3/ogg locally (no remote fetch) and preload on admin entry.
- Map sounds:
  - New order (`order.submitted`): primary alert.
  - Receipt uploaded (`payment.receipt_uploaded`): secondary alert.
  - Optional soft chime for courier payment receipt if distinct UI needed.
- Volume control + mute toggle stored in local storage; do not auto-play on pages without user gesture until user interacts (browser autoplay rules).

## Implementation Steps
1. Configure Pusher env vars + server SDK helper.
2. Add auth endpoint for private channels; gate admin/global vs per-order.
3. Emit events from order lifecycle service (create order, update status, payment requests, receipt upload, courier updates).
4. Wire admin UI listeners with toast + audio; wire diner UI to refresh order detail on events.
5. Add minimal instrumentation/logging for failed publishes to catch quota/auth issues.
