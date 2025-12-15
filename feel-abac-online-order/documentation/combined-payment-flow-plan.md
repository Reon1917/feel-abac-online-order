# Combined Payment Flow Plan

## Overview

This plan consolidates the previous two-stage payment system (food payment → delivery fee payment) into a **single combined payment** at order acceptance. The restaurant manually enters the delivery fee when accepting an order, and the customer pays everything in one transaction.

---

## Current State (Being Replaced)

```
order_processing
  → admin accepts (food QR generated)
  → awaiting_food_payment
  → customer uploads receipt
  → food_payment_review
  → admin verifies
  → order_in_kitchen
  → (separate delivery fee payment flow)
  → order_out_for_delivery
  → delivered
```

**Problems with current flow:**
- Two separate payment steps = friction for customers
- Complex status model with delivery payment states
- More admin actions required

---

## New Combined Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CUSTOMER SIDE                          │ ADMIN SIDE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                        │                                    │
│ Order submitted                        │ New order appears                  │
│ (status: order_processing)             │                                    │
│        ↓                               │        ↓                           │
│                                        │ Admin reviews order details        │
│                                        │ Admin enters DELIVERY FEE          │
│                                        │ Admin clicks "Accept"              │
│        ↓                               │        ↓                           │
│ QR code appears with COMBINED amount   │ Order card shows                   │
│ Shows breakdown:                       │ "Awaiting Payment"                 │
│   Food: ฿XXX                           │                                    │
│   Delivery Fee: ฿XX                    │                                    │
│   ─────────────                        │                                    │
│   Total: ฿XXX                          │                                    │
│ (status: awaiting_payment)             │                                    │
│        ↓                               │                                    │
│ Customer pays via PromptPay            │                                    │
│ Customer uploads receipt               │        ↓                           │
│        ↓                               │ "Receipt Uploaded" badge appears   │
│ UI shows "Payment Under Review"        │ Admin reviews receipt              │
│ (status: payment_review)               │        ↓                           │
│        ↓                               │ Admin clicks "Confirm"             │
│ "Payment Confirmed ✓"                  │        ↓                           │
│ (status: order_in_kitchen)             │ Order moves to kitchen queue       │
│        ↓                               │                                    │
│                                        │ Kitchen prepares order             │
│                                        │        ↓                           │
│                                        │ Admin calls Bolt/Grab              │
│                                        │ Admin pastes tracking link         │
│                                        │ Admin clicks "Hand Off"            │
│        ↓                               │        ↓                           │
│ Shows "Out for Delivery"               │ Order shows "Handed Off"           │
│ + "Track Delivery" button              │                                    │
│ (status: order_out_for_delivery)       │                                    │
│        ↓                               │        ↓                           │
│                                        │ Delivery completes                 │
│                                        │ Admin clicks "Order Completed"     │
│        ↓                               │        ↓                           │
│ Shows "Delivered ✓"                    │ Order closed, connections cleanup  │
│ (status: delivered)                    │                                    │
│                                        │                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Status Model (Simplified)

| Status | Description | Customer UI | Admin UI |
|--------|-------------|-------------|----------|
| `order_processing` | New order submitted | "Order Received" | Accept/Reject buttons |
| `awaiting_payment` | Admin accepted, QR shown | QR + breakdown + upload | "Awaiting Payment" badge |
| `payment_review` | Receipt uploaded | "Under Review" spinner | Review/Verify/Reject buttons |
| `order_in_kitchen` | Payment verified | "Preparing" | Kitchen queue |
| `order_out_for_delivery` | Handed to courier | "Out for Delivery" + track link | "Handed Off" badge |
| `delivered` | Order complete | "Delivered ✓" | "Completed" badge |
| `cancelled` | Order cancelled | Cancellation notice | "Cancelled" badge |

**Removed statuses:**
- `awaiting_food_payment` → replaced by `awaiting_payment`
- `food_payment_review` → replaced by `payment_review`
- `awaiting_delivery_fee_payment` → REMOVED (no separate delivery payment)
- `delivery_payment_review` → REMOVED

---

## Schema Changes

### `orders` Table

