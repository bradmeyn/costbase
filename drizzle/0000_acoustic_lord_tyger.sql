CREATE TABLE "account" (
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_name" text,
	"last_name" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amit_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"financial_year" integer NOT NULL,
	"label_13u" integer DEFAULT 0 NOT NULL,
	"label_13c" integer DEFAULT 0 NOT NULL,
	"label_13q" integer DEFAULT 0 NOT NULL,
	"label_13r" integer DEFAULT 0 NOT NULL,
	"label_13a" integer DEFAULT 0 NOT NULL,
	"label_18a" integer DEFAULT 0 NOT NULL,
	"label_18h" integer DEFAULT 0 NOT NULL,
	"label_20e" integer DEFAULT 0 NOT NULL,
	"label_20m" integer DEFAULT 0 NOT NULL,
	"label_20o" integer DEFAULT 0 NOT NULL,
	"unfranked_distributions" integer DEFAULT 0 NOT NULL,
	"unfranked_cfi_distributions" integer DEFAULT 0 NOT NULL,
	"interest_subject_to_nrwht" integer DEFAULT 0 NOT NULL,
	"interest_not_subject_to_nrwht" integer DEFAULT 0 NOT NULL,
	"other_income_clean_building_mit" integer DEFAULT 0 NOT NULL,
	"other_income_excluded_from_ncmi" integer DEFAULT 0 NOT NULL,
	"other_income_ncmi" integer DEFAULT 0 NOT NULL,
	"other_income" integer DEFAULT 0 NOT NULL,
	"non_primary_production_income" integer DEFAULT 0 NOT NULL,
	"franked_distributions_cash" integer DEFAULT 0 NOT NULL,
	"franked_distributions_credit" integer DEFAULT 0 NOT NULL,
	"franked_distributions_attribution" integer DEFAULT 0 NOT NULL,
	"discounted_tap_clean_building_mit" integer DEFAULT 0 NOT NULL,
	"discounted_tap_excluded_from_ncmi" integer DEFAULT 0 NOT NULL,
	"discounted_tap_ncmi" integer DEFAULT 0 NOT NULL,
	"discounted_tap" integer DEFAULT 0 NOT NULL,
	"discounted_ntap" integer DEFAULT 0 NOT NULL,
	"other_method_tap_clean_building_mit" integer DEFAULT 0 NOT NULL,
	"other_method_tap_excluded_from_ncmi" integer DEFAULT 0 NOT NULL,
	"other_method_tap_ncmi" integer DEFAULT 0 NOT NULL,
	"other_method_tap" integer DEFAULT 0 NOT NULL,
	"other_method_ntap" integer DEFAULT 0 NOT NULL,
	"net_capital_gain" integer DEFAULT 0 NOT NULL,
	"amit_cgt_gross_up_amount" integer DEFAULT 0 NOT NULL,
	"total_current_year_capital_gains" integer DEFAULT 0 NOT NULL,
	"foreign_income_tax_offset" integer DEFAULT 0 NOT NULL,
	"assessable_foreign_source_income" integer DEFAULT 0 NOT NULL,
	"non_assessable_non_exempt_amount" integer DEFAULT 0 NOT NULL,
	"gross_cash_distribution" integer DEFAULT 0 NOT NULL,
	"gross_attribution" integer DEFAULT 0 NOT NULL,
	"amit_cost_base_excess" integer DEFAULT 0 NOT NULL,
	"amit_cost_base_shortfall" integer DEFAULT 0 NOT NULL,
	"tfn_amounts_withheld" integer DEFAULT 0 NOT NULL,
	"nrwht_interest_dividend" integer DEFAULT 0 NOT NULL,
	"nrwht_fund_payment" integer DEFAULT 0 NOT NULL,
	"net_cash_distribution" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amit_statement_holding_year" UNIQUE("holding_id","financial_year")
);
--> statement-breakpoint
CREATE TABLE "distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"date_paid" timestamp NOT NULL,
	"gross_payment" integer DEFAULT 0 NOT NULL,
	"tax_withheld" integer DEFAULT 0 NOT NULL,
	"reinvested" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"investment_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"management_fee" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" integer NOT NULL,
	"brokerage" integer DEFAULT 0 NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amit_statement" ADD CONSTRAINT "amit_statement_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_investment_id_investment_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE cascade ON UPDATE no action;