# Backlog Clearing Plan

This document covers three features: **User Account Management**, **Enhanced Onboarding**, and **Set Menu System**.

---

## 1. User Account Management

### Problem Statement
Users cannot reset their profile data or delete their accounts. GDPR/privacy compliance and user control are missing.

### Core Requirements
1. **Account Reset** – Clear `userProfiles` row (phone, delivery prefs), keep auth intact
2. **Account Delete** – Full cascade delete of user and all associated data (profile, carts, order history anonymization)

### Schema Impact
No new tables. Existing cascade deletes on `users` → `sessions`, `accounts`, `userProfiles`, `carts` handle most cleanup. Orders use `SET NULL` on `userId` which is correct for anonymization.

### Implementation

#### A. Account Reset
- **API Route:** `DELETE /api/user/profile`
- **Action:** Delete `userProfiles` row by `userId`, redirect to `/onboarding`
- **Client:** Confirmation modal in `ProfileClient` → "Reset my profile" → calls API → redirects

```ts
// lib/user/reset-profile.ts
export async function resetUserProfile(userId: string) {
  await db.delete(userProfiles).where(eq(userProfiles.id, userId));
}
```

#### B. Account Delete
Better Auth does not ship a built-in delete endpoint. We need to:

1. **API Route:** `DELETE /api/user/account`
2. **Server Action:**
   - Delete user from `users` table (cascades to sessions, accounts, userProfiles, carts)
   - Orders remain with `userId = null` (anonymized)
   - Sign out and clear cookies
3. **Client:** Destructive confirmation modal with typed confirmation (e.g., "delete my account")

```ts
// lib/user/delete-account.ts
import { dbTx } from "@/src/db/tx-client";

export async function deleteUserAccount(userId: string) {
  await dbTx.transaction(async (tx) => {
    // Carts & cart items cascade from user
    // Orders set userId to null (already configured)
    await tx.delete(users).where(eq(users.id, userId));
  });
}
```

#### C. Profile UI Additions
Add to `ProfileClient`:
```tsx
{/* Danger Zone Card */}
<section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
  <div className="border-b border-red-100 bg-red-50 px-5 py-4">
    <h2 className="text-base font-semibold text-red-800">
      {sections.dangerZone.title}
    </h2>
  </div>
  <div className="divide-y divide-red-100">
    <ResetProfileButton />
    <DeleteAccountButton />
  </div>
</section>
```

### Tasks
- [ ] Add `DELETE /api/user/profile` route
- [ ] Add `DELETE /api/user/account` route
- [ ] Create `ResetProfileButton` with confirmation modal
- [ ] Create `DeleteAccountButton` with typed confirmation modal
- [ ] Add dictionary entries for danger zone copy (en/my)
- [ ] Test cascade behavior with existing orders

---

## 2. Enhanced Onboarding Flow

### Problem Statement
Current onboarding collects phone + (implicitly expects delivery selection later). Research shows longer, step-by-step onboarding increases retention by creating commitment/investment.

### Current State
- Single-step form: phone number → redirect to `/menu`
- Delivery location selected later during checkout or in profile

### Target State
Multi-step wizard:
1. **Step 1: Phone Number** – Collect and validate phone
2. **Step 2: Delivery Location** – Select preset condo or search custom location
3. **Step 3: (Optional) Preferences** – App language, menu language (can skip)

User progresses through each step. Progress indicator at top. Back button available.

### Implementation

#### A. State Management
Store onboarding progress in URL query or `localStorage`. Prefer URL for shareability/debugging:
```
/onboarding?step=phone
/onboarding?step=location
/onboarding?step=preferences
```

#### B. Component Structure
```
components/onboarding/
├── onboarding-wizard.tsx       # Main wizard controller
├── steps/
│   ├── phone-step.tsx          # Existing form extracted
│   ├── location-step.tsx       # Delivery location picker
│   └── preferences-step.tsx    # Language prefs (optional/skippable)
└── progress-indicator.tsx      # Step dots/bar
```

