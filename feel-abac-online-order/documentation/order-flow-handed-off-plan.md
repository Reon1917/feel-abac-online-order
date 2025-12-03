# Order Flow – Handed Off for Delivery (v1)

## Scope

This spec extends the existing food receipt + kitchen flow to cover the **restaurant side of delivery** up to the point where the order is handed off to a third‑party delivery service (Bolt/Grab/etc). Delivery‑provider internals and long‑term notification system details are out of scope for this patch.

---

## High-Level Goals

- Keep the restaurant’s **responsibility boundary** clear: once an order is marked **Handed off**, the restaurant is no longer operationally responsible.
- Support attaching a **delivery tracking link** (Bolt/Grab share URL) and a **manual delivery fee** per order.
- Keep the **order status model simple** and linear for v1.
- Lay hooks for **future web push notifications** without blocking this iteration.

---

## Order Status Model (v1)

We keep a single primary `orders.status` for user/admin visibility and do **not** introduce a separate “waiting for delivery payment” status. Delivery fee settlement is treated as an internal step between “kitchen” and the final “delivered” state.

Visible status lifecycle (restaurant + diner), mapped to existing status strings:

```text
order_processing          (customer submitted)
  → awaiting_food_payment
  → food_payment_review
  → order_in_kitchen
  → order_out_for_delivery   // shown as “Handed off to delivery”
  → delivered
    or cancelled
```

Notes:

- `order_out_for_delivery` means the order has been given to the delivery provider and the restaurant is **no longer responsible** for delivery progress.
- `delivered` is the final “everything done” state (including any delivery fee settlement on the restaurant side).
- For pickup or non‑delivery flows, we may keep using `order_in_kitchen → delivered` directly if needed.

---

## Data Model

File: `src/db/schema.ts`

- We **reuse existing fields** instead of adding new columns:
  - `orders.courierTrackingUrl` (nullable text)  
    - Third‑party share/tracking URL from Bolt/Grab/etc.
  - `orders.deliveryFee` (nullable numeric, THB)  
    - Manually entered delivery fee for this order (what the diner pays the courier).
  - `orders.outForDeliveryAt` (timestamp)  
    - Set when the order is handed off to the courier.
- Status values:
  - `order_out_for_delivery` represents “Handed off to delivery”.
  - `delivered` remains the terminal state for completed orders.
- `order_events`:
  - We reuse the existing `status_updated` event type to record the handoff, with metadata for `courierTrackingUrl` and `deliveryFee`.

---

## Backend: Status Transitions & API

### Admin Status API

File: `app/api/admin/orders/[displayId]/status/route.ts`

- The handler supports actions:
  - `"accept"` → `order_processing → awaiting_food_payment` (creates food payment QR).
  - `"handed_off"` → `order_in_kitchen → order_out_for_delivery`.
  - `"delivered"` → `order_out_for_delivery → delivered` (or `order_in_kitchen → delivered` for pickup).
  - `"cancel"` → terminal `cancelled`.

Transition rules:

- `"handed_off"`:
  - Allowed only from `order_in_kitchen`.
  - **Required payload fields**:
    - `courierTrackingUrl` – non‑empty string; treated as Bolt/Grab share link.
    - `deliveryFee` – non‑negative THB amount (number or numeric string).
  - Optional payload:
    - `courierVendor` – e.g. `"Grab"` or `"Bolt"`.
  - Behavior:
    - Persist `courierTrackingUrl`, `courierVendor`, and `deliveryFee` into the `orders` record.
    - Set `orders.status = 'order_out_for_delivery'`.
    - Set `orders.outForDeliveryAt = now`.
    - Append `order_events` with `eventType = 'status_updated'` and metadata containing `courierVendor`, `courierTrackingUrl`, and `deliveryFee`.
    - Broadcast `order.status.changed` so admin and diner UIs update.

- `"delivered"`:
  - Allowed from `order_out_for_delivery` (delivery) or `order_in_kitchen` (pickup).
  - Behavior:
    - Update `orders.status = 'delivered'`.
    - Set `deliveredAt`, `isClosed = true`, `closedAt = now`.
    - Append `order_events` with `eventType = 'order_delivered'`.
    - Broadcast both `order.status.changed` and `order.closed` for websocket cleanup.

Authorization:

- Reuse existing admin guards:
  - Only authenticated admins can transition to `HANDED_OFF` or `COMPLETED`.

Cron / cleanup:

- Keep existing auto‑delete cron behavior:
  - Do **not** hard‑delete on `delivered`; instead:
    - Use the current retention window to decide when to delete transient data.
    - `order_events` keeps critical events (`order_submitted`, `order_delivered`, etc.) for history while transient events are cleaned up.

---

## Admin UI – Actions & Badges

### Orders List & Detail

Files (likely):  
- `app/[lang]/admin/orders/page.tsx`  
- Any admin order detail / drawer component used for actions.

Changes:

- Status labels:
  - `order_out_for_delivery` is labeled “Handed off to delivery” in admin and diner dictionaries.
- Badges:
  - `order_out_for_delivery`: neutral/greenish style, label “Handed off to delivery”.
  - `delivered`: success/green style, label “Delivered”.
  - Derived metrics treat `order_processing`, `awaiting_food_payment`, `food_payment_review`, `order_in_kitchen`, and `order_out_for_delivery` as active; `delivered` / `cancelled` are terminal.

### Handed Off Action

Admin flow to move an order to `order_out_for_delivery` (“Handed off”):

