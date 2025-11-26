# Two-Stage PromptPay Tasks

- [ ] **Schema**
  - [ ] Add `promptpay_accounts` table with partial unique index enforcing single active account
  - [ ] Add `order_payments` table with `food`/`delivery` payment types and statuses
  - [ ] Add `delivery_fee` column to `orders` and extend status enum with `awaiting_delivery_fee` + `delivery_payment_review`
  - [ ] Generate and apply migration

- [ ] **QR + Accounts**
  - [ ] Implement PromptPay QR helper (`promptparse`) for food total
  - [ ] Admin API for PromptPay accounts (list/create/delete/activate)
  - [ ] Admin settings page to manage accounts (enforce single active)

- [ ] **Receipts (UploadThing)**
  - [ ] Set up UploadThing file router under App Router with 100 KB target via `sharp` compression
  - [ ] Receipt upload endpoint + client component for customers with preview/progress
  - [ ] Persist receipt metadata to `order_payments` and gate cancel after upload

- [ ] **Payment Flow**
  - [ ] Payment status banner + QR modal for customers (food stage)
  - [ ] Admin review UI: view receipt, verify, reject with reason
  - [ ] Wire status transitions: upload → `food_payment_review`; admin verify → `order_in_kitchen`; admin reject → re-upload loop

- [ ] **Delivery Fee Stage**
  - [ ] Admin modal to input delivery fee and create delivery `order_payments`
  - [ ] QR generation for delivery fee
  - [ ] Customer upload + admin verify to move to `order_out_for_delivery`

- [ ] **Cleanup & Events**
  - [ ] Delete UploadThing receipts on `delivered`/`cancelled`
  - [ ] Add Pusher events (`payment.requested`, `payment.verified`, `payment.rejected`, `delivery_fee.set`)
  - [ ] Manual verification steps: lint, smoke test flows