#### C. Server Actions
Modify `completeOnboarding` to accept partial saves:

```ts
// app/[lang]/onboarding/actions.ts
export async function savePhoneStep(prevState, formData: FormData) {
  // Validate & save phone to userProfiles
  // Return { success: true } on success
}

export async function saveLocationStep(prevState, formData: FormData) {
  // Save delivery location prefs to userProfiles
  // Return { success: true }
}

export async function completeOnboarding() {
  // Final redirect to /menu
}
```

#### D. Location Step Component
Reuse existing `DeliveryLocationSelector` or create simplified version:
```tsx
// components/onboarding/steps/location-step.tsx
export function LocationStep({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  // Use existing delivery location list from DB
  // On save → call saveLocationStep action → onComplete()
}
```

#### E. Progress Persistence
If user abandons mid-flow, next visit should resume where they left off:
- Check `userProfiles.phoneNumber` exists → skip phone step
- Check `userProfiles.deliverySelectionMode` exists → skip location step

### UI/UX Notes
- Each step fits in a single screen (no scroll)
- Large touch targets for mobile
- Progress: `Step 1 of 3` or dot indicators
- Back button on steps 2+, close/skip on preferences step
- Animations between steps (slide or fade)

### Tasks
- [ ] Create `OnboardingWizard` component with step routing
- [ ] Extract phone form into `PhoneStep` component
- [ ] Create `LocationStep` component using delivery location data
- [ ] Create optional `PreferencesStep` (language selection)
- [ ] Add `ProgressIndicator` component
- [ ] Modify server actions for partial saves
- [ ] Add resumption logic (check existing profile data)
- [ ] Add dictionary entries for step copy (en/my)
- [ ] Test flow on mobile/desktop

---

## 3. Set Menu System

### Problem Statement
Set menus are combo meals where users build their own combination. Instead of pre-defined variants (Chicken Set, Beef Set, etc.), we have ONE "Build Your Own" set menu to reduce menu bloat.

### User Flow
1. **Rice** – Just rice, no price variation
2. **Protein** – **Determines base price** (Chicken = ฿65, Beef = ฿90)
3. **Free veggie** – 1 pick, no extra cost
4. **Add-on curry** – Paid extras
5. **Add-on veggies** – Paid extras

### Design Decisions
1. **Set menu is a special mode of `menuItems`** – Add `isSetMenu` flag, not separate table
2. **Protein selection determines BASE PRICE** – Not an add-on, THE price
3. **Shared choice pools** – Reusable across set menus (if we add more later)
4. **Lives within menu builder** – Same admin flow, toggle "This is a set menu"

### Schema Design

#### Extend Existing `menuItems`
```ts
// Add to menuItems table
isSetMenu: boolean("is_set_menu").default(false).notNull(),
// Note: For set menus, `price` field stores minimum price for display ("from ฿65")
```

