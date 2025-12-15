# Push Notifications Implementation Plan

## Overview
Web push notifications for order status updates using **PushAlert** (3000 subscriber free tier).

**Strategy:** Subscribe on order creation, unsubscribe on order completion. Keeps active subs under limit.

---

## Notification Events

| Status Change | Title | Body |
|--------------|-------|------|
| `awaiting_payment` | Order Accepted ✓ | Pay ฿{total} to confirm your order |
| `order_in_kitchen` | Payment Confirmed 🍳 | Your order is being prepared |
| `cancelled` | Order Cancelled | Your order has been cancelled |
| `order_out_for_delivery` | On the Way 🛵 | Your order is out for delivery |
| `delivered` | Delivered ✓ | Thank you for ordering! |

---

## Implementation Phases

### Phase 1: PushAlert Setup
- [ ] Create PushAlert account, get API keys
- [ ] Add PushAlert SDK script to `app/layout.tsx`
- [ ] Configure manifest via PushAlert dashboard (handles PWA + iOS)
- [ ] Test add-to-homescreen prompt on iOS

### Phase 2: Subscription Management
- [ ] Add `push_subscriptions` table:
  ```sql
  push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    pushalert_subscriber_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  )
  ```
- [ ] `POST /api/push/subscribe` - Store PushAlert subscriber ID after permission granted
- [ ] `DELETE /api/push/unsubscribe` - Mark inactive on order completion

### Phase 3: Send Notifications
- [ ] `lib/push/send.ts` - PushAlert API wrapper
- [ ] Integrate into existing status change handlers:
  - `api/admin/orders/[displayId]/status/route.ts` (accept → awaiting_payment)
  - `api/admin/orders/[displayId]/verify-payment/route.ts` (→ order_in_kitchen)
  - `api/admin/orders/[displayId]/status/route.ts` (handed_off → out_for_delivery)
  - `api/admin/orders/[displayId]/status/route.ts` (delivered + unsubscribe)

### Phase 4: Client UX
- [ ] Permission prompt on order status page (first visit after order placed)
- [ ] "🔔 Notifications enabled" indicator when subscribed
- [ ] Handle denied/unsupported gracefully (silent fallback)

---

## Subscription Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  FIRST ORDER                                                │
│  ─────────────────────────────────────────────────────────  │
│  Order placed → Show permission prompt → User grants        │
│              → PushAlert.subscribe()                        │
│              → Store subscriber_id in DB                    │
│                                                             │
│  Status updates → Send push via PushAlert API               │
│                                                             │
│  Order delivered → PushAlert.unsubscribe(subscriber_id)     │
│                 → Mark is_active = false in DB              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  REPEAT ORDER                                               │
│  ─────────────────────────────────────────────────────────  │
│  Order placed → Check if user has inactive subscription     │
│              → PushAlert.subscribe() (no prompt - already   │
│                granted)                                     │
│              → Update is_active = true                      │
│                                                             │
│  (Same flow as above)                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## PushAlert API Reference

**Subscribe (client-side):**
```js
PushAlertCo.push(['onReady', function() {
  PushAlertCo.push(['subscribe']);
}]);
```

**Send notification (server-side):**
```bash
POST https://api.pushalert.co/rest/v1/send
Authorization: api_key={API_KEY}
{
  "subscriber": "{subscriber_id}",
  "title": "Order Accepted ✓",
  "message": "Pay ฿350 to confirm your order",
  "url": "https://yoursite.com/en/orders/OR0001"
}
```

**Unsubscribe (server-side):**
```bash
DELETE https://api.pushalert.co/rest/v1/subscriber/{subscriber_id}
Authorization: api_key={API_KEY}
```

---

## Effort Estimate

| Task | Time |
|------|------|
| PushAlert setup + PWA config | 2 hours |
| DB schema + subscription API | 2 hours |
| Send notification integration | 2 hours |
| Client permission UX | 2 hours |
| Testing (iOS, Android, Desktop) | 2 hours |
| **Total** | **~10 hours / 1.5 days** |

---

## Notes
- PushAlert handles iOS PWA complexity (manifest, service worker)
- Browser permission persists after first grant - no re-prompts needed
- 3000 sub limit = active subscribers only (unsub on delivery keeps count low)
- Fallback: Pusher realtime still works if push denied/unsupported

