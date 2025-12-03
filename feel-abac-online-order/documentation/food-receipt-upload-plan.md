# Food Receipt Upload Flow

## Scope

This plan covers the **food payment stage only** — from QR display through payment confirmation. Delivery fee flow is separate and out of scope.

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Receipt history | **No** — rejected receipts overwritten, no audit trail |
| Image compression | **Client-side** via sharp/canvas before upload |
| QR expiration | **Not implemented** — stakeholder prefers manual contact |
| Rejection retries | **10 attempts max** — then requires admin intervention |
| Upload timeout notification | **TODO** — boilerplate for push notification, implement later |

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ CUSTOMER SIDE                        │ ADMIN SIDE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                      │                              │
│ Order accepted by admin              │ Admin clicks "Accept"        │
│        ↓                             │        ↓                     │
│ QR code appears with amount          │ Order card shows             │
│ + step-by-step instructions          │ "Awaiting Payment"           │
│ (status: awaiting_food_payment)      │                              │
│        ↓                             │                              │
│ Customer scans QR, pays via          │                              │
│ mobile banking app                   │                              │
│        ↓                             │                              │
│ Customer uploads receipt image       │        ↓                     │
│        ↓                             │ Real-time: "Receipt          │
│ UI shows "Payment Under Review"      │ Uploaded" badge appears      │
│ (status: food_payment_review)        │ + thumbnail preview          │
│        ↓                             │        ↓                     │
│                                      │ Admin reviews receipt        │
│                                      │        ↓                     │
│                                      │ Admin clicks "Confirm"       │
│        ↓                             │        ↓                     │
│ Real-time: "Payment Confirmed ✓"     │ Order moves to kitchen       │
│ QR disappears                        │ queue                        │
│ (status: order_in_kitchen)           │                              │
│                                      │                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Status Transitions

| Current Status | Action | Next Status |
|----------------|--------|-------------|
| `order_processing` | Admin accepts | `awaiting_food_payment` |
| `awaiting_food_payment` | Customer uploads receipt | `food_payment_review` |
| `food_payment_review` | Admin verifies | `order_in_kitchen` |
| `food_payment_review` | Admin rejects | `awaiting_food_payment` (re-upload) |

---

## Database

### Use Existing `order_payments` Table

No new table needed. Current schema already supports:

```sql
order_payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  type TEXT NOT NULL,           -- 'food' | 'delivery'
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'receipt_uploaded' | 'verified' | 'rejected'
  qr_payload TEXT,              -- PromptPay QR string
  receipt_url TEXT,             -- UploadThing URL
  receipt_uploaded_at TIMESTAMP,
  verified_at TIMESTAMP,
  verified_by_admin_id TEXT,
  rejected_reason TEXT,
  ...
)
```

**Receipt Re-upload Strategy**: On rejection, customer uploads new receipt which **overwrites** `receipt_url`. Previous receipt is NOT retained (simpler, less storage).

**Rejection Retry Limit**: Add `rejection_count` column (default 0). Increment on each rejection. After 10 rejections, block further uploads and show "Please contact support".

```sql
-- Add to order_payments
ALTER TABLE order_payments ADD COLUMN rejection_count INTEGER DEFAULT 0;
```

---

## UploadThing Setup

### File Router (`app/api/uploadthing/core.ts`)

```typescript
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { resolveUserId } from "@/lib/api/require-user";
import sharp from "sharp";

const f = createUploadthing();

export const uploadRouter = {
  paymentReceipt: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const userId = await resolveUserId(req);
      if (!userId) throw new Error("Unauthorized");
      
      // orderId and paymentType passed from client
      const orderId = req.headers.get("x-order-id");
      const paymentType = req.headers.get("x-payment-type") || "food";
      
      if (!orderId) throw new Error("Missing order ID");
      
      return { userId, orderId, paymentType };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Compress image before storing (target ~100KB)
      // Note: UploadThing stores original, compression happens client-side or post-upload
      return { 
        url: file.url, 
        orderId: metadata.orderId,
        paymentType: metadata.paymentType 
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
```