No new columns needed. Existing columns used:
- `subtotal` — food items total
- `deliveryFee` — delivery fee (admin-entered at accept time)
- `totalAmount` — subtotal + deliveryFee (computed)

### `order_payments` Table

Simplify to single payment record per order:

```sql
-- Existing structure works, minor semantic changes
order_payments (
  id UUID,
  order_id UUID,
  type TEXT DEFAULT 'combined',  -- Changed from 'food'/'delivery' to 'combined'
  amount NUMERIC,                -- Total = food + delivery
  status TEXT,                   -- pending → receipt_uploaded → verified → rejected
  qr_payload TEXT,
  receipt_url TEXT,
  receipt_uploaded_at TIMESTAMP,
  verified_at TIMESTAMP,
  verified_by_admin_id TEXT,
  rejected_reason TEXT,
  rejection_count INTEGER DEFAULT 0,
  ...
)
```

**Migration approach:**
- Keep existing `type` column but use `'combined'` for new orders
- Existing `'food'` type orders continue to work (backwards compatible)
- No schema migration needed initially; just change the value we insert

### Status Enum Update

Update status validation to include new simplified statuses:

```typescript
// lib/orders/types.ts
export type OrderStatus =
  | "order_processing"
  | "awaiting_payment"      // NEW: replaces awaiting_food_payment
  | "payment_review"        // NEW: replaces food_payment_review  
  | "order_in_kitchen"
  | "order_out_for_delivery"
  | "delivered"
  | "cancelled";

// For backwards compatibility during transition
export type LegacyOrderStatus =
  | "awaiting_food_payment"
  | "food_payment_review"
  | "awaiting_delivery_fee_payment"
  | "delivery_payment_review";
```

---

## API Changes

### 1. Admin Accept Order

**`PATCH /api/admin/orders/[displayId]/status`**

Update `action: "accept"` to require `deliveryFee`:

```typescript
// Request body
{
  action: "accept",
  deliveryFee: number  // NEW: required, THB amount (can be 0 for pickup)
}

// Response
{
  status: "awaiting_payment",
  payment: {
    type: "combined",
    foodAmount: number,
    deliveryFee: number,
    totalAmount: number,
    qrPayload: string
  }
}
```

**Logic:**
1. Validate admin + order in `order_processing` status
2. Calculate `totalAmount = subtotal + deliveryFee`
3. Update `orders.deliveryFee` and `orders.totalAmount`
4. Generate QR for `totalAmount`
5. Create `order_payments` with `type: 'combined'`, `amount: totalAmount`
6. Update `orders.status = 'awaiting_payment'`
7. Broadcast `order.status.changed` + `payment.requested`

### 2. Receipt Upload (Customer)

**`PATCH /api/orders/[displayId]/payment`** — No changes needed

### 3. Verify Payment (Admin)

**`POST /api/admin/orders/[displayId]/verify-payment`**

```typescript
// Request body
{ type: "combined" }  // or omit, default to combined

// Response
{ status: "order_in_kitchen" }
```

**Logic:**
1. Verify payment status is `receipt_uploaded`
2. Update payment status to `verified`
3. Update order status to `order_in_kitchen`
4. Set `orders.kitchenStartedAt`
5. Broadcast events

### 4. Hand Off to Delivery (Admin)

**`PATCH /api/admin/orders/[displayId]/status`**

```typescript
// Request body
{
  action: "handed_off",
  courierTrackingUrl: string,  // Required: Bolt/Grab share link
  courierVendor?: string       // Optional: "Bolt" | "Grab"
}

// Response
{ status: "order_out_for_delivery" }
```

**Key change:** No `deliveryFee` in this action anymore — it was already set at accept time.

**Logic:**
1. Validate order is in `order_in_kitchen`
2. Update `orders.courierTrackingUrl`, `orders.courierVendor`
3. Update `orders.status = 'order_out_for_delivery'`
4. Set `orders.outForDeliveryAt`
5. Broadcast events

### 5. Mark Order Completed (Admin)

**`PATCH /api/admin/orders/[displayId]/status`**

```typescript
// Request body
{ action: "delivered" }

// Response
{ status: "delivered" }
```