-- UI:
  - When status is `order_in_kitchen`, show a “Hand off to delivery” section in the admin order detail modal.
  - Inputs:
    - `courierVendor` (optional text: Grab / Bolt / etc.).
    - `deliveryFee` (numeric, THB).
    - `courierTrackingUrl` (URL – Bolt/Grab share link).
  - Validate inputs client‑side before submit (non‑negative fee, non‑empty tracking link).
- API call:
  - PATCH `/api/admin/orders/[displayId]/status` with:
    - `action: "handed_off"`
    - `courierVendor`
    - `courierTrackingUrl`
    - `deliveryFee`
  - Handle backend validation errors with inline messages/toasts.
- Realtime:
  - On success, rely on `order.status.changed` broadcast to update the admin list/status badge.

### Mark as Completed Action

Admin flow to close the order:

- UI:
  - When status is `order_out_for_delivery`, show a “Mark as delivered” button in the admin order detail modal.
  - Copy clarifies that delivery has finished and the order will be closed.
- API call:
  - PATCH `/api/admin/orders/[displayId]/status` with:
    - `action: "delivered"`
- Realtime:
  - `order.status.changed` + `order.closed` events update all admin and diner views and allow clients to unsubscribe from the order channel.

---

## Diner UI – Status & Tracking

Files (likely):  
- `app/[lang]/orders/page.tsx`  
- `app/[lang]/orders/[displayId]/page.tsx`  
- `components/orders/orders-client.tsx`

### Status Labels

- Ensure the status → label mapping includes:
  - `order_out_for_delivery` → localized “Handed off to delivery”.
  - `delivered` → localized “Delivered”.
- Tab grouping:
  - “Ongoing” should include `order_processing`, `awaiting_food_payment`, `food_payment_review`, `order_in_kitchen`, `order_out_for_delivery`.
  - “Completed” should include `delivered`.
  - “Cancelled” tab remains for `cancelled`.

### Delivery Tracking Link

- When `orders.status = 'order_out_for_delivery'`:
  - Show status text “Handed off to delivery”.
  - If `courierTrackingUrl` is present:
    - Render a “Track delivery” button/link using that URL.
    - Copy example: “Track your delivery in Bolt/Grab”.
  - If `courierTrackingUrl` is missing:
    - Either hide the button or show neutral helper text like “Delivery is in progress with our driver”.

### Dictionaries / i18n

- Files: `dictionaries/*`
  - Keys and translations:
    - Status labels: `statusOutForDelivery` → “Handed off to delivery”.
    - UI copy: `trackDelivery` → “Track delivery”, plus any helper text as needed.

---

## Realtime Updates & WebSocket Lifecycle

Existing architecture uses Pusher for realtime order updates.

### Realtime Events

- On server‑side status changes to:
  - `order_out_for_delivery`
  - `delivered`
  - `cancelled`
- Emit existing Pusher events:
  - `order.status.changed` when status changes.
  - `order.closed` when status becomes `delivered` or `cancelled`.

### Client Handling

- Admin clients:
  - Update order list rows and badges when `order_out_for_delivery` / `delivered` events arrive.
  - Close or disable actions that are no longer valid after completion.
- Diner clients:
  - If a diner is viewing the order detail page:
    - Update the visible status and “Track delivery” button when `order_out_for_delivery` arrives.
    - When `delivered` arrives, show final “Delivered” UI and stop any further polling.

### Channel Teardown

- When an order transitions to `delivered` or `cancelled`:
  - Diner and admin clients should unsubscribe from the order’s Pusher channel (or equivalent).
  - This keeps open connections minimal and matches the “order is now final” semantics.

---

## TODO – Web Push Notifications (Next Patches)

We intentionally **do not** implement web push notifications in this patch but design the flow so they can be layered on later.

TODO items for future patches:

- Diner notifications:
  - Notify when:
    - `PAYMENT_UNDER_REVIEW → PAID`
    - `PAID → IN_KITCHEN`
    - `IN_KITCHEN → HANDED_OFF`
    - `HANDED_OFF → COMPLETED`
  - Notify if receipt upload is rejected (tie into existing food receipt flow).
- Admin notifications:
  - Notify when:
    - New receipt is uploaded for an order in `PENDING_PAYMENT` / `PAYMENT_UNDER_REVIEW`.
    - Orders stay too long in `IN_KITCHEN` without progressing.
- Implementation sketch:
  - Reuse Pusher channels for in‑app notifications, and/or:
    - Implement Web Push (VAPID) endpoints under `app/api/notifications/*`.
  - Store per‑user notification preferences and topics.

See also: `documentation/pushwoosh-notification-plan.md` for broader notification strategy.

---

## TODO – Receipt Upload UX Recheck

After this patch lands, re‑audit the food receipt upload flow to ensure consistent status transitions:

- `PENDING_PAYMENT` → `PAYMENT_UNDER_REVIEW` when receipt uploaded.
- `PAYMENT_UNDER_REVIEW` → `PAID`/`IN_KITCHEN` after admin confirms (depending on current naming).
- Confirm:
  - UI messages are still correct when an order later enters `HANDED_OFF`.
  - No assumptions exist that “kitchen” is the final state.

Relevant doc: `documentation/food-receipt-upload-plan.md`.

---

## TODO – Admin Status Badges & Metrics Audit

Before shipping to production:

- Audit all admin views that depend on `orders.status`:
  - Lists, filters, dashboards, charts, and summaries.
- Ensure:
  - New statuses `HANDED_OFF` and `COMPLETED` are displayed with correct labels and colors.
  - “Active orders” logic excludes terminal statuses (`COMPLETED`, `CANCELLED`).
  - Any performance or SLA metrics are updated to include/exclude `HANDED_OFF` appropriately.