### API Route (`app/api/uploadthing/route.ts`)

```typescript
import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});
```

---

## Client-Side Image Compression

Compress images before upload to reduce storage and bandwidth (~100KB target).

### `lib/image-compress.ts`

```typescript
const MAX_SIZE_KB = 100;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1600;

export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = (width * MAX_HEIGHT) / height;
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Start with quality 0.8, reduce if still too large
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            
            if (blob.size > MAX_SIZE_KB * 1024 && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
```

### Usage in Upload Button

```tsx
import { compressImage } from "@/lib/image-compress";

// In ReceiptUploadButton
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    const compressed = await compressImage(file);
    startUpload([compressed]);
  } catch (err) {
    toast.error("Failed to process image");
  }
};
```

---

## API Endpoints

### 1. Upload Receipt Callback

**`PATCH /api/orders/[displayId]/payment`**

Called after UploadThing upload completes. Updates payment record and order status.

```typescript
// Request body
{
  type: "food",           // payment type
  receiptUrl: string,     // UploadThing URL
}

// Response
{ 
  status: "food_payment_review",
  payment: OrderPaymentRecord 
}
```

**Logic**:
1. Validate user owns the order
2. Update `order_payments` set `receipt_url`, `receipt_uploaded_at`, `status = 'receipt_uploaded'`
3. Update `orders` set `status = 'food_payment_review'`
4. Insert `order_events` record
5. Broadcast Pusher event `payment.receipt_uploaded`

### 2. Admin Verify Payment

**`POST /api/admin/orders/[displayId]/verify-payment`**

```typescript
// Request body
{ type: "food" }

// Response
{ status: "order_in_kitchen" }
```

**Logic**:
1. Validate admin
2. Validate order is in `food_payment_review`
3. Update `order_payments` set `status = 'verified'`, `verified_at`, `verified_by_admin_id`
4. Update `orders` set `status = 'order_in_kitchen'`, `kitchen_started_at`
5. Insert `order_events` record
6. Broadcast Pusher event `payment.verified`

### 3. Admin Reject Payment

**`POST /api/admin/orders/[displayId]/reject-payment`**

```typescript
// Request body
{ 
  type: "food",
  reason?: string  // optional rejection reason
}

// Response
{ status: "awaiting_food_payment", rejectionCount: number }
```

**Logic**:
1. Validate admin
2. Validate order is in `food_payment_review`
3. Increment `rejection_count` on `order_payments`
4. Update `order_payments` set `status = 'rejected'`, `rejected_reason`
5. Update `orders` set `status = 'awaiting_food_payment'` (back to QR)
6. Insert `order_events` record
7. Broadcast Pusher event `payment.rejected`

**Rejection Limit Check** (in customer upload API):
```typescript
// In PATCH /api/orders/[displayId]/payment
if (payment.rejectionCount >= 10) {
  return NextResponse.json(
    { error: "Maximum upload attempts reached. Please contact support." },
    { status: 400 }
  );
}
```

---

## UI Components

### Customer Side

#### 1. `PaymentQrSection` (in order status page)

Shows based on order status:

| Status | Display |
|--------|---------|
| `awaiting_food_payment` | QR code + amount + upload button |
| `food_payment_review` | "Payment Under Review" spinner |
| `order_in_kitchen` | "Payment Confirmed ✓" success message |

