# Realtime Ordering (Pusher) Plan

## Objectives
- Deliver low-latency updates between diner and admin for order submission, payment, and courier steps.
- Keep payloads small to control Pusher message counts and cost.
- Provide audible alerts on admin side for every diner-initiated event.

## MVP Scope (now)
- Diner submits order; admin receives realtime card + can accept or cancel.
- Status changes (accept → `order_in_kitchen` or cancel) reflect on both diner and admin UIs instantly.
- No payment flows yet; keep payloads minimal and reuse order displayId.

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

## Coding Plan (MVP: submit + accept/cancel)
- **Env & config**
  - Add `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` to `.env.local.example`.
  - Create `lib/pusher-server.ts` exporting configured Pusher server client (lazy singleton).
  - Create `lib/pusher-client.ts` wrapping the browser SDK; guard to only load in client components.
  - Add `lib/pusher-channels.ts` helpers to build channel names (`private-admin-orders`, `private-order-${displayId}`).
- **Auth endpoint**
  - New route `app/api/pusher/auth/route.ts` that validates session/admin status, authorizes `private-admin-orders` only for admins, per-order channel for diners/admins tied to that order.
  - Return `{ auth }` payload expected by Pusher; use existing session lookup utilities.
- **Server emitters**
  - Add small helper `emitOrderEvent({ displayId, type, payload })` that publishes to both channels where needed.
  - On order creation: emit `order.submitted` to `private-admin-orders` and `private-order-{displayId}`.
  - On admin accept: update DB (`orders.status = 'order_in_kitchen'`), write `order_events`, emit `order.status.changed`.
  - On admin cancel: update DB (`status = 'cancelled'` + reason), write `order_events`, emit `order.status.changed`.
- **UI wiring**
  - Diner page (order confirmation view): subscribe to `private-order-{displayId}` via `pusher-client`, update local status state on `order.status.changed`.
  - Admin orders list/detail: subscribe to `private-admin-orders`; on `order.submitted` prepend card, on `order.status.changed` update card state; play audio on `order.submitted`.
  - Keep subscriptions inside client components with cleanup; expose `usePusherChannel` hook for reuse.
- **Safety & costs**
  - Payloads limited to `{ orderId, displayId, status, fromStatus, actorType, at, reason? }`.
  - Use server-side fetch after receiving an event to refresh full order state instead of sending bulky payloads.
  - Unsubscribe from per-order channel once `isClosed` is true.

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