**Logic:**
1. Validate order is in `order_out_for_delivery`
2. Update `orders.status = 'delivered'`
3. Set `orders.deliveredAt`, `orders.isClosed = true`, `orders.closedAt`
4. Broadcast `order.status.changed` + `order.closed`
5. Trigger channel cleanup (clients unsubscribe)

---

## UI Changes

### Admin: Accept Order Modal

Add delivery fee input when accepting:

```tsx
function AcceptOrderModal({ order }: Props) {
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  
  // Suggest fee based on delivery location if available
  const suggestedFee = order.deliveryLocation?.minFee ?? 0;
  
  return (
    <div className="space-y-4">
      <h3>Accept Order #{order.displayId}</h3>
      
      {/* Order Summary */}
      <div className="bg-slate-50 p-3 rounded-lg text-sm">
        <div className="flex justify-between">
          <span>Food Total:</span>
          <span>฿{order.subtotal}</span>
        </div>
      </div>
      
      {/* Delivery Fee Input */}
      <div>
        <label className="text-sm font-medium">Delivery Fee (THB)</label>
        <input
          type="number"
          min="0"
          value={deliveryFee}
          onChange={(e) => setDeliveryFee(Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2"
          placeholder={`Suggested: ฿${suggestedFee}`}
        />
        {order.deliveryLocation && (
          <p className="text-xs text-slate-500 mt-1">
            {order.deliveryLocation.condoName}: ฿{order.deliveryLocation.minFee}–{order.deliveryLocation.maxFee}
          </p>
        )}
      </div>
      
      {/* Combined Total Preview */}
      <div className="bg-emerald-50 p-3 rounded-lg">
        <div className="flex justify-between font-semibold">
          <span>Customer Pays:</span>
          <span>฿{Number(order.subtotal) + deliveryFee}</span>
        </div>
      </div>
      
      <button onClick={() => handleAccept(deliveryFee)}>
        Accept Order
      </button>
    </div>
  );
}
```

### Admin: Hand Off Modal

Simplified — just tracking link, no delivery fee:

```tsx
function HandOffModal({ order }: Props) {
  const [trackingUrl, setTrackingUrl] = useState("");
  const [vendor, setVendor] = useState<"Bolt" | "Grab">("Bolt");
  
  return (
    <div className="space-y-4">
      <h3>Hand Off to Delivery</h3>
      
      {/* Vendor Selection */}
      <div className="flex gap-2">
        <button 
          className={cn("px-3 py-1 rounded", vendor === "Bolt" && "bg-green-100")}
          onClick={() => setVendor("Bolt")}
        >
          Bolt
        </button>
        <button 
          className={cn("px-3 py-1 rounded", vendor === "Grab" && "bg-green-100")}
          onClick={() => setVendor("Grab")}
        >
          Grab
        </button>
      </div>
      
      {/* Tracking Link */}
      <div>
        <label className="text-sm font-medium">Rider Tracking Link</label>
        <input
          type="url"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Paste Bolt/Grab share link"
        />
      </div>
      
      <button 
        onClick={() => handleHandOff(trackingUrl, vendor)}
        disabled={!trackingUrl.trim()}
      >
        Hand Off to {vendor}
      </button>
    </div>
  );
}
```

### Admin: Order Completed Button

Simple action button when order is `order_out_for_delivery`:

```tsx
function OrderCompletedButton({ order }: Props) {
  if (order.status !== "order_out_for_delivery") return null;
  
  return (
    <button 
      onClick={handleMarkCompleted}
      className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
    >
      ✓ Mark Order Completed
    </button>
  );
}
```

### Customer: Payment QR Section

Show clear breakdown:

```tsx
function PaymentQrSection({ order, payment }: Props) {
  if (order.status !== "awaiting_payment") return null;
  
  const foodAmount = Number(order.subtotal);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const total = Number(payment.amount);
  
  return (
    <div className="space-y-4">
      {/* QR Code */}
      <div className="bg-white p-4 rounded-xl border flex justify-center">
        <QRCodeSVG value={payment.qrPayload} size={200} />
      </div>
      
      {/* Payment Breakdown */}
      <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Food</span>
          <span>฿{foodAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Delivery Fee</span>
          <span>฿{deliveryFee.toLocaleString()}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-emerald-600">฿{total.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="text-xs text-slate-600 space-y-1">
        <p className="font-semibold">How to pay:</p>
        <p>1. Screenshot this QR code</p>
        <p>2. Open your mobile banking app</p>
        <p>3. Scan QR & pay via PromptPay</p>
        <p>4. Upload your receipt below</p>
      </div>
      
      <ReceiptUploadButton orderId={order.id} />
    </div>
  );
}
```

