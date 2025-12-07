CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cart_item_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_item_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"group_name_mm" text,
	"option_name" text NOT NULL,
	"option_name_mm" text,
	"extra_price" numeric(10, 0) DEFAULT '0' NOT NULL,
	"selection_role" text,
	"menu_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"menu_item_name" text NOT NULL,
	"menu_item_name_mm" text,
	"base_price" numeric(10, 0) NOT NULL,
	"addons_total" numeric(10, 0) DEFAULT '0' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"note" text,
	"hash_key" text NOT NULL,
	"total_price" numeric(10, 0) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"session_token" text,
	"status" text DEFAULT 'active' NOT NULL,
	"subtotal" numeric(10, 0) DEFAULT '0' NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "choice_pool_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"menu_code" text,
	"name_en" text NOT NULL,
	"name_mm" text,
	"price" numeric(10, 0) DEFAULT '0' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "choice_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_mm" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"condo_name" text NOT NULL,
	"area" text DEFAULT 'AU' NOT NULL,
	"min_fee" integer NOT NULL,
	"max_fee" integer NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_mm" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_choice_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"title_en" text NOT NULL,
	"title_mm" text,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_choice_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"choice_group_id" uuid NOT NULL,
	"name_en" text NOT NULL,
	"name_mm" text,
	"extra_price" numeric(10, 0) DEFAULT '0' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name_en" text NOT NULL,
	"name_mm" text,
	"price" numeric(10, 0) NOT NULL,
	"image_url" text,
	"has_image" boolean DEFAULT false NOT NULL,
	"placeholder_icon" text,
	"menu_code" text,
	"description_en" text,
	"description_mm" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_set_menu" boolean DEFAULT false NOT NULL,
	"allow_user_notes" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"group_name_mm" text,
	"option_name" text NOT NULL,
	"option_name_mm" text,
	"extra_price" numeric(10, 0) DEFAULT '0' NOT NULL,
	"selection_role" text,
	"menu_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid,
	"menu_item_name" text NOT NULL,
	"menu_item_name_mm" text,
	"menu_code" text,
	"base_price" numeric(10, 0) NOT NULL,
	"addons_total" numeric(10, 0) DEFAULT '0' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"note" text,
	"total_price" numeric(10, 0) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"promptpay_account_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(10, 0) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qr_payload" text,
	"qr_expires_at" timestamp,
	"receipt_url" text,
	"receipt_uploaded_at" timestamp,
	"verified_at" timestamp,
	"verified_by_admin_id" text,
	"rejected_reason" text,
	"rejection_count" integer DEFAULT 0 NOT NULL,
	"requested_by_admin_id" text,
	"payment_intent_id" text,
	"prompt_parse_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" text NOT NULL,
	"display_day" date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date NOT NULL,
	"display_counter" integer NOT NULL,
	"cart_id" uuid,
	"user_id" text,
	"session_token" text,
	"status" text DEFAULT 'order_processing' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(10, 0) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(10, 0),
	"discount_total" numeric(10, 0) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 0) DEFAULT '0' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_mode" text,
	"delivery_location_id" uuid,
	"delivery_building_id" uuid,
	"custom_condo_name" text,
	"custom_building_name" text,
	"custom_place_id" text,
	"custom_lat" numeric(10, 6),
	"custom_lng" numeric(10, 6),
	"delivery_notes" text,
	"order_note" text,
	"admin_note" text,
	"kitchen_started_at" timestamp,
	"out_for_delivery_at" timestamp,
	"delivered_at" timestamp,
	"closed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"is_closed" boolean DEFAULT false NOT NULL,
	"resolved_by_admin_id" text,
	"courier_vendor" text,
	"courier_tracking_url" text,
	"courier_fee" numeric(10, 0),
	"courier_payment_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promptpay_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommended_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_category_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"badge_label" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "set_menu_pool_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"role" text NOT NULL,
	"is_price_determining" boolean DEFAULT false NOT NULL,
	"uses_option_price" boolean DEFAULT true NOT NULL,
	"flat_price" numeric(10, 0),
	"is_required" boolean DEFAULT true NOT NULL,
	"min_select" integer DEFAULT 1 NOT NULL,
	"max_select" integer DEFAULT 99 NOT NULL,
	"label_en" text,
	"label_mm" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"delivery_selection_mode" text,
	"default_delivery_location_id" uuid,
	"default_delivery_building_id" uuid,
	"custom_condo_name" text,
	"custom_building_name" text,
	"custom_place_id" text,
	"custom_lat" numeric(10, 6),
	"custom_lng" numeric(10, 6),
	"custom_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item_choices" ADD CONSTRAINT "cart_item_choices_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_pool_options" ADD CONSTRAINT "choice_pool_options_pool_id_choice_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."choice_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_buildings" ADD CONSTRAINT "delivery_buildings_location_id_delivery_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_choice_groups" ADD CONSTRAINT "menu_choice_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_choice_options" ADD CONSTRAINT "menu_choice_options_choice_group_id_menu_choice_groups_id_fk" FOREIGN KEY ("choice_group_id") REFERENCES "public"."menu_choice_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_choices" ADD CONSTRAINT "order_item_choices_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_promptpay_account_id_promptpay_accounts_id_fk" FOREIGN KEY ("promptpay_account_id") REFERENCES "public"."promptpay_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_verified_by_admin_id_admins_id_fk" FOREIGN KEY ("verified_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_requested_by_admin_id_admins_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_building_id_delivery_buildings_id_fk" FOREIGN KEY ("delivery_building_id") REFERENCES "public"."delivery_buildings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_resolved_by_admin_id_admins_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_menu_items" ADD CONSTRAINT "recommended_menu_items_menu_category_id_menu_categories_id_fk" FOREIGN KEY ("menu_category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_menu_items" ADD CONSTRAINT "recommended_menu_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_menu_pool_links" ADD CONSTRAINT "set_menu_pool_links_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_menu_pool_links" ADD CONSTRAINT "set_menu_pool_links_pool_id_choice_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."choice_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_default_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("default_delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_default_delivery_building_id_delivery_buildings_id_fk" FOREIGN KEY ("default_delivery_building_id") REFERENCES "public"."delivery_buildings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_hash_unique" ON "cart_items" USING btree ("cart_id","hash_key");--> statement-breakpoint
CREATE INDEX "carts_user_id_idx" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carts_session_token_idx" ON "carts" USING btree ("session_token");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_buildings_location_label_unique" ON "delivery_buildings" USING btree ("location_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_locations_slug_unique" ON "delivery_locations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "delivery_locations_area_idx" ON "delivery_locations" USING btree ("area");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_events_created_at_idx" ON "order_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_item_choices_order_item_id_idx" ON "order_item_choices" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_payments_order_id_idx" ON "order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_payments_type_idx" ON "order_payments" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_order_type_unique" ON "order_payments" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "orders_display_id_idx" ON "orders" USING btree ("display_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_display_day_counter_unique" ON "orders" USING btree ("display_day","display_counter");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "promptpay_accounts_single_active" ON "promptpay_accounts" USING btree ("is_active") WHERE "promptpay_accounts"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "recommended_menu_items_item_unique" ON "recommended_menu_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "set_menu_pool_links_unique" ON "set_menu_pool_links" USING btree ("menu_item_id","pool_id","role");--> statement-breakpoint
CREATE INDEX "set_menu_pool_links_menu_item_idx" ON "set_menu_pool_links" USING btree ("menu_item_id");