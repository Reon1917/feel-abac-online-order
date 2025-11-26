# Pushwoosh Notification Plan

## Objectives
- Layer push notifications on top of Pusher events for diner updates and critical admin alerts.
- Respect locale and opt-in while avoiding duplicate notifications when the app is already in focus.

## Triggers
- Diner-facing: `payment.requested`, `payment.rejected`, `payment.verified`, `order.status.changed` (kitchen → ready, ready → out_for_delivery), `courier.tracking.updated`.
- Admin-facing (optional): new order submitted, receipt uploaded when no admin tab active.
- Use `order_events` stream to enqueue notifications; include event id to prevent repeats.

## Payload Design
- Title/body keyed off dictionary entries for `en`/`mm`; include `displayId` and concise CTA text.
- Deep links: `withLocalePath("/menu/orders/{displayId}")` for diners; `withLocalePath("/admin/orders/{displayId}")` for admins.
- Data payload: `{eventId, orderId, displayId, type, status, trackingUrl?}` kept small.

## Delivery Strategy
- Register devices after login/onboarding; store `pushwooshDeviceId` on profile/session.
- Suppress pushes when a live Pusher connection for that user is active and page visible; otherwise deliver.
- Batch low-priority updates (e.g., kitchen in-progress) to reduce noise; send immediate for payment requests and courier updates.

## Implementation Notes
- Add server helper to map order events → Pushwoosh create message calls with platform segmentation.
- Keep feature-flag (`PUSHWOOSH_ENABLED`) to disable on staging.
- Audit logging: persist sent notification meta to `order_events.metadata` for traceability.

## Open Questions
- Do we send courier location updates if provider supports webhooks? If yes, rate-limit to avoid spam.
- Should admins receive pushes on mobile, or keep them web-only?