```tsx
// Simplified structure
function PaymentQrSection({ order, payment }: Props) {
  if (order.status === "awaiting_food_payment") {
    return (
      <div className="space-y-4">
        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl border">
          <QRCodeSVG value={payment.qrPayload} size={200} />
        </div>
        
        {/* Amount */}
        <p className="text-2xl font-bold text-center">฿{payment.amount}</p>
        
        {/* Step-by-step instructions */}
        <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg">
          <p className="font-semibold text-slate-700">How to pay:</p>
          <p>1. Screenshot this QR code</p>
          <p>2. Open your mobile banking app</p>
          <p>3. Scan QR & pay via PromptPay</p>
          <p>4. Upload your receipt below</p>
        </div>
        
        <CopyPaymentCodeButton payload={payment.qrPayload} />
        <ReceiptUploadButton orderId={order.id} />
      </div>
    );
  }
  
  if (order.status === "food_payment_review") {
    return (
      <div className="flex items-center gap-2 text-amber-600">
        <Spinner />
        <span>Payment Under Review</span>
      </div>
    );
  }
  
  if (order.status === "order_in_kitchen") {
    return (
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle />
        <span>Payment Confirmed</span>
      </div>
    );
  }
  
  return null;
}
```

#### 2. `ReceiptUploadButton`

Uses `@uploadthing/react` hook:

```tsx
import { useUploadThing } from "@/lib/uploadthing";

function ReceiptUploadButton({ orderId }: { orderId: string }) {
  const { startUpload, isUploading } = useUploadThing("paymentReceipt", {
    headers: { "x-order-id": orderId, "x-payment-type": "food" },
    onClientUploadComplete: async (res) => {
      // Call our API to update payment record
      await fetch(`/api/orders/${displayId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ type: "food", receiptUrl: res[0].url }),
      });
    },
  });

  return (
    <label className="cursor-pointer ...">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) startUpload([file]);
        }}
      />
      {isUploading ? "Uploading..." : "I've Paid – Upload Receipt"}
    </label>
  );
}
```

#### 3. `RejectionBanner`

Shows when admin rejected receipt:

```tsx
function RejectionBanner({ payment }: { payment: OrderPaymentRecord }) {
  if (payment.status !== "rejected") return null;
  
  const maxRetries = 10;
  const retriesLeft = maxRetries - (payment.rejectionCount ?? 0);
  const isBlocked = retriesLeft <= 0;
  
  if (isBlocked) {
    return (
      <div className="bg-slate-100 border border-slate-300 rounded-xl p-4">
        <p className="font-semibold text-slate-800">Maximum Attempts Reached</p>
        <p className="text-sm text-slate-600 mt-1">
          Please contact support for assistance with your order.
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="font-semibold text-red-700">Receipt Rejected</p>
      {payment.rejectedReason && (
        <p className="text-sm text-red-600 mt-1">{payment.rejectedReason}</p>
      )}
      <p className="text-sm text-red-600 mt-2">
        Please upload a valid receipt. ({retriesLeft} attempts remaining)
      </p>
    </div>
  );
}
```

### Admin Side

#### 1. Order Card Badge Updates

In `OrderCard` component, show payment status:

```tsx
function PaymentBadge({ order, payment }: Props) {
  if (!payment) return null;
  
  if (payment.status === "receipt_uploaded") {
    return (
      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
        Receipt Uploaded
      </span>
    );
  }
  
  if (payment.status === "verified") {
    return (
      <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-semibold">
        Payment Verified ✓
      </span>
    );
  }
  
  return null;
}
```

#### 2. Receipt Review Section

In order detail/modal:

```tsx
function ReceiptReviewSection({ order, payment }: Props) {
  if (order.status !== "food_payment_review") return null;
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Review Payment Receipt</h3>
      
      {/* Receipt thumbnail - click to enlarge */}
      <button onClick={() => setShowModal(true)}>
        <img 
          src={payment.receiptUrl} 
          alt="Payment receipt" 
          className="w-32 h-32 object-cover rounded-lg border"
        />
      </button>
      
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleVerify}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
        >
          Confirm Payment
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          className="bg-red-100 text-red-700 px-4 py-2 rounded-xl"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
```

---

## Pusher Events

| Event | Channel | Payload | Triggered By |
|-------|---------|---------|--------------|
| `payment.receipt_uploaded` | `order-{orderId}`, `admin-orders` | `{ orderId, displayId, type, receiptUrl }` | Customer upload |
| `payment.verified` | `order-{orderId}`, `admin-orders` | `{ orderId, displayId, type, verifiedBy }` | Admin verify |
| `payment.rejected` | `order-{orderId}` | `{ orderId, displayId, type, reason }` | Admin reject |

Customer subscribes to `order-{orderId}` channel to receive real-time updates.
Admin subscribes to `admin-orders` channel for all order updates.

---

## File Structure

```
lib/payments/
├── promptpay.ts              # Existing - QR generation
├── queries.ts                # Existing - PromptPay account queries
├── receipt-queries.ts        # NEW - Receipt upload/verify queries
└── types.ts                  # NEW - Payment type definitions (move from orders/types.ts)

lib/uploadthing.ts            # NEW - Client hook export
lib/image-compress.ts         # NEW - Client-side image compression utility

app/api/uploadthing/
├── core.ts                   # NEW - File router
└── route.ts                  # NEW - Route handler

app/api/orders/[displayId]/
├── route.ts                  # Existing
├── cancel/route.ts           # Existing
└── payment/route.ts          # NEW - Receipt upload callback

app/api/admin/orders/[displayId]/
├── status/route.ts           # Existing
├── verify-payment/route.ts   # NEW
└── reject-payment/route.ts   # NEW

components/payments/
├── payment-qr-section.tsx    # NEW - Customer QR + status display + instructions
├── receipt-upload-button.tsx # NEW - Upload trigger with compression
├── rejection-banner.tsx      # NEW - Shows rejection reason + retry count
├── refund-notice-banner.tsx  # NEW - Post-payment cancellation notice
└── admin/
    ├── payment-badge.tsx     # NEW - Order card badge
    └── receipt-review.tsx    # NEW - Admin review UI
```

---

## Implementation Order

### Phase 0: Schema Update (10 min)
- Add `rejection_count` column to `order_payments`

```sql
ALTER TABLE order_payments ADD COLUMN rejection_count INTEGER DEFAULT 0;
```

### Phase 1: UploadThing Setup (30 min)
- File router with auth middleware
- Route handler
- Client hook export
- Client-side image compression (canvas/sharp)

### Phase 2: Receipt Upload API (45 min)
- `PATCH /api/orders/[displayId]/payment`
- Status transition logic
- Rejection count check (block if >= 10)
- Pusher broadcast

### Phase 3: Customer QR Section (1 hr)
- QR display with amount
- Step-by-step payment instructions
- Upload button with UploadThing
- Status-based UI switching
- Rejection banner with retry count
- Max attempts reached UI

### Phase 4: Admin Verify/Reject APIs (45 min)
- `POST /verify-payment`
- `POST /reject-payment` (increment rejection_count)
- Status transitions + Pusher

### Phase 5: Admin Review UI (1 hr)
- Receipt thumbnail + full-size modal
- Verify/reject buttons
- Order card badge updates
- Rejection count display

### Phase 6: Real-time Subscriptions (45 min)
- Customer Pusher subscription
- Admin order list updates
- UI state sync

### Phase 7: Cancellation Guards (30 min)
- Block customer cancel after receipt upload
- Refund notice banner for post-payment cancellation

**Total: ~5.5 hours**

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| Receipt history | No audit trail — overwrite on re-upload |
| Image compression | Client-side before upload |
| QR expiration | Not implemented — manual contact preferred |
| Rejection retries | 10 max — then "contact support" |
| Post-payment cancellation | Show refund notice with order number |

---

## TODO: Push Notification Boilerplate

**Purpose**: Notify customer if they haven't uploaded receipt after X minutes.

```typescript
// lib/notifications/payment-reminder.ts
// TODO: Implement when Pushwoosh/Web Push is set up

export interface PaymentReminderPayload {
  orderId: string;
  displayId: string;
  userId: string;
  amount: number;
  minutesSinceAccepted: number;
}

/**
 * TODO: Wire up to scheduled job (Vercel Cron or similar)
 * 
 * 1. Find orders in `awaiting_food_payment` for > 30 minutes
 * 2. Check if reminder already sent (add `reminder_sent_at` to order_payments)
 * 3. Send push notification via Pushwoosh
 * 4. Mark reminder as sent
 * 
 * Cron schedule: Every 15 minutes
 * 
 * Message: "Don't forget to upload your payment receipt for order #{displayId}"
 */
export async function sendPaymentReminder(payload: PaymentReminderPayload) {
  // TODO: Implement Pushwoosh integration
  console.log("[TODO] Send payment reminder:", payload);
}

/**
 * TODO: Add to schema
 * ALTER TABLE order_payments ADD COLUMN reminder_sent_at TIMESTAMP;
 */
```

**Implementation deferred** — add when Pushwoosh integration is ready.

---

## Cancellation Rules (this phase)

### Customer Side

| Status | Can Cancel? | UI |
|--------|-------------|-----|
| `order_processing` | YES | Cancel button visible |
| `awaiting_food_payment` | YES | Cancel button visible (before upload) |
| `food_payment_review` | NO | "Contact shop to cancel" |
| `order_in_kitchen` | NO | No cancel option |

**Rule**: Check `order_payments.status` — if `receipt_uploaded` or later, block customer cancel button.

### Admin Side

Admin can **always** cancel/reject, but with different consequences:

| Stage | Admin Action | Customer UI |
|-------|--------------|-------------|
| Before payment uploaded | Cancel | Normal cancellation message |
| After payment uploaded | Reject receipt | "Receipt Rejected - Please re-upload" |
| After payment verified (`order_in_kitchen`) | Cancel order | **Refund notice** (see below) |

### Refund Notice UI (Post-Payment Cancellation)

When admin cancels an order that has a **verified** payment:

```tsx
function RefundNoticeBanner({ order }: Props) {
  if (order.status !== "cancelled") return null;
  
  const hasVerifiedPayment = order.payments.some(p => p.status === "verified");
  if (!hasVerifiedPayment) return null;
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <p className="font-semibold text-amber-800">Order Cancelled - Refund Pending</p>
      <p className="text-sm text-amber-700">
        You will be contacted for a refund. Please keep note of:
      </p>
      <ul className="text-sm text-amber-700 list-disc list-inside">
        <li>Order number: <strong>{order.displayId}</strong></li>
        <li>Your payment receipt</li>
      </ul>
    </div>
  );
}
```

---

## Dictionary Keys Needed

```json
// dictionaries/en/order.json additions
{
  "paymentSection": {
    "scanToPay": "Scan to pay via PromptPay",
    "amount": "Amount",
    "copyCode": "Copy Payment Code",
    "uploadReceipt": "I've Paid – Upload Receipt",
    "uploading": "Uploading...",
    "underReview": "Payment Under Review",
    "confirmed": "Payment Confirmed",
    "rejected": "Receipt Rejected",
    "pleaseReupload": "Please upload a valid receipt",
    "maxAttemptsReached": "Maximum upload attempts reached. Please contact support.",
    "howToPay": "How to pay:",
    "step1": "Screenshot this QR code",
    "step2": "Open your mobile banking app",
    "step3": "Scan QR & pay via PromptPay",
    "step4": "Upload your receipt below"
  },
  "refund": {
    "title": "Order Cancelled - Refund Pending",
    "description": "You will be contacted for a refund. Please keep note of:",
    "orderNumber": "Order number",
    "keepReceipt": "Your payment receipt"
  }
}

// dictionaries/en/admin-orders.json additions
{
  "payment": {
    "receiptUploaded": "Receipt Uploaded",
    "verified": "Payment Verified",
    "reviewReceipt": "Review Payment Receipt",
    "confirmPayment": "Confirm Payment",
    "rejectPayment": "Reject",
    "rejectReason": "Rejection reason (optional)",
    "rejectConfirm": "Reject Receipt",
    "rejectionCount": "Rejection attempts"
  }
}
```