### Customer: Order Status Timeline

```tsx
function OrderStatusTimeline({ order }: Props) {
  const steps = [
    { status: "order_processing", label: "Order Received" },
    { status: "awaiting_payment", label: "Awaiting Payment" },
    { status: "payment_review", label: "Verifying Payment" },
    { status: "order_in_kitchen", label: "Preparing" },
    { status: "order_out_for_delivery", label: "Out for Delivery" },
    { status: "delivered", label: "Delivered" },
  ];
  
  const currentIndex = steps.findIndex(s => s.status === order.status);
  
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step.status} className={cn(
          "flex items-center gap-2",
          i <= currentIndex ? "text-emerald-600" : "text-slate-300"
        )}>
          {i < currentIndex ? <CheckCircle /> : i === currentIndex ? <Spinner /> : <Circle />}
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Pusher Events

| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `order.status.changed` | Both | `{ orderId, displayId, from, to, at }` | Any status change |
| `payment.requested` | Diner | `{ orderId, displayId, amount, qrPayload, breakdown }` | Admin accepts |
| `payment.receipt_uploaded` | Admin | `{ orderId, displayId, receiptUrl }` | Customer uploads |
| `payment.verified` | Both | `{ orderId, displayId }` | Admin verifies |
| `payment.rejected` | Diner | `{ orderId, displayId, reason }` | Admin rejects |
| `order.handed_off` | Diner | `{ orderId, displayId, trackingUrl, vendor }` | Admin hands off |
| `order.closed` | Both | `{ orderId, displayId, finalStatus }` | Order completed/cancelled |

---

## Dictionary Updates

### English (`dictionaries/en/`)

```json
// order.json additions
{
  "status": {
    "orderProcessing": "Order Received",
    "awaitingPayment": "Awaiting Payment",
    "paymentReview": "Verifying Payment",
    "orderInKitchen": "Preparing Your Order",
    "orderOutForDelivery": "Out for Delivery",
    "delivered": "Delivered",
    "cancelled": "Cancelled"
  },
  "payment": {
    "breakdown": {
      "food": "Food",
      "deliveryFee": "Delivery Fee",
      "total": "Total"
    },
    "scanToPay": "Scan to pay via PromptPay",
    "uploadReceipt": "I've Paid – Upload Receipt",
    "underReview": "Payment Under Review",
    "confirmed": "Payment Confirmed"
  },
  "tracking": {
    "trackDelivery": "Track Delivery",
    "outForDelivery": "Your order is on the way!"
  }
}

