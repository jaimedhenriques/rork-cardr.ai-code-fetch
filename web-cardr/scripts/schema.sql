-- Auto-generated best-effort schema migration
create extension if not exists "pgcrypto";

-- Tables
create table if not exists public."account_deletion_audit" (
  "created_at" timestamptz default now(),
  "db_errors" jsonb default '{}'::jsonb,
  "db_rows_deleted" jsonb default '{}'::jsonb,
  "duration_ms" numeric,
  "email" text,
  "error_message" text,
  "id" uuid primary key default gen_random_uuid(),
  "ip_address" text,
  "phase" text,
  "status" text not null,
  "storage_objects_deleted" jsonb default '{}'::jsonb,
  "stripe_subs_cancelled" numeric,
  "user_agent" text,
  "user_id" uuid not null
);
create table if not exists public."agent_runs" (
  "agent_id" uuid not null,
  "completed_at" timestamptz,
  "contact_id" uuid,
  "created_at" timestamptz default now(),
  "error_message" text,
  "id" uuid primary key default gen_random_uuid(),
  "input" jsonb default '{}'::jsonb,
  "output" jsonb default '{}'::jsonb,
  "status" text,
  "user_id" uuid not null
);
create table if not exists public."agents" (
  "config" jsonb default '{}'::jsonb,
  "created_at" timestamptz default now(),
  "description" text,
  "icon" text,
  "id" uuid primary key default gen_random_uuid(),
  "is_template" boolean default false,
  "name" text not null,
  "status" text,
  "system_prompt" text,
  "type" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid
);
create table if not exists public."automation_sequence_messages" (
  "body" text not null,
  "channel" text not null,
  "created_at" timestamptz default now(),
  "error_message" text,
  "id" uuid primary key default gen_random_uuid(),
  "run_id" uuid not null,
  "scheduled_at" timestamptz,
  "sent_at" timestamptz,
  "status" text,
  "step_id" uuid not null,
  "subject" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."automation_sequence_runs" (
  "completed_at" timestamptz,
  "contact_id" uuid not null,
  "created_at" timestamptz default now(),
  "current_step" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "sequence_id" uuid not null,
  "started_at" timestamptz,
  "status" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."automation_sequence_steps" (
  "body_template" text not null,
  "channel" text not null,
  "created_at" timestamptz default now(),
  "delay_days" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "sequence_id" uuid not null,
  "step_order" numeric not null,
  "subject_template" text,
  "user_id" uuid not null
);
create table if not exists public."automation_sequences" (
  "channel" text,
  "created_at" timestamptz default now(),
  "description" text,
  "goal" text,
  "id" uuid primary key default gen_random_uuid(),
  "is_active" boolean default false,
  "name" text not null,
  "tone" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."calendar_events" (
  "all_day" boolean default false,
  "bot_enabled" boolean default false,
  "bot_name" text,
  "calendar_provider" text,
  "created_at" timestamptz default now(),
  "description" text,
  "end_time" text,
  "event_id" uuid,
  "external_id" uuid,
  "google_calendar_id" uuid,
  "google_etag" text,
  "google_event_id" uuid,
  "id" uuid primary key default gen_random_uuid(),
  "location" text,
  "meeting_url" text,
  "reminder_email" text,
  "reminder_minutes" numeric,
  "reminder_type" text,
  "source" text,
  "start_time" text not null,
  "sync_source" text,
  "title" text not null,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."ci_errors" (
  "code" text,
  "column_number" numeric,
  "created_at" timestamptz default now(),
  "file_path" text,
  "fingerprint" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "line_number" numeric,
  "message" text not null,
  "raw_line" text,
  "rule" text,
  "run_id" uuid not null,
  "severity" text,
  "source" text not null
);
create table if not exists public."ci_runs" (
  "branch" text,
  "commit_sha" text,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "metadata" jsonb default '{}'::jsonb,
  "raw_log" text,
  "source" text not null,
  "status" text,
  "total_errors" numeric,
  "total_warnings" numeric,
  "triggered_by" text
);
create table if not exists public."contact_activities" (
  "contact_id" uuid not null,
  "created_at" timestamptz default now(),
  "description" text,
  "id" uuid primary key default gen_random_uuid(),
  "metadata" jsonb default '{}'::jsonb,
  "title" text not null,
  "type" text,
  "user_id" uuid not null
);
create table if not exists public."contact_tags" (
  "contact_id" uuid not null,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "tag_id" uuid not null
);
create table if not exists public."contacts" (
  "annual_revenue" text,
  "avatar" text,
  "birthday" text,
  "company" text,
  "company_address" text,
  "company_description" text,
  "company_email" text,
  "company_linkedin" text,
  "company_size" text,
  "company_type" text,
  "conversation_status" text,
  "created_at" timestamptz default now(),
  "email" text,
  "enriched" boolean default false,
  "enriched_at" timestamptz,
  "folder_id" uuid,
  "follow_up_date" text,
  "follow_up_sent_at" timestamptz,
  "founding_year" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "industry" text,
  "lead_source" text,
  "linkedin" text,
  "linkedin_profile_url" text,
  "location" text,
  "mobile_phone" text,
  "name" text not null,
  "next_action_date" text,
  "next_step" text,
  "notes" text,
  "phone" text,
  "pipedrive_deal_id" numeric,
  "pipedrive_person_id" numeric,
  "pipedrive_synced_at" timestamptz,
  "scanned_at" timestamptz,
  "stage_id" uuid,
  "title" text,
  "user_id" uuid not null,
  "website" text,
  "work_phone" text
);
create table if not exists public."coupon_codes" (
  "active" boolean default false,
  "applies_to" text[],
  "code" text not null,
  "created_at" timestamptz default now(),
  "discount_pct" numeric not null,
  "duration" text,
  "duration_months" numeric,
  "expires_at" timestamptz,
  "id" uuid primary key default gen_random_uuid(),
  "max_uses" numeric,
  "updated_at" timestamptz default now(),
  "use_case" text
);
create table if not exists public."coupon_usage" (
  "applied_at" timestamptz,
  "coupon_id" uuid not null,
  "id" uuid primary key default gen_random_uuid(),
  "stripe_coupon_id" uuid,
  "user_id" uuid not null
);
create table if not exists public."email_send_log" (
  "created_at" timestamptz default now(),
  "error_message" text,
  "id" uuid primary key default gen_random_uuid(),
  "message_id" uuid,
  "metadata" jsonb default '{}'::jsonb,
  "recipient_email" text not null,
  "status" text not null,
  "template_name" text not null
);
create table if not exists public."email_send_state" (
  "auth_email_ttl_minutes" numeric,
  "batch_size" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "retry_after_until" text,
  "send_delay_ms" numeric,
  "transactional_email_ttl_minutes" numeric,
  "updated_at" timestamptz default now()
);
create table if not exists public."email_unsubscribe_tokens" (
  "created_at" timestamptz default now(),
  "email" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "token" text not null,
  "used_at" timestamptz
);
create table if not exists public."event_contacts" (
  "contact_id" uuid not null,
  "created_at" timestamptz default now(),
  "event_id" uuid not null,
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null
);
create table if not exists public."event_files" (
  "created_at" timestamptz default now(),
  "event_id" uuid not null,
  "file_name" text not null,
  "file_path" text not null,
  "file_size" numeric,
  "file_type" text,
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null
);
create table if not exists public."events" (
  "created_at" timestamptz default now(),
  "description" text,
  "end_date" text,
  "event_type" text,
  "id" uuid primary key default gen_random_uuid(),
  "location" text,
  "start_date" text not null,
  "status" text,
  "title" text not null,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null,
  "website" text
);
create table if not exists public."export_attachment_validations" (
  "checks" jsonb default '{}'::jsonb,
  "created_at" timestamptz default now(),
  "failure_reason" text,
  "file_name" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "mime_type" text not null,
  "outcome" text not null,
  "run_id" uuid,
  "schedule_id" uuid not null,
  "size_bytes" numeric not null,
  "user_id" uuid not null
);
create table if not exists public."export_header_suppression_audits" (
  "bcc_recipient" text not null,
  "conflicting_addresses" text[],
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "invariant" text,
  "reason" text not null,
  "run_id" uuid,
  "schedule_id" uuid not null,
  "user_id" uuid not null
);
create table if not exists public."export_schedule_runs" (
  "contact_count" numeric,
  "created_at" timestamptz default now(),
  "csv_path" text,
  "delivery_status" jsonb default '{}'::jsonb,
  "error_message" text,
  "id" uuid primary key default gen_random_uuid(),
  "manual" boolean default false,
  "range_label" text,
  "recipient_count" numeric,
  "schedule_id" uuid not null,
  "status" text not null,
  "user_id" uuid not null
);
create table if not exists public."export_schedules" (
  "attachment_max_kb" numeric,
  "attachment_zip_threshold_kb" numeric,
  "bcc_emails" text[],
  "cc_emails" text[],
  "columns" text[],
  "contact_ids" text[],
  "created_at" timestamptz default now(),
  "date_from" text,
  "date_to" text,
  "day_of_week" numeric,
  "days_back" numeric,
  "delivery_mode" text,
  "enabled" boolean default false,
  "event_id" uuid,
  "folder_id" uuid,
  "frequency" text not null,
  "hour_utc" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "last_run_at" timestamptz,
  "name" text not null,
  "preview_snapshot" jsonb default '{}'::jsonb,
  "recipient_email" text not null,
  "recipient_emails" text[],
  "search_query" text,
  "statuses" text[],
  "tag_ids" text[],
  "timezone" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."feature_flags" (
  "enabled" boolean not null,
  "key" text not null,
  "platform" text not null,
  "reason" text,
  "updated_at" timestamptz default now()
);
create table if not exists public."folders" (
  "created_at" timestamptz default now(),
  "emoji" text,
  "event_id" uuid,
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "user_id" uuid not null
);
create table if not exists public."google_calendar_sync" (
  "calendar_name" text,
  "color" text,
  "created_at" timestamptz default now(),
  "enabled" boolean default false,
  "google_calendar_id" uuid not null,
  "id" uuid primary key default gen_random_uuid(),
  "last_synced_at" timestamptz,
  "sync_token" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null,
  "webhook_channel_id" uuid,
  "webhook_expires_at" timestamptz,
  "webhook_resource_id" uuid
);
create table if not exists public."google_calendar_tokens" (
  "access_token" text not null,
  "created_at" timestamptz default now(),
  "expires_at" timestamptz not null,
  "id" uuid primary key default gen_random_uuid(),
  "refresh_token" text not null,
  "scopes" text[],
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."ios_receipt_validations" (
  "auto_renew_status" boolean default false,
  "created_at" timestamptz default now(),
  "environment" text,
  "expires_at" timestamptz,
  "id" uuid primary key default gen_random_uuid(),
  "is_trial" boolean default false,
  "original_transaction_id" uuid,
  "product_id" uuid,
  "raw_response" jsonb default '{}'::jsonb,
  "source" text,
  "status" numeric,
  "user_id" uuid not null
);
create table if not exists public."license_orders" (
  "created_at" timestamptz default now(),
  "discount_pct" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null,
  "plan" text,
  "purchased_by" text not null,
  "quantity" numeric not null,
  "status" text,
  "stripe_payment_intent_id" uuid,
  "total_cents" numeric not null,
  "unit_price_cents" numeric not null
);
create table if not exists public."card_events" (
  "created_at" timestamptz default now(),
  "event_type" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "slug" text not null,
  "source" text,
  "user_id" uuid
);
create table if not exists public."meeting_notes" (
  "action_items" jsonb default '{}'::jsonb,
  "analytics" jsonb default '{}'::jsonb,
  "calendar_event_id" uuid,
  "category" text,
  "created_at" timestamptz default now(),
  "decisions" jsonb default '{}'::jsonb,
  "duration_seconds" numeric,
  "folder_id" uuid,
  "follow_ups" jsonb default '{}'::jsonb,
  "id" uuid primary key default gen_random_uuid(),
  "insights" jsonb default '{}'::jsonb,
  "key_topics" jsonb default '{}'::jsonb,
  "manual_notes" text,
  "mentioned_people" jsonb default '{}'::jsonb,
  "open_questions" jsonb default '{}'::jsonb,
  "share_token" text,
  "summary" text,
  "title" text,
  "transcript" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."meeting_participants" (
  "contact_id" uuid,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "meeting_note_id" uuid not null,
  "name" text not null,
  "speaker_label" text,
  "user_id" uuid not null
);
create table if not exists public."note_tags" (
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "note_id" uuid not null,
  "tag_id" uuid not null
);
create table if not exists public."notifications" (
  "body" text,
  "calendar_event_id" uuid,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "metadata" jsonb default '{}'::jsonb,
  "read" boolean default false,
  "title" text not null,
  "type" text,
  "user_id" uuid not null
);
create table if not exists public."org_branding" (
  "accent_color" text,
  "app_name" text,
  "created_at" timestamptz default now(),
  "favicon_url" text,
  "id" uuid primary key default gen_random_uuid(),
  "logo_url" text,
  "org_id" uuid not null,
  "primary_color" text,
  "splash_url" text,
  "tagline" text,
  "updated_at" timestamptz default now()
);
create table if not exists public."org_domains" (
  "created_at" timestamptz default now(),
  "domain" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null,
  "verification_token" text,
  "verified" boolean default false
);
create table if not exists public."org_invitations" (
  "accepted_at" timestamptz,
  "created_at" timestamptz default now(),
  "email" text not null,
  "expires_at" timestamptz,
  "id" uuid primary key default gen_random_uuid(),
  "invited_by" text,
  "org_id" uuid not null,
  "role" text,
  "token" text
);
create table if not exists public."org_members" (
  "id" uuid primary key default gen_random_uuid(),
  "joined_at" timestamptz,
  "org_id" uuid not null,
  "role" text,
  "user_id" uuid not null
);
create table if not exists public."organizations" (
  "created_at" timestamptz default now(),
  "created_by" timestamptz,
  "domain" text,
  "id" uuid primary key default gen_random_uuid(),
  "logo_url" text,
  "max_seats" numeric,
  "name" text not null,
  "slug" text not null,
  "sso_config" jsonb default '{}'::jsonb,
  "sso_provider" text,
  "updated_at" timestamptz default now()
);
create table if not exists public."pipedream_connections" (
  "app_name" text not null,
  "app_slug" text not null,
  "connected_at" timestamptz,
  "environment" text,
  "external_user_id" uuid not null,
  "id" uuid primary key default gen_random_uuid(),
  "last_error" text,
  "metadata" jsonb default '{}'::jsonb,
  "pipedream_account_id" uuid not null,
  "status" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."pipedrive_connections" (
  "access_token" text not null,
  "api_domain" text not null,
  "auto_create_deal" boolean default false,
  "connected_at" timestamptz,
  "enabled" boolean default false,
  "expires_at" timestamptz not null,
  "field_mappings" jsonb default '{}'::jsonb,
  "id" uuid primary key default gen_random_uuid(),
  "pipedrive_company_id" numeric,
  "pipedrive_user_id" numeric,
  "pipeline_id" numeric,
  "refresh_token" text not null,
  "stage_mappings" jsonb default '{}'::jsonb,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."pipedrive_sync_log" (
  "contact_id" uuid,
  "created_at" timestamptz default now(),
  "error_message" text,
  "event_type" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "payload" jsonb default '{}'::jsonb,
  "pipedrive_deal_id" numeric,
  "pipedrive_person_id" numeric,
  "status" text not null,
  "user_id" uuid not null
);
create table if not exists public."pipeline_stages" (
  "color" text,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "sort_order" numeric,
  "user_id" uuid not null
);
create table if not exists public."platform_admins" (
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null
);
create table if not exists public."platform_waitlist" (
  "created_at" timestamptz default now(),
  "email" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "platform" text not null,
  "referrer" text,
  "source" text,
  "user_agent" text
);
create table if not exists public."profiles" (
  "avatar" text,
  "booking_url" text,
  "card_slug" text,
  "company" text,
  "created_at" timestamptz default now(),
  "default_export_timezone" text,
  "email" text,
  "id" uuid primary key default gen_random_uuid(),
  "linkedin" text,
  "name" text,
  "phone" text,
  "referral_code" text,
  "referred_by" text,
  "title" text,
  "updated_at" timestamptz default now(),
  "website" text
);
create table if not exists public."proposals" (
  "agent_run_id" uuid,
  "budget_range" text,
  "contact_id" uuid,
  "created_at" timestamptz default now(),
  "html_content" text,
  "id" uuid primary key default gen_random_uuid(),
  "pdf_url" text,
  "pricing_structure" jsonb default '{}'::jsonb,
  "project_type" text,
  "sent_at" timestamptz,
  "share_token" text,
  "status" text,
  "structured_content" jsonb default '{}'::jsonb,
  "template_id" uuid,
  "timeline" text,
  "title" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."referral_clicks" (
  "clicked_at" timestamptz,
  "id" uuid primary key default gen_random_uuid(),
  "ip_hash" text,
  "referral_code" text not null,
  "user_agent" text
);
create table if not exists public."referral_commissions" (
  "amount_cents" numeric,
  "created_at" timestamptz default now(),
  "flag_reason" text,
  "flagged" boolean default false,
  "id" uuid primary key default gen_random_uuid(),
  "invoice_id" uuid,
  "paid_at" timestamptz,
  "referral_id" uuid not null,
  "referrer_id" uuid not null,
  "status" text
);
create table if not exists public."referrals" (
  "converted_at" timestamptz,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "referral_code" text not null,
  "referred_id" uuid,
  "referrer_id" uuid not null,
  "status" text
);
create table if not exists public."scan_artifacts" (
  "boxes" jsonb default '{}'::jsonb,
  "confidence" jsonb default '{}'::jsonb,
  "contact_id" uuid,
  "created_at" timestamptz default now(),
  "debug_image_path" text,
  "id" uuid primary key default gen_random_uuid(),
  "image_path" text,
  "model" text,
  "preprocess_guard" text,
  "raw_text" text,
  "scan_mode" text,
  "structured" jsonb default '{}'::jsonb,
  "user_id" uuid not null
);
create table if not exists public."scan_csv_state" (
  "created_at" timestamptz default now(),
  "csv_path" text not null,
  "last_appended_at" timestamptz,
  "row_count" numeric,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."scan_sync_jobs" (
  "attempts" numeric,
  "completed_actions" jsonb default '{}'::jsonb,
  "contact_id" uuid not null,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "last_error" text,
  "next_attempt_at" timestamptz,
  "pending_actions" text[],
  "status" text,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."sent_reminders" (
  "calendar_event_id" uuid not null,
  "id" uuid primary key default gen_random_uuid(),
  "reminder_type" text,
  "sent_at" timestamptz
);
create table if not exists public."slack_settings" (
  "channel_id" uuid not null,
  "channel_name" text,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "notify_follow_up" boolean default false,
  "notify_new_contact" boolean default false,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."subscriptions" (
  "apple_original_transaction_id" uuid,
  "cancel_at_period_end" boolean default false,
  "created_at" timestamptz default now(),
  "current_period_end" text,
  "current_period_start" text,
  "id" uuid primary key default gen_random_uuid(),
  "plan" text,
  "provider" text,
  "status" text,
  "stripe_customer_id" uuid,
  "stripe_subscription_id" uuid,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."suppressed_emails" (
  "created_at" timestamptz default now(),
  "email" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "metadata" jsonb default '{}'::jsonb,
  "reason" text not null
);
create table if not exists public."tags" (
  "color" text,
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "user_id" uuid not null
);
create table if not exists public."typecheck_run_audit" (
  "actor_role" text not null,
  "actor_uid" text,
  "branch" text,
  "commit_sha" text,
  "context" jsonb default '{}'::jsonb,
  "created_at" timestamptz default now(),
  "error_count" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "run_id" uuid,
  "source_ip" text,
  "succeeded" boolean not null
);
create table if not exists public."typecheck_runs" (
  "branch" text,
  "commit_sha" text,
  "created_at" timestamptz default now(),
  "duration_ms" numeric,
  "error_count" numeric,
  "errors" jsonb default '{}'::jsonb,
  "id" uuid primary key default gen_random_uuid(),
  "succeeded" boolean not null
);
create table if not exists public."usage_tracking" (
  "contacts_count" numeric,
  "enrichments_used" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "notes_created" numeric,
  "period_start" text,
  "transcription_minutes_used" numeric,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null
);
create table if not exists public."user_api_keys" (
  "created_at" timestamptz default now(),
  "id" uuid primary key default gen_random_uuid(),
  "key_hash" text not null,
  "key_prefix" text not null,
  "label" text,
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  "user_id" uuid not null
);
create table if not exists public."webhook_deliveries" (
  "delivered_at" timestamptz,
  "error" text,
  "event" text not null,
  "id" uuid primary key default gen_random_uuid(),
  "payload" jsonb default '{}'::jsonb,
  "response_body" text,
  "status_code" numeric,
  "subscription_id" uuid not null,
  "user_id" uuid not null
);
create table if not exists public."webhook_subscriptions" (
  "active" boolean default false,
  "created_at" timestamptz default now(),
  "events" text[],
  "failure_count" numeric,
  "id" uuid primary key default gen_random_uuid(),
  "last_delivery_at" timestamptz,
  "last_status" text,
  "name" text,
  "provider" text,
  "secret" text,
  "updated_at" timestamptz default now(),
  "url" text not null,
  "user_id" uuid not null
);

-- Foreign keys
alter table public."agent_runs" add constraint "agent_runs_agent_id_fkey" foreign key ("agent_id") references public."agents"("id") on delete cascade;
alter table public."automation_sequence_messages" add constraint "automation_sequence_messages_run_id_fkey" foreign key ("run_id") references public."automation_sequence_runs"("id") on delete cascade;
alter table public."automation_sequence_messages" add constraint "automation_sequence_messages_step_id_fkey" foreign key ("step_id") references public."automation_sequence_steps"("id") on delete cascade;
alter table public."automation_sequence_runs" add constraint "automation_sequence_runs_contact_id_fkey" foreign key ("contact_id") references public."contacts"("id") on delete cascade;
alter table public."automation_sequence_runs" add constraint "automation_sequence_runs_sequence_id_fkey" foreign key ("sequence_id") references public."automation_sequences"("id") on delete cascade;
alter table public."automation_sequence_steps" add constraint "automation_sequence_steps_sequence_id_fkey" foreign key ("sequence_id") references public."automation_sequences"("id") on delete cascade;
alter table public."calendar_events" add constraint "calendar_events_event_id_fkey" foreign key ("event_id") references public."events"("id") on delete cascade;
alter table public."ci_errors" add constraint "ci_errors_run_id_fkey" foreign key ("run_id") references public."ci_runs"("id") on delete cascade;
alter table public."contact_activities" add constraint "contact_activities_contact_id_fkey" foreign key ("contact_id") references public."contacts"("id") on delete cascade;
alter table public."contact_tags" add constraint "contact_tags_contact_id_fkey" foreign key ("contact_id") references public."contacts"("id") on delete cascade;
alter table public."contact_tags" add constraint "contact_tags_tag_id_fkey" foreign key ("tag_id") references public."tags"("id") on delete cascade;
alter table public."contacts" add constraint "contacts_folder_id_fkey" foreign key ("folder_id") references public."folders"("id") on delete cascade;
alter table public."contacts" add constraint "contacts_stage_id_fkey" foreign key ("stage_id") references public."pipeline_stages"("id") on delete cascade;
alter table public."coupon_usage" add constraint "coupon_usage_coupon_id_fkey" foreign key ("coupon_id") references public."coupon_codes"("id") on delete cascade;
alter table public."event_contacts" add constraint "event_contacts_contact_id_fkey" foreign key ("contact_id") references public."contacts"("id") on delete cascade;
alter table public."event_contacts" add constraint "event_contacts_event_id_fkey" foreign key ("event_id") references public."events"("id") on delete cascade;
alter table public."event_files" add constraint "event_files_event_id_fkey" foreign key ("event_id") references public."events"("id") on delete cascade;
alter table public."export_schedules" add constraint "export_schedules_event_id_fkey" foreign key ("event_id") references public."events"("id") on delete cascade;
alter table public."export_schedules" add constraint "export_schedules_folder_id_fkey" foreign key ("folder_id") references public."folders"("id") on delete cascade;
alter table public."license_orders" add constraint "license_orders_org_id_fkey" foreign key ("org_id") references public."organizations"("id") on delete cascade;
alter table public."meeting_notes" add constraint "meeting_notes_calendar_event_id_fkey" foreign key ("calendar_event_id") references public."calendar_events"("id") on delete cascade;
alter table public."meeting_notes" add constraint "meeting_notes_folder_id_fkey" foreign key ("folder_id") references public."folders"("id") on delete cascade;
alter table public."meeting_participants" add constraint "meeting_participants_contact_id_fkey" foreign key ("contact_id") references public."contacts"("id") on delete cascade;
alter table public."meeting_participants" add constraint "meeting_participants_meeting_note_id_fkey" foreign key ("meeting_note_id") references public."meeting_notes"("id") on delete cascade;
alter table public."note_tags" add constraint "note_tags_note_id_fkey" foreign key ("note_id") references public."meeting_notes"("id") on delete cascade;
alter table public."note_tags" add constraint "note_tags_tag_id_fkey" foreign key ("tag_id") references public."tags"("id") on delete cascade;
alter table public."notifications" add constraint "notifications_calendar_event_id_fkey" foreign key ("calendar_event_id") references public."calendar_events"("id") on delete cascade;
alter table public."org_branding" add constraint "org_branding_org_id_fkey" foreign key ("org_id") references public."organizations"("id") on delete cascade;
alter table public."org_domains" add constraint "org_domains_org_id_fkey" foreign key ("org_id") references public."organizations"("id") on delete cascade;
alter table public."org_invitations" add constraint "org_invitations_org_id_fkey" foreign key ("org_id") references public."organizations"("id") on delete cascade;
alter table public."org_members" add constraint "org_members_org_id_fkey" foreign key ("org_id") references public."organizations"("id") on delete cascade;
alter table public."proposals" add constraint "proposals_agent_run_id_fkey" foreign key ("agent_run_id") references public."agent_runs"("id") on delete cascade;
alter table public."referral_commissions" add constraint "referral_commissions_referral_id_fkey" foreign key ("referral_id") references public."referrals"("id") on delete cascade;
alter table public."sent_reminders" add constraint "sent_reminders_calendar_event_id_fkey" foreign key ("calendar_event_id") references public."calendar_events"("id") on delete cascade;
alter table public."webhook_deliveries" add constraint "webhook_deliveries_subscription_id_fkey" foreign key ("subscription_id") references public."webhook_subscriptions"("id") on delete cascade;

-- Row Level Security
alter table public."account_deletion_audit" enable row level security;
create policy "own_select_account_deletion_audit" on public."account_deletion_audit" for select using (auth.uid() = user_id);
create policy "own_insert_account_deletion_audit" on public."account_deletion_audit" for insert with check (auth.uid() = user_id);
create policy "own_update_account_deletion_audit" on public."account_deletion_audit" for update using (auth.uid() = user_id);
create policy "own_delete_account_deletion_audit" on public."account_deletion_audit" for delete using (auth.uid() = user_id);
alter table public."agent_runs" enable row level security;
create policy "own_select_agent_runs" on public."agent_runs" for select using (auth.uid() = user_id);
create policy "own_insert_agent_runs" on public."agent_runs" for insert with check (auth.uid() = user_id);
create policy "own_update_agent_runs" on public."agent_runs" for update using (auth.uid() = user_id);
create policy "own_delete_agent_runs" on public."agent_runs" for delete using (auth.uid() = user_id);
alter table public."agents" enable row level security;
create policy "own_select_agents" on public."agents" for select using (auth.uid() = user_id);
create policy "own_insert_agents" on public."agents" for insert with check (auth.uid() = user_id);
create policy "own_update_agents" on public."agents" for update using (auth.uid() = user_id);
create policy "own_delete_agents" on public."agents" for delete using (auth.uid() = user_id);
alter table public."automation_sequence_messages" enable row level security;
create policy "own_select_automation_sequence_messages" on public."automation_sequence_messages" for select using (auth.uid() = user_id);
create policy "own_insert_automation_sequence_messages" on public."automation_sequence_messages" for insert with check (auth.uid() = user_id);
create policy "own_update_automation_sequence_messages" on public."automation_sequence_messages" for update using (auth.uid() = user_id);
create policy "own_delete_automation_sequence_messages" on public."automation_sequence_messages" for delete using (auth.uid() = user_id);
alter table public."automation_sequence_runs" enable row level security;
create policy "own_select_automation_sequence_runs" on public."automation_sequence_runs" for select using (auth.uid() = user_id);
create policy "own_insert_automation_sequence_runs" on public."automation_sequence_runs" for insert with check (auth.uid() = user_id);
create policy "own_update_automation_sequence_runs" on public."automation_sequence_runs" for update using (auth.uid() = user_id);
create policy "own_delete_automation_sequence_runs" on public."automation_sequence_runs" for delete using (auth.uid() = user_id);
alter table public."automation_sequence_steps" enable row level security;
create policy "own_select_automation_sequence_steps" on public."automation_sequence_steps" for select using (auth.uid() = user_id);
create policy "own_insert_automation_sequence_steps" on public."automation_sequence_steps" for insert with check (auth.uid() = user_id);
create policy "own_update_automation_sequence_steps" on public."automation_sequence_steps" for update using (auth.uid() = user_id);
create policy "own_delete_automation_sequence_steps" on public."automation_sequence_steps" for delete using (auth.uid() = user_id);
alter table public."automation_sequences" enable row level security;
create policy "own_select_automation_sequences" on public."automation_sequences" for select using (auth.uid() = user_id);
create policy "own_insert_automation_sequences" on public."automation_sequences" for insert with check (auth.uid() = user_id);
create policy "own_update_automation_sequences" on public."automation_sequences" for update using (auth.uid() = user_id);
create policy "own_delete_automation_sequences" on public."automation_sequences" for delete using (auth.uid() = user_id);
alter table public."calendar_events" enable row level security;
create policy "own_select_calendar_events" on public."calendar_events" for select using (auth.uid() = user_id);
create policy "own_insert_calendar_events" on public."calendar_events" for insert with check (auth.uid() = user_id);
create policy "own_update_calendar_events" on public."calendar_events" for update using (auth.uid() = user_id);
create policy "own_delete_calendar_events" on public."calendar_events" for delete using (auth.uid() = user_id);
alter table public."ci_errors" enable row level security;
alter table public."ci_runs" enable row level security;
alter table public."contact_activities" enable row level security;
create policy "own_select_contact_activities" on public."contact_activities" for select using (auth.uid() = user_id);
create policy "own_insert_contact_activities" on public."contact_activities" for insert with check (auth.uid() = user_id);
create policy "own_update_contact_activities" on public."contact_activities" for update using (auth.uid() = user_id);
create policy "own_delete_contact_activities" on public."contact_activities" for delete using (auth.uid() = user_id);
alter table public."contact_tags" enable row level security;
alter table public."contacts" enable row level security;
create policy "own_select_contacts" on public."contacts" for select using (auth.uid() = user_id);
create policy "own_insert_contacts" on public."contacts" for insert with check (auth.uid() = user_id);
create policy "own_update_contacts" on public."contacts" for update using (auth.uid() = user_id);
create policy "own_delete_contacts" on public."contacts" for delete using (auth.uid() = user_id);
alter table public."coupon_codes" enable row level security;
alter table public."coupon_usage" enable row level security;
create policy "own_select_coupon_usage" on public."coupon_usage" for select using (auth.uid() = user_id);
create policy "own_insert_coupon_usage" on public."coupon_usage" for insert with check (auth.uid() = user_id);
create policy "own_update_coupon_usage" on public."coupon_usage" for update using (auth.uid() = user_id);
create policy "own_delete_coupon_usage" on public."coupon_usage" for delete using (auth.uid() = user_id);
alter table public."email_send_log" enable row level security;
alter table public."email_send_state" enable row level security;
alter table public."email_unsubscribe_tokens" enable row level security;
alter table public."event_contacts" enable row level security;
create policy "own_select_event_contacts" on public."event_contacts" for select using (auth.uid() = user_id);
create policy "own_insert_event_contacts" on public."event_contacts" for insert with check (auth.uid() = user_id);
create policy "own_update_event_contacts" on public."event_contacts" for update using (auth.uid() = user_id);
create policy "own_delete_event_contacts" on public."event_contacts" for delete using (auth.uid() = user_id);
alter table public."event_files" enable row level security;
create policy "own_select_event_files" on public."event_files" for select using (auth.uid() = user_id);
create policy "own_insert_event_files" on public."event_files" for insert with check (auth.uid() = user_id);
create policy "own_update_event_files" on public."event_files" for update using (auth.uid() = user_id);
create policy "own_delete_event_files" on public."event_files" for delete using (auth.uid() = user_id);
alter table public."events" enable row level security;
create policy "own_select_events" on public."events" for select using (auth.uid() = user_id);
create policy "own_insert_events" on public."events" for insert with check (auth.uid() = user_id);
create policy "own_update_events" on public."events" for update using (auth.uid() = user_id);
create policy "own_delete_events" on public."events" for delete using (auth.uid() = user_id);
alter table public."export_attachment_validations" enable row level security;
create policy "own_select_export_attachment_validations" on public."export_attachment_validations" for select using (auth.uid() = user_id);
create policy "own_insert_export_attachment_validations" on public."export_attachment_validations" for insert with check (auth.uid() = user_id);
create policy "own_update_export_attachment_validations" on public."export_attachment_validations" for update using (auth.uid() = user_id);
create policy "own_delete_export_attachment_validations" on public."export_attachment_validations" for delete using (auth.uid() = user_id);
alter table public."export_header_suppression_audits" enable row level security;
create policy "own_select_export_header_suppression_audits" on public."export_header_suppression_audits" for select using (auth.uid() = user_id);
create policy "own_insert_export_header_suppression_audits" on public."export_header_suppression_audits" for insert with check (auth.uid() = user_id);
create policy "own_update_export_header_suppression_audits" on public."export_header_suppression_audits" for update using (auth.uid() = user_id);
create policy "own_delete_export_header_suppression_audits" on public."export_header_suppression_audits" for delete using (auth.uid() = user_id);
alter table public."export_schedule_runs" enable row level security;
create policy "own_select_export_schedule_runs" on public."export_schedule_runs" for select using (auth.uid() = user_id);
create policy "own_insert_export_schedule_runs" on public."export_schedule_runs" for insert with check (auth.uid() = user_id);
create policy "own_update_export_schedule_runs" on public."export_schedule_runs" for update using (auth.uid() = user_id);
create policy "own_delete_export_schedule_runs" on public."export_schedule_runs" for delete using (auth.uid() = user_id);
alter table public."export_schedules" enable row level security;
create policy "own_select_export_schedules" on public."export_schedules" for select using (auth.uid() = user_id);
create policy "own_insert_export_schedules" on public."export_schedules" for insert with check (auth.uid() = user_id);
create policy "own_update_export_schedules" on public."export_schedules" for update using (auth.uid() = user_id);
create policy "own_delete_export_schedules" on public."export_schedules" for delete using (auth.uid() = user_id);
alter table public."feature_flags" enable row level security;
alter table public."folders" enable row level security;
create policy "own_select_folders" on public."folders" for select using (auth.uid() = user_id);
create policy "own_insert_folders" on public."folders" for insert with check (auth.uid() = user_id);
create policy "own_update_folders" on public."folders" for update using (auth.uid() = user_id);
create policy "own_delete_folders" on public."folders" for delete using (auth.uid() = user_id);
alter table public."google_calendar_sync" enable row level security;
create policy "own_select_google_calendar_sync" on public."google_calendar_sync" for select using (auth.uid() = user_id);
create policy "own_insert_google_calendar_sync" on public."google_calendar_sync" for insert with check (auth.uid() = user_id);
create policy "own_update_google_calendar_sync" on public."google_calendar_sync" for update using (auth.uid() = user_id);
create policy "own_delete_google_calendar_sync" on public."google_calendar_sync" for delete using (auth.uid() = user_id);
alter table public."google_calendar_tokens" enable row level security;
create policy "own_select_google_calendar_tokens" on public."google_calendar_tokens" for select using (auth.uid() = user_id);
create policy "own_insert_google_calendar_tokens" on public."google_calendar_tokens" for insert with check (auth.uid() = user_id);
create policy "own_update_google_calendar_tokens" on public."google_calendar_tokens" for update using (auth.uid() = user_id);
create policy "own_delete_google_calendar_tokens" on public."google_calendar_tokens" for delete using (auth.uid() = user_id);
alter table public."ios_receipt_validations" enable row level security;
create policy "own_select_ios_receipt_validations" on public."ios_receipt_validations" for select using (auth.uid() = user_id);
create policy "own_insert_ios_receipt_validations" on public."ios_receipt_validations" for insert with check (auth.uid() = user_id);
create policy "own_update_ios_receipt_validations" on public."ios_receipt_validations" for update using (auth.uid() = user_id);
create policy "own_delete_ios_receipt_validations" on public."ios_receipt_validations" for delete using (auth.uid() = user_id);
alter table public."license_orders" enable row level security;
alter table public."card_events" enable row level security;
create policy "own_select_card_events" on public."card_events" for select using (auth.uid() = user_id);
create policy "own_insert_card_events" on public."card_events" for insert with check (auth.uid() = user_id);
create policy "own_update_card_events" on public."card_events" for update using (auth.uid() = user_id);
create policy "own_delete_card_events" on public."card_events" for delete using (auth.uid() = user_id);
alter table public."meeting_notes" enable row level security;
create policy "own_select_meeting_notes" on public."meeting_notes" for select using (auth.uid() = user_id);
create policy "own_insert_meeting_notes" on public."meeting_notes" for insert with check (auth.uid() = user_id);
create policy "own_update_meeting_notes" on public."meeting_notes" for update using (auth.uid() = user_id);
create policy "own_delete_meeting_notes" on public."meeting_notes" for delete using (auth.uid() = user_id);
alter table public."meeting_participants" enable row level security;
create policy "own_select_meeting_participants" on public."meeting_participants" for select using (auth.uid() = user_id);
create policy "own_insert_meeting_participants" on public."meeting_participants" for insert with check (auth.uid() = user_id);
create policy "own_update_meeting_participants" on public."meeting_participants" for update using (auth.uid() = user_id);
create policy "own_delete_meeting_participants" on public."meeting_participants" for delete using (auth.uid() = user_id);
alter table public."note_tags" enable row level security;
alter table public."notifications" enable row level security;
create policy "own_select_notifications" on public."notifications" for select using (auth.uid() = user_id);
create policy "own_insert_notifications" on public."notifications" for insert with check (auth.uid() = user_id);
create policy "own_update_notifications" on public."notifications" for update using (auth.uid() = user_id);
create policy "own_delete_notifications" on public."notifications" for delete using (auth.uid() = user_id);
alter table public."org_branding" enable row level security;
alter table public."org_domains" enable row level security;
alter table public."org_invitations" enable row level security;
alter table public."org_members" enable row level security;
create policy "own_select_org_members" on public."org_members" for select using (auth.uid() = user_id);
create policy "own_insert_org_members" on public."org_members" for insert with check (auth.uid() = user_id);
create policy "own_update_org_members" on public."org_members" for update using (auth.uid() = user_id);
create policy "own_delete_org_members" on public."org_members" for delete using (auth.uid() = user_id);
alter table public."organizations" enable row level security;
alter table public."pipedream_connections" enable row level security;
create policy "own_select_pipedream_connections" on public."pipedream_connections" for select using (auth.uid() = user_id);
create policy "own_insert_pipedream_connections" on public."pipedream_connections" for insert with check (auth.uid() = user_id);
create policy "own_update_pipedream_connections" on public."pipedream_connections" for update using (auth.uid() = user_id);
create policy "own_delete_pipedream_connections" on public."pipedream_connections" for delete using (auth.uid() = user_id);
alter table public."pipedrive_connections" enable row level security;
create policy "own_select_pipedrive_connections" on public."pipedrive_connections" for select using (auth.uid() = user_id);
create policy "own_insert_pipedrive_connections" on public."pipedrive_connections" for insert with check (auth.uid() = user_id);
create policy "own_update_pipedrive_connections" on public."pipedrive_connections" for update using (auth.uid() = user_id);
create policy "own_delete_pipedrive_connections" on public."pipedrive_connections" for delete using (auth.uid() = user_id);
alter table public."pipedrive_sync_log" enable row level security;
create policy "own_select_pipedrive_sync_log" on public."pipedrive_sync_log" for select using (auth.uid() = user_id);
create policy "own_insert_pipedrive_sync_log" on public."pipedrive_sync_log" for insert with check (auth.uid() = user_id);
create policy "own_update_pipedrive_sync_log" on public."pipedrive_sync_log" for update using (auth.uid() = user_id);
create policy "own_delete_pipedrive_sync_log" on public."pipedrive_sync_log" for delete using (auth.uid() = user_id);
alter table public."pipeline_stages" enable row level security;
create policy "own_select_pipeline_stages" on public."pipeline_stages" for select using (auth.uid() = user_id);
create policy "own_insert_pipeline_stages" on public."pipeline_stages" for insert with check (auth.uid() = user_id);
create policy "own_update_pipeline_stages" on public."pipeline_stages" for update using (auth.uid() = user_id);
create policy "own_delete_pipeline_stages" on public."pipeline_stages" for delete using (auth.uid() = user_id);
alter table public."platform_admins" enable row level security;
create policy "own_select_platform_admins" on public."platform_admins" for select using (auth.uid() = user_id);
create policy "own_insert_platform_admins" on public."platform_admins" for insert with check (auth.uid() = user_id);
create policy "own_update_platform_admins" on public."platform_admins" for update using (auth.uid() = user_id);
create policy "own_delete_platform_admins" on public."platform_admins" for delete using (auth.uid() = user_id);
alter table public."platform_waitlist" enable row level security;
alter table public."profiles" enable row level security;
alter table public."proposals" enable row level security;
create policy "own_select_proposals" on public."proposals" for select using (auth.uid() = user_id);
create policy "own_insert_proposals" on public."proposals" for insert with check (auth.uid() = user_id);
create policy "own_update_proposals" on public."proposals" for update using (auth.uid() = user_id);
create policy "own_delete_proposals" on public."proposals" for delete using (auth.uid() = user_id);
alter table public."referral_clicks" enable row level security;
alter table public."referral_commissions" enable row level security;
alter table public."referrals" enable row level security;
alter table public."scan_artifacts" enable row level security;
create policy "own_select_scan_artifacts" on public."scan_artifacts" for select using (auth.uid() = user_id);
create policy "own_insert_scan_artifacts" on public."scan_artifacts" for insert with check (auth.uid() = user_id);
create policy "own_update_scan_artifacts" on public."scan_artifacts" for update using (auth.uid() = user_id);
create policy "own_delete_scan_artifacts" on public."scan_artifacts" for delete using (auth.uid() = user_id);
alter table public."scan_csv_state" enable row level security;
create policy "own_select_scan_csv_state" on public."scan_csv_state" for select using (auth.uid() = user_id);
create policy "own_insert_scan_csv_state" on public."scan_csv_state" for insert with check (auth.uid() = user_id);
create policy "own_update_scan_csv_state" on public."scan_csv_state" for update using (auth.uid() = user_id);
create policy "own_delete_scan_csv_state" on public."scan_csv_state" for delete using (auth.uid() = user_id);
alter table public."scan_sync_jobs" enable row level security;
create policy "own_select_scan_sync_jobs" on public."scan_sync_jobs" for select using (auth.uid() = user_id);
create policy "own_insert_scan_sync_jobs" on public."scan_sync_jobs" for insert with check (auth.uid() = user_id);
create policy "own_update_scan_sync_jobs" on public."scan_sync_jobs" for update using (auth.uid() = user_id);
create policy "own_delete_scan_sync_jobs" on public."scan_sync_jobs" for delete using (auth.uid() = user_id);
alter table public."sent_reminders" enable row level security;
alter table public."slack_settings" enable row level security;
create policy "own_select_slack_settings" on public."slack_settings" for select using (auth.uid() = user_id);
create policy "own_insert_slack_settings" on public."slack_settings" for insert with check (auth.uid() = user_id);
create policy "own_update_slack_settings" on public."slack_settings" for update using (auth.uid() = user_id);
create policy "own_delete_slack_settings" on public."slack_settings" for delete using (auth.uid() = user_id);
alter table public."subscriptions" enable row level security;
create policy "own_select_subscriptions" on public."subscriptions" for select using (auth.uid() = user_id);
create policy "own_insert_subscriptions" on public."subscriptions" for insert with check (auth.uid() = user_id);
create policy "own_update_subscriptions" on public."subscriptions" for update using (auth.uid() = user_id);
create policy "own_delete_subscriptions" on public."subscriptions" for delete using (auth.uid() = user_id);
alter table public."suppressed_emails" enable row level security;
alter table public."tags" enable row level security;
create policy "own_select_tags" on public."tags" for select using (auth.uid() = user_id);
create policy "own_insert_tags" on public."tags" for insert with check (auth.uid() = user_id);
create policy "own_update_tags" on public."tags" for update using (auth.uid() = user_id);
create policy "own_delete_tags" on public."tags" for delete using (auth.uid() = user_id);
alter table public."typecheck_run_audit" enable row level security;
alter table public."typecheck_runs" enable row level security;
alter table public."usage_tracking" enable row level security;
create policy "own_select_usage_tracking" on public."usage_tracking" for select using (auth.uid() = user_id);
create policy "own_insert_usage_tracking" on public."usage_tracking" for insert with check (auth.uid() = user_id);
create policy "own_update_usage_tracking" on public."usage_tracking" for update using (auth.uid() = user_id);
create policy "own_delete_usage_tracking" on public."usage_tracking" for delete using (auth.uid() = user_id);
alter table public."user_api_keys" enable row level security;
create policy "own_select_user_api_keys" on public."user_api_keys" for select using (auth.uid() = user_id);
create policy "own_insert_user_api_keys" on public."user_api_keys" for insert with check (auth.uid() = user_id);
create policy "own_update_user_api_keys" on public."user_api_keys" for update using (auth.uid() = user_id);
create policy "own_delete_user_api_keys" on public."user_api_keys" for delete using (auth.uid() = user_id);
alter table public."webhook_deliveries" enable row level security;
create policy "own_select_webhook_deliveries" on public."webhook_deliveries" for select using (auth.uid() = user_id);
create policy "own_insert_webhook_deliveries" on public."webhook_deliveries" for insert with check (auth.uid() = user_id);
create policy "own_update_webhook_deliveries" on public."webhook_deliveries" for update using (auth.uid() = user_id);
create policy "own_delete_webhook_deliveries" on public."webhook_deliveries" for delete using (auth.uid() = user_id);
alter table public."webhook_subscriptions" enable row level security;
create policy "own_select_webhook_subscriptions" on public."webhook_subscriptions" for select using (auth.uid() = user_id);
create policy "own_insert_webhook_subscriptions" on public."webhook_subscriptions" for insert with check (auth.uid() = user_id);
create policy "own_update_webhook_subscriptions" on public."webhook_subscriptions" for update using (auth.uid() = user_id);
create policy "own_delete_webhook_subscriptions" on public."webhook_subscriptions" for delete using (auth.uid() = user_id);