#### Choice Pools (Reusable Option Lists)
```ts
// src/db/schema.ts

// Reusable pools of options
export const choicePools = pgTable("choice_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Options within a pool
export const choicePoolOptions = pgTable("choice_pool_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  poolId: uuid("pool_id").notNull().references(() => choicePools.id, { onDelete: "cascade" }),
  menuCode: text("menu_code"), // RS1, AD5, AV3, etc. For kitchen/POS. Nullable.
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  price: numeric("price", { precision: 10, scale: 0 }).default("0").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

#### Set Menu Configuration
```ts
// Links a set menu item to choice pools with specific roles
export const setMenuPoolLinks = pgTable("set_menu_pool_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  poolId: uuid("pool_id").notNull().references(() => choicePools.id, { onDelete: "cascade" }),
  
  // Role determines how this pool affects pricing
  role: text("role").notNull(), // 'base_curry' | 'addon_curry' | 'addon_veggie'
  
  // Pricing behavior
  isPriceDetermining: boolean("is_price_determining").default(false).notNull(), // true = option price becomes BASE price
  usesOptionPrice: boolean("uses_option_price").default(true).notNull(), // true = use each option's price, false = use flatPrice
  flatPrice: numeric("flat_price", { precision: 10, scale: 0 }), // Override: all options cost this (e.g., ฿15 for all veggies)
  
  // Selection rules
  isRequired: boolean("is_required").default(true).notNull(),
  minSelect: integer("min_select").default(1).notNull(),
  maxSelect: integer("max_select").default(99).notNull(), // 99 = unlimited
  
  // UI
  labelEn: text("label_en"), // "Choose your curry", "Add extra curry?"
  labelMm: text("label_mm"),
  displayOrder: integer("display_order").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  menuPoolRoleUnique: uniqueIndex("set_menu_pool_links_unique").on(table.menuItemId, table.poolId, table.role),
}));
```

**Role configurations for Rice & Curry Set:**

| Pool | Role | isPriceDetermining | usesOptionPrice | flatPrice | isRequired | max |
|------|------|-------------------|-----------------|-----------|------------|-----|
| Base Curry | `base_curry` | true | true | null | true | 1 |
| Add-on Curries | `addon_curry` | false | **true** | null | false | 99 |
| Add-on Vegetables | `addon_veggie` | false | false | **15** | false | 99 |

- **Base Curry:** Required, 1 pick, price-determining (RS1-RS10 prices: ฿69-฿115)
- **Add-on Curries:** Optional, unlimited picks, uses each option's own price (AD1-AD16: ฿24-฿70)
- **Add-on Vegetables:** Optional, unlimited picks, flat ฿15 each (AV1-AV8)

### Pricing Logic

| Role | isPriceDetermining | isFree | flatPrice | Behavior |
|------|-------------------|--------|-----------|----------|
| `base_curry` | **true** | false | null | Option's `price` = BASE PRICE (RS1=฿75, RS4=฿90, etc.) |
| `addon_curry` | false | false | null | Use option's own `price` (AD1=฿30, AD10=฿45, AD11=฿70) |
| `addon_veggie` | false | false | **15** | Flat ฿15 each (or use option price if varies) |

**Note:** Add-on curries have varying prices (฿24-฿70), so we use each option's `price` field, not a flat override.

**Total calculation:**
```ts
total = baseCurryPrice + sum(addonCurryPrices) + sum(addonVeggiePrices)
// Example: RS4 Beef (฿90) + AD1 Chicken (฿30) + AD11 Mutton (฿70) + AV2 Bamboo (฿15) = ฿205
```

### Real Menu Mapping

Based on actual Feel menu structure:

**Pool: "Base Curry" (price-determining)**
| menuCode | nameEn | nameMm | price |
|----------|--------|--------|-------|
| RS1 | Chicken Curry + Vegetable | ကြက်သားဟင်း+အသီးအရွက် | 75 |
| RS2 | Pork Curry + Vegetable | ဝက်သားဟင်း+အသီးအရွက် | 75 |
| RS3 | Steamed Pork + Vegetable | ဆင်မလိုက်ဝက်ချိုပေါင်း+အသီးအရွက် | 80 |
| RS4 | Beef Curry + Vegetable | အမဲသားဟင်း+အသီးအရွက် | 90 |
| RS5 | Mutton Curry + Vegetable | ဆိတ်သားဟင်း+အသီးအရွက် | 115 |
| RS6 | Banded Snakehead Fish + Vegetable | ငါးရံ့ဟင်း+အသီးအရွက် | 80 |
| RS7 | Catfish Curry + Vegetable | ငါးခူဟင်း+အသီးအရွက် | 75 |
| RS8 | Featherback Fish Cake + Vegetable | ငါးဖယ်ငါးဆုပ်ဟင်း+အသီးအရွက် | 75 |
| RS9 | Spicy Shrimp Curry + Vegetable | ပုဇွန်ဘော့ချိတ်ဟင်း+အသီးအရွက် | 85 |
| RS10 | Duck Egg Curry + Vegetable | ဘဲဥဟင်း+အသီးအရွက် | 69 |

**Pool: "Add-on Curries"**
| menuCode | nameEn | nameMm | price |
|----------|--------|--------|-------|
| AD1 | Chicken Curry | ကြက်သားဆီပြန်ဟင်း | 30 |
| AD2 | Spicy Chicken Curry | ကြက်ရှူးရှဲ | 30 |
| AD3 | Rakhine Chicken Soup | ရခိုင်ကြက်သောက်စမ်း | 30 |
| AD9 | Steamed Pork | ဆင်မလိုက်ဝက်ချိုပေါင်း | 35 |
| AD10 | Beef Curry | အမဲသားနှပ် | 45 |
| AD11 | Mutton Curry | ဆိပ်သားနှပ် | 70 |
| AD15 | Spicy Shrimp Curry | ပုဇွန်ဘော့ချိတ်ဟင်း | 40 |
| AD16 | Duck Egg Curry | ဘဲဥဟင်း | 24 |
| ... | (16 total items) | | |

**Pool: "Add-on Vegetables"**
| menuCode | nameEn | nameMm | price |
|----------|--------|--------|-------|
| AV1 | Fried Roselle Leaves with Bamboo Shoot | | 15 |
| AV2 | Fried Bamboo Shoot with Garden Bean | ပဲပြုတ်မျှစ်ကြော် | 15 |
| AV3 | Potato Curry | အာလူးဟင်း | 15 |
| AV4 | Fried Bean | ပဲသီးကြော် | 15 |
| AV5 | Fried Snake Gourd | ဗုံလုံသီးကြော် | 15 |
| AV6 | Fried Tofu & Bean Sprouts | ပဲပင်ပေါက်ပဲပြားကြော် | 15 |
| AV7 | Pennywort Salad | မြင်းခွါရွက်သုပ် | 15 |
| AV8 | Winged Bean Salad | | 15 |

**Note:** Free sides (Balachaung, soup, free vegetables) are included with every set menu order – no selection needed, just mentioned in description.

### Order Ticket Example

When customer orders: RS4 (Beef) + AD1 (Chicken) + AD3 (Rakhine Soup) + AV2 (Bamboo)

Kitchen ticket shows:
```
Rice & Curry Set
├── RS4  Beef Curry + Vegetable      ฿90
├── AD1  Chicken Curry               ฿30
├── AD3  Rakhine Chicken Soup        ฿30
└── AV2  Fried Bamboo Shoot          ฿15
                            Total: ฿165
