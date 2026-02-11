import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  numeric,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const deliveryLocations = pgTable(
  "delivery_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    condoName: text("condo_name").notNull(),
    area: text("area").notNull().default("AU"),
    minFee: integer("min_fee").notNull(),
    maxFee: integer("max_fee").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("delivery_locations_slug_unique").on(table.slug),
    areaIdx: index("delivery_locations_area_idx").on(table.area),
  })
);

export const deliveryBuildings = pgTable(
  "delivery_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => deliveryLocations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    locationLabelIdx: uniqueIndex(
      "delivery_buildings_location_label_unique"
    ).on(table.locationId, table.label),
  })
);

export const userProfiles = pgTable("user_profiles", {
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  deliverySelectionMode: text("delivery_selection_mode"),
  defaultDeliveryLocationId: uuid("default_delivery_location_id").references(
    () => deliveryLocations.id,
    { onDelete: "set null" }
  ),
  defaultDeliveryBuildingId: uuid("default_delivery_building_id").references(
    () => deliveryBuildings.id,
    { onDelete: "set null" }
  ),
  customCondoName: text("custom_condo_name"),
  customBuildingName: text("custom_building_name"),
  customPlaceId: text("custom_place_id"),
  customLat: numeric("custom_lat", { precision: 10, scale: 6 }),
  customLng: numeric("custom_lng", { precision: 10, scale: 6 }),
  customUpdatedAt: timestamp("custom_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const admins = pgTable("admins", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const promptpayAccounts = pgTable(
  "promptpay_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    singleActiveIdx: uniqueIndex("promptpay_accounts_single_active")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  })
);

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => menuCategories.id, { onDelete: "cascade" }),
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  price: numeric("price", { precision: 10, scale: 0 }).notNull(),
  imageUrl: text("image_url"),
  hasImage: boolean("has_image").default(false).notNull(),
  placeholderIcon: text("placeholder_icon"),
  menuCode: text("menu_code"),
  descriptionEn: text("description_en"),
  descriptionMm: text("description_mm"),
  isAvailable: boolean("is_available").default(true).notNull(),
  isSetMenu: boolean("is_set_menu").default(false).notNull(),
  allowUserNotes: boolean("allow_user_notes").default(false).notNull(),
  status: text("status").default("draft").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const recommendedMenuItems = pgTable(
  "recommended_menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuCategoryId: uuid("menu_category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    badgeLabel: text("badge_label"),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    itemUnique: uniqueIndex("recommended_menu_items_item_unique").on(
      table.menuItemId
    ),
  })
);

export const menuChoiceGroups = pgTable("menu_choice_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  titleEn: text("title_en").notNull(),
  titleMm: text("title_mm"),
  minSelect: integer("min_select").default(0).notNull(),
  maxSelect: integer("max_select").default(1).notNull(),
  isRequired: boolean("is_required").default(false).notNull(),
  type: text("type").default("single").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const menuChoiceOptions = pgTable("menu_choice_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  choiceGroupId: uuid("choice_group_id")
    .notNull()
    .references(() => menuChoiceGroups.id, { onDelete: "cascade" }),
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  extraPrice: numeric("extra_price", { precision: 10, scale: 0 })
    .default("0")
    .notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Set Menu Choice Pools - reusable option pools for set menus
export const choicePools = pgTable("choice_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Options within a choice pool
export const choicePoolOptions = pgTable("choice_pool_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  poolId: uuid("pool_id")
    .notNull()
    .references(() => choicePools.id, { onDelete: "cascade" }),
  menuCode: text("menu_code"), // RS1, AD5, AV3 - for kitchen/POS
  nameEn: text("name_en").notNull(),
  nameMm: text("name_mm"),
  price: numeric("price", { precision: 10, scale: 0 }).default("0").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Links pools to set menu items with role configuration
export const setMenuPoolLinks = pgTable(
  "set_menu_pool_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => choicePools.id, { onDelete: "cascade" }),
    isPriceDetermining: boolean("is_price_determining").default(false).notNull(),
    usesOptionPrice: boolean("uses_option_price").default(true).notNull(),
    flatPrice: numeric("flat_price", { precision: 10, scale: 0 }),
    isRequired: boolean("is_required").default(true).notNull(),
    minSelect: integer("min_select").default(1).notNull(),
    maxSelect: integer("max_select").default(99).notNull(),
    labelEn: text("label_en"),
    labelMm: text("label_mm"),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    menuPoolUnique: uniqueIndex("set_menu_pool_links_unique").on(
      table.menuItemId,
      table.poolId
    ),
    menuItemIdx: index("set_menu_pool_links_menu_item_idx").on(table.menuItemId),
  })
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token"),
    status: text("status").default("active").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    userIdx: index("carts_user_id_idx").on(table.userId),
    sessionIdx: index("carts_session_token_idx").on(table.sessionToken),
  })
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    menuItemName: text("menu_item_name").notNull(),
    menuItemNameMm: text("menu_item_name_mm"),
    basePrice: numeric("base_price", { precision: 10, scale: 0 }).notNull(),
    addonsTotal: numeric("addons_total", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    quantity: integer("quantity").default(1).notNull(),
    note: text("note"),
    hashKey: text("hash_key").notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 0 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    hashIdx: uniqueIndex("cart_items_cart_hash_unique").on(
      table.cartId,
      table.hashKey
    ),
  })
);