// admin-orders.json additions
{
  "accept": {
    "title": "Accept Order",
    "deliveryFee": "Delivery Fee (THB)",
    "suggestedFee": "Suggested",
    "customerPays": "Customer Pays",
    "acceptButton": "Accept Order"
  },
  "handOff": {
    "title": "Hand Off to Delivery",
    "trackingLink": "Rider Tracking Link",
    "trackingPlaceholder": "Paste Bolt/Grab share link",
    "handOffButton": "Hand Off to"
  },
  "complete": {
    "markCompleted": "Mark Order Completed"
  }
}
```

### Burmese (`dictionaries/my/`) — translate above

---

## Implementation Order

### Phase 1: Backend Changes (2 hours)

1. **Update order types** (`lib/orders/types.ts`)
   - Add new status types
   - Keep legacy types for backwards compat

2. **Update accept handler** (`app/api/admin/orders/[displayId]/status/route.ts`)
   - Require `deliveryFee` in accept action
   - Calculate combined total
   - Generate combined QR
   - Update order amounts

3. **Update verify handler** (`app/api/admin/orders/[displayId]/verify-payment/route.ts`)
   - Accept `type: "combined"` or default
   - Update to new status names

4. **Update hand-off handler**
   - Remove delivery fee from this action
   - Just save tracking URL

5. **Update delivered handler**
   - Mark order complete, set `isClosed`

### Phase 2: Admin UI Changes (2 hours)

1. **Accept modal** — Add delivery fee input with fee range hints
2. **Hand-off modal** — Simplify to just tracking link + vendor
3. **Complete button** — Add prominent action button
4. **Status badges** — Update color/labels for new statuses

### Phase 3: Customer UI Changes (1.5 hours)

1. **Payment QR section** — Add breakdown display
2. **Order status page** — Update status timeline
3. **Track delivery** — Show tracking button when available

### Phase 4: Realtime Updates (1 hour)

1. Update Pusher event payloads for new flow
2. Add `order.handed_off` event
3. Ensure status listeners handle new status names

### Phase 5: Testing & Cleanup (1 hour)

1. Test full flow: submit → accept → pay → verify → hand-off → complete
2. Test rejection/re-upload flow
3. Test cancellation at various stages
4. Verify backwards compat with existing orders

**Total: ~7.5 hours**

---

## Migration Strategy

### Existing Orders

Orders already in the system will continue to work:
- Orders with `awaiting_food_payment` → treat as `awaiting_payment`
- Orders with `food_payment_review` → treat as `payment_review`
- UI maps legacy statuses to new labels

```typescript
// lib/orders/status-compat.ts
export function normalizeStatus(status: string): OrderStatus {
  const legacyMap: Record<string, OrderStatus> = {
    "awaiting_food_payment": "awaiting_payment",
    "food_payment_review": "payment_review",
    // delivery payment statuses no longer used
  };
  return legacyMap[status] ?? status as OrderStatus;
}
```

### Database

No schema migrations needed for MVP. The `order_payments.type` column accepts any string, we just use `"combined"` for new orders.

Future cleanup (optional):
```sql
-- After all legacy orders are closed
UPDATE order_payments SET type = 'combined' WHERE type = 'food';
-- Delete orphan delivery payment records if any
DELETE FROM order_payments WHERE type = 'delivery';
```

---

## Edge Cases

### 1. Pickup Orders (No Delivery)
- Admin enters `deliveryFee: 0`
- QR shows food total only
- Skip hand-off, go directly from kitchen to delivered

### 2. Payment Rejection
- Same flow as before: admin rejects → customer re-uploads
- Rejection count still enforced (max 10)

### 3. Order Cancellation
- Before payment: Customer or admin can cancel
- After receipt uploaded: Admin only (refund notice shown)
- After verified: Admin only with refund notice

### 4. Admin Changes Delivery Fee After Accept
- **Not allowed** — fee is locked once QR is shown
- If wrong fee entered, admin must cancel and customer re-orders
- (Future: add "void and re-accept" flow if needed)

---

## Open Questions

| Question | Decision |
|----------|----------|
| Can admin edit delivery fee after accept? | **No** — cancel and re-order if wrong |
| Pickup orders skip hand-off? | **Yes** — kitchen → delivered directly |
| Show delivery fee range hints? | **Yes** — from delivery_locations table |
| Required tracking URL for hand-off? | **Yes** — cannot hand off without link |

---

## Files to Modify

### Backend
- `lib/orders/types.ts` — Status types
- `app/api/admin/orders/[displayId]/status/route.ts` — Accept + hand-off + delivered actions
- `app/api/admin/orders/[displayId]/verify-payment/route.ts` — Payment verification
- `lib/orders/realtime.ts` — Event broadcasters

### Frontend - Admin
- `components/admin/orders/order-actions.tsx` (or equivalent) — Accept modal
- `components/admin/orders/hand-off-modal.tsx` — NEW
- `components/admin/orders/order-card.tsx` — Status badges

### Frontend - Customer
- `components/payments/payment-qr-section.tsx` — Add breakdown
- `components/orders/order-status-client.tsx` — Status timeline
- `app/[lang]/orders/[displayId]/page.tsx` — Track delivery button

### i18n
- `dictionaries/en/order.json`
- `dictionaries/en/admin-orders.json`
- `dictionaries/my/order.json`
- `dictionaries/my/admin-orders.json`