(Includes: Balachaung, Soup, Free Vegetables)
```

The `menuCode` field makes this possible – kitchen staff instantly know what to prepare.

### Admin Flow (Within Menu Builder)

#### 1. Manage Choice Pools (`/admin/menu/pools`)
New tab in menu admin, sibling to Categories/Items.

```
Choice Pools
├── Base Curry (RS1-RS10)
│   ├── RS1  Chicken Curry + Vegetable     ฿75
│   ├── RS2  Pork Curry + Vegetable        ฿75
│   ├── RS3  Steamed Pork + Vegetable      ฿80
│   ├── RS4  Beef Curry + Vegetable        ฿90
│   ├── RS5  Mutton Curry + Vegetable      ฿115
│   ├── RS6  Snakehead Fish + Vegetable    ฿80
│   ├── RS7  Catfish Curry + Vegetable     ฿75
│   ├── RS8  Featherback Fish + Vegetable  ฿75
│   ├── RS9  Spicy Shrimp + Vegetable      ฿85
│   └── RS10 Duck Egg + Vegetable          ฿69
│
├── Add-on Curries (AD1-AD16)
│   ├── AD1  Chicken Curry                 ฿30
│   ├── AD2  Spicy Chicken Curry           ฿30
│   ├── AD9  Steamed Pork                  ฿35
│   ├── AD10 Beef Curry                    ฿45
│   ├── AD11 Mutton Curry                  ฿70
│   └── ... (16 items)
│
├── Add-on Vegetables (AV1-AV8)
│   ├── AV1  Fried Roselle Leaves          ฿15
│   ├── AV2  Fried Bamboo Shoot            ฿15
│   ├── AV3  Potato Curry                  ฿15
│   └── ... (8 items, all ฿15)
│
└── [+ Add Pool]
```

#### 2. Create Set Menu Item (Within Item Editor)
```
┌─────────────────────────────────────────────────────┐
│ Create Menu Item                                    │
├─────────────────────────────────────────────────────┤
│ Name (EN): [Rice with Topping]                      │
│ Name (MM): [ပုံစားထမင်း]                               │
│ Category: [Set Menu ▼]                              │
│ Description: [Includes free Balachaung, soup &      │
│               vegetables (lady finger, mango,       │
│               bamboo shoot)]                        │
│ Image: [Upload]                                     │
│                                                     │
│ ☑️ This is a Set Menu                               │
│                                                     │
│ ─── Set Menu Builder ───                            │
│                                                     │
│ Starting price: ฿69 (auto: lowest base_curry)       │
│                                                     │
│ [+ Attach Pool]                                     │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 1. Base Curry (RS1-RS10)                        │ │
│ │    Role: [base_curry ▼]                         │ │
│ │    ☑ Required  ☑ Price-determining              │ │
│ │    Label: [Choose your curry]                   │ │
│ │    Picks: [1] min [1] max                       │ │
│ │    Preview: RS1 ฿75, RS4 ฿90, RS5 ฿115...       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 2. Add-on Curries (AD1-AD16)                    │ │
│ │    Role: [addon_curry ▼]                        │ │
│ │    ☐ Required  ☑ Use option prices              │ │
│ │    Label: [Add extra curry?]                    │ │
│ │    Picks: [0] min [99] max                      │ │
│ │    Preview: AD1 ฿30, AD10 ฿45, AD11 ฿70...      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 3. Add-on Vegetables (AV1-AV8)                  │ │
│ │    Role: [addon_veggie ▼]                       │ │
│ │    ☐ Required  ○ Use option prices              │ │
│ │               ● Flat price: [15] THB each       │ │
│ │    Label: [Add extra vegetables?]               │ │
│ │    Picks: [0] min [99] max                      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Save Set Menu]                                     │
└─────────────────────────────────────────────────────┘
```

### Customer Flow

**Menu Page:**
```
┌─────────────────────────────────┐
│ [Image]                         │
│ Rice with Topping               │
│ from ฿69                        │
│ ပုံစားထမင်း                        │
│ Includes free soup & vegetables │
│                    [Build →]    │
└─────────────────────────────────┘
```

**Detail Page / Builder:**
```
Rice with Topping (ပုံစားထမင်း)

