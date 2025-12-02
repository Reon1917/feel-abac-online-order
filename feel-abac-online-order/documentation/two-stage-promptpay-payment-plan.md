# Two-Stage PromptPay Payment System

## Overview

This plan implements a two-stage payment system (food payment + delivery fee) using PromptPay QR codes. Customers scan QR codes to pay, upload payment receipts, and admins manually verify payments before progressing the order.

**Key Library**: [`promptparse`](https://github.com/maythiwat/promptparse) for PromptPay QR payload generation.

---

## Order Status Flow

```
┌─────────────────────────┐
│ order_processing        │ ← Admin reviews order
│ (cancel: YES)           │
└───────────┬─────────────┘
            │ admin accepts
            ▼
┌─────────────────────────┐
│ awaiting_food_payment   │ ← Customer sees QR, pays
│ (cancel: until upload)  │
└───────────┬─────────────┘
            │ customer uploads receipt
            ▼
┌─────────────────────────┐
│ food_payment_review     │ ← Admin verifies receipt
│ (cancel: NO - contact)  │
└───────────┬─────────────┘
            │ admin confirms OR rejects (re-upload)
            ▼
┌─────────────────────────┐
│ order_in_kitchen        │ ← Food being prepared
│ (cancel: NO)            │
└───────────┬─────────────┘
            │ admin inputs delivery fee
            ▼
┌─────────────────────────┐
│ awaiting_delivery_fee   │ ← Customer sees QR, pays
│ (cancel: NO)            │
└───────────┬─────────────┘
            │ customer uploads receipt
            ▼
┌─────────────────────────┐
│ delivery_payment_review │ ← Admin verifies (NEW STATUS)
│ (cancel: NO)            │
└───────────┬─────────────┘
            │ admin confirms
            ▼
┌─────────────────────────┐
│ order_out_for_delivery  │ ← Courier delivering
│ (cancel: NO)            │
└───────────┬─────────────┘
            │ delivered
            ▼
┌─────────────────────────┐
│ delivered               │ ← Cleanup receipts
│ (closed)                │
└─────────────────────────┘
```

**Transition rules (current scope)**:
- Food stage only: QR amount comes from confirmed order total; discounts handled later.
- Customer uploads receipt → status goes to `food_payment_review`; only admin action can move to `order_in_kitchen` (verify) or stay in review (reject/reupload).
- Delivery fee flow gated by admin entering fee and verifying receipt; customer uploads alone never advances order status.

---

## Business Rules

### Cancellation Policy

| Status | Customer Can Cancel? | Notes |
|--------|---------------------|-------|
| `order_processing` | YES | Before admin accepts |
| `awaiting_food_payment` | YES | Only before uploading receipt |
| `food_payment_review` | NO | Must contact shop |
| `order_in_kitchen` | NO | Food being prepared |
| `awaiting_delivery_fee` | NO | Committed to order |
| `delivery_payment_review` | NO | Must contact shop |
| `order_out_for_delivery` | NO | Courier en route |

**Enforcement**: Check `order_payments` table - if food payment has `receipt_uploaded` status or later, block customer cancel button.

### Payment Rejection Flow

When admin rejects a receipt:
1. Payment status changes to `rejected`
2. Customer notified via Pusher event
3. Customer can re-upload a new receipt
4. Previous receipt kept for audit (deleted on order close)

---

## Database Schema

### New Table: `promptpay_accounts`

Stores PromptPay account configurations. Only one account can be active at a time.

```sql
CREATE TABLE promptpay_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,           -- Display name: "Account 1"
  phone_number VARCHAR(20) NOT NULL,    -- Thai phone: "0926088220"
  is_active BOOLEAN DEFAULT false,      -- Only one active at a time
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enforce single active account
CREATE UNIQUE INDEX promptpay_accounts_single_active
  ON promptpay_accounts ((is_active)) WHERE is_active = true;

-- Ensure phone format is valid Thai mobile (10 digits starting with 0)
-- Validation handled in application layer
```

### New Table: `order_payments`

Tracks each payment stage for an order.

```sql
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_type VARCHAR(20) NOT NULL,    -- 'food' | 'delivery'
  amount DECIMAL(10,2) NOT NULL,        -- Payment amount in THB (food total only for now)
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'receipt_uploaded' | 'verified' | 'rejected'
  receipt_url VARCHAR(500),             -- UploadThing URL
  receipt_key VARCHAR(100),             -- UploadThing file key (for deletion)
  rejected_reason TEXT,                 -- Why admin rejected (optional)
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(order_id, payment_type)        -- One payment per type per order
);
```

### Orders Table Addition

```sql
ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2);
```

### Status Enum Update

Add new status to existing enum:
- `delivery_payment_review` (after delivery fee receipt uploaded)

---

## Receipt Storage Strategy

**Provider**: UploadThing (not R2)
- Lower volume, simpler SDK
- Built-in file deletion API
- No bandwidth concerns for this use case
- File size: limit to ~100 KB using `sharp` compression in the UploadThing file router before upload completion (optimize JPEG/WEBP).

**Cleanup on Order Close**:

```typescript
// Called when order reaches terminal state (delivered/cancelled)
async function cleanupOrderReceipts(orderId: string) {
  const payments = await db
    .select({ receiptKey: orderPayments.receiptKey })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));
  
  const keysToDelete = payments
    .map(p => p.receiptKey)
    .filter(Boolean);
  
  if (keysToDelete.length > 0) {
    await utapi.deleteFiles(keysToDelete);
  }
}
```

Integrated into existing `cleanupTransientEvents()` flow in order close handler.

---

## API Endpoints

### PromptPay Accounts (Admin)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/promptpay-accounts` | List all accounts |
| POST | `/api/admin/promptpay-accounts` | Add new account |
| DELETE | `/api/admin/promptpay-accounts/[id]` | Delete account (if not active) |
| PATCH | `/api/admin/promptpay-accounts/[id]/activate` | Set as active account |

### Payment Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/payments/promptpay-qr?orderId=X&type=food` | Generate QR payload for payment (food total only for now) |
| POST | `/api/uploadthing` | UploadThing endpoint for receipts (App Router pattern from docs) |
| PATCH | `/api/orders/[displayId]/payment` | Customer: Mark receipt uploaded |

### Admin Payment Actions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/admin/orders/[displayId]/verify-payment` | Verify uploaded receipt |
| POST | `/api/admin/orders/[displayId]/reject-payment` | Reject with reason |
| POST | `/api/admin/orders/[displayId]/delivery-fee` | Set delivery fee amount |

---

## UI Components

### Customer Side

#### 1. PaymentQrModal
- Displays PromptPay QR code
- Shows amount prominently (฿200.00)
- Shows receiving account name (masked phone)
- "Copy Payment Code" button
- "I've Paid - Upload Receipt" button

#### 2. ReceiptUploadComponent
- Drag & drop or tap to select image
- Image preview before upload
- Upload progress indicator
- Re-upload button if rejected

#### 3. PaymentStatusBanner (on order status page)
- `pending`: "Pay for Food - ฿200" → tap opens QR modal
- `receipt_uploaded`: "Payment Under Review" → waiting spinner
- `rejected`: "Payment Rejected - Please re-upload" → error style, re-upload button
- `verified`: "Payment Confirmed ✓" → success style

### Admin Side

#### 1. PromptPay Settings Page (`/admin/settings/promptpay`)
- List accounts with masked phone numbers
- Add new account (name + phone validation)
- Radio button to set active account
- Delete inactive accounts

#### 2. Payment Review Section (in order detail)
- View uploaded receipt (thumbnail + full-size modal)
- "Verify Payment" button (green)
- "Reject Payment" button (red) → opens reason input

#### 3. Delivery Fee Modal
- Triggered when food is ready
- Input field for amount (THB)
- Creates `order_payments` entry with type `delivery`

---

## File Structure

```
lib/payments/
├── promptpay.ts              # QR generation using promptparse
├── receipt-cleanup.ts        # UploadThing deletion logic
├── queries.ts                # Payment-related DB queries
└── types.ts                  # Payment type definitions

components/payments/
├── payment-qr-modal.tsx      # QR display modal for customer
├── receipt-upload.tsx        # Receipt upload component
├── payment-status-banner.tsx # Status indicator on order page
└── admin/
    ├── payment-review.tsx    # Verify/reject UI
    ├── delivery-fee-modal.tsx
    └── promptpay-account-list.tsx

app/api/payments/
├── promptpay-qr/route.ts     # QR generation endpoint
└── uploadthing/route.ts      # UploadThing webhook

app/api/admin/
├── promptpay-accounts/
│   ├── route.ts              # GET, POST
│   └── [id]/
│       ├── route.ts          # DELETE
│       └── activate/route.ts # PATCH
└── orders/[displayId]/
    ├── verify-payment/route.ts
    ├── reject-payment/route.ts
    └── delivery-fee/route.ts

app/[lang]/admin/settings/
└── promptpay/page.tsx        # Account management page
```

---

## Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| `promptparse` | PromptPay QR payload generation | Installed |
| `uploadthing` | Receipt file uploads | To install |
| `qrcode.react` | QR code rendering | To install |

---

## Implementation Order

1. **Schema + Migration** - Add tables, update status enum
2. **PromptPay Accounts CRUD** - Admin API + settings page
3. **QR Generation** - `promptparse` integration + API
4. **Customer QR Modal** - Display, copy, open upload
5. **UploadThing Setup** - Configure for receipt uploads
6. **Receipt Upload Flow** - Component + status banner
7. **Admin Payment Review** - Verify/reject UI + API
8. **Delivery Fee Flow** - Admin input modal + customer payment
9. **Cancellation Guards** - Block cancel after receipt upload
10. **Cleanup Integration** - Delete receipts on order close

---

## Pusher Events (Extensions)

Add to existing event system:

| Event | Channels | Payload |
|-------|----------|---------|
| `payment.requested` | order | `{ type, amount }` |
| `payment.verified` | admin, order | `{ type, verifiedBy }` |
| `payment.rejected` | order | `{ type, reason }` |
| `delivery_fee.set` | order | `{ amount }` |

---

## Future Considerations

- **Slip Verification**: `promptparse/validate` has `slipVerify()` for automated verification via bank APIs
- **Multiple Payment Methods**: TrueMoney QR can use same modal pattern
- **Payment Timeout**: Auto-cancel if no payment within X hours
- **Refund Tracking**: Add refund status/amount to `order_payments`

## Implementation Checklist

- **Schema**
  - [ ] Add `promptpay_accounts` table with a partial unique index enforcing a single active account at a time.
  - [ ] Add `order_payments` table to track `food` / `delivery` payment types and statuses.
  - [ ] Add a `delivery_fee` column to `orders` and extend the status enum with `awaiting_delivery_fee` and `delivery_payment_review`.
  - [ ] Generate and apply the migration.

- **QR + Accounts**
  - [ ] Implement a PromptPay QR helper (using `promptparse`) for the food total.
  - [ ] Admin API for PromptPay accounts (list/create/delete/activate).
  - [ ] Admin settings page to manage accounts and enforce a single active account.

- **Receipts (UploadThing)**
  - [ ] Set up UploadThing file router under the App Router, with ~100 KB targets via `sharp` compression.
  - [ ] Receipt upload endpoint + client component for customers with preview and progress.
  - [ ] Persist receipt metadata to `order_payments` and gate customer cancel after upload.

- **Payment Flow**
  - [ ] Payment status banner + QR modal for customers (food stage).
  - [ ] Admin review UI to view receipt, verify, or reject with reason.
  - [ ] Wire status transitions: upload → `food_payment_review`; admin verify → `order_in_kitchen`; admin reject → re-upload loop.

- **Delivery Fee Stage**
  - [ ] Admin modal to input delivery fee and create delivery `order_payments`.
  - [ ] QR generation for the delivery fee.
  - [ ] Customer upload + admin verify to move to `order_out_for_delivery`.

- **Cleanup & Events**
  - [ ] Delete UploadThing receipts on `delivered` / `cancelled`.
  - [ ] Add Pusher events (`payment.requested`, `payment.verified`, `payment.rejected`, `delivery_fee.set`).
  - [ ] Manual verification steps: lint and smoke-test flows.
