export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_audit: {
        Row: {
          created_at: string
          db_errors: Json | null
          db_rows_deleted: Json
          duration_ms: number | null
          email: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          phase: string | null
          status: string
          storage_objects_deleted: Json
          stripe_subs_cancelled: number
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          db_errors?: Json | null
          db_rows_deleted?: Json
          duration_ms?: number | null
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          phase?: string | null
          status: string
          storage_objects_deleted?: Json
          stripe_subs_cancelled?: number
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          db_errors?: Json | null
          db_rows_deleted?: Json
          duration_ms?: number | null
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          phase?: string | null
          status?: string
          storage_objects_deleted?: Json
          stripe_subs_cancelled?: number
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json | null
          output: Json | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_template: boolean
          name: string
          status: string
          system_prompt: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_template?: boolean
          name: string
          status?: string
          system_prompt?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_template?: boolean
          name?: string
          status?: string
          system_prompt?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automation_sequence_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          run_id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          step_id: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          run_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          step_id: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          run_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          step_id?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequence_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_sequence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_sequence_messages_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequence_runs: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step: number
          id: string
          sequence_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: number
          id?: string
          sequence_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: number
          id?: string
          sequence_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequence_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_sequence_runs_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequence_steps: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          delay_days: number
          id: string
          sequence_id: string
          step_order: number
          subject_template: string | null
          user_id: string
        }
        Insert: {
          body_template: string
          channel: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id: string
          step_order: number
          subject_template?: string | null
          user_id: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id?: string
          step_order?: number
          subject_template?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequences: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          goal: string | null
          id: string
          is_active: boolean
          name: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          bot_enabled: boolean
          bot_name: string | null
          calendar_provider: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_id: string | null
          external_id: string | null
          google_calendar_id: string | null
          google_etag: string | null
          google_event_id: string | null
          id: string
          location: string | null
          meeting_url: string | null
          reminder_email: string | null
          reminder_minutes: number | null
          reminder_type: string
          source: string
          start_time: string
          sync_source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          bot_enabled?: boolean
          bot_name?: string | null
          calendar_provider?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          external_id?: string | null
          google_calendar_id?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          reminder_email?: string | null
          reminder_minutes?: number | null
          reminder_type?: string
          source?: string
          start_time: string
          sync_source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          bot_enabled?: boolean
          bot_name?: string | null
          calendar_provider?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          external_id?: string | null
          google_calendar_id?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          reminder_email?: string | null
          reminder_minutes?: number | null
          reminder_type?: string
          source?: string
          start_time?: string
          sync_source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_errors: {
        Row: {
          code: string | null
          column_number: number | null
          created_at: string
          file_path: string | null
          fingerprint: string
          id: string
          line_number: number | null
          message: string
          raw_line: string | null
          rule: string | null
          run_id: string
          severity: string
          source: string
        }
        Insert: {
          code?: string | null
          column_number?: number | null
          created_at?: string
          file_path?: string | null
          fingerprint: string
          id?: string
          line_number?: number | null
          message: string
          raw_line?: string | null
          rule?: string | null
          run_id: string
          severity?: string
          source: string
        }
        Update: {
          code?: string | null
          column_number?: number | null
          created_at?: string
          file_path?: string | null
          fingerprint?: string
          id?: string
          line_number?: number | null
          message?: string
          raw_line?: string | null
          rule?: string | null
          run_id?: string
          severity?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ci_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_runs: {
        Row: {
          branch: string | null
          commit_sha: string | null
          created_at: string
          id: string
          metadata: Json
          raw_log: string | null
          source: string
          status: string
          total_errors: number
          total_warnings: number
          triggered_by: string | null
        }
        Insert: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          raw_log?: string | null
          source: string
          status?: string
          total_errors?: number
          total_warnings?: number
          triggered_by?: string | null
        }
        Update: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          raw_log?: string | null
          source?: string
          status?: string
          total_errors?: number
          total_warnings?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          contact_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          annual_revenue: string | null
          avatar: string | null
          birthday: string | null
          company: string
          company_address: string | null
          company_description: string | null
          company_email: string | null
          company_linkedin: string | null
          company_size: string | null
          company_type: string | null
          conversation_status: string | null
          created_at: string
          email: string
          enriched: boolean
          enriched_at: string | null
          folder_id: string | null
          follow_up_date: string | null
          follow_up_sent_at: string | null
          founding_year: number | null
          id: string
          industry: string | null
          lead_source: string | null
          linkedin: string | null
          linkedin_profile_url: string | null
          location: string | null
          mobile_phone: string | null
          name: string
          next_action_date: string | null
          next_step: string | null
          notes: string | null
          phone: string
          pipedrive_deal_id: number | null
          pipedrive_person_id: number | null
          pipedrive_synced_at: string | null
          scanned_at: string
          stage_id: string | null
          title: string
          user_id: string
          website: string | null
          work_phone: string | null
        }
        Insert: {
          annual_revenue?: string | null
          avatar?: string | null
          birthday?: string | null
          company?: string
          company_address?: string | null
          company_description?: string | null
          company_email?: string | null
          company_linkedin?: string | null
          company_size?: string | null
          company_type?: string | null
          conversation_status?: string | null
          created_at?: string
          email?: string
          enriched?: boolean
          enriched_at?: string | null
          folder_id?: string | null
          follow_up_date?: string | null
          follow_up_sent_at?: string | null
          founding_year?: number | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          linkedin?: string | null
          linkedin_profile_url?: string | null
          location?: string | null
          mobile_phone?: string | null
          name: string
          next_action_date?: string | null
          next_step?: string | null
          notes?: string | null
          phone?: string
          pipedrive_deal_id?: number | null
          pipedrive_person_id?: number | null
          pipedrive_synced_at?: string | null
          scanned_at?: string
          stage_id?: string | null
          title?: string
          user_id: string
          website?: string | null
          work_phone?: string | null
        }
        Update: {
          annual_revenue?: string | null
          avatar?: string | null
          birthday?: string | null
          company?: string
          company_address?: string | null
          company_description?: string | null
          company_email?: string | null
          company_linkedin?: string | null
          company_size?: string | null
          company_type?: string | null
          conversation_status?: string | null
          created_at?: string
          email?: string
          enriched?: boolean
          enriched_at?: string | null
          folder_id?: string | null
          follow_up_date?: string | null
          follow_up_sent_at?: string | null
          founding_year?: number | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          linkedin?: string | null
          linkedin_profile_url?: string | null
          location?: string | null
          mobile_phone?: string | null
          name?: string
          next_action_date?: string | null
          next_step?: string | null
          notes?: string | null
          phone?: string
          pipedrive_deal_id?: number | null
          pipedrive_person_id?: number | null
          pipedrive_synced_at?: string | null
          scanned_at?: string
          stage_id?: string | null
          title?: string
          user_id?: string
          website?: string | null
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_codes: {
        Row: {
          active: boolean
          applies_to: string[]
          code: string
          created_at: string
          discount_pct: number
          duration: string
          duration_months: number | null
          expires_at: string | null
          id: string
          max_uses: number | null
          updated_at: string
          use_case: string | null
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          code: string
          created_at?: string
          discount_pct: number
          duration?: string
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          code?: string
          created_at?: string
          discount_pct?: number
          duration?: string
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          applied_at: string
          coupon_id: string
          id: string
          stripe_coupon_id: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          coupon_id: string
          id?: string
          stripe_coupon_id?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          coupon_id?: string
          id?: string
          stripe_coupon_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_note_templates: {
        Row: {
          created_at: string
          description: string
          emoji: string
          fields: Json
          guidance: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          emoji?: string
          fields?: Json
          guidance?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          emoji?: string
          fields?: Json
          guidance?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_contacts: {
        Row: {
          contact_id: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_files: {
        Row: {
          created_at: string
          event_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_files_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          location: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      export_attachment_validations: {
        Row: {
          checks: Json
          created_at: string
          failure_reason: string | null
          file_name: string
          id: string
          mime_type: string
          outcome: string
          run_id: string | null
          schedule_id: string
          size_bytes: number
          user_id: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          failure_reason?: string | null
          file_name: string
          id?: string
          mime_type: string
          outcome: string
          run_id?: string | null
          schedule_id: string
          size_bytes: number
          user_id: string
        }
        Update: {
          checks?: Json
          created_at?: string
          failure_reason?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          outcome?: string
          run_id?: string | null
          schedule_id?: string
          size_bytes?: number
          user_id?: string
        }
        Relationships: []
      }
      export_header_suppression_audits: {
        Row: {
          bcc_recipient: string
          conflicting_addresses: string[]
          created_at: string
          id: string
          invariant: string
          reason: string
          run_id: string | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          bcc_recipient: string
          conflicting_addresses?: string[]
          created_at?: string
          id?: string
          invariant?: string
          reason: string
          run_id?: string | null
          schedule_id: string
          user_id: string
        }
        Update: {
          bcc_recipient?: string
          conflicting_addresses?: string[]
          created_at?: string
          id?: string
          invariant?: string
          reason?: string
          run_id?: string | null
          schedule_id?: string
          user_id?: string
        }
        Relationships: []
      }
      export_schedule_runs: {
        Row: {
          contact_count: number
          created_at: string
          csv_path: string | null
          delivery_status: Json
          error_message: string | null
          id: string
          manual: boolean
          range_label: string | null
          recipient_count: number
          schedule_id: string
          status: string
          user_id: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          csv_path?: string | null
          delivery_status?: Json
          error_message?: string | null
          id?: string
          manual?: boolean
          range_label?: string | null
          recipient_count?: number
          schedule_id: string
          status: string
          user_id: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          csv_path?: string | null
          delivery_status?: Json
          error_message?: string | null
          id?: string
          manual?: boolean
          range_label?: string | null
          recipient_count?: number
          schedule_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      export_schedules: {
        Row: {
          attachment_max_kb: number | null
          attachment_zip_threshold_kb: number | null
          bcc_emails: string[]
          cc_emails: string[]
          columns: string[] | null
          contact_ids: string[] | null
          created_at: string
          date_from: string | null
          date_to: string | null
          day_of_week: number | null
          days_back: number | null
          delivery_mode: string
          enabled: boolean
          event_id: string | null
          folder_id: string | null
          frequency: string
          hour_utc: number
          id: string
          last_run_at: string | null
          name: string
          preview_snapshot: Json | null
          recipient_email: string
          recipient_emails: string[] | null
          search_query: string | null
          statuses: string[] | null
          tag_ids: string[] | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_max_kb?: number | null
          attachment_zip_threshold_kb?: number | null
          bcc_emails?: string[]
          cc_emails?: string[]
          columns?: string[] | null
          contact_ids?: string[] | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          day_of_week?: number | null
          days_back?: number | null
          delivery_mode?: string
          enabled?: boolean
          event_id?: string | null
          folder_id?: string | null
          frequency: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          name: string
          preview_snapshot?: Json | null
          recipient_email: string
          recipient_emails?: string[] | null
          search_query?: string | null
          statuses?: string[] | null
          tag_ids?: string[] | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_max_kb?: number | null
          attachment_zip_threshold_kb?: number | null
          bcc_emails?: string[]
          cc_emails?: string[]
          columns?: string[] | null
          contact_ids?: string[] | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          day_of_week?: number | null
          days_back?: number | null
          delivery_mode?: string
          enabled?: boolean
          event_id?: string | null
          folder_id?: string | null
          frequency?: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          name?: string
          preview_snapshot?: Json | null
          recipient_email?: string
          recipient_emails?: string[] | null
          search_query?: string | null
          statuses?: string[] | null
          tag_ids?: string[] | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_schedules_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          platform: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          enabled: boolean
          key: string
          platform: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          platform?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          emoji: string
          event_id: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          event_id?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          event_id?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_sync: {
        Row: {
          calendar_name: string
          color: string | null
          created_at: string
          enabled: boolean
          google_calendar_id: string
          id: string
          last_synced_at: string | null
          sync_token: string | null
          updated_at: string
          user_id: string
          webhook_channel_id: string | null
          webhook_expires_at: string | null
          webhook_resource_id: string | null
        }
        Insert: {
          calendar_name?: string
          color?: string | null
          created_at?: string
          enabled?: boolean
          google_calendar_id: string
          id?: string
          last_synced_at?: string | null
          sync_token?: string | null
          updated_at?: string
          user_id: string
          webhook_channel_id?: string | null
          webhook_expires_at?: string | null
          webhook_resource_id?: string | null
        }
        Update: {
          calendar_name?: string
          color?: string | null
          created_at?: string
          enabled?: boolean
          google_calendar_id?: string
          id?: string
          last_synced_at?: string | null
          sync_token?: string | null
          updated_at?: string
          user_id?: string
          webhook_channel_id?: string | null
          webhook_expires_at?: string | null
          webhook_resource_id?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ios_receipt_validations: {
        Row: {
          auto_renew_status: boolean | null
          created_at: string
          environment: string | null
          expires_at: string | null
          id: string
          is_trial: boolean | null
          original_transaction_id: string | null
          product_id: string | null
          raw_response: Json | null
          source: string
          status: number | null
          user_id: string
        }
        Insert: {
          auto_renew_status?: boolean | null
          created_at?: string
          environment?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
          original_transaction_id?: string | null
          product_id?: string | null
          raw_response?: Json | null
          source?: string
          status?: number | null
          user_id: string
        }
        Update: {
          auto_renew_status?: boolean | null
          created_at?: string
          environment?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
          original_transaction_id?: string | null
          product_id?: string | null
          raw_response?: Json | null
          source?: string
          status?: number | null
          user_id?: string
        }
        Relationships: []
      }
      license_orders: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          org_id: string
          plan: string
          purchased_by: string
          quantity: number
          status: string
          stripe_payment_intent_id: string | null
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          id?: string
          org_id: string
          plan?: string
          purchased_by: string
          quantity: number
          status?: string
          stripe_payment_intent_id?: string | null
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          org_id?: string
          plan?: string
          purchased_by?: string
          quantity?: number
          status?: string
          stripe_payment_intent_id?: string | null
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "license_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      card_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          slug: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          slug: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          slug?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_notes: {
        Row: {
          action_items: Json | null
          analytics: Json | null
          calendar_event_id: string | null
          category: string | null
          created_at: string
          decisions: Json | null
          duration_seconds: number | null
          folder_id: string | null
          follow_ups: Json | null
          id: string
          enhanced_notes: string | null
          insights: Json | null
          key_topics: Json | null
          manual_notes: string | null
          mentioned_people: Json | null
          open_questions: Json | null
          share_token: string | null
          summary: string | null
          title: string
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json | null
          analytics?: Json | null
          calendar_event_id?: string | null
          category?: string | null
          created_at?: string
          decisions?: Json | null
          duration_seconds?: number | null
          folder_id?: string | null
          follow_ups?: Json | null
          id?: string
          enhanced_notes?: string | null
          insights?: Json | null
          key_topics?: Json | null
          manual_notes?: string | null
          mentioned_people?: Json | null
          open_questions?: Json | null
          share_token?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json | null
          analytics?: Json | null
          calendar_event_id?: string | null
          category?: string | null
          created_at?: string
          decisions?: Json | null
          duration_seconds?: number | null
          folder_id?: string | null
          follow_ups?: Json | null
          id?: string
          enhanced_notes?: string | null
          insights?: Json | null
          key_topics?: Json | null
          manual_notes?: string | null
          mentioned_people?: Json | null
          open_questions?: Json | null
          share_token?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          meeting_note_id: string
          name: string
          speaker_label: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          meeting_note_id: string
          name: string
          speaker_label?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          meeting_note_id?: string
          name?: string
          speaker_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_meeting_note_id_fkey"
            columns: ["meeting_note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          created_at: string
          id: string
          note_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          calendar_event_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          calendar_event_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          calendar_event_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branding: {
        Row: {
          accent_color: string
          app_name: string
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          org_id: string
          primary_color: string
          splash_url: string | null
          tagline: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          app_name?: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          org_id: string
          primary_color?: string
          splash_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          app_name?: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          org_id?: string
          primary_color?: string
          splash_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          org_id: string
          verification_token: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          org_id: string
          verification_token?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          org_id?: string
          verification_token?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string | null
          id: string
          logo_url: string | null
          max_seats: number | null
          name: string
          slug: string
          sso_config: Json | null
          sso_provider: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_seats?: number | null
          name: string
          slug: string
          sso_config?: Json | null
          sso_provider?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_seats?: number | null
          name?: string
          slug?: string
          sso_config?: Json | null
          sso_provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipedream_connections: {
        Row: {
          app_name: string
          app_slug: string
          connected_at: string
          environment: string
          external_user_id: string
          id: string
          last_error: string | null
          metadata: Json
          pipedream_account_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name: string
          app_slug: string
          connected_at?: string
          environment?: string
          external_user_id: string
          id?: string
          last_error?: string | null
          metadata?: Json
          pipedream_account_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          app_slug?: string
          connected_at?: string
          environment?: string
          external_user_id?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          pipedream_account_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pipedrive_connections: {
        Row: {
          access_token: string
          api_domain: string
          auto_create_deal: boolean
          connected_at: string
          enabled: boolean
          expires_at: string
          field_mappings: Json
          id: string
          pipedrive_company_id: number | null
          pipedrive_user_id: number | null
          pipeline_id: number | null
          refresh_token: string
          stage_mappings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          api_domain: string
          auto_create_deal?: boolean
          connected_at?: string
          enabled?: boolean
          expires_at: string
          field_mappings?: Json
          id?: string
          pipedrive_company_id?: number | null
          pipedrive_user_id?: number | null
          pipeline_id?: number | null
          refresh_token: string
          stage_mappings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          api_domain?: string
          auto_create_deal?: boolean
          connected_at?: string
          enabled?: boolean
          expires_at?: string
          field_mappings?: Json
          id?: string
          pipedrive_company_id?: number | null
          pipedrive_user_id?: number | null
          pipeline_id?: number | null
          refresh_token?: string
          stage_mappings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pipedrive_sync_log: {
        Row: {
          contact_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          pipedrive_deal_id: number | null
          pipedrive_person_id: number | null
          status: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          pipedrive_deal_id?: number | null
          pipedrive_person_id?: number | null
          status: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          pipedrive_deal_id?: number | null
          pipedrive_person_id?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          platform: string
          referrer: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          platform: string
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          platform?: string
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          booking_url: string | null
          card_slug: string | null
          company: string
          created_at: string
          default_export_timezone: string | null
          email: string
          id: string
          linkedin: string
          name: string
          phone: string
          referral_code: string | null
          referred_by: string | null
          title: string
          updated_at: string
          website: string
        }
        Insert: {
          avatar?: string | null
          booking_url?: string | null
          card_slug?: string | null
          company?: string
          created_at?: string
          default_export_timezone?: string | null
          email?: string
          id: string
          linkedin?: string
          name?: string
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          title?: string
          updated_at?: string
          website?: string
        }
        Update: {
          avatar?: string | null
          booking_url?: string | null
          card_slug?: string | null
          company?: string
          created_at?: string
          default_export_timezone?: string | null
          email?: string
          id?: string
          linkedin?: string
          name?: string
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          title?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          agent_run_id: string | null
          budget_range: string | null
          contact_id: string | null
          created_at: string
          html_content: string
          id: string
          pdf_url: string | null
          pricing_structure: Json | null
          project_type: string | null
          sent_at: string | null
          share_token: string | null
          status: string
          structured_content: Json | null
          template_id: string | null
          timeline: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_run_id?: string | null
          budget_range?: string | null
          contact_id?: string | null
          created_at?: string
          html_content?: string
          id?: string
          pdf_url?: string | null
          pricing_structure?: Json | null
          project_type?: string | null
          sent_at?: string | null
          share_token?: string | null
          status?: string
          structured_content?: Json | null
          template_id?: string | null
          timeline?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_run_id?: string | null
          budget_range?: string | null
          contact_id?: string | null
          created_at?: string
          html_content?: string
          id?: string
          pdf_url?: string | null
          pricing_structure?: Json | null
          project_type?: string | null
          sent_at?: string | null
          share_token?: string | null
          status?: string
          structured_content?: Json | null
          template_id?: string | null
          timeline?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          referral_code: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          referral_code: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          referral_code?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          amount_cents: number
          created_at: string
          flag_reason: string | null
          flagged: boolean
          id: string
          invoice_id: string | null
          paid_at: string | null
          referral_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          referral_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          referral_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      scan_artifacts: {
        Row: {
          boxes: Json
          confidence: Json
          contact_id: string | null
          created_at: string
          debug_image_path: string | null
          id: string
          image_path: string | null
          model: string | null
          preprocess_guard: string | null
          raw_text: string | null
          scan_mode: string | null
          structured: Json
          user_id: string
        }
        Insert: {
          boxes?: Json
          confidence?: Json
          contact_id?: string | null
          created_at?: string
          debug_image_path?: string | null
          id?: string
          image_path?: string | null
          model?: string | null
          preprocess_guard?: string | null
          raw_text?: string | null
          scan_mode?: string | null
          structured?: Json
          user_id: string
        }
        Update: {
          boxes?: Json
          confidence?: Json
          contact_id?: string | null
          created_at?: string
          debug_image_path?: string | null
          id?: string
          image_path?: string | null
          model?: string | null
          preprocess_guard?: string | null
          raw_text?: string | null
          scan_mode?: string | null
          structured?: Json
          user_id?: string
        }
        Relationships: []
      }
      scan_csv_state: {
        Row: {
          created_at: string
          csv_path: string
          last_appended_at: string | null
          row_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csv_path: string
          last_appended_at?: string | null
          row_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csv_path?: string
          last_appended_at?: string | null
          row_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_sync_jobs: {
        Row: {
          attempts: number
          completed_actions: Json
          contact_id: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          pending_actions: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_actions?: Json
          contact_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          pending_actions?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_actions?: Json
          contact_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          pending_actions?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sent_reminders: {
        Row: {
          calendar_event_id: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          calendar_event_id: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Update: {
          calendar_event_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_reminders_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_settings: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string
          id: string
          notify_follow_up: boolean
          notify_new_contact: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_name?: string
          created_at?: string
          id?: string
          notify_follow_up?: boolean
          notify_new_contact?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string
          id?: string
          notify_follow_up?: boolean
          notify_new_contact?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          apple_original_transaction_id: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          provider: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apple_original_transaction_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apple_original_transaction_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      typecheck_run_audit: {
        Row: {
          actor_role: string
          actor_uid: string | null
          branch: string | null
          commit_sha: string | null
          context: Json
          created_at: string
          error_count: number | null
          id: string
          run_id: string | null
          source_ip: string | null
          succeeded: boolean
        }
        Insert: {
          actor_role: string
          actor_uid?: string | null
          branch?: string | null
          commit_sha?: string | null
          context?: Json
          created_at?: string
          error_count?: number | null
          id?: string
          run_id?: string | null
          source_ip?: string | null
          succeeded: boolean
        }
        Update: {
          actor_role?: string
          actor_uid?: string | null
          branch?: string | null
          commit_sha?: string | null
          context?: Json
          created_at?: string
          error_count?: number | null
          id?: string
          run_id?: string | null
          source_ip?: string | null
          succeeded?: boolean
        }
        Relationships: []
      }
      typecheck_runs: {
        Row: {
          branch: string | null
          commit_sha: string | null
          created_at: string
          duration_ms: number | null
          error_count: number
          errors: Json
          id: string
          succeeded: boolean
        }
        Insert: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          errors?: Json
          id?: string
          succeeded: boolean
        }
        Update: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          errors?: Json
          id?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          contacts_count: number
          enrichments_used: number
          id: string
          notes_created: number
          period_start: string
          transcription_minutes_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contacts_count?: number
          enrichments_used?: number
          id?: string
          notes_created?: number
          period_start?: string
          transcription_minutes_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contacts_count?: number
          enrichments_used?: number
          id?: string
          notes_created?: number
          period_start?: string
          transcription_minutes_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          status_code: number | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          delivered_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          subscription_id: string
          user_id: string
        }
        Update: {
          delivered_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          failure_count: number
          id: string
          last_delivery_at: string | null
          last_status: string | null
          name: string
          provider: string
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          last_status?: string | null
          name?: string
          provider?: string
          secret?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          last_status?: string | null
          name?: string
          provider?: string
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      get_user_by_api_key: { Args: { _key_hash: string }; Returns: string }
      get_user_plan: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      plan_rank: { Args: { _plan: string }; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_has_min_plan: {
        Args: { _min_plan: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      org_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      org_role: ["owner", "admin", "member"],
    },
  },
} as const