Free with every order: Balachaung, Soup, Vegetables
(lady finger, mango, bamboo shoot)

─── Choose your curry (required) ───
○ RS1  Chicken Curry + Vegetable           ฿75
○ RS2  Pork Curry + Vegetable              ฿75
○ RS3  Steamed Pork + Vegetable            ฿80
● RS4  Beef Curry + Vegetable              ฿90 ← selected
○ RS5  Mutton Curry + Vegetable            ฿115
○ RS6  Banded Snakehead Fish + Vegetable   ฿80
○ RS7  Catfish Curry + Vegetable           ฿75
○ RS8  Featherback Fish Cake + Vegetable   ฿75
○ RS9  Spicy Shrimp Curry + Vegetable      ฿85
○ RS10 Duck Egg Curry + Vegetable          ฿69

─── Add extra curry? (optional) ───
☑ AD1  Chicken Curry                       +฿30
☐ AD2  Spicy Chicken Curry                 +฿30
☐ AD3  Rakhine Chicken Soup                +฿30
☐ AD9  Steamed Pork                        +฿35
☐ AD10 Beef Curry                          +฿45
☑ AD11 Mutton Curry                        +฿70 ← selected
☐ AD15 Spicy Shrimp Curry                  +฿40
☐ AD16 Duck Egg Curry                      +฿24
    ... (16 options)