export const cartItemChoices = pgTable("cart_item_choices", {
  id: uuid("id").defaultRandom().primaryKey(),
  cartItemId: uuid("cart_item_id")
    .notNull()
    .references(() => cartItems.id, { onDelete: "cascade" }),
  groupName: text("group_name").notNull(),
  groupNameMm: text("group_name_mm"),
  optionName: text("option_name").notNull(),
  optionNameMm: text("option_name_mm"),
  extraPrice: numeric("extra_price", { precision: 10, scale: 0 })
    .default("0")
    .notNull(),
  // Set menu specific fields
  selectionRole: text("selection_role"), // 'base_curry' | 'addon_curry' | 'addon_veggie' | null for regular items
  menuCode: text("menu_code"), // RS1, AD5, AV3 - copied from pool option at cart time
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayId: text("display_id").notNull(),
    displayDay: date("display_day", { mode: "date" })
      .default(sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date`)
      .notNull(),
    displayCounter: integer("display_counter").notNull(),
    cartId: uuid("cart_id"),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sessionToken: text("session_token"),
    status: text("status").default("order_processing").notNull(),
    totalItems: integer("total_items").default(0).notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    vatAmount: numeric("vat_amount", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 0 }),
    discountTotal: numeric("discount_total", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    deliveryMode: text("delivery_mode"),
    deliveryLocationId: uuid("delivery_location_id").references(
      () => deliveryLocations.id,
      { onDelete: "set null" }
    ),
    deliveryBuildingId: uuid("delivery_building_id").references(
      () => deliveryBuildings.id,
      { onDelete: "set null" }
    ),
    customCondoName: text("custom_condo_name"),
    customBuildingName: text("custom_building_name"),
    customPlaceId: text("custom_place_id"),
    customLat: numeric("custom_lat", { precision: 10, scale: 6 }),
    customLng: numeric("custom_lng", { precision: 10, scale: 6 }),
    deliveryNotes: text("delivery_notes"),
    orderNote: text("order_note"),
    adminNote: text("admin_note"),
    kitchenStartedAt: timestamp("kitchen_started_at"),
    outForDeliveryAt: timestamp("out_for_delivery_at"),
    deliveredAt: timestamp("delivered_at"),
    closedAt: timestamp("closed_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    refundStatus: text("refund_status"),
    refundType: text("refund_type"),
    refundAmount: numeric("refund_amount", { precision: 10, scale: 0 }),
    refundReason: text("refund_reason"),
    refundProcessedAt: timestamp("refund_processed_at", { withTimezone: true }),
    refundProcessedByAdminId: text("refund_processed_by_admin_id").references(
      () => admins.id,
      { onDelete: "set null" }
    ),
    isClosed: boolean("is_closed").default(false).notNull(),
    resolvedByAdminId: text("resolved_by_admin_id").references(
      () => admins.id,
      { onDelete: "set null" }
    ),
    courierVendor: text("courier_vendor"),
    courierTrackingUrl: text("courier_tracking_url"),
    courierFee: numeric("courier_fee", { precision: 10, scale: 0 }),
    courierPaymentStatus: text("courier_payment_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    displayIdIdx: index("orders_display_id_idx").on(table.displayId),
    displayDayCounterIdx: uniqueIndex("orders_display_day_counter_unique").on(
      table.displayDay,
      table.displayCounter
    ),
    userIdx: index("orders_user_id_idx").on(table.userId),
    statusIdx: index("orders_status_idx").on(table.status),
    createdIdx: index("orders_created_at_idx").on(table.createdAt),
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    menuItemName: text("menu_item_name").notNull(),
    menuItemNameMm: text("menu_item_name_mm"),
    menuCode: text("menu_code"),
    basePrice: numeric("base_price", { precision: 10, scale: 0 }).notNull(),
    addonsTotal: numeric("addons_total", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    quantity: integer("quantity").default(1).notNull(),
    note: text("note"),
    totalPrice: numeric("total_price", { precision: 10, scale: 0 }).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderIdx: index("order_items_order_id_idx").on(table.orderId),
  })
);

export const orderItemChoices = pgTable(
  "order_item_choices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    groupName: text("group_name").notNull(),
    groupNameMm: text("group_name_mm"),
    optionName: text("option_name").notNull(),
    optionNameMm: text("option_name_mm"),
    extraPrice: numeric("extra_price", { precision: 10, scale: 0 })
      .default("0")
      .notNull(),
    // Set menu specific fields
    selectionRole: text("selection_role"), // 'base_curry' | 'addon_curry' | 'addon_veggie' | null for regular items
    menuCode: text("menu_code"), // RS1, AD5, AV3 - copied from pool option for kitchen/POS
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderItemIdx: index("order_item_choices_order_item_id_idx").on(
      table.orderItemId
    ),
  })
);

export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    promptpayAccountId: uuid("promptpay_account_id").references(
      () => promptpayAccounts.id,
      { onDelete: "set null" }
    ),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 0 }).notNull(),
    status: text("status").default("pending").notNull(),
    qrPayload: text("qr_payload"),
    qrExpiresAt: timestamp("qr_expires_at"),
    receiptUrl: text("receipt_url"),
    receiptUploadedAt: timestamp("receipt_uploaded_at"),
    verifiedAt: timestamp("verified_at"),
    verifiedByAdminId: text("verified_by_admin_id").references(
      () => admins.id,
      { onDelete: "set null" }
    ),
    rejectedReason: text("rejected_reason"),
    rejectionCount: integer("rejection_count").default(0).notNull(),
    requestedByAdminId: text("requested_by_admin_id").references(
      () => admins.id,
      { onDelete: "set null" }
    ),
    paymentIntentId: text("payment_intent_id"),
    promptParseData: text("prompt_parse_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    orderIdx: index("order_payments_order_id_idx").on(table.orderId),
    typeIdx: index("order_payments_type_idx").on(table.type),
    orderTypeIdx: uniqueIndex("order_payments_order_type_unique").on(
      table.orderId,
      table.type
    ),
  })
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderIdx: index("order_events_order_id_idx").on(table.orderId),
    createdIdx: index("order_events_created_at_idx").on(table.createdAt),
  })
);

// Singleton shop settings row to control open/closed state and messages
export const shopSettings = pgTable("shop_settings", {
  id: text("id").primaryKey().default("default"),
  isOpen: boolean("is_open").default(true).notNull(),
  closedMessageEn: text("closed_message_en"),
  closedMessageMm: text("closed_message_mm"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedByAdminId: text("updated_by_admin_id").references(() => admins.id),
});
