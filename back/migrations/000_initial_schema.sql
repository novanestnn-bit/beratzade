-- Initial schema snapshot for installations predating versioned SQL migrations.

-- Generated from models.py and inventory_models.py; never alter existing tables.

-- Version 000 runs before historical ALTER migrations. Existing tables and rows are preserved.

DO $baseline$ BEGIN
CREATE TYPE businesstype AS ENUM ('restaurant', 'bar', 'cafe', 'retail', 'service', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE productquestiontype AS ENUM ('choice', 'scale', 'text');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE reservationstatus AS ENUM ('booked', 'seated', 'finished', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE waitingliststatus AS ENUM ('waiting', 'notified', 'seated', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE hubfulfillmentstatus AS ENUM ('requested', 'preparing', 'prepared_at_hq', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE orderstatus AS ENUM ('pending', 'preparing', 'ready', 'out_for_delivery', 'partially_delivered', 'paid', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE orderchannel AS ENUM ('table', 'quick_sale', 'takeaway', 'satisfecho_delivery', 'marketplace');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE orderitemstatus AS ENUM ('pending', 'preparing', 'ready', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE unitofmeasure AS ENUM ('piece', 'gram', 'kilogram', 'ounce', 'pound', 'milliliter', 'centiliter', 'liter', 'fluid_ounce', 'cup', 'gallon');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE inventorycategory AS ENUM ('ingredients', 'beverages', 'packaging', 'cleaning', 'equipment', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE purchaseorderstatus AS ENUM ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE transactiontype AS ENUM ('purchase', 'sale', 'adjustment_add', 'adjustment_subtract', 'waste', 'transfer_in', 'transfer_out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'kitchen', 'bartender', 'waiter', 'receptionist', 'courier', 'provider', 'platform_operator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE staff_contract_kind AS ENUM ('employee', 'freelancer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE staff_contract_status AS ENUM ('draft', 'pending_signature', 'active', 'expired', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ BEGIN
CREATE TYPE staff_contract_payment_structure AS ENUM ('payroll', 'invoice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $baseline$;

DO $baseline$ DECLARE new_tables text[] := ARRAY[]::text[]; BEGIN
IF to_regclass('public."tax"') IS NULL THEN

CREATE TABLE tax (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	name VARCHAR(128) NOT NULL,
	rate_percent INTEGER NOT NULL,
	valid_from DATE NOT NULL,
	valid_to DATE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'tax');
END IF;
IF 'tax' = ANY(new_tables) THEN
CREATE INDEX ix_tax_tenant_id ON tax (tenant_id);
END IF;
IF to_regclass('public."tenant"') IS NULL THEN

CREATE TABLE tenant (
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	business_type businesstype,
	description VARCHAR,
	phone VARCHAR,
	whatsapp VARCHAR,
	email VARCHAR,
	address VARCHAR,
	city VARCHAR(120),
	public_slug VARCHAR(160),
	website VARCHAR,
	tax_id VARCHAR,
	cif VARCHAR,
	ccc VARCHAR,
	logo_filename VARCHAR,
	header_background_filename VARCHAR,
	public_background_color VARCHAR,
	public_primary_color VARCHAR,
	opening_hours VARCHAR,
	immediate_payment_required BOOLEAN NOT NULL,
	currency_code VARCHAR,
	currency VARCHAR,
	default_language VARCHAR,
	timezone VARCHAR,
	country_code VARCHAR(2),
	stripe_secret_key VARCHAR,
	stripe_publishable_key VARCHAR,
	revolut_merchant_secret VARCHAR,
	latitude FLOAT,
	longitude FLOAT,
	location_radius_meters INTEGER NOT NULL,
	location_check_enabled BOOLEAN NOT NULL,
	smtp_host VARCHAR,
	smtp_port INTEGER,
	smtp_use_tls BOOLEAN,
	smtp_user VARCHAR,
	smtp_password VARCHAR,
	email_from VARCHAR,
	email_from_name VARCHAR,
	reservation_confirmation_email_subject VARCHAR,
	reservation_confirmation_email_body VARCHAR,
	working_plan_updated_at TIMESTAMP WITH TIME ZONE,
	working_plan_owner_seen_at TIMESTAMP WITH TIME ZONE,
	reservation_prepayment_cents INTEGER,
	reservation_prepayment_text VARCHAR,
	reservation_cancellation_policy VARCHAR,
	reservation_arrival_tolerance_minutes INTEGER,
	reservation_average_table_turn_minutes INTEGER,
	reservation_slot_minutes INTEGER,
	reservation_max_guests_per_slot INTEGER,
	reservation_walk_in_tables_reserved INTEGER NOT NULL,
	reservation_dress_code VARCHAR,
	reservation_reminder_24h_enabled BOOLEAN NOT NULL,
	reservation_reminder_2h_enabled BOOLEAN NOT NULL,
	guest_birthday_capture_enabled BOOLEAN NOT NULL,
	guest_birthday_marketing_enabled BOOLEAN NOT NULL,
	guest_birthday_consent_text VARCHAR,
	delivery_fee_cents INTEGER NOT NULL,
	delivery_radius_meters INTEGER,
	delivery_postal_codes VARCHAR,
	public_google_review_url VARCHAR(2048),
	public_google_maps_url VARCHAR(2048),
	public_openstreetmap_url VARCHAR(2048),
	public_terms_of_service_url VARCHAR(2048),
	public_privacy_policy_url VARCHAR(2048),
	kitchen_display_timer_yellow_minutes INTEGER,
	kitchen_display_timer_orange_minutes INTEGER,
	kitchen_display_timer_red_minutes INTEGER,
	tip_preset_percents JSONB,
	tip_tax_rate_percent INTEGER,
	tip_entry_mode VARCHAR(32) NOT NULL,
	default_tax_id INTEGER,
	default_kitchen_station_id INTEGER,
	default_bar_station_id INTEGER,
	ui_modules JSONB,
	custom_subcategories JSONB,
	clock_qr_token_hash VARCHAR(128),
	clock_qr_token_encrypted TEXT,
	clock_qr_location_verify BOOLEAN NOT NULL,
	fiscal_mode VARCHAR(16) NOT NULL,
	fiscal_invoice_series VARCHAR(32) NOT NULL,
	fiscal_invoice_next_number INTEGER NOT NULL,
	fiscal_aeat_api_secret VARCHAR(512),
	fiscal_country VARCHAR(2),
	tse_mode VARCHAR(16) NOT NULL,
	tse_client_id VARCHAR(128),
	tse_api_secret VARCHAR(512),
	tse_serial_number VARCHAR(128),
	tse_signature_counter INTEGER NOT NULL,
	saas_subscription_status VARCHAR(32) NOT NULL,
	saas_trial_ends_at TIMESTAMP WITH TIME ZONE,
	saas_subscription_ends_at TIMESTAMP WITH TIME ZONE,
	saas_stripe_customer_id VARCHAR(255),
	saas_stripe_subscription_id VARCHAR(255),
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'tenant');
END IF;
IF 'tenant' = ANY(new_tables) THEN
CREATE INDEX ix_tenant_name ON tenant (name);
END IF;
IF 'tenant' = ANY(new_tables) THEN
CREATE INDEX ix_tenant_default_kitchen_station_id ON tenant (default_kitchen_station_id);
END IF;
IF 'tenant' = ANY(new_tables) THEN
CREATE INDEX ix_tenant_public_slug ON tenant (public_slug);
END IF;
IF 'tenant' = ANY(new_tables) THEN
CREATE INDEX ix_tenant_default_tax_id ON tenant (default_tax_id);
END IF;
IF 'tenant' = ANY(new_tables) THEN
CREATE INDEX ix_tenant_default_bar_station_id ON tenant (default_bar_station_id);
END IF;
IF to_regclass('public."customer"') IS NULL THEN

CREATE TABLE customer (
	id SERIAL NOT NULL,
	email VARCHAR(255) NOT NULL,
	hashed_password VARCHAR NOT NULL,
	full_name VARCHAR(255),
	phone VARCHAR(64),
	business_name VARCHAR(255),
	tax_id VARCHAR(64),
	address TEXT,
	email_verified BOOLEAN NOT NULL,
	email_verification_token_hash VARCHAR(64),
	email_verification_sent_at TIMESTAMP WITH TIME ZONE,
	token_version INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'customer');
END IF;
IF 'customer' = ANY(new_tables) THEN
CREATE INDEX ix_customer_email_verification_token_hash ON customer (email_verification_token_hash);
END IF;
IF 'customer' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_customer_email ON customer (email);
END IF;
IF to_regclass('public."kitchen_station"') IS NULL THEN

CREATE TABLE kitchen_station (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	name VARCHAR(128) NOT NULL,
	sort_order INTEGER NOT NULL,
	display_route VARCHAR(16) NOT NULL,
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'kitchen_station');
END IF;
IF 'kitchen_station' = ANY(new_tables) THEN
CREATE INDEX ix_kitchen_station_tenant_id ON kitchen_station (tenant_id);
END IF;
IF to_regclass('public."productcatalog"') IS NULL THEN

CREATE TABLE productcatalog (
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	description VARCHAR,
	category VARCHAR,
	subcategory VARCHAR,
	barcode VARCHAR,
	brand VARCHAR,
	normalized_name VARCHAR,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'productcatalog');
END IF;
IF 'productcatalog' = ANY(new_tables) THEN
CREATE INDEX ix_productcatalog_subcategory ON productcatalog (subcategory);
END IF;
IF 'productcatalog' = ANY(new_tables) THEN
CREATE INDEX ix_productcatalog_category ON productcatalog (category);
END IF;
IF 'productcatalog' = ANY(new_tables) THEN
CREATE INDEX ix_productcatalog_barcode ON productcatalog (barcode);
END IF;
IF 'productcatalog' = ANY(new_tables) THEN
CREATE INDEX ix_productcatalog_normalized_name ON productcatalog (normalized_name);
END IF;
IF 'productcatalog' = ANY(new_tables) THEN
CREATE INDEX ix_productcatalog_name ON productcatalog (name);
END IF;
IF to_regclass('public."staff_contract_template_preset"') IS NULL THEN

CREATE TABLE staff_contract_template_preset (
	id SERIAL NOT NULL,
	region_code VARCHAR(8) NOT NULL,
	locale VARCHAR(16) NOT NULL,
	template_key VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	body TEXT NOT NULL,
	kind staff_contract_kind,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;
new_tables := array_append(new_tables, 'staff_contract_template_preset');
END IF;
IF to_regclass('public."product"') IS NULL THEN

CREATE TABLE product (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	is_active BOOLEAN NOT NULL,
	name VARCHAR NOT NULL,
	price_cents INTEGER NOT NULL,
	cost_cents INTEGER,
	description VARCHAR,
	image_filename VARCHAR,
	ingredients VARCHAR,
	category VARCHAR,
	subcategory VARCHAR,
	tax_id INTEGER,
	available_from DATE,
	available_until DATE,
	kitchen_station_id INTEGER,
	stock_alert_enabled BOOLEAN NOT NULL,
	stock_qty INTEGER NOT NULL,
	stock_alert_level INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(tax_id) REFERENCES tax (id),
	FOREIGN KEY(kitchen_station_id) REFERENCES kitchen_station (id)
)

;
new_tables := array_append(new_tables, 'product');
END IF;
IF 'product' = ANY(new_tables) THEN
CREATE INDEX ix_product_kitchen_station_id ON product (kitchen_station_id);
END IF;
IF 'product' = ANY(new_tables) THEN
CREATE INDEX ix_product_category ON product (category);
END IF;
IF 'product' = ANY(new_tables) THEN
CREATE INDEX ix_product_tax_id ON product (tax_id);
END IF;
IF 'product' = ANY(new_tables) THEN
CREATE INDEX ix_product_subcategory ON product (subcategory);
END IF;
IF to_regclass('public."provider"') IS NULL THEN

CREATE TABLE provider (
	id SERIAL NOT NULL,
	tenant_id INTEGER,
	name VARCHAR NOT NULL,
	token VARCHAR NOT NULL,
	url VARCHAR,
	api_endpoint VARCHAR,
	is_active BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	full_company_name VARCHAR,
	address VARCHAR,
	tax_number VARCHAR,
	phone VARCHAR,
	email VARCHAR,
	bank_iban VARCHAR,
	bank_bic VARCHAR,
	bank_name VARCHAR,
	bank_account_holder VARCHAR,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'provider');
END IF;
IF 'provider' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_provider_token ON provider (token);
END IF;
IF 'provider' = ANY(new_tables) THEN
CREATE INDEX ix_provider_name ON provider (name);
END IF;
IF 'provider' = ANY(new_tables) THEN
CREATE INDEX ix_provider_tenant_id ON provider (tenant_id);
END IF;
IF to_regclass('public."table_group"') IS NULL THEN

CREATE TABLE table_group (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'table_group');
END IF;
IF to_regclass('public."waiting_list_entry"') IS NULL THEN

CREATE TABLE waiting_list_entry (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	customer_name VARCHAR(200) NOT NULL,
	customer_phone VARCHAR(40) NOT NULL,
	party_size INTEGER NOT NULL,
	status waitingliststatus NOT NULL,
	notified_at TIMESTAMP WITH TIME ZONE,
	client_ip VARCHAR(45),
	client_user_agent VARCHAR(512),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'waiting_list_entry');
END IF;
IF 'waiting_list_entry' = ANY(new_tables) THEN
CREATE INDEX ix_waiting_list_entry_status ON waiting_list_entry (status);
END IF;
IF to_regclass('public."price_promotion"') IS NULL THEN

CREATE TABLE price_promotion (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	name VARCHAR(120) NOT NULL,
	promo_type VARCHAR(32) NOT NULL,
	percent_off INTEGER NOT NULL,
	category VARCHAR(120) NOT NULL,
	channels JSONB,
	starts_at TIMESTAMP WITH TIME ZONE,
	ends_at TIMESTAMP WITH TIME ZONE,
	days_of_week JSONB,
	start_time_local VARCHAR(5),
	end_time_local VARCHAR(5),
	stackable BOOLEAN NOT NULL,
	enabled BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'price_promotion');
END IF;
IF to_regclass('public."loyalty_program"') IS NULL THEN

CREATE TABLE loyalty_program (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	enabled BOOLEAN NOT NULL,
	program_name VARCHAR(120) NOT NULL,
	mode VARCHAR(16) NOT NULL,
	earn_units_per_order INTEGER NOT NULL,
	redemption_threshold INTEGER NOT NULL,
	reward_discount_cents INTEGER NOT NULL,
	birthday_bonus_units INTEGER NOT NULL,
	vip_silver_min_lifetime_units INTEGER NOT NULL,
	vip_gold_min_lifetime_units INTEGER NOT NULL,
	referral_bonus_units INTEGER NOT NULL,
	referral_invitee_bonus_units INTEGER NOT NULL,
	wallet_passes_enabled BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_loyalty_program_tenant UNIQUE (tenant_id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'loyalty_program');
END IF;
IF to_regclass('public."billing_customer"') IS NULL THEN

CREATE TABLE billing_customer (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	name VARCHAR NOT NULL,
	company_name VARCHAR,
	tax_id VARCHAR,
	address VARCHAR,
	email VARCHAR,
	phone VARCHAR,
	birth_date DATE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'billing_customer');
END IF;
IF 'billing_customer' = ANY(new_tables) THEN
CREATE INDEX ix_billing_customer_email ON billing_customer (email);
END IF;
IF 'billing_customer' = ANY(new_tables) THEN
CREATE INDEX ix_billing_customer_tenant_id ON billing_customer (tenant_id);
END IF;
IF 'billing_customer' = ANY(new_tables) THEN
CREATE INDEX ix_billing_customer_name ON billing_customer (name);
END IF;
IF 'billing_customer' = ANY(new_tables) THEN
CREATE INDEX ix_billing_customer_tax_id ON billing_customer (tax_id);
END IF;
IF 'billing_customer' = ANY(new_tables) THEN
CREATE INDEX ix_billing_customer_company_name ON billing_customer (company_name);
END IF;
IF to_regclass('public."restaurant_group"') IS NULL THEN

CREATE TABLE restaurant_group (
	id SERIAL NOT NULL,
	name VARCHAR(256) NOT NULL,
	join_code VARCHAR(32) NOT NULL,
	share_products BOOLEAN NOT NULL,
	share_customers BOOLEAN NOT NULL,
	hub_tenant_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(hub_tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'restaurant_group');
END IF;
IF 'restaurant_group' = ANY(new_tables) THEN
CREATE INDEX ix_restaurant_group_hub_tenant_id ON restaurant_group (hub_tenant_id);
END IF;
IF 'restaurant_group' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_restaurant_group_join_code ON restaurant_group (join_code);
END IF;
IF to_regclass('public."i18ntext"') IS NULL THEN

CREATE TABLE i18ntext (
	id SERIAL NOT NULL,
	tenant_id INTEGER,
	entity_type VARCHAR NOT NULL,
	entity_id INTEGER NOT NULL,
	field VARCHAR NOT NULL,
	lang VARCHAR NOT NULL,
	text VARCHAR NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'i18ntext');
END IF;
IF 'i18ntext' = ANY(new_tables) THEN
CREATE INDEX ix_i18ntext_entity_type ON i18ntext (entity_type);
END IF;
IF 'i18ntext' = ANY(new_tables) THEN
CREATE INDEX ix_i18ntext_field ON i18ntext (field);
END IF;
IF 'i18ntext' = ANY(new_tables) THEN
CREATE INDEX ix_i18ntext_lang ON i18ntext (lang);
END IF;
IF 'i18ntext' = ANY(new_tables) THEN
CREATE INDEX ix_i18ntext_entity_id ON i18ntext (entity_id);
END IF;
IF 'i18ntext' = ANY(new_tables) THEN
CREATE INDEX ix_i18ntext_tenant_id ON i18ntext (tenant_id);
END IF;
IF to_regclass('public."staff_contract_template"') IS NULL THEN

CREATE TABLE staff_contract_template (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	template_key VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	body TEXT NOT NULL,
	locale VARCHAR(16),
	kind staff_contract_kind,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_staff_contract_template_tenant_key UNIQUE (tenant_id, template_key),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'staff_contract_template');
END IF;
IF 'staff_contract_template' = ANY(new_tables) THEN
CREATE INDEX ix_staff_contract_template_tenant_id ON staff_contract_template (tenant_id);
END IF;
IF to_regclass('public."opening_hours_baseline_schedule"') IS NULL THEN

CREATE TABLE opening_hours_baseline_schedule (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	effective_from DATE NOT NULL,
	opening_hours TEXT NOT NULL,
	note VARCHAR(512),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'opening_hours_baseline_schedule');
END IF;
IF 'opening_hours_baseline_schedule' = ANY(new_tables) THEN
CREATE INDEX ix_opening_hours_baseline_schedule_tenant_id ON opening_hours_baseline_schedule (tenant_id);
END IF;
IF to_regclass('public."opening_hours_date_override"') IS NULL THEN

CREATE TABLE opening_hours_date_override (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	date_from DATE NOT NULL,
	date_to DATE NOT NULL,
	closed BOOLEAN NOT NULL,
	opening_hours TEXT,
	note VARCHAR(512),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'opening_hours_date_override');
END IF;
IF 'opening_hours_date_override' = ANY(new_tables) THEN
CREATE INDEX ix_opening_hours_date_override_tenant_id ON opening_hours_date_override (tenant_id);
END IF;
IF to_regclass('public."delivery_marketplace_integration"') IS NULL THEN

CREATE TABLE delivery_marketplace_integration (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	provider_key VARCHAR(64) NOT NULL,
	connection_status VARCHAR(32) NOT NULL,
	credentials_encrypted TEXT,
	external_store_id VARCHAR(256),
	enabled BOOLEAN NOT NULL,
	webhook_ingest_token VARCHAR(64) NOT NULL,
	last_test_at TIMESTAMP WITH TIME ZONE,
	last_test_ok BOOLEAN,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'delivery_marketplace_integration');
END IF;
IF 'delivery_marketplace_integration' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_marketplace_integration_provider_key ON delivery_marketplace_integration (provider_key);
END IF;
IF 'delivery_marketplace_integration' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_marketplace_integration_tenant_id ON delivery_marketplace_integration (tenant_id);
END IF;
IF 'delivery_marketplace_integration' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_delivery_marketplace_integration_webhook_ingest_token ON delivery_marketplace_integration (webhook_ingest_token);
END IF;
IF to_regclass('public."social_connection"') IS NULL THEN

CREATE TABLE social_connection (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	provider_key VARCHAR(32) NOT NULL,
	connection_status VARCHAR(32) NOT NULL,
	oauth_payload_encrypted TEXT,
	meta_page_id VARCHAR(64),
	meta_page_name VARCHAR(512),
	instagram_account_id VARCHAR(64),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'social_connection');
END IF;
IF 'social_connection' = ANY(new_tables) THEN
CREATE INDEX ix_social_connection_tenant_id ON social_connection (tenant_id);
END IF;
IF 'social_connection' = ANY(new_tables) THEN
CREATE INDEX ix_social_connection_provider_key ON social_connection (provider_key);
END IF;
IF to_regclass('public."print_agent"') IS NULL THEN

CREATE TABLE print_agent (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	device_id VARCHAR(64) NOT NULL,
	display_name VARCHAR(120) NOT NULL,
	token_hash VARCHAR(64) NOT NULL,
	last_seen_at TIMESTAMP WITH TIME ZONE,
	revoked_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_print_agent_tenant_device UNIQUE (tenant_id, device_id),
	CONSTRAINT uq_print_agent_token_hash UNIQUE (token_hash),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'print_agent');
END IF;
IF 'print_agent' = ANY(new_tables) THEN
CREATE INDEX ix_print_agent_token_hash ON print_agent (token_hash);
END IF;
IF to_regclass('public."warehouse"') IS NULL THEN

CREATE TABLE warehouse (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	code VARCHAR,
	is_default BOOLEAN NOT NULL,
	is_active BOOLEAN NOT NULL,
	is_deleted BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'warehouse');
END IF;
IF 'warehouse' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_code ON warehouse (code);
END IF;
IF 'warehouse' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_name ON warehouse (name);
END IF;
IF 'warehouse' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_is_default ON warehouse (is_default);
END IF;
IF 'warehouse' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_is_deleted ON warehouse (is_deleted);
END IF;
IF 'warehouse' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_is_active ON warehouse (is_active);
END IF;
IF to_regclass('public."supplier"') IS NULL THEN

CREATE TABLE supplier (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	code VARCHAR,
	contact_name VARCHAR,
	phone VARCHAR,
	email VARCHAR,
	address VARCHAR,
	payment_terms VARCHAR,
	lead_time_days INTEGER,
	minimum_order_cents INTEGER,
	notes VARCHAR,
	is_active BOOLEAN NOT NULL,
	is_deleted BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'supplier');
END IF;
IF 'supplier' = ANY(new_tables) THEN
CREATE INDEX ix_supplier_name ON supplier (name);
END IF;
IF 'supplier' = ANY(new_tables) THEN
CREATE INDEX ix_supplier_is_deleted ON supplier (is_deleted);
END IF;
IF 'supplier' = ANY(new_tables) THEN
CREATE INDEX ix_supplier_is_active ON supplier (is_active);
END IF;
IF 'supplier' = ANY(new_tables) THEN
CREATE INDEX ix_supplier_code ON supplier (code);
END IF;
IF to_regclass('public."user"') IS NULL THEN

CREATE TABLE "user" (
	id SERIAL NOT NULL,
	email VARCHAR NOT NULL,
	hashed_password VARCHAR NOT NULL,
	full_name VARCHAR,
	token_version INTEGER NOT NULL,
	role user_role NOT NULL,
	tenant_id INTEGER,
	provider_id INTEGER,
	otp_secret VARCHAR,
	otp_enabled BOOLEAN NOT NULL,
	employee_number VARCHAR(64),
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(provider_id) REFERENCES provider (id)
)

;
new_tables := array_append(new_tables, 'user');
END IF;
IF 'user' = ANY(new_tables) THEN
CREATE INDEX ix_user_provider_id ON "user" (provider_id);
END IF;
IF 'user' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_user_email ON "user" (email);
END IF;
IF to_regclass('public."product_question"') IS NULL THEN

CREATE TABLE product_question (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	product_id INTEGER NOT NULL,
	type productquestiontype NOT NULL,
	label VARCHAR(256) NOT NULL,
	options JSONB,
	sort_order INTEGER NOT NULL,
	required BOOLEAN NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(product_id) REFERENCES product (id)
)

;
new_tables := array_append(new_tables, 'product_question');
END IF;
IF 'product_question' = ANY(new_tables) THEN
CREATE INDEX ix_product_question_product_id ON product_question (product_id);
END IF;
IF 'product_question' = ANY(new_tables) THEN
CREATE INDEX ix_product_question_type ON product_question (type);
END IF;
IF to_regclass('public."providerproduct"') IS NULL THEN

CREATE TABLE providerproduct (
	id SERIAL NOT NULL,
	catalog_id INTEGER NOT NULL,
	provider_id INTEGER NOT NULL,
	external_id VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	price_cents INTEGER,
	image_url VARCHAR,
	image_filename VARCHAR,
	availability BOOLEAN NOT NULL,
	country VARCHAR,
	region VARCHAR,
	grape_variety VARCHAR,
	volume_ml INTEGER,
	unit VARCHAR,
	wine_category_id VARCHAR,
	detailed_description VARCHAR,
	wine_style VARCHAR,
	vintage INTEGER,
	winery VARCHAR,
	aromas VARCHAR,
	elaboration VARCHAR,
	last_synced_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(catalog_id) REFERENCES productcatalog (id),
	FOREIGN KEY(provider_id) REFERENCES provider (id)
)

;
new_tables := array_append(new_tables, 'providerproduct');
END IF;
IF 'providerproduct' = ANY(new_tables) THEN
CREATE INDEX ix_providerproduct_availability ON providerproduct (availability);
END IF;
IF 'providerproduct' = ANY(new_tables) THEN
CREATE INDEX ix_providerproduct_provider_id ON providerproduct (provider_id);
END IF;
IF 'providerproduct' = ANY(new_tables) THEN
CREATE INDEX ix_providerproduct_external_id ON providerproduct (external_id);
END IF;
IF 'providerproduct' = ANY(new_tables) THEN
CREATE INDEX ix_providerproduct_catalog_id ON providerproduct (catalog_id);
END IF;
IF to_regclass('public."loyalty_membership"') IS NULL THEN

CREATE TABLE loyalty_membership (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	program_id INTEGER NOT NULL,
	billing_customer_id INTEGER,
	display_name VARCHAR(200) NOT NULL,
	email VARCHAR(320),
	phone VARCHAR(40),
	member_token VARCHAR(64) NOT NULL,
	balance INTEGER NOT NULL,
	lifetime_earn_units INTEGER NOT NULL,
	referral_code VARCHAR(32) NOT NULL,
	referred_by_membership_id INTEGER,
	referral_reward_granted BOOLEAN NOT NULL,
	birthday_month INTEGER,
	birthday_day INTEGER,
	birthday_bonus_year INTEGER,
	apple_pass_serial VARCHAR(64),
	apple_auth_token VARCHAR(64),
	apple_pass_updated_tag VARCHAR(64),
	google_loyalty_object_id VARCHAR(200),
	joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(program_id) REFERENCES loyalty_program (id),
	FOREIGN KEY(billing_customer_id) REFERENCES billing_customer (id),
	FOREIGN KEY(referred_by_membership_id) REFERENCES loyalty_membership (id)
)

;
new_tables := array_append(new_tables, 'loyalty_membership');
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_program_id ON loyalty_membership (program_id);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_email ON loyalty_membership (email);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_phone ON loyalty_membership (phone);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_loyalty_membership_referral_code ON loyalty_membership (referral_code);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_apple_pass_serial ON loyalty_membership (apple_pass_serial);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_billing_customer_id ON loyalty_membership (billing_customer_id);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_membership_referred_by_membership_id ON loyalty_membership (referred_by_membership_id);
END IF;
IF 'loyalty_membership' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_loyalty_membership_member_token ON loyalty_membership (member_token);
END IF;
IF to_regclass('public."restaurant_group_member"') IS NULL THEN

CREATE TABLE restaurant_group_member (
	id SERIAL NOT NULL,
	group_id INTEGER NOT NULL,
	tenant_id INTEGER NOT NULL,
	joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(group_id) REFERENCES restaurant_group (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id)
)

;
new_tables := array_append(new_tables, 'restaurant_group_member');
END IF;
IF 'restaurant_group_member' = ANY(new_tables) THEN
CREATE INDEX ix_restaurant_group_member_group_id ON restaurant_group_member (group_id);
END IF;
IF 'restaurant_group_member' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_restaurant_group_member_tenant_id ON restaurant_group_member (tenant_id);
END IF;
IF to_regclass('public."delivery_catalog_mapping"') IS NULL THEN

CREATE TABLE delivery_catalog_mapping (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	integration_id INTEGER NOT NULL,
	external_item_id VARCHAR(256) NOT NULL,
	product_id INTEGER,
	notes VARCHAR,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(integration_id) REFERENCES delivery_marketplace_integration (id),
	FOREIGN KEY(product_id) REFERENCES product (id)
)

;
new_tables := array_append(new_tables, 'delivery_catalog_mapping');
END IF;
IF 'delivery_catalog_mapping' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_catalog_mapping_integration_id ON delivery_catalog_mapping (integration_id);
END IF;
IF 'delivery_catalog_mapping' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_catalog_mapping_tenant_id ON delivery_catalog_mapping (tenant_id);
END IF;
IF to_regclass('public."delivery_integration_event_log"') IS NULL THEN

CREATE TABLE delivery_integration_event_log (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	integration_id INTEGER,
	provider_key VARCHAR(64) NOT NULL,
	event_type VARCHAR(64) NOT NULL,
	summary TEXT,
	detail JSONB,
	success BOOLEAN NOT NULL,
	error_message TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(integration_id) REFERENCES delivery_marketplace_integration (id)
)

;
new_tables := array_append(new_tables, 'delivery_integration_event_log');
END IF;
IF 'delivery_integration_event_log' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_integration_event_log_tenant_id ON delivery_integration_event_log (tenant_id);
END IF;
IF 'delivery_integration_event_log' = ANY(new_tables) THEN
CREATE INDEX ix_delivery_integration_event_log_integration_id ON delivery_integration_event_log (integration_id);
END IF;
IF to_regclass('public."inventory_item"') IS NULL THEN

CREATE TABLE inventory_item (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	sku VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	description VARCHAR,
	unit unitofmeasure NOT NULL,
	reorder_level NUMERIC(12, 4) NOT NULL,
	reorder_quantity NUMERIC(12, 4) NOT NULL,
	current_quantity NUMERIC(12, 4) NOT NULL,
	average_cost_cents INTEGER NOT NULL,
	category inventorycategory NOT NULL,
	default_supplier_id INTEGER,
	is_active BOOLEAN NOT NULL,
	is_deleted BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(default_supplier_id) REFERENCES supplier (id)
)

;
new_tables := array_append(new_tables, 'inventory_item');
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_sku ON inventory_item (sku);
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_is_active ON inventory_item (is_active);
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_default_supplier_id ON inventory_item (default_supplier_id);
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_is_deleted ON inventory_item (is_deleted);
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_category ON inventory_item (category);
END IF;
IF 'inventory_item' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_item_name ON inventory_item (name);
END IF;
IF to_regclass('public."user_otp_recovery_code"') IS NULL THEN

CREATE TABLE user_otp_recovery_code (
	id SERIAL NOT NULL,
	user_id INTEGER NOT NULL,
	code_hash VARCHAR(64) NOT NULL,
	used_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'user_otp_recovery_code');
END IF;
IF 'user_otp_recovery_code' = ANY(new_tables) THEN
CREATE INDEX ix_user_otp_recovery_code_user_id ON user_otp_recovery_code (user_id);
END IF;
IF 'user_otp_recovery_code' = ANY(new_tables) THEN
CREATE INDEX ix_user_otp_recovery_code_code_hash ON user_otp_recovery_code (code_hash);
END IF;
IF to_regclass('public."password_reset_token"') IS NULL THEN

CREATE TABLE password_reset_token (
	id SERIAL NOT NULL,
	user_id INTEGER NOT NULL,
	token_hash VARCHAR(64) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	used_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'password_reset_token');
END IF;
IF 'password_reset_token' = ANY(new_tables) THEN
CREATE INDEX ix_password_reset_token_user_id ON password_reset_token (user_id);
END IF;
IF 'password_reset_token' = ANY(new_tables) THEN
CREATE INDEX ix_password_reset_token_token_hash ON password_reset_token (token_hash);
END IF;
IF to_regclass('public."login_event"') IS NULL THEN

CREATE TABLE login_event (
	id SERIAL NOT NULL,
	user_id INTEGER,
	role user_role,
	tenant_id INTEGER,
	provider_id INTEGER,
	login_scope VARCHAR(32),
	logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(provider_id) REFERENCES provider (id)
)

;
new_tables := array_append(new_tables, 'login_event');
END IF;
IF 'login_event' = ANY(new_tables) THEN
CREATE INDEX ix_login_event_user_id ON login_event (user_id);
END IF;
IF 'login_event' = ANY(new_tables) THEN
CREATE INDEX ix_login_event_tenant_id ON login_event (tenant_id);
END IF;
IF to_regclass('public."tenantproduct"') IS NULL THEN

CREATE TABLE tenantproduct (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	catalog_id INTEGER NOT NULL,
	provider_product_id INTEGER,
	product_id INTEGER,
	name VARCHAR NOT NULL,
	price_cents INTEGER NOT NULL,
	cost_cents INTEGER,
	image_filename VARCHAR,
	ingredients VARCHAR,
	is_active BOOLEAN NOT NULL,
	tax_id INTEGER,
	available_from DATE,
	available_until DATE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(catalog_id) REFERENCES productcatalog (id),
	FOREIGN KEY(provider_product_id) REFERENCES providerproduct (id),
	FOREIGN KEY(product_id) REFERENCES product (id),
	FOREIGN KEY(tax_id) REFERENCES tax (id)
)

;
new_tables := array_append(new_tables, 'tenantproduct');
END IF;
IF 'tenantproduct' = ANY(new_tables) THEN
CREATE INDEX ix_tenantproduct_catalog_id ON tenantproduct (catalog_id);
END IF;
IF 'tenantproduct' = ANY(new_tables) THEN
CREATE INDEX ix_tenantproduct_provider_product_id ON tenantproduct (provider_product_id);
END IF;
IF 'tenantproduct' = ANY(new_tables) THEN
CREATE INDEX ix_tenantproduct_product_id ON tenantproduct (product_id);
END IF;
IF 'tenantproduct' = ANY(new_tables) THEN
CREATE INDEX ix_tenantproduct_tax_id ON tenantproduct (tax_id);
END IF;
IF 'tenantproduct' = ANY(new_tables) THEN
CREATE INDEX ix_tenantproduct_tenant_id ON tenantproduct (tenant_id);
END IF;
IF to_regclass('public."floor"') IS NULL THEN

CREATE TABLE floor (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	sort_order INTEGER NOT NULL,
	is_active BOOLEAN NOT NULL,
	seating_zone VARCHAR(16) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	default_waiter_id INTEGER,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(default_waiter_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'floor');
END IF;
IF to_regclass('public."shift"') IS NULL THEN

CREATE TABLE shift (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	user_id INTEGER NOT NULL,
	shift_date DATE NOT NULL,
	start_time TIME WITHOUT TIME ZONE NOT NULL,
	end_time TIME WITHOUT TIME ZONE NOT NULL,
	label VARCHAR(64),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'shift');
END IF;
IF to_regclass('public."work_session"') IS NULL THEN

CREATE TABLE work_session (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	user_id INTEGER NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE,
	start_ip VARCHAR(45),
	end_ip VARCHAR(45),
	break_started_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'work_session');
END IF;
IF 'work_session' = ANY(new_tables) THEN
CREATE INDEX ix_work_session_user_id ON work_session (user_id);
END IF;
IF to_regclass('public."loyalty_apple_device"') IS NULL THEN

CREATE TABLE loyalty_apple_device (
	id SERIAL NOT NULL,
	membership_id INTEGER NOT NULL,
	device_library_identifier VARCHAR(128) NOT NULL,
	push_token VARCHAR(255) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_loyalty_apple_device_membership_device UNIQUE (membership_id, device_library_identifier),
	FOREIGN KEY(membership_id) REFERENCES loyalty_membership (id)
)

;
new_tables := array_append(new_tables, 'loyalty_apple_device');
END IF;
IF 'loyalty_apple_device' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_apple_device_device_library_identifier ON loyalty_apple_device (device_library_identifier);
END IF;
IF 'loyalty_apple_device' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_apple_device_membership_id ON loyalty_apple_device (membership_id);
END IF;
IF to_regclass('public."cash_register_session"') IS NULL THEN

CREATE TABLE cash_register_session (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	opened_by_user_id INTEGER NOT NULL,
	opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
	opening_cash_cents INTEGER NOT NULL,
	status VARCHAR(16) NOT NULL,
	closed_by_user_id INTEGER,
	closed_at TIMESTAMP WITH TIME ZONE,
	counted_cash_cents INTEGER,
	expected_cash_cents INTEGER,
	variance_cents INTEGER,
	note VARCHAR(500),
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(opened_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(closed_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'cash_register_session');
END IF;
IF 'cash_register_session' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_session_tenant_status ON cash_register_session (tenant_id, status);
END IF;
IF 'cash_register_session' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_session_opened_by_user_id ON cash_register_session (opened_by_user_id);
END IF;
IF 'cash_register_session' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_session_status ON cash_register_session (status);
END IF;
IF to_regclass('public."staff_contract"') IS NULL THEN

CREATE TABLE staff_contract (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	contract_group_id UUID NOT NULL,
	version INTEGER NOT NULL,
	subject_user_id INTEGER NOT NULL,
	kind staff_contract_kind NOT NULL,
	status staff_contract_status NOT NULL,
	role_title VARCHAR(256) NOT NULL,
	start_date DATE,
	end_date DATE,
	compensation_summary TEXT,
	tax_identifier_subject VARCHAR(128),
	payment_structure staff_contract_payment_structure NOT NULL,
	payment_terms TEXT,
	jurisdiction_note TEXT,
	template_key VARCHAR(64),
	notes_internal TEXT,
	document_filename VARCHAR(512),
	document_uploaded_at TIMESTAMP WITH TIME ZONE,
	created_by_user_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(subject_user_id) REFERENCES "user" (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'staff_contract');
END IF;
IF 'staff_contract' = ANY(new_tables) THEN
CREATE INDEX ix_staff_contract_contract_group_id ON staff_contract (contract_group_id);
END IF;
IF 'staff_contract' = ANY(new_tables) THEN
CREATE INDEX ix_staff_contract_tenant_id ON staff_contract (tenant_id);
END IF;
IF 'staff_contract' = ANY(new_tables) THEN
CREATE INDEX ix_staff_contract_subject_user_id ON staff_contract (subject_user_id);
END IF;
IF to_regclass('public."social_oauth_state"') IS NULL THEN

CREATE TABLE social_oauth_state (
	state VARCHAR(64) NOT NULL,
	tenant_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	provider_key VARCHAR(32) NOT NULL,
	redirect_uri TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (state),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'social_oauth_state');
END IF;
IF 'social_oauth_state' = ANY(new_tables) THEN
CREATE INDEX ix_social_oauth_state_user_id ON social_oauth_state (user_id);
END IF;
IF 'social_oauth_state' = ANY(new_tables) THEN
CREATE INDEX ix_social_oauth_state_tenant_id ON social_oauth_state (tenant_id);
END IF;
IF to_regclass('public."social_post"') IS NULL THEN

CREATE TABLE social_post (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	caption TEXT NOT NULL,
	image_filename VARCHAR(256) NOT NULL,
	schedule_at TIMESTAMP WITH TIME ZONE NOT NULL,
	status VARCHAR(32) NOT NULL,
	error_message TEXT,
	created_by_user_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'social_post');
END IF;
IF 'social_post' = ANY(new_tables) THEN
CREATE INDEX ix_social_post_tenant_id ON social_post (tenant_id);
END IF;
IF to_regclass('public."newsletter_campaign"') IS NULL THEN

CREATE TABLE newsletter_campaign (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	subject VARCHAR(200) NOT NULL,
	body_html TEXT NOT NULL,
	body_text TEXT,
	audience_source VARCHAR(32) NOT NULL,
	status VARCHAR(32) NOT NULL,
	schedule_at TIMESTAMP WITH TIME ZONE NOT NULL,
	consent_confirmed BOOLEAN NOT NULL,
	recipient_count INTEGER NOT NULL,
	sent_count INTEGER NOT NULL,
	failed_count INTEGER NOT NULL,
	open_count INTEGER NOT NULL,
	click_count INTEGER NOT NULL,
	error_message TEXT,
	created_by_user_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'newsletter_campaign');
END IF;
IF 'newsletter_campaign' = ANY(new_tables) THEN
CREATE INDEX ix_newsletter_campaign_tenant_id ON newsletter_campaign (tenant_id);
END IF;
IF to_regclass('public."warehouse_stock"') IS NULL THEN

CREATE TABLE warehouse_stock (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	warehouse_id INTEGER NOT NULL,
	inventory_item_id INTEGER NOT NULL,
	quantity NUMERIC(12, 4) NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(warehouse_id) REFERENCES warehouse (id),
	FOREIGN KEY(inventory_item_id) REFERENCES inventory_item (id)
)

;
new_tables := array_append(new_tables, 'warehouse_stock');
END IF;
IF 'warehouse_stock' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_stock_warehouse_id ON warehouse_stock (warehouse_id);
END IF;
IF 'warehouse_stock' = ANY(new_tables) THEN
CREATE INDEX ix_warehouse_stock_inventory_item_id ON warehouse_stock (inventory_item_id);
END IF;
IF to_regclass('public."product_recipe"') IS NULL THEN

CREATE TABLE product_recipe (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	product_id INTEGER NOT NULL,
	inventory_item_id INTEGER NOT NULL,
	quantity_required NUMERIC(12, 4) NOT NULL,
	unit unitofmeasure NOT NULL,
	waste_percentage NUMERIC(5, 2) NOT NULL,
	notes VARCHAR,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(product_id) REFERENCES product (id),
	FOREIGN KEY(inventory_item_id) REFERENCES inventory_item (id)
)

;
new_tables := array_append(new_tables, 'product_recipe');
END IF;
IF 'product_recipe' = ANY(new_tables) THEN
CREATE INDEX ix_product_recipe_inventory_item_id ON product_recipe (inventory_item_id);
END IF;
IF 'product_recipe' = ANY(new_tables) THEN
CREATE INDEX ix_product_recipe_product_id ON product_recipe (product_id);
END IF;
IF to_regclass('public."purchase_order"') IS NULL THEN

CREATE TABLE purchase_order (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	order_number VARCHAR NOT NULL,
	supplier_id INTEGER NOT NULL,
	status purchaseorderstatus NOT NULL,
	order_date TIMESTAMP WITH TIME ZONE NOT NULL,
	expected_date DATE,
	received_date TIMESTAMP WITH TIME ZONE,
	subtotal_cents INTEGER NOT NULL,
	tax_cents INTEGER NOT NULL,
	total_cents INTEGER NOT NULL,
	notes VARCHAR,
	created_by_id INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(supplier_id) REFERENCES supplier (id),
	FOREIGN KEY(created_by_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'purchase_order');
END IF;
IF 'purchase_order' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_purchase_order_order_number ON purchase_order (order_number);
END IF;
IF 'purchase_order' = ANY(new_tables) THEN
CREATE INDEX ix_purchase_order_supplier_id ON purchase_order (supplier_id);
END IF;
IF 'purchase_order' = ANY(new_tables) THEN
CREATE INDEX ix_purchase_order_status ON purchase_order (status);
END IF;
IF to_regclass('public."table"') IS NULL THEN

CREATE TABLE "table" (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	name VARCHAR NOT NULL,
	token VARCHAR NOT NULL,
	floor_id INTEGER,
	x_position FLOAT NOT NULL,
	y_position FLOAT NOT NULL,
	rotation FLOAT NOT NULL,
	shape VARCHAR NOT NULL,
	width FLOAT NOT NULL,
	height FLOAT NOT NULL,
	seat_count INTEGER NOT NULL,
	table_group_id INTEGER,
	assigned_waiter_id INTEGER,
	order_pin VARCHAR,
	is_active BOOLEAN NOT NULL,
	active_order_id INTEGER,
	activated_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(floor_id) REFERENCES floor (id),
	FOREIGN KEY(table_group_id) REFERENCES table_group (id),
	FOREIGN KEY(assigned_waiter_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'table');
END IF;
IF 'table' = ANY(new_tables) THEN
CREATE INDEX ix_table_is_active ON "table" (is_active);
END IF;
IF 'table' = ANY(new_tables) THEN
CREATE INDEX ix_table_table_group_id ON "table" (table_group_id);
END IF;
IF 'table' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_table_token ON "table" (token);
END IF;
IF to_regclass('public."work_session_break"') IS NULL THEN

CREATE TABLE work_session_break (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	work_session_id INTEGER NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(work_session_id) REFERENCES work_session (id)
)

;
new_tables := array_append(new_tables, 'work_session_break');
END IF;
IF 'work_session_break' = ANY(new_tables) THEN
CREATE INDEX ix_work_session_break_work_session_id ON work_session_break (work_session_id);
END IF;
IF to_regclass('public."work_session_adjustment"') IS NULL THEN

CREATE TABLE work_session_adjustment (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	work_session_id INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	actor_user_id INTEGER,
	note VARCHAR NOT NULL,
	previous_started_at TIMESTAMP WITH TIME ZONE,
	previous_ended_at TIMESTAMP WITH TIME ZONE,
	new_started_at TIMESTAMP WITH TIME ZONE,
	new_ended_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(work_session_id) REFERENCES work_session (id),
	FOREIGN KEY(actor_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'work_session_adjustment');
END IF;
IF 'work_session_adjustment' = ANY(new_tables) THEN
CREATE INDEX ix_work_session_adjustment_actor_user_id ON work_session_adjustment (actor_user_id);
END IF;
IF 'work_session_adjustment' = ANY(new_tables) THEN
CREATE INDEX ix_work_session_adjustment_work_session_id ON work_session_adjustment (work_session_id);
END IF;
IF to_regclass('public."cash_register_movement"') IS NULL THEN

CREATE TABLE cash_register_movement (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	session_id INTEGER NOT NULL,
	movement_type VARCHAR(16) NOT NULL,
	amount_cents INTEGER NOT NULL,
	note VARCHAR(500) NOT NULL,
	created_by_user_id INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(session_id) REFERENCES cash_register_session (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'cash_register_movement');
END IF;
IF 'cash_register_movement' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_movement_created_by_user_id ON cash_register_movement (created_by_user_id);
END IF;
IF 'cash_register_movement' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_movement_session_id ON cash_register_movement (session_id);
END IF;
IF 'cash_register_movement' = ANY(new_tables) THEN
CREATE INDEX ix_cash_register_movement_created_at ON cash_register_movement (created_at);
END IF;
IF to_regclass('public."social_post_target"') IS NULL THEN

CREATE TABLE social_post_target (
	id SERIAL NOT NULL,
	social_post_id INTEGER NOT NULL,
	channel_key VARCHAR(64) NOT NULL,
	status VARCHAR(32) NOT NULL,
	external_id VARCHAR(256),
	error_message TEXT,
	PRIMARY KEY (id),
	FOREIGN KEY(social_post_id) REFERENCES social_post (id)
)

;
new_tables := array_append(new_tables, 'social_post_target');
END IF;
IF 'social_post_target' = ANY(new_tables) THEN
CREATE INDEX ix_social_post_target_social_post_id ON social_post_target (social_post_id);
END IF;
IF to_regclass('public."newsletter_recipient"') IS NULL THEN

CREATE TABLE newsletter_recipient (
	id SERIAL NOT NULL,
	campaign_id INTEGER NOT NULL,
	email VARCHAR(320) NOT NULL,
	tracking_token VARCHAR(64) NOT NULL,
	status VARCHAR(32) NOT NULL,
	error_message TEXT,
	opened_at TIMESTAMP WITH TIME ZONE,
	click_count INTEGER NOT NULL,
	sent_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(campaign_id) REFERENCES newsletter_campaign (id)
)

;
new_tables := array_append(new_tables, 'newsletter_recipient');
END IF;
IF 'newsletter_recipient' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_newsletter_recipient_tracking_token ON newsletter_recipient (tracking_token);
END IF;
IF 'newsletter_recipient' = ANY(new_tables) THEN
CREATE INDEX ix_newsletter_recipient_campaign_id ON newsletter_recipient (campaign_id);
END IF;
IF to_regclass('public."inventory_batch"') IS NULL THEN

CREATE TABLE inventory_batch (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	inventory_item_id INTEGER NOT NULL,
	purchase_order_id INTEGER,
	warehouse_id INTEGER,
	batch_number VARCHAR,
	received_at TIMESTAMP WITH TIME ZONE NOT NULL,
	quantity_received NUMERIC(12, 4) NOT NULL,
	quantity_remaining NUMERIC(12, 4) NOT NULL,
	cost_per_unit_cents INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(inventory_item_id) REFERENCES inventory_item (id),
	FOREIGN KEY(purchase_order_id) REFERENCES purchase_order (id),
	FOREIGN KEY(warehouse_id) REFERENCES warehouse (id)
)

;
new_tables := array_append(new_tables, 'inventory_batch');
END IF;
IF 'inventory_batch' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_batch_warehouse_id ON inventory_batch (warehouse_id);
END IF;
IF 'inventory_batch' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_batch_inventory_item_id ON inventory_batch (inventory_item_id);
END IF;
IF 'inventory_batch' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_batch_purchase_order_id ON inventory_batch (purchase_order_id);
END IF;
IF to_regclass('public."purchase_order_item"') IS NULL THEN

CREATE TABLE purchase_order_item (
	id SERIAL NOT NULL,
	purchase_order_id INTEGER NOT NULL,
	inventory_item_id INTEGER NOT NULL,
	quantity_ordered NUMERIC(12, 4) NOT NULL,
	quantity_received NUMERIC(12, 4) NOT NULL,
	unit unitofmeasure NOT NULL,
	unit_cost_cents INTEGER NOT NULL,
	line_total_cents INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(purchase_order_id) REFERENCES purchase_order (id),
	FOREIGN KEY(inventory_item_id) REFERENCES inventory_item (id)
)

;
new_tables := array_append(new_tables, 'purchase_order_item');
END IF;
IF 'purchase_order_item' = ANY(new_tables) THEN
CREATE INDEX ix_purchase_order_item_inventory_item_id ON purchase_order_item (inventory_item_id);
END IF;
IF 'purchase_order_item' = ANY(new_tables) THEN
CREATE INDEX ix_purchase_order_item_purchase_order_id ON purchase_order_item (purchase_order_id);
END IF;
IF to_regclass('public."reservation"') IS NULL THEN

CREATE TABLE reservation (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	customer_name VARCHAR NOT NULL,
	customer_phone VARCHAR NOT NULL,
	customer_email VARCHAR,
	reservation_date DATE NOT NULL,
	reservation_time TIME WITHOUT TIME ZONE NOT NULL,
	party_size INTEGER NOT NULL,
	status reservationstatus NOT NULL,
	table_id INTEGER,
	created_by_user_id INTEGER,
	seated_at TIMESTAMP WITH TIME ZONE,
	token VARCHAR,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	client_notes VARCHAR,
	customer_notes VARCHAR,
	owner_notes VARCHAR,
	delay_notice VARCHAR,
	client_ip VARCHAR(45),
	client_user_agent VARCHAR(512),
	client_fingerprint VARCHAR(256),
	client_screen_width INTEGER,
	client_screen_height INTEGER,
	reminder_24h_sent_at TIMESTAMP WITH TIME ZONE,
	reminder_2h_sent_at TIMESTAMP WITH TIME ZONE,
	service_type VARCHAR(16),
	seating_preference VARCHAR(32),
	allergies_has BOOLEAN NOT NULL,
	allergies_detail VARCHAR,
	preferred_floor_id INTEGER,
	locale VARCHAR(16),
	guest_birthday_month INTEGER,
	guest_birthday_day INTEGER,
	guest_birthday_marketing_consent BOOLEAN NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(table_id) REFERENCES "table" (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(preferred_floor_id) REFERENCES floor (id)
)

;
new_tables := array_append(new_tables, 'reservation');
END IF;
IF 'reservation' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_reservation_token ON reservation (token);
END IF;
IF 'reservation' = ANY(new_tables) THEN
CREATE INDEX ix_reservation_created_by_user_id ON reservation (created_by_user_id);
END IF;
IF 'reservation' = ANY(new_tables) THEN
CREATE INDEX ix_reservation_status ON reservation (status);
END IF;
IF 'reservation' = ANY(new_tables) THEN
CREATE INDEX ix_reservation_customer_email ON reservation (customer_email);
END IF;
IF to_regclass('public."order"') IS NULL THEN

CREATE TABLE "order" (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	table_id INTEGER,
	created_by_user_id INTEGER,
	status orderstatus NOT NULL,
	notes VARCHAR,
	session_id VARCHAR,
	customer_name VARCHAR,
	billing_customer_id INTEGER,
	invoice_email VARCHAR(255),
	customer_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	cancelled_at TIMESTAMP WITH TIME ZONE,
	cancelled_by VARCHAR,
	bill_requested_at TIMESTAMP WITH TIME ZONE,
	paid_at TIMESTAMP WITH TIME ZONE,
	paid_by_user_id INTEGER,
	payment_method VARCHAR,
	revolut_order_id VARCHAR,
	tip_percent_applied INTEGER,
	tip_amount_cents INTEGER,
	tip_attributed_user_id INTEGER,
	location_verified BOOLEAN,
	flagged_for_review BOOLEAN NOT NULL,
	flag_reason VARCHAR,
	deleted_at TIMESTAMP WITH TIME ZONE,
	deleted_by_user_id INTEGER,
	staff_urgent BOOLEAN NOT NULL,
	delivery_integration_id INTEGER,
	external_order_ref VARCHAR(256),
	order_channel orderchannel NOT NULL,
	staff_sale_idempotency_key VARCHAR(64),
	staff_sale_payload_hash VARCHAR(64),
	delivery_address TEXT,
	customer_phone VARCHAR(40),
	courier_user_id INTEGER,
	delivery_fee_cents INTEGER NOT NULL,
	loyalty_membership_id INTEGER,
	loyalty_discount_cents INTEGER NOT NULL,
	loyalty_units_redeemed INTEGER NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_order_tenant_staff_sale_key UNIQUE (tenant_id, staff_sale_idempotency_key),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(table_id) REFERENCES "table" (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(billing_customer_id) REFERENCES billing_customer (id),
	FOREIGN KEY(customer_id) REFERENCES customer (id),
	FOREIGN KEY(tip_attributed_user_id) REFERENCES "user" (id),
	FOREIGN KEY(deleted_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(delivery_integration_id) REFERENCES delivery_marketplace_integration (id),
	FOREIGN KEY(courier_user_id) REFERENCES "user" (id),
	FOREIGN KEY(loyalty_membership_id) REFERENCES loyalty_membership (id)
)

;
new_tables := array_append(new_tables, 'order');
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_staff_urgent ON "order" (staff_urgent);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_order_channel ON "order" (order_channel);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_delivery_integration_id ON "order" (delivery_integration_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_session_id ON "order" (session_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_invoice_email ON "order" (invoice_email);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_created_by_user_id ON "order" (created_by_user_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_loyalty_membership_id ON "order" (loyalty_membership_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_customer_name ON "order" (customer_name);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_customer_id ON "order" (customer_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_courier_user_id ON "order" (courier_user_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_billing_customer_id ON "order" (billing_customer_id);
END IF;
IF 'order' = ANY(new_tables) THEN
CREATE INDEX ix_order_external_order_ref ON "order" (external_order_ref);
END IF;
IF to_regclass('public."guest_feedback"') IS NULL THEN

CREATE TABLE guest_feedback (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	rating INTEGER NOT NULL,
	comment VARCHAR,
	contact_name VARCHAR(200),
	contact_email VARCHAR(320),
	contact_phone VARCHAR(40),
	reservation_id INTEGER,
	client_ip VARCHAR(45),
	client_user_agent VARCHAR(512),
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(reservation_id) REFERENCES reservation (id)
)

;
new_tables := array_append(new_tables, 'guest_feedback');
END IF;
IF to_regclass('public."loyalty_ledger_entry"') IS NULL THEN

CREATE TABLE loyalty_ledger_entry (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	membership_id INTEGER NOT NULL,
	entry_type VARCHAR(16) NOT NULL,
	units INTEGER NOT NULL,
	balance_after INTEGER NOT NULL,
	order_id INTEGER,
	note VARCHAR(500),
	created_by_user_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(membership_id) REFERENCES loyalty_membership (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'loyalty_ledger_entry');
END IF;
IF 'loyalty_ledger_entry' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_ledger_entry_membership_id ON loyalty_ledger_entry (membership_id);
END IF;
IF 'loyalty_ledger_entry' = ANY(new_tables) THEN
CREATE INDEX ix_loyalty_ledger_entry_order_id ON loyalty_ledger_entry (order_id);
END IF;
IF to_regclass('public."branch_hub_fulfillment"') IS NULL THEN

CREATE TABLE branch_hub_fulfillment (
	id SERIAL NOT NULL,
	group_id INTEGER NOT NULL,
	order_id INTEGER NOT NULL,
	branch_tenant_id INTEGER NOT NULL,
	hub_tenant_id INTEGER NOT NULL,
	status hubfulfillmentstatus NOT NULL,
	notes TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	prepared_at TIMESTAMP WITH TIME ZONE,
	created_by_user_id INTEGER,
	prepared_by_user_id INTEGER,
	PRIMARY KEY (id),
	FOREIGN KEY(group_id) REFERENCES restaurant_group (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(branch_tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(hub_tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(prepared_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'branch_hub_fulfillment');
END IF;
IF 'branch_hub_fulfillment' = ANY(new_tables) THEN
CREATE UNIQUE INDEX ix_branch_hub_fulfillment_order_id ON branch_hub_fulfillment (order_id);
END IF;
IF 'branch_hub_fulfillment' = ANY(new_tables) THEN
CREATE INDEX ix_branch_hub_fulfillment_hub_tenant_id ON branch_hub_fulfillment (hub_tenant_id);
END IF;
IF 'branch_hub_fulfillment' = ANY(new_tables) THEN
CREATE INDEX ix_branch_hub_fulfillment_group_id ON branch_hub_fulfillment (group_id);
END IF;
IF 'branch_hub_fulfillment' = ANY(new_tables) THEN
CREATE INDEX ix_branch_hub_fulfillment_branch_tenant_id ON branch_hub_fulfillment (branch_tenant_id);
END IF;
IF 'branch_hub_fulfillment' = ANY(new_tables) THEN
CREATE INDEX ix_branch_hub_fulfillment_status ON branch_hub_fulfillment (status);
END IF;
IF to_regclass('public."fiscal_invoice"') IS NULL THEN

CREATE TABLE fiscal_invoice (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	order_id INTEGER NOT NULL,
	series VARCHAR(32) NOT NULL,
	doc_number INTEGER NOT NULL,
	full_number VARCHAR(64) NOT NULL,
	mode VARCHAR(16) NOT NULL,
	status VARCHAR(32) NOT NULL,
	issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
	request_payload JSONB,
	response_payload JSONB,
	verification_qr_content TEXT NOT NULL,
	verification_text TEXT NOT NULL,
	record_type VARCHAR(16) NOT NULL,
	previous_hash VARCHAR(64) NOT NULL,
	record_hash VARCHAR(64) NOT NULL,
	cancels_fiscal_invoice_id INTEGER,
	amount_cents INTEGER NOT NULL,
	submission_status VARCHAR(32) NOT NULL,
	sandbox_submitted_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(cancels_fiscal_invoice_id) REFERENCES fiscal_invoice (id)
)

;
new_tables := array_append(new_tables, 'fiscal_invoice');
END IF;
IF 'fiscal_invoice' = ANY(new_tables) THEN
CREATE INDEX ix_fiscal_invoice_order_id ON fiscal_invoice (order_id);
END IF;
IF 'fiscal_invoice' = ANY(new_tables) THEN
CREATE INDEX ix_fiscal_invoice_tenant_id ON fiscal_invoice (tenant_id);
END IF;
IF to_regclass('public."tse_transaction"') IS NULL THEN

CREATE TABLE tse_transaction (
	id SERIAL NOT NULL,
	tenant_id INTEGER NOT NULL,
	order_id INTEGER NOT NULL,
	process_type VARCHAR(16) NOT NULL,
	mode VARCHAR(16) NOT NULL,
	tse_serial VARCHAR(128) NOT NULL,
	signature_counter INTEGER NOT NULL,
	signature_value TEXT NOT NULL,
	qr_content TEXT NOT NULL,
	process_data TEXT NOT NULL,
	transaction_number INTEGER NOT NULL,
	certificate_serial VARCHAR(128) NOT NULL,
	time_start TIMESTAMP WITH TIME ZONE NOT NULL,
	time_end TIMESTAMP WITH TIME ZONE NOT NULL,
	amount_cents INTEGER NOT NULL,
	request_payload JSONB,
	response_payload JSONB,
	submission_status VARCHAR(32) NOT NULL,
	storno_of_tse_transaction_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(storno_of_tse_transaction_id) REFERENCES tse_transaction (id)
)

;
new_tables := array_append(new_tables, 'tse_transaction');
END IF;
IF 'tse_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_tse_transaction_tenant_id ON tse_transaction (tenant_id);
END IF;
IF 'tse_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_tse_transaction_order_id ON tse_transaction (order_id);
END IF;
IF to_regclass('public."order_payment"') IS NULL THEN

CREATE TABLE order_payment (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	order_id INTEGER NOT NULL,
	amount_cents INTEGER NOT NULL,
	payment_method VARCHAR(32) NOT NULL,
	idempotency_key VARCHAR(64),
	cash_register_session_id INTEGER,
	payer_label VARCHAR(120),
	tip_amount_cents INTEGER,
	stripe_payment_intent_id VARCHAR(128),
	paid_by_user_id INTEGER,
	paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
	voided_at TIMESTAMP WITH TIME ZONE,
	note VARCHAR(500),
	PRIMARY KEY (id),
	CONSTRAINT uq_order_payment_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(cash_register_session_id) REFERENCES cash_register_session (id),
	FOREIGN KEY(paid_by_user_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'order_payment');
END IF;
IF 'order_payment' = ANY(new_tables) THEN
CREATE INDEX ix_order_payment_order_id ON order_payment (order_id);
END IF;
IF 'order_payment' = ANY(new_tables) THEN
CREATE INDEX ix_order_payment_cash_register_session_id ON order_payment (cash_register_session_id);
END IF;
IF to_regclass('public."offline_order_idempotency"') IS NULL THEN

CREATE TABLE offline_order_idempotency (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	idempotency_key VARCHAR(64) NOT NULL,
	order_id INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_offline_order_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id)
)

;
new_tables := array_append(new_tables, 'offline_order_idempotency');
END IF;
IF 'offline_order_idempotency' = ANY(new_tables) THEN
CREATE INDEX ix_offline_order_idempotency_order_id ON offline_order_idempotency (order_id);
END IF;
IF 'offline_order_idempotency' = ANY(new_tables) THEN
CREATE INDEX ix_offline_order_idempotency_idempotency_key ON offline_order_idempotency (idempotency_key);
END IF;
IF to_regclass('public."orderitem"') IS NULL THEN

CREATE TABLE orderitem (
	id SERIAL NOT NULL,
	order_id INTEGER NOT NULL,
	product_id INTEGER NOT NULL,
	product_name VARCHAR NOT NULL,
	quantity INTEGER NOT NULL,
	price_cents INTEGER NOT NULL,
	cost_cents INTEGER,
	notes VARCHAR,
	customization_answers JSONB,
	customization_summary VARCHAR(1024),
	line_modifiers JSONB,
	line_modifiers_summary VARCHAR(1024),
	list_price_cents INTEGER,
	discount_cents INTEGER NOT NULL,
	promo_id INTEGER,
	promo_snapshot JSONB,
	tax_id INTEGER,
	tax_rate_percent INTEGER,
	tax_amount_cents INTEGER,
	status orderitemstatus NOT NULL,
	status_updated_at TIMESTAMP WITH TIME ZONE,
	prepared_by_user_id INTEGER,
	delivered_by_user_id INTEGER,
	removed_by_customer BOOLEAN NOT NULL,
	removed_at TIMESTAMP WITH TIME ZONE,
	removed_reason VARCHAR,
	removed_by_user_id INTEGER,
	modified_by_user_id INTEGER,
	modified_at TIMESTAMP WITH TIME ZONE,
	cancelled_reason VARCHAR,
	added_by_session VARCHAR,
	location_flagged BOOLEAN NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(product_id) REFERENCES product (id),
	FOREIGN KEY(promo_id) REFERENCES price_promotion (id),
	FOREIGN KEY(tax_id) REFERENCES tax (id)
)

;
new_tables := array_append(new_tables, 'orderitem');
END IF;
IF 'orderitem' = ANY(new_tables) THEN
CREATE INDEX ix_orderitem_status ON orderitem (status);
END IF;
IF 'orderitem' = ANY(new_tables) THEN
CREATE INDEX ix_orderitem_promo_id ON orderitem (promo_id);
END IF;
IF 'orderitem' = ANY(new_tables) THEN
CREATE INDEX ix_orderitem_removed_by_customer ON orderitem (removed_by_customer);
END IF;
IF 'orderitem' = ANY(new_tables) THEN
CREATE INDEX ix_orderitem_tax_id ON orderitem (tax_id);
END IF;
IF to_regclass('public."print_job"') IS NULL THEN

CREATE TABLE print_job (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	job_type VARCHAR(16) NOT NULL,
	printer_role VARCHAR(32) NOT NULL,
	status VARCHAR(16) NOT NULL,
	order_id INTEGER,
	payload JSONB NOT NULL,
	created_by_user_id INTEGER,
	claimed_by_agent_id INTEGER,
	claimed_at TIMESTAMP WITH TIME ZONE,
	completed_at TIMESTAMP WITH TIME ZONE,
	error_message VARCHAR(500),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(created_by_user_id) REFERENCES "user" (id),
	FOREIGN KEY(claimed_by_agent_id) REFERENCES print_agent (id)
)

;
new_tables := array_append(new_tables, 'print_job');
END IF;
IF 'print_job' = ANY(new_tables) THEN
CREATE INDEX ix_print_job_order_id ON print_job (order_id);
END IF;
IF to_regclass('public."inventory_transaction"') IS NULL THEN

CREATE TABLE inventory_transaction (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	inventory_item_id INTEGER NOT NULL,
	batch_id INTEGER,
	transaction_type transactiontype NOT NULL,
	quantity NUMERIC(12, 4) NOT NULL,
	unit unitofmeasure NOT NULL,
	unit_cost_cents INTEGER,
	total_cost_cents INTEGER,
	balance_after NUMERIC(12, 4) NOT NULL,
	order_id INTEGER,
	purchase_order_id INTEGER,
	warehouse_id INTEGER,
	notes VARCHAR,
	created_by_id INTEGER,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(inventory_item_id) REFERENCES inventory_item (id),
	FOREIGN KEY(batch_id) REFERENCES inventory_batch (id),
	FOREIGN KEY(order_id) REFERENCES "order" (id),
	FOREIGN KEY(purchase_order_id) REFERENCES purchase_order (id),
	FOREIGN KEY(warehouse_id) REFERENCES warehouse (id),
	FOREIGN KEY(created_by_id) REFERENCES "user" (id)
)

;
new_tables := array_append(new_tables, 'inventory_transaction');
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_purchase_order_id ON inventory_transaction (purchase_order_id);
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_batch_id ON inventory_transaction (batch_id);
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_order_id ON inventory_transaction (order_id);
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_inventory_item_id ON inventory_transaction (inventory_item_id);
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_transaction_type ON inventory_transaction (transaction_type);
END IF;
IF 'inventory_transaction' = ANY(new_tables) THEN
CREATE INDEX ix_inventory_transaction_warehouse_id ON inventory_transaction (warehouse_id);
END IF;
IF to_regclass('public."order_payment_item"') IS NULL THEN

CREATE TABLE order_payment_item (
	tenant_id INTEGER NOT NULL,
	id SERIAL NOT NULL,
	order_payment_id INTEGER NOT NULL,
	order_item_id INTEGER NOT NULL,
	amount_cents INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(tenant_id) REFERENCES tenant (id),
	FOREIGN KEY(order_payment_id) REFERENCES order_payment (id),
	FOREIGN KEY(order_item_id) REFERENCES orderitem (id)
)

;
new_tables := array_append(new_tables, 'order_payment_item');
END IF;
IF 'order_payment_item' = ANY(new_tables) THEN
CREATE INDEX ix_order_payment_item_order_item_id ON order_payment_item (order_item_id);
END IF;
IF 'order_payment_item' = ANY(new_tables) THEN
CREATE INDEX ix_order_payment_item_order_payment_id ON order_payment_item (order_payment_id);
END IF;
IF 'tenant' = ANY(new_tables) THEN
ALTER TABLE tenant ADD CONSTRAINT baseline_fk_tenant_default_kitchen_station_id FOREIGN KEY(default_kitchen_station_id) REFERENCES kitchen_station (id);
END IF;
IF 'tax' = ANY(new_tables) THEN
ALTER TABLE tax ADD CONSTRAINT baseline_fk_tax_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenant (id);
END IF;
IF 'tenant' = ANY(new_tables) THEN
ALTER TABLE tenant ADD CONSTRAINT baseline_fk_tenant_default_bar_station_id FOREIGN KEY(default_bar_station_id) REFERENCES kitchen_station (id);
END IF;
IF 'tenant' = ANY(new_tables) THEN
ALTER TABLE tenant ADD CONSTRAINT baseline_fk_tenant_default_tax_id FOREIGN KEY(default_tax_id) REFERENCES tax (id);
END IF;
IF 'kitchen_station' = ANY(new_tables) THEN
ALTER TABLE kitchen_station ADD CONSTRAINT baseline_fk_kitchen_station_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenant (id);
END IF;
END $baseline$;