─── Add extra vegetables? (+฿15 each) ───
☑ AV1  Fried Roselle Leaves                +฿15 ← selected
☐ AV2  Fried Bamboo Shoot with Bean        +฿15
☐ AV3  Potato Curry                        +฿15
☐ AV4  Fried Bean                          +฿15
☐ AV5  Fried Snake Gourd                   +฿15
☐ AV6  Fried Tofu & Bean Sprouts           +฿15
☐ AV7  Pennywort Salad                     +฿15
☐ AV8  Winged Bean Salad                   +฿15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RS4 Beef Curry + Vegetable          ฿90
AD1 Chicken Curry                   ฿30
AD11 Mutton Curry                   ฿70
AV1 Fried Roselle Leaves            ฿15
─────────────────────────────────────
Total: ฿205
[Add to Cart]
```

### Cart/Order Storage

Extend existing `cartItemChoices` / `orderItemChoices`:

```ts
// Add columns for set menu tracking
selectionRole: text("selection_role"), // 'base_curry' | 'addon_curry' | 'addon_veggie' | null
menuCode: text("menu_code"), // RS4, AD1, AV2, etc. Copied from pool option for order history/kitchen
```

**Why copy `menuCode` to order?**
- Pool options can be edited/deleted later
- Order history must preserve what was actually ordered
- Kitchen ticket needs the code at order time

**Cart item total calculation:**
```ts
const basePrice = choices.find(c => c.selectionRole === 'base_curry')?.extraPrice ?? 0;
const addonsTotal = choices
  .filter(c => c.selectionRole?.startsWith('addon_'))
  .reduce((sum, c) => sum + Number(c.extraPrice), 0);
const total = basePrice + addonsTotal;
```

### Compatibility with Regular Items

| Feature | Regular Item | Set Menu Item |
|---------|--------------|---------------|
| Table | `menuItems` | `menuItems` (isSetMenu=true) |
| Choices | `menuChoiceGroups` → `menuChoiceOptions` | `setMenuPoolLinks` → `choicePools` → `choicePoolOptions` |
| Pricing | Fixed `price` + option `extraPrice` | `base_curry` option price + addon prices |
| Cart storage | `cartItemChoices` | `cartItemChoices` (with selectionRole + menuCode) |
| Order display | Item name + choices | Item name + choices with menu codes (RS4, AD1, AV2) |
| Admin UI | Item editor with inline choice groups | Item editor with pool attachment builder |

**No conflicts.** Regular items use existing choice groups system. Set menus use pool links system. Both live in `menuItems`.

### Kitchen/POS Integration

Order data includes `menuCode` for each selection:

```json
{
  "orderId": "OR0042",
  "items": [{
    "name": "Rice with Topping",
    "isSetMenu": true,
    "choices": [
      { "menuCode": "RS4", "name": "Beef Curry + Vegetable", "price": 90, "role": "base_curry" },
      { "menuCode": "AD1", "name": "Chicken Curry", "price": 30, "role": "addon_curry" },
      { "menuCode": "AD11", "name": "Mutton Curry", "price": 70, "role": "addon_curry" },
      { "menuCode": "AV1", "name": "Fried Roselle Leaves", "price": 15, "role": "addon_veggie" }
    ],
    "total": 205
  }]
}
```

Kitchen staff see: `RS4 + AD1 + AD11 + AV1` – instantly knows what to prepare.

### API Routes

```
# Choice Pools (new)
GET    /api/admin/menu/pools          – List all pools with options
POST   /api/admin/menu/pools          – Create pool
GET    /api/admin/menu/pools/[id]     – Get pool details
PATCH  /api/admin/menu/pools/[id]     – Update pool
DELETE /api/admin/menu/pools/[id]     – Delete pool
POST   /api/admin/menu/pools/[id]/options     – Add option
PATCH  /api/admin/menu/pools/[id]/options/[optionId] – Update option
DELETE /api/admin/menu/pools/[id]/options/[optionId] – Delete option

# Set Menu Config (extends existing item routes)
POST   /api/admin/menu/items          – Create item (if isSetMenu, include poolLinks)
PATCH  /api/admin/menu/items/[id]     – Update item + poolLinks
GET    /api/admin/menu/items/[id]     – Returns poolLinks if isSetMenu

# Public
GET    /api/menu                      – Returns all items; set menus include resolved pools
GET    /api/menu/items/[id]           – If set menu, includes pools + options for builder UI
```

### Tasks

**Schema & Migration**
- [x] Add `isSetMenu` column to `menuItems`
- [x] Add `choicePools` table (id, nameEn, nameMm, isActive, displayOrder)
- [x] Add `choicePoolOptions` table (id, poolId, **menuCode**, nameEn, nameMm, price, isAvailable, displayOrder)
- [x] Add `setMenuPoolLinks` table (menuItemId, poolId, role, isPriceDetermining, usesOptionPrice, flatPrice, isRequired, minSelect, maxSelect, labelEn, labelMm, displayOrder)
- [x] Add `selectionRole` + `menuCode` columns to `cartItemChoices`
- [x] Add `selectionRole` + `menuCode` columns to `orderItemChoices`
- [x] Create migration and push to DB

**Admin UI**
- [x] Create Choice Pool management page (`/admin/menu/pools`)
- [x] Pool list with CRUD
- [x] Pool option list with inline add/edit/delete + menuCode field
- [x] Extend item editor with "This is a Set Menu" toggle
- [x] Set Menu builder: attach pools via dedicated "Set menu pools" panel in menu editor (assign roles, required/min/max, pricing flags)

**API Routes**
- [x] `GET/POST /api/admin/menu/pools` – List/create pools
- [x] `GET/PATCH/DELETE /api/admin/menu/pools/[id]` – Pool CRUD
- [x] `POST/PATCH/DELETE /api/admin/menu/pools/[id]/options` – Option CRUD
- [x] Update `POST/PATCH /api/admin/menu/items` to handle pool links when `isSetMenu` (sync via `setMenuPoolLinks`)
- [x] Update `GET /api/menu` to include resolved pools for set menu items (`poolLinks` on `PublicMenuItem`)
- [x] Update `GET /api/menu/items/[id]` to return pool data for builder UI

**Customer UI**
- [x] Update menu card and list rows to show "from ฿XX" + "Build" for set menus (navigates to detail page)
- [x] Create `SetMenuBuilder` component (select base group → addons) backed by `poolLinks`
- [x] Live price calculation as user selects (base + addons × quantity)
- [x] Validation: enforce required pools/min selections client-side

**Cart/Order**
- [x] Update cart add to handle set menu selections + pricing (server derives prices from pool options, ignores client prices)
- [x] Update cart display to show set menu choices (menu codes are stored for kitchen but hidden from customer UI)
- [x] Update order item display to include set menu choices and codes for kitchen/admin views
- [x] Persist `selectionRole` + `menuCode` on cart/order choices for stable kitchen tickets and reporting

**i18n**
- [x] Add dictionary entries for pool/set menu UI copy (en/my), detail-page set-menu copy, and admin menu builder strings

---

## 4. Shop Open/Close Status

### Problem Statement
No way to indicate shop is closed. Users can place orders 24/7 even when kitchen is offline.

### Design Decision
**Menu viewable, ordering disabled** – Better UX than blocking access entirely. Users can browse and plan, just can't add to cart.

### Schema

```ts
// src/db/schema.ts

export const shopSettings = pgTable("shop_settings", {
  id: text("id").primaryKey().default("default"), // Single row, always "default"
  isOpen: boolean("is_open").default(true).notNull(),
  closedMessage: text("closed_message"), // Optional custom message
  closedMessageMm: text("closed_message_mm"),
  autoOpenTime: text("auto_open_time"), // HH:mm format, Bangkok timezone (future: scheduled open)
  autoCloseTime: text("auto_close_time"), // HH:mm format (future: scheduled close)
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  updatedByAdminId: text("updated_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
});
```

Single row table – upsert on settings changes.

### API Routes

```
GET  /api/shop/status        – Public: { isOpen, closedMessage }
POST /api/admin/shop/status  – Admin: Toggle open/close, set message
```

### Admin UI

Add to admin dashboard or top bar:

```
┌─────────────────────────────────────┐
│ Shop Status                         │
│                                     │
│ ● OPEN   ○ CLOSED                   │
│                                     │
│ Closed message (optional):          │
│ [We're closed for today. See you    │
│  tomorrow at 10am!                ] │
│                                     │
│ [Save]                              │
└─────────────────────────────────────┘
```

Or simpler: Toggle button in admin bar with quick close/open.

### Customer Experience

#### When Closed:
1. **Banner at top of menu page:**
   ```
   ┌────────────────────────────────────┐
   │ 🔴 We're currently closed          │
   │ We're closed for today. See you    │
   │ tomorrow at 10am!                  │
   └────────────────────────────────────┘
   ```

2. **"Add to Cart" buttons disabled** – Greyed out with tooltip "Shop is closed"

3. **Cart page:** If items already in cart, show warning banner + disable checkout

4. **Checkout blocked:** API validates shop is open before creating order

#### When Open:
Normal operation, no banners.

### Implementation

#### 1. Shop Status Context/Hook
```ts
// lib/shop/use-shop-status.ts
export function useShopStatus() {
  const { data } = useSWR('/api/shop/status', fetcher);
  return {
    isOpen: data?.isOpen ?? true,
    closedMessage: data?.closedMessage,
  };
}
```

#### 2. Menu Page Integration
```tsx
// components/menu/menu-browser.tsx
const { isOpen, closedMessage } = useShopStatus();

return (
  <>
    {!isOpen && <ShopClosedBanner message={closedMessage} />}
    {/* ... menu items ... */}
  </>
);
```

#### 3. Add to Cart Button
```tsx
// components/menu/add-to-cart-button.tsx
const { isOpen } = useShopStatus();

return (
  <Button disabled={!isOpen || !isValid}>
    {isOpen ? "Add to Cart" : "Shop Closed"}
  </Button>
);
```

#### 4. Order Creation Guard
```ts
// lib/orders/create.ts
export async function createOrderFromCart(cartId: string, ...) {
  const shopStatus = await getShopStatus();
  if (!shopStatus.isOpen) {
    throw new Error("SHOP_CLOSED");
  }
  // ... proceed with order creation
}
```

### Future Enhancement (Not MVP)
- **Scheduled hours:** Auto open at 10:00, auto close at 21:00 (cron job or check at request time)
- **Day-specific schedules:** Different hours for weekends

### Tasks
- [ ] Add `shopSettings` table to schema
- [ ] Create migration and push
- [ ] Create `GET /api/shop/status` public route
- [ ] Create `POST /api/admin/shop/status` admin route
- [ ] Add `useShopStatus` hook
- [ ] Create `ShopClosedBanner` component
- [ ] Disable "Add to Cart" when closed
- [ ] Add checkout guard in order creation
- [ ] Add admin toggle UI (dashboard or admin bar)
- [ ] Add dictionary entries (en/my)

---

## Priority & Sequencing

| Feature | Complexity | User Impact | Priority |
|---------|------------|-------------|----------|
| Shop Open/Close | Low | Critical | 1 |
| Account Reset | Low | Medium | 2 |
| Account Delete | Medium | Medium | 3 |
| Enhanced Onboarding | Medium | High | 4 |
| Set Menu System | High | High | 5 |

Recommended order:
1. **Shop Open/Close** (critical for operations, ~2hr) – Can't launch without this
2. Account Reset (quick win, ~1hr)
3. Account Delete (builds on reset, ~2hr)
4. Enhanced Onboarding (medium effort, high retention value, ~4hr)
5. Set Menu System (most complex, save for focused session, ~8-12hr)

---

## Open Questions

1. **Account Delete:** Should we hard-delete orders or keep anonymized? (Current design: anonymized)
2. **Onboarding:** Is preferences step worth the extra friction? Can be skippable.
3. **Shop Hours:** Need scheduled auto open/close or manual toggle sufficient for MVP?
