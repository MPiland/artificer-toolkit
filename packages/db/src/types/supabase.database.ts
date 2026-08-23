export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_entitlements: {
        Row: {
          created_at: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alignments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alignments_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      authored_creation_rate_limits: {
        Row: {
          hour_count: number
          hour_window_start: string
          minute_count: number
          minute_window_start: string
          user_id: string
        }
        Insert: {
          hour_count?: number
          hour_window_start: string
          minute_count?: number
          minute_window_start: string
          user_id: string
        }
        Update: {
          hour_count?: number
          hour_window_start?: string
          minute_count?: number
          minute_window_start?: string
          user_id?: string
        }
        Relationships: []
      }
      authored_drafts: {
        Row: {
          base_active_updated_at: string | null
          created_at: string
          label: string
          payload: Json
          subject_id: string
          subject_kind: string
          system_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_active_updated_at?: string | null
          created_at?: string
          label: string
          payload: Json
          subject_id: string
          subject_kind: string
          system_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_active_updated_at?: string | null
          created_at?: string
          label?: string
          payload?: Json
          subject_id?: string
          subject_kind?: string
          system_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "authored_drafts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      authored_image_slots: {
        Row: {
          alt_text: string | null
          asset_id: string | null
          created_at: string
          is_decorative: boolean
          scope: string
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          asset_id?: string | null
          created_at?: string
          is_decorative?: boolean
          scope: string
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          asset_id?: string | null
          created_at?: string
          is_decorative?: boolean
          scope?: string
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authored_image_slots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authored_image_slots_route_fk"
            columns: ["subject_kind", "subject_id"]
            isOneToOne: false
            referencedRelation: "authored_route_ids"
            referencedColumns: ["subject_kind", "subject_id"]
          },
        ]
      }
      authored_import_refs: {
        Row: {
          created_at: string
          external_id: string
          source: string
          subject_id: string
          subject_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          source: string
          subject_id: string
          subject_kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          source?: string
          subject_id?: string
          subject_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      authored_route_ids: {
        Row: {
          created_at: string
          public_id: string | null
          route_number: number
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          public_id?: string | null
          route_number?: number
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          public_id?: string | null
          route_number?: number
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      background_details: {
        Row: {
          background_id: string
          detail_id: string
          sort_order: number
        }
        Insert: {
          background_id: string
          detail_id: string
          sort_order: number
        }
        Update: {
          background_id?: string
          detail_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "background_details_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
        ]
      }
      background_features: {
        Row: {
          background_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          background_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          background_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "background_features_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      background_proficiency_grants: {
        Row: {
          background_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          background_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          background_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "background_proficiency_grants_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      background_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          background_id: string
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          background_id: string
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          background_id?: string
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_versions_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      backgrounds: {
        Row: {
          active_version_id: string | null
          created_at: string
          description: string | null
          id: string
          is_master: boolean | null
          label: string
          starting_equipment_id: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_master?: boolean | null
          label: string
          starting_equipment_id?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_master?: boolean | null
          label?: string
          starting_equipment_id?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backgrounds_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "background_versions"
            referencedColumns: ["background_id", "id"]
          },
          {
            foreignKeyName: "backgrounds_starting_equipment_id_fkey"
            columns: ["starting_equipment_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backgrounds_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_adjustments: {
        Row: {
          campaign_id: string
          character_id: string
          created_at: string
          created_by: string
          family: string
          id: string
          payload: Json
          slot_key: string
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          created_at?: string
          created_by: string
          family: string
          id?: string
          payload: Json
          slot_key: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          created_at?: string
          created_by?: string
          family?: string
          id?: string
          payload?: Json
          slot_key?: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_adjustments_campaign_id_character_id_fkey"
            columns: ["campaign_id", "character_id"]
            isOneToOne: false
            referencedRelation: "campaign_character_assignments"
            referencedColumns: ["campaign_id", "character_id"]
          },
        ]
      }
      campaign_announcements: {
        Row: {
          author_user_id: string
          body: string
          campaign_id: string
          command_id: string
          created_at: string
          id: string
          input_fingerprint: string
          party_id: string | null
          scope: string
          title: string
        }
        Insert: {
          author_user_id: string
          body: string
          campaign_id: string
          command_id: string
          created_at?: string
          id?: string
          input_fingerprint: string
          party_id?: string | null
          scope: string
          title: string
        }
        Update: {
          author_user_id?: string
          body?: string
          campaign_id?: string
          command_id?: string
          created_at?: string
          id?: string
          input_fingerprint?: string
          party_id?: string | null
          scope?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_announcements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_announcements_party_id_campaign_id_fkey"
            columns: ["party_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_conversations"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_attachments: {
        Row: {
          asset_id: string
          campaign_id: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          note_section_id: string | null
          profile: string
          session_id: string | null
          uploader_user_id: string
        }
        Insert: {
          asset_id: string
          campaign_id: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          note_section_id?: string | null
          profile: string
          session_id?: string | null
          uploader_user_id: string
        }
        Update: {
          asset_id?: string
          campaign_id?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          note_section_id?: string | null
          profile?: string
          session_id?: string | null
          uploader_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_attachments_asset_id_profile_fkey"
            columns: ["asset_id", "profile"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "profile"]
          },
          {
            foreignKeyName: "campaign_attachments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attachments_note_section_id_campaign_id_fkey"
            columns: ["note_section_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_note_sections"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "campaign_attachments_session_id_campaign_id_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_character_assignments: {
        Row: {
          assigned_at: string
          campaign_id: string
          character_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          campaign_id: string
          character_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          campaign_id?: string
          character_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_character_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_character_assignments_campaign_id_user_id_fkey"
            columns: ["campaign_id", "user_id"]
            isOneToOne: true
            referencedRelation: "campaign_memberships"
            referencedColumns: ["campaign_id", "user_id"]
          },
          {
            foreignKeyName: "campaign_character_assignments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_character_assignments_character_id_user_id_fkey"
            columns: ["character_id", "user_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      campaign_character_mechanics_projections: {
        Row: {
          base_mechanics_projection_checksum: string
          campaign_id: string
          character_id: string
          manual_maximum_modifier_owner: string | null
          mechanical_context_checksum: string
          projection_checksum: string
          projection_kind: string
          projection_schema_version: number
          rule_policy_input: Json | null
          rule_policy_output: Json | null
          stream_version: number
          updated_at: string
        }
        Insert: {
          base_mechanics_projection_checksum: string
          campaign_id: string
          character_id: string
          manual_maximum_modifier_owner?: string | null
          mechanical_context_checksum: string
          projection_checksum: string
          projection_kind: string
          projection_schema_version: number
          rule_policy_input?: Json | null
          rule_policy_output?: Json | null
          stream_version: number
          updated_at?: string
        }
        Update: {
          base_mechanics_projection_checksum?: string
          campaign_id?: string
          character_id?: string
          manual_maximum_modifier_owner?: string | null
          mechanical_context_checksum?: string
          projection_checksum?: string
          projection_kind?: string
          projection_schema_version?: number
          rule_policy_input?: Json | null
          rule_policy_output?: Json | null
          stream_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_character_mechanics_proj_campaign_id_character_id_fkey"
            columns: ["campaign_id", "character_id"]
            isOneToOne: true
            referencedRelation: "campaign_character_assignments"
            referencedColumns: ["campaign_id", "character_id"]
          },
        ]
      }
      campaign_clock_recoveries: {
        Row: {
          boundary_absolute_minute: number
          boundary_kind: string
          campaign_id: string
          character_id: string
          created_at: string
          event_id: string
          id: string
          resource_key: string
        }
        Insert: {
          boundary_absolute_minute: number
          boundary_kind: string
          campaign_id: string
          character_id: string
          created_at?: string
          event_id: string
          id?: string
          resource_key: string
        }
        Update: {
          boundary_absolute_minute?: number
          boundary_kind?: string
          campaign_id?: string
          character_id?: string
          created_at?: string
          event_id?: string
          id?: string
          resource_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_clock_recoveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_clock_recoveries_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_clock_recoveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "campaign_events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_clock_segments: {
        Row: {
          campaign_id: string
          end_absolute_minute: number | null
          id: string
          start_absolute_minute: number
          started_at: string
          stopped_at: string | null
        }
        Insert: {
          campaign_id: string
          end_absolute_minute?: number | null
          id?: string
          start_absolute_minute: number
          started_at: string
          stopped_at?: string | null
        }
        Update: {
          campaign_id?: string
          end_absolute_minute?: number | null
          id?: string
          start_absolute_minute?: number
          started_at?: string
          stopped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_clock_segments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_clocks: {
        Row: {
          campaign_id: string
          dawn_minute: number
          day: number
          dusk_minute: number
          minute_of_day: number
          processed_boundary_absolute_minute: number
          running: boolean
          running_since: string | null
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          dawn_minute?: number
          day: number
          dusk_minute?: number
          minute_of_day: number
          processed_boundary_absolute_minute?: number
          running?: boolean
          running_since?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          dawn_minute?: number
          day?: number
          dusk_minute?: number
          minute_of_day?: number
          processed_boundary_absolute_minute?: number
          running?: boolean
          running_since?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_clocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_content_shares: {
        Row: {
          campaign_id: string
          created_at: string
          shared_by: string
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          shared_by: string
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          shared_by?: string
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_content_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_conversation_entries: {
        Row: {
          author_character_id: string | null
          author_user_id: string
          body: string | null
          campaign_id: string
          character_name_snapshot: string | null
          client_nonce: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          kind: string
          mode: string | null
          roll_payload: Json | null
          unsent_at: string | null
          username_snapshot: string
        }
        Insert: {
          author_character_id?: string | null
          author_user_id: string
          body?: string | null
          campaign_id: string
          character_name_snapshot?: string | null
          client_nonce: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind: string
          mode?: string | null
          roll_payload?: Json | null
          unsent_at?: string | null
          username_snapshot: string
        }
        Update: {
          author_character_id?: string | null
          author_user_id?: string
          body?: string | null
          campaign_id?: string
          character_name_snapshot?: string | null
          client_nonce?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind?: string
          mode?: string | null
          roll_payload?: Json | null
          unsent_at?: string | null
          username_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversation_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_conversation_entries_conversation_campaign_fkey"
            columns: ["conversation_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_conversations"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_conversation_members: {
        Row: {
          access_started_at: string
          campaign_id: string
          conversation_id: string
          last_read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_started_at?: string
          campaign_id: string
          conversation_id: string
          last_read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_started_at?: string
          campaign_id?: string
          conversation_id?: string
          last_read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversation_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_conversation_members_conversation_campaign_fkey"
            columns: ["conversation_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_conversations"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_conversations: {
        Row: {
          campaign_id: string
          created_at: string
          direct_user_a: string | null
          direct_user_b: string | null
          id: string
          kind: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          direct_user_a?: string | null
          direct_user_b?: string | null
          id?: string
          kind: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          direct_user_a?: string | null
          direct_user_b?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_currency_denominations: {
        Row: {
          abbreviation: string
          created_at: string
          id: string
          name: string
          scale_in_reference: number
          sort_order: number
          system_id: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          id?: string
          name: string
          scale_in_reference: number
          sort_order?: number
          system_id: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          id?: string
          name?: string
          scale_in_reference?: number
          sort_order?: number
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_currency_denominations_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "campaign_currency_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_currency_systems: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_reference: boolean
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_reference?: boolean
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_reference?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_currency_systems_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          actor_user_id: string | null
          campaign_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          payload: Json
          subject_character_id: string | null
          subject_user_id: string | null
          visibility: string
        }
        Insert: {
          actor_user_id?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          payload?: Json
          subject_character_id?: string | null
          subject_user_id?: string | null
          visibility: string
        }
        Update: {
          actor_user_id?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          payload?: Json
          subject_character_id?: string | null
          subject_user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_subject_character_id_fkey"
            columns: ["subject_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_invites: {
        Row: {
          created_at: string
          created_by: string
          expired_at: string | null
          expires_at: string
          id: string
          listing_id: string
          listing_version: number
          recipient_user_id: string
          recipient_username: string
          responded_at: string | null
          revoked_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expired_at?: string | null
          expires_at: string
          id?: string
          listing_id: string
          listing_version: number
          recipient_user_id: string
          recipient_username: string
          responded_at?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          listing_id?: string
          listing_version?: number
          recipient_user_id?: string
          recipient_username?: string
          responded_at?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_invites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "social_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_live_play_commands: {
        Row: {
          campaign_id: string
          command_id: string
          command_type: string
          correction_reason: string | null
          created_at: string
          input_fingerprint: string
          result_payload: Json
        }
        Insert: {
          campaign_id: string
          command_id: string
          command_type: string
          correction_reason?: string | null
          created_at?: string
          input_fingerprint: string
          result_payload: Json
        }
        Update: {
          campaign_id?: string
          command_id?: string
          command_type?: string
          correction_reason?: string | null
          created_at?: string
          input_fingerprint?: string
          result_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_live_play_commands_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_memberships: {
        Row: {
          access_started_at: string
          campaign_id: string
          created_at: string
          joined_at: string
          left_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_started_at?: string
          campaign_id: string
          created_at?: string
          joined_at?: string
          left_at?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_started_at?: string
          campaign_id?: string
          created_at?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_memberships_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_note_sections: {
        Row: {
          campaign_id: string
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string
          version: number
          visibility: string
        }
        Insert: {
          campaign_id: string
          category?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by: string
          version?: number
          visibility?: string
        }
        Update: {
          campaign_id?: string
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_note_sections_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_ownership_transfers: {
        Row: {
          campaign_id: string
          created_at: string
          expires_at: string
          from_user_id: string
          to_user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          expires_at: string
          from_user_id: string
          to_user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          expires_at?: string
          from_user_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ownership_transfers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_play_settings: {
        Row: {
          absent_character_policy: string | null
          allowed_content_rules: string | null
          campaign_id: string
          content_boundaries: string | null
          content_guidance: string | null
          created_at: string
          expected_duration_minutes: number | null
          live_safety_method: string | null
          normal_cadence_days: number | null
          quorum: number | null
          safety_practices: string[]
          table_conduct: string | null
          updated_at: string
          version: number
        }
        Insert: {
          absent_character_policy?: string | null
          allowed_content_rules?: string | null
          campaign_id: string
          content_boundaries?: string | null
          content_guidance?: string | null
          created_at?: string
          expected_duration_minutes?: number | null
          live_safety_method?: string | null
          normal_cadence_days?: number | null
          quorum?: number | null
          safety_practices?: string[]
          table_conduct?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          absent_character_policy?: string | null
          allowed_content_rules?: string | null
          campaign_id?: string
          content_boundaries?: string | null
          content_guidance?: string | null
          created_at?: string
          expected_duration_minutes?: number | null
          live_safety_method?: string | null
          normal_cadence_days?: number | null
          quorum?: number | null
          safety_practices?: string[]
          table_conduct?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_play_settings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_scene_definitions: {
        Row: {
          campaign_id: string
          created_at: string
          definition: Json
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          definition: Json
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          definition?: Json
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_scene_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_session_attendance: {
        Row: {
          campaign_id: string
          character_id: string
          present: boolean
          session_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          present?: boolean
          session_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          present?: boolean
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_session_attendance_campaign_id_character_id_fkey"
            columns: ["campaign_id", "character_id"]
            isOneToOne: false
            referencedRelation: "campaign_character_assignments"
            referencedColumns: ["campaign_id", "character_id"]
          },
          {
            foreignKeyName: "campaign_session_attendance_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_session_attendance_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_session_attendance_session_campaign_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_session_note_sections: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          kind: string
          session_id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string
          version: number
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          session_id: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by: string
          version?: number
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          session_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_session_note_sections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_session_reference_pins: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          note_section_id: string | null
          route_public_id: string | null
          route_subject_kind: string | null
          session_id: string
          target_kind: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          note_section_id?: string | null
          route_public_id?: string | null
          route_subject_kind?: string | null
          session_id: string
          target_kind: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          note_section_id?: string | null
          route_public_id?: string | null
          route_subject_kind?: string | null
          session_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_session_reference_pins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_session_reference_pins_note_section_id_fkey"
            columns: ["note_section_id"]
            isOneToOne: false
            referencedRelation: "campaign_note_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_session_reference_pins_session_campaign_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_session_rsvps: {
        Row: {
          campaign_id: string
          response: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          response: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          response?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_session_rsvps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_session_rsvps_campaign_id_user_id_fkey"
            columns: ["campaign_id", "user_id"]
            isOneToOne: false
            referencedRelation: "campaign_memberships"
            referencedColumns: ["campaign_id", "user_id"]
          },
          {
            foreignKeyName: "campaign_session_rsvps_session_campaign_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      campaign_sessions: {
        Row: {
          campaign_id: string
          created_at: string
          finished_at: string | null
          id: string
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          session_number: number
          status: string
          time_zone: string | null
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          session_number: number
          status?: string
          time_zone?: string | null
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          session_number?: number
          status?: string
          time_zone?: string | null
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_vehicles: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          label: string | null
          updated_at: string
          vehicle_definition_id: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          vehicle_definition_id: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          vehicle_definition_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_vehicles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_vehicles_vehicle_definition_id_fkey"
            columns: ["vehicle_definition_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          attunement_slot_override: number | null
          content_maturity: string
          created_at: string
          description: string | null
          format: string
          id: string
          name: string
          owner_user_id: string
          status: string
          tone_details: string | null
          tone_tags: string[]
          updated_at: string
          version: number
        }
        Insert: {
          attunement_slot_override?: number | null
          content_maturity: string
          created_at?: string
          description?: string | null
          format: string
          id?: string
          name: string
          owner_user_id: string
          status?: string
          tone_details?: string | null
          tone_tags: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          attunement_slot_override?: number | null
          content_maturity?: string
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          name?: string
          owner_user_id?: string
          status?: string
          tone_details?: string | null
          tone_tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      challenge_ratings: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_ratings_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities: {
        Row: {
          character_id: string
          created_at: string
          method_code: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          method_code: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          method_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_manual_assignments: {
        Row: {
          ability_code: string
          character_id: string
          created_at: string
          score: number
          updated_at: string
        }
        Insert: {
          ability_code: string
          character_id: string
          created_at?: string
          score: number
          updated_at?: string
        }
        Update: {
          ability_code?: string
          character_id?: string
          created_at?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_manual_assignments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_manual_rolled: {
        Row: {
          character_id: string
          configuration: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          character_id: string
          configuration?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          configuration?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_manual_rolled_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_manual_rolled_groups: {
        Row: {
          applied: boolean | null
          assigned_ability_code: string | null
          character_id: string
          created_at: string
          group_index: number
          id: string
          rolling: boolean | null
          score: number
          updated_at: string
        }
        Insert: {
          applied?: boolean | null
          assigned_ability_code?: string | null
          character_id: string
          created_at?: string
          group_index: number
          id: string
          rolling?: boolean | null
          score: number
          updated_at?: string
        }
        Update: {
          applied?: boolean | null
          assigned_ability_code?: string | null
          character_id?: string
          created_at?: string
          group_index?: number
          id?: string
          rolling?: boolean | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_manual_rolled_groups_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_manual_rolled_rolls: {
        Row: {
          character_id: string
          created_at: string
          die: number
          group_index: number
          is_kept: boolean | null
          roll_index: number
          updated_at: string
          value: number
        }
        Insert: {
          character_id: string
          created_at?: string
          die: number
          group_index: number
          is_kept?: boolean | null
          roll_index: number
          updated_at?: string
          value: number
        }
        Update: {
          character_id?: string
          created_at?: string
          die?: number
          group_index?: number
          is_kept?: boolean | null
          roll_index?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_manual_rolled_rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_point_buy: {
        Row: {
          character_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_point_buy_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_point_buy_distributed: {
        Row: {
          ability_code: string
          character_id: string
          created_at: string
          option_code: string
          updated_at: string
        }
        Insert: {
          ability_code: string
          character_id: string
          created_at?: string
          option_code: string
          updated_at?: string
        }
        Update: {
          ability_code?: string
          character_id?: string
          created_at?: string
          option_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_point_buy_distributed_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_abilities_standard_array: {
        Row: {
          ability_code: string
          character_id: string
          created_at: string
          option_code: string
          updated_at: string
        }
        Insert: {
          ability_code: string
          character_id: string
          created_at?: string
          option_code: string
          updated_at?: string
        }
        Update: {
          ability_code?: string
          character_id?: string
          created_at?: string
          option_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_standard_array_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_ability_adjustments: {
        Row: {
          ability_code: string
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          ability_code: string
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value: number
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          ability_code?: string
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_ability_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_advancement: {
        Row: {
          character_id: string
          created_at: string
          experience: number | null
          method_code: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          experience?: number | null
          method_code: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          experience?: number | null
          method_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_advancement_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_ancestry_acquisitions: {
        Row: {
          ancestry_id: string
          character_id: string
          class_id: string | null
          class_level: number | null
          created_at: string
          id: string
          option_id: string
          race_id: string | null
          source_kind: string
          subrace_id: string | null
          timing_kind: string
          updated_at: string
        }
        Insert: {
          ancestry_id: string
          character_id: string
          class_id?: string | null
          class_level?: number | null
          created_at?: string
          id?: string
          option_id: string
          race_id?: string | null
          source_kind: string
          subrace_id?: string | null
          timing_kind: string
          updated_at?: string
        }
        Update: {
          ancestry_id?: string
          character_id?: string
          class_id?: string | null
          class_level?: number | null
          created_at?: string
          id?: string
          option_id?: string
          race_id?: string | null
          source_kind?: string
          subrace_id?: string | null
          timing_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_ancestry_acquisitions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_ancestry_acquisitions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_ancestry_acquisitions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_ancestry_acquisitions_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      character_attuned: {
        Row: {
          character_id: string
          created_at: string
          equipment_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          equipment_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          equipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_attuned_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_attuned_equipment_owner_fkey"
            columns: ["character_id", "equipment_id"]
            isOneToOne: true
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_background: {
        Row: {
          background_id: string
          character_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          background_id: string
          character_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          background_id?: string
          character_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_background_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_background_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_background_equipment_groups: {
        Row: {
          character_id: string
          created_at: string
          group_id: string
          option_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          group_id: string
          option_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          group_id?: string
          option_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_background_equipment_groups_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_background_equipment_items: {
        Row: {
          character_id: string
          created_at: string
          equipment_id: string
          group_id: string
          quantity: number
          selection_item_id: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          equipment_id: string
          group_id: string
          quantity?: number
          selection_item_id?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          equipment_id?: string
          group_id?: string
          quantity?: number
          selection_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_background_equipment_items_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_background_equipment_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      character_background_equipment_session: {
        Row: {
          applied: boolean | null
          character_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          applied?: boolean | null
          character_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          applied?: boolean | null
          character_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_background_equipment_session_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_builder_drafts: {
        Row: {
          base_active_updated_at: string | null
          character_id: string
          created_at: string
          id: string
          label: string
          mode: string
          payload: Json
          status: string
          system_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_active_updated_at?: string | null
          character_id: string
          created_at?: string
          id?: string
          label: string
          mode?: string
          payload: Json
          status?: string
          system_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_active_updated_at?: string | null
          character_id?: string
          created_at?: string
          id?: string
          label?: string
          mode?: string
          payload?: Json
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_builder_drafts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      character_chosen_grant_selection_targets: {
        Row: {
          created_at: string
          selection_id: string
          slot_index: number
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          selection_id: string
          slot_index: number
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          selection_id?: string
          slot_index?: number
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_chosen_grant_selection_targets_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "character_chosen_grant_selections"
            referencedColumns: ["id"]
          },
        ]
      }
      character_chosen_grant_selections: {
        Row: {
          acquired_parent_id: string | null
          ancestry_id: string | null
          background_id: string | null
          character_id: string
          class_id: string | null
          created_at: string
          feat_id: string | null
          feature_id: string | null
          grant_id: string
          id: string
          option_id: string | null
          progression_level: number | null
          race_id: string | null
          reason: string | null
          source_class_level: number | null
          source_kind: string
          subclass_id: string | null
          subrace_id: string | null
          timing_class_id: string | null
          timing_class_level: number | null
          timing_kind: string
          timing_level: number | null
          updated_at: string
        }
        Insert: {
          acquired_parent_id?: string | null
          ancestry_id?: string | null
          background_id?: string | null
          character_id: string
          class_id?: string | null
          created_at?: string
          feat_id?: string | null
          feature_id?: string | null
          grant_id: string
          id: string
          option_id?: string | null
          progression_level?: number | null
          race_id?: string | null
          reason?: string | null
          source_class_level?: number | null
          source_kind: string
          subclass_id?: string | null
          subrace_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind: string
          timing_level?: number | null
          updated_at?: string
        }
        Update: {
          acquired_parent_id?: string | null
          ancestry_id?: string | null
          background_id?: string | null
          character_id?: string
          class_id?: string | null
          created_at?: string
          feat_id?: string | null
          feature_id?: string | null
          grant_id?: string
          id?: string
          option_id?: string | null
          progression_level?: number | null
          race_id?: string | null
          reason?: string | null
          source_class_level?: number | null
          source_kind?: string
          subclass_id?: string | null
          subrace_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind?: string
          timing_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_chosen_grant_selections_acquired_parent_id_fkey"
            columns: ["acquired_parent_id"]
            isOneToOne: false
            referencedRelation: "character_feature_acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_chosen_grant_selections_timing_class_id_fkey"
            columns: ["timing_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_class_equipment_groups: {
        Row: {
          character_id: string
          created_at: string
          group_id: string
          option_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          group_id: string
          option_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          group_id?: string
          option_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_class_equipment_groups_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_class_equipment_items: {
        Row: {
          character_id: string
          created_at: string
          equipment_id: string
          group_id: string
          quantity: number
          selection_item_id: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          equipment_id: string
          group_id: string
          quantity?: number
          selection_item_id?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          equipment_id?: string
          group_id?: string
          quantity?: number
          selection_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_class_equipment_items_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_class_equipment_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      character_class_equipment_session: {
        Row: {
          applied: boolean | null
          character_id: string
          created_at: string
          gold_option: string | null
          option: string | null
          total_gold: number | null
          updated_at: string
        }
        Insert: {
          applied?: boolean | null
          character_id: string
          created_at?: string
          gold_option?: string | null
          option?: string | null
          total_gold?: number | null
          updated_at?: string
        }
        Update: {
          applied?: boolean | null
          character_id?: string
          created_at?: string
          gold_option?: string | null
          option?: string | null
          total_gold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_class_equipment_session_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_class_spells: {
        Row: {
          character_id: string
          class_id: string
          created_at: string
          spell_id: string
          state: Database["public"]["Enums"]["spell_state"]
          updated_at: string
        }
        Insert: {
          character_id: string
          class_id: string
          created_at?: string
          spell_id: string
          state: Database["public"]["Enums"]["spell_state"]
          updated_at?: string
        }
        Update: {
          character_id?: string
          class_id?: string
          created_at?: string
          spell_id?: string
          state?: Database["public"]["Enums"]["spell_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_class_spells_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_class_spells_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_class_spells_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      character_classes: {
        Row: {
          character_id: string
          class_id: string
          class_level: number
          created_at: string
          known_spells_overridden: boolean
          specialization_id: string | null
          subclass_id: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          class_id: string
          class_level: number
          created_at?: string
          known_spells_overridden?: boolean
          specialization_id?: string | null
          subclass_id?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          class_id?: string
          class_level?: number
          created_at?: string
          known_spells_overridden?: boolean
          specialization_id?: string | null
          subclass_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_classes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_classes_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_companion_adjustments: {
        Row: {
          character_id: string
          companion_instance_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number | null
          reference_value: string | null
          source_note: string | null
          text_value: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          companion_instance_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value?: number | null
          reference_value?: string | null
          source_note?: string | null
          text_value?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          companion_instance_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number | null
          reference_value?: string | null
          source_note?: string | null
          text_value?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_companion_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_companion_adjustments_companion_fkey"
            columns: ["character_id", "companion_instance_id"]
            isOneToOne: false
            referencedRelation: "character_creatures"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_conditions: {
        Row: {
          character_id: string
          condition_type_id: string
          created_at: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          condition_type_id: string
          created_at?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          condition_type_id?: string
          created_at?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_conditions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_conditions_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
        ]
      }
      character_creature_equipment: {
        Row: {
          character_creature_id: string
          character_id: string
          created_at: string
          equipment_id: string
          updated_at: string
        }
        Insert: {
          character_creature_id: string
          character_id: string
          created_at?: string
          equipment_id: string
          updated_at?: string
        }
        Update: {
          character_creature_id?: string
          character_id?: string
          created_at?: string
          equipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_creature_equipment_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_creature_equipment_creature_owner_fkey"
            columns: ["character_id", "character_creature_id"]
            isOneToOne: false
            referencedRelation: "character_creatures"
            referencedColumns: ["character_id", "id"]
          },
          {
            foreignKeyName: "character_creature_equipment_item_owner_fkey"
            columns: ["character_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_creature_hit_dice_state: {
        Row: {
          character_creature_id: string
          character_id: string
          created_at: string
          die: number
          total: number
          updated_at: string
          used: number
        }
        Insert: {
          character_creature_id: string
          character_id: string
          created_at?: string
          die: number
          total: number
          updated_at?: string
          used: number
        }
        Update: {
          character_creature_id?: string
          character_id?: string
          created_at?: string
          die?: number
          total?: number
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_creature_hit_dice_state_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_creature_hit_dice_state_creature_owner_fkey"
            columns: ["character_id", "character_creature_id"]
            isOneToOne: false
            referencedRelation: "character_creatures"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_creatures: {
        Row: {
          character_id: string
          created_at: string
          creature_id: string
          current_hit_points: number | null
          custom_name: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          origin_kind: string
          relationship_kind: string
          temp_hit_points: number | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          creature_id: string
          current_hit_points?: number | null
          custom_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_kind?: string
          relationship_kind: string
          temp_hit_points?: number | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          creature_id?: string
          current_hit_points?: number | null
          custom_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_kind?: string
          relationship_kind?: string
          temp_hit_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_creatures_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_creatures_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
        ]
      }
      character_currencies: {
        Row: {
          amount: number
          character_id: string
          created_at: string
          currency_id: string
          group_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          character_id: string
          created_at?: string
          currency_id: string
          group_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          character_id?: string
          created_at?: string
          currency_id?: string
          group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_currencies_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_currencies_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_currencies_group_owner_fkey"
            columns: ["character_id", "group_id"]
            isOneToOne: false
            referencedRelation: "character_currency_groups"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_currency_groups: {
        Row: {
          character_id: string
          container_id: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          container_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          container_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_currency_groups_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_currency_groups_container_owner_fkey"
            columns: ["character_id", "container_id"]
            isOneToOne: false
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_defense_additions: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          damage_type_id: string
          defense_kind: string
          id: string
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          damage_type_id: string
          defense_kind: string
          id?: string
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          damage_type_id?: string
          defense_kind?: string
          id?: string
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_defense_additions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_defense_additions_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      character_equipment: {
        Row: {
          character_id: string
          container_id: string | null
          container_path: string | null
          created_at: string
          custom_name: string | null
          equipment_id: string
          id: string
          notes: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          character_id: string
          container_id?: string | null
          container_path?: string | null
          created_at?: string
          custom_name?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          character_id?: string
          container_id?: string | null
          container_path?: string | null
          created_at?: string
          custom_name?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_equipment_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_equipment_container_owner_fkey"
            columns: ["character_id", "container_id"]
            isOneToOne: false
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
          {
            foreignKeyName: "character_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      character_equipped: {
        Row: {
          character_id: string
          created_at: string
          equipment_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          equipment_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          equipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_equipped_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_equipped_equipment_owner_fkey"
            columns: ["character_id", "equipment_id"]
            isOneToOne: true
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_events: {
        Row: {
          actor_id: string
          character_id: string
          command_id: string
          event_data: Json
          event_id: string
          event_type: string
          occurred_at: string
          schema_version: number
        }
        Insert: {
          actor_id: string
          character_id: string
          command_id: string
          event_data: Json
          event_id?: string
          event_type: string
          occurred_at?: string
          schema_version?: number
        }
        Update: {
          actor_id?: string
          character_id?: string
          command_id?: string
          event_data?: Json
          event_id?: string
          event_type?: string
          occurred_at?: string
          schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_events_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_exhaustion: {
        Row: {
          character_id: string
          created_at: string
          level: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          level?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          level?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_exhaustion_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_feature_acquisitions: {
        Row: {
          acquired_parent_id: string | null
          ancestry_id: string | null
          background_id: string | null
          character_id: string
          class_id: string | null
          created_at: string
          feat_id: string | null
          feature_id: string
          id: string
          option_id: string | null
          race_id: string | null
          reason: string | null
          source_kind: string
          subclass_id: string | null
          subrace_id: string | null
          timing_class_id: string | null
          timing_class_level: number | null
          timing_kind: string
          timing_level: number | null
          updated_at: string
        }
        Insert: {
          acquired_parent_id?: string | null
          ancestry_id?: string | null
          background_id?: string | null
          character_id: string
          class_id?: string | null
          created_at?: string
          feat_id?: string | null
          feature_id: string
          id: string
          option_id?: string | null
          race_id?: string | null
          reason?: string | null
          source_kind: string
          subclass_id?: string | null
          subrace_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind: string
          timing_level?: number | null
          updated_at?: string
        }
        Update: {
          acquired_parent_id?: string | null
          ancestry_id?: string | null
          background_id?: string | null
          character_id?: string
          class_id?: string | null
          created_at?: string
          feat_id?: string | null
          feature_id?: string
          id?: string
          option_id?: string | null
          race_id?: string | null
          reason?: string | null
          source_kind?: string
          subclass_id?: string | null
          subrace_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind?: string
          timing_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_feature_acquisitions_acquired_parent_id_fkey"
            columns: ["acquired_parent_id"]
            isOneToOne: false
            referencedRelation: "character_feature_acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_acquisitions_timing_class_id_fkey"
            columns: ["timing_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_feature_selection_records: {
        Row: {
          created_at: string
          feature_acquisition_id: string
          selection_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_acquisition_id: string
          selection_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_acquisition_id?: string
          selection_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_feature_selection_records_feature_acquisition_id_fkey"
            columns: ["feature_acquisition_id"]
            isOneToOne: false
            referencedRelation: "character_feature_acquisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      character_feature_selection_values: {
        Row: {
          boolean_value: boolean | null
          created_at: string
          feature_acquisition_id: string
          number_value: number | null
          selection_key: string
          text_value: string | null
          updated_at: string
          value_index: number
          value_kind: string
        }
        Insert: {
          boolean_value?: boolean | null
          created_at?: string
          feature_acquisition_id: string
          number_value?: number | null
          selection_key: string
          text_value?: string | null
          updated_at?: string
          value_index: number
          value_kind: string
        }
        Update: {
          boolean_value?: boolean | null
          created_at?: string
          feature_acquisition_id?: string
          number_value?: number | null
          selection_key?: string
          text_value?: string | null
          updated_at?: string
          value_index?: number
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_feature_selection_v_feature_acquisition_id_selec_fkey"
            columns: ["feature_acquisition_id", "selection_key"]
            isOneToOne: false
            referencedRelation: "character_feature_selection_records"
            referencedColumns: ["feature_acquisition_id", "selection_key"]
          },
        ]
      }
      character_hit_dice_state: {
        Row: {
          character_id: string
          created_at: string
          die: number
          total: number
          updated_at: string
          used: number
        }
        Insert: {
          character_id: string
          created_at?: string
          die: number
          total: number
          updated_at?: string
          used: number
        }
        Update: {
          character_id?: string
          created_at?: string
          die?: number
          total?: number
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_hit_dice_state_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_hitpoint_adjustments: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value: number
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_hitpoint_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_hitpoint_intent: {
        Row: {
          character_id: string
          created_at: string
          method_code: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          method_code: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          method_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_hitpoint_intent_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_hitpoint_level_rolls: {
        Row: {
          char_level: number
          character_id: string
          created_at: string
          die: number
          roll_index: number
          updated_at: string
          value: number
        }
        Insert: {
          char_level: number
          character_id: string
          created_at?: string
          die: number
          roll_index: number
          updated_at?: string
          value: number
        }
        Update: {
          char_level?: number
          character_id?: string
          created_at?: string
          die?: number
          roll_index?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_hitpoint_level_rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_hitpoint_levels: {
        Row: {
          char_level: number
          character_id: string
          class_id: string
          class_level: number
          created_at: string
          overridden: boolean | null
          updated_at: string
          value: number
        }
        Insert: {
          char_level: number
          character_id: string
          class_id: string
          class_level: number
          created_at?: string
          overridden?: boolean | null
          updated_at?: string
          value: number
        }
        Update: {
          char_level?: number
          character_id?: string
          class_id?: string
          class_level?: number
          created_at?: string
          overridden?: boolean | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_hitpoint_levels_character_class_fkey"
            columns: ["character_id", "class_id"]
            isOneToOne: false
            referencedRelation: "character_classes"
            referencedColumns: ["character_id", "class_id"]
          },
          {
            foreignKeyName: "character_hitpoint_levels_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_hitpoint_state: {
        Row: {
          character_id: string
          created_at: string
          current: number | null
          max_override: number | null
          temp: number | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          current?: number | null
          max_override?: number | null
          temp?: number | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          current?: number | null
          max_override?: number | null
          temp?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_hitpoint_state_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_item_adjustments: {
        Row: {
          boolean_value: boolean | null
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          item_instance_id: string
          numeric_value: number | null
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          boolean_value?: boolean | null
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          item_instance_id: string
          numeric_value?: number | null
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          boolean_value?: boolean | null
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          item_instance_id?: string
          numeric_value?: number | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_item_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_item_adjustments_item_fkey"
            columns: ["item_instance_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      character_mechanics_projections: {
        Row: {
          authored_version_vector: Json
          bounded_registry: Json
          character_id: string
          command_lane_checksum: string
          command_state: Json
          command_state_checksum: string
          evaluator_version: string
          model_contract_version: number
          normalized_facts: Json
          projection_checksum: string
          projection_schema_version: number
          rule_pack_checksum: string
          rule_pack_revision_id: string
          rule_result: Json
          rule_snapshot: Json
          stream_version: number
          updated_at: string
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_version_vector: Json
          bounded_registry: Json
          character_id: string
          command_lane_checksum: string
          command_state: Json
          command_state_checksum: string
          evaluator_version: string
          model_contract_version: number
          normalized_facts: Json
          projection_checksum: string
          projection_schema_version: number
          rule_pack_checksum: string
          rule_pack_revision_id: string
          rule_result: Json
          rule_snapshot: Json
          stream_version: number
          updated_at?: string
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_version_vector?: Json
          bounded_registry?: Json
          character_id?: string
          command_lane_checksum?: string
          command_state?: Json
          command_state_checksum?: string
          evaluator_version?: string
          model_contract_version?: number
          normalized_facts?: Json
          projection_checksum?: string
          projection_schema_version?: number
          rule_pack_checksum?: string
          rule_pack_revision_id?: string
          rule_result?: Json
          rule_snapshot?: Json
          stream_version?: number
          updated_at?: string
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_mechanics_projections_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_mechanics_projections_rule_pack_revision_id_fkey"
            columns: ["rule_pack_revision_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_mechanics_projections_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      character_movement_adjustments: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          source_note: string | null
          speed_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          field_kind?: string
          id?: string
          integer_value: number
          source_note?: string | null
          speed_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          source_note?: string | null
          speed_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_movement_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_movement_adjustments_speed_id_fkey"
            columns: ["speed_id"]
            isOneToOne: false
            referencedRelation: "speeds"
            referencedColumns: ["id"]
          },
        ]
      }
      character_note_groups: {
        Row: {
          character_id: string
          created_at: string
          id: string
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          kind: string
          label: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_note_groups_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_notes: {
        Row: {
          body: string | null
          character_id: string
          created_at: string
          group_id: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          character_id: string
          created_at: string
          group_id: string
          id?: string
          pinned?: boolean
          title: string
          updated_at: string
        }
        Update: {
          body?: string | null
          character_id?: string
          created_at?: string
          group_id?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_notes_group_owner_fkey"
            columns: ["character_id", "group_id"]
            isOneToOne: false
            referencedRelation: "character_note_groups"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_passive_adjustments: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          skill_id: string
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          field_kind?: string
          id?: string
          integer_value: number
          skill_id: string
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          skill_id?: string
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_passive_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_passive_adjustments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      character_proficiency_additions: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          id: string
          proficiency_kind: string
          source_note: string | null
          target_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          id?: string
          proficiency_kind: string
          source_note?: string | null
          target_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          id?: string
          proficiency_kind?: string
          source_note?: string | null
          target_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_proficiency_additions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_profile: {
        Row: {
          age: string | null
          alignment_id: string | null
          allies: string | null
          backstory: string | null
          bonds: string | null
          character_id: string
          created_at: string
          enemies: string | null
          eyes: string | null
          faith: string | null
          flaws: string | null
          gender: string | null
          hair: string | null
          height: string | null
          ideals: string | null
          lifestyle_id: string | null
          notes: string | null
          organizations: string | null
          personality_traits: string | null
          physical_characteristics: string | null
          skin: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          age?: string | null
          alignment_id?: string | null
          allies?: string | null
          backstory?: string | null
          bonds?: string | null
          character_id: string
          created_at?: string
          enemies?: string | null
          eyes?: string | null
          faith?: string | null
          flaws?: string | null
          gender?: string | null
          hair?: string | null
          height?: string | null
          ideals?: string | null
          lifestyle_id?: string | null
          notes?: string | null
          organizations?: string | null
          personality_traits?: string | null
          physical_characteristics?: string | null
          skin?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          age?: string | null
          alignment_id?: string | null
          allies?: string | null
          backstory?: string | null
          bonds?: string | null
          character_id?: string
          created_at?: string
          enemies?: string | null
          eyes?: string | null
          faith?: string | null
          flaws?: string | null
          gender?: string | null
          hair?: string | null
          height?: string | null
          ideals?: string | null
          lifestyle_id?: string | null
          notes?: string | null
          organizations?: string | null
          personality_traits?: string | null
          physical_characteristics?: string | null
          skin?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_profile_alignment_id_fkey"
            columns: ["alignment_id"]
            isOneToOne: false
            referencedRelation: "alignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profile_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profile_lifestyle_id_fkey"
            columns: ["lifestyle_id"]
            isOneToOne: false
            referencedRelation: "lifestyles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_race: {
        Row: {
          character_id: string
          created_at: string
          race_id: string
          subrace_id: string | null
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          race_id: string
          subrace_id?: string | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          race_id?: string
          subrace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_race_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_race_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_race_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      character_resource_grants: {
        Row: {
          acquired_parent_id: string | null
          character_id: string
          class_id: string | null
          created_at: string
          feature_id: string | null
          id: string
          option_id: string | null
          resource_id: string
          source_kind: string
          subclass_id: string | null
          timing_class_id: string | null
          timing_class_level: number | null
          timing_kind: string
          timing_level: number | null
          updated_at: string
        }
        Insert: {
          acquired_parent_id?: string | null
          character_id: string
          class_id?: string | null
          created_at?: string
          feature_id?: string | null
          id: string
          option_id?: string | null
          resource_id: string
          source_kind: string
          subclass_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind: string
          timing_level?: number | null
          updated_at?: string
        }
        Update: {
          acquired_parent_id?: string | null
          character_id?: string
          class_id?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          option_id?: string | null
          resource_id?: string
          source_kind?: string
          subclass_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind?: string
          timing_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_resource_grants_acquired_parent_id_fkey"
            columns: ["acquired_parent_id"]
            isOneToOne: false
            referencedRelation: "character_feature_acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_resource_grants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_resource_grants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_resource_grants_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_resource_grants_timing_class_id_fkey"
            columns: ["timing_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_resources: {
        Row: {
          character_id: string
          created_at: string
          resource_grant_id: string
          updated_at: string
          used: number
        }
        Insert: {
          character_id: string
          created_at?: string
          resource_grant_id: string
          updated_at?: string
          used?: number
        }
        Update: {
          character_id?: string
          created_at?: string
          resource_grant_id?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_resources_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_resources_resource_grant_id_fkey"
            columns: ["character_id", "resource_grant_id"]
            isOneToOne: true
            referencedRelation: "character_resource_grants"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_saving_throw_adjustments: {
        Row: {
          ability_code: string
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number | null
          proficiency_value: string | null
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          ability_code: string
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value?: number | null
          proficiency_value?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          ability_code?: string
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number | null
          proficiency_value?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_saving_throw_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sense_adjustments: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          sense_id: string
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          field_kind?: string
          id?: string
          integer_value: number
          sense_id: string
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          sense_id?: string
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sense_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sense_adjustments_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "senses"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sheet_preferences: {
        Row: {
          character_id: string
          created_at: string
          movement_display_mode: string
          movement_speed_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          movement_display_mode?: string
          movement_speed_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          movement_display_mode?: string
          movement_speed_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sheet_preferences_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sheet_preferences_movement_speed_id_fkey"
            columns: ["movement_speed_id"]
            isOneToOne: false
            referencedRelation: "speeds"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sheet_resource_usage: {
        Row: {
          character_id: string
          charge_id: string | null
          companion_instance_id: string | null
          created_at: string
          created_by: string
          feature_id: string | null
          id: string
          item_instance_id: string | null
          owner_kind: string
          resource_grant_id: string | null
          sense_grant_id: string | null
          source_id: string | null
          source_instance_id: string | null
          source_kind: string | null
          spell_id: string | null
          updated_at: string
          updated_by: string
          used: number
        }
        Insert: {
          character_id: string
          charge_id?: string | null
          companion_instance_id?: string | null
          created_at?: string
          created_by: string
          feature_id?: string | null
          id?: string
          item_instance_id?: string | null
          owner_kind: string
          resource_grant_id?: string | null
          sense_grant_id?: string | null
          source_id?: string | null
          source_instance_id?: string | null
          source_kind?: string | null
          spell_id?: string | null
          updated_at?: string
          updated_by: string
          used?: number
        }
        Update: {
          character_id?: string
          charge_id?: string | null
          companion_instance_id?: string | null
          created_at?: string
          created_by?: string
          feature_id?: string | null
          id?: string
          item_instance_id?: string | null
          owner_kind?: string
          resource_grant_id?: string | null
          sense_grant_id?: string | null
          source_id?: string | null
          source_instance_id?: string | null
          source_kind?: string | null
          spell_id?: string | null
          updated_at?: string
          updated_by?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_sheet_resource_usage_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sheet_resource_usage_companion_fkey"
            columns: ["character_id", "companion_instance_id"]
            isOneToOne: false
            referencedRelation: "character_creatures"
            referencedColumns: ["character_id", "id"]
          },
          {
            foreignKeyName: "character_sheet_resource_usage_item_fkey"
            columns: ["item_instance_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sheet_resource_usage_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skill_adjustments: {
        Row: {
          ability_value: string | null
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number | null
          proficiency_value: string | null
          skill_id: string
          source_note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          ability_value?: string | null
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value?: number | null
          proficiency_value?: string | null
          skill_id: string
          source_note?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          ability_value?: string | null
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number | null
          proficiency_value?: string | null
          skill_id?: string
          source_note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_skill_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_skill_adjustments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_adjustments: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          field_kind: string
          id: string
          integer_value: number
          source_instance_id: string
          source_kind: string
          source_note: string | null
          spell_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          field_kind: string
          id?: string
          integer_value: number
          source_instance_id: string
          source_kind: string
          source_note?: string | null
          spell_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          field_kind?: string
          id?: string
          integer_value?: number
          source_instance_id?: string
          source_kind?: string
          source_note?: string | null
          spell_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_adjustments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_adjustments_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_customizations: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          custom_name: string | null
          display_as_attack: boolean
          id: string
          notes: string | null
          source_instance_id: string
          source_kind: string
          spell_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          custom_name?: string | null
          display_as_attack?: boolean
          id?: string
          notes?: string | null
          source_instance_id: string
          source_kind: string
          spell_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          custom_name?: string | null
          display_as_attack?: boolean
          id?: string
          notes?: string | null
          source_instance_id?: string
          source_kind?: string
          spell_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_customizations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_customizations_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_selection_spells: {
        Row: {
          created_at: string
          selection_id: string
          spell_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          selection_id: string
          spell_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          selection_id?: string
          spell_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_selection_spells_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "character_spell_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selection_spells_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_selections: {
        Row: {
          acquired_parent_id: string | null
          character_id: string
          class_id: string | null
          created_at: string
          feature_id: string | null
          id: string
          option_id: string | null
          replaced_selection_id: string | null
          source_kind: string
          subclass_id: string | null
          timing_class_id: string | null
          timing_class_level: number | null
          timing_kind: string
          timing_level: number | null
          updated_at: string
        }
        Insert: {
          acquired_parent_id?: string | null
          character_id: string
          class_id?: string | null
          created_at?: string
          feature_id?: string | null
          id: string
          option_id?: string | null
          replaced_selection_id?: string | null
          source_kind: string
          subclass_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind: string
          timing_level?: number | null
          updated_at?: string
        }
        Update: {
          acquired_parent_id?: string | null
          character_id?: string
          class_id?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          option_id?: string | null
          replaced_selection_id?: string | null
          source_kind?: string
          subclass_id?: string | null
          timing_class_id?: string | null
          timing_class_level?: number | null
          timing_kind?: string
          timing_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_selections_acquired_parent_id_fkey"
            columns: ["acquired_parent_id"]
            isOneToOne: false
            referencedRelation: "character_feature_acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selections_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selections_replaced_selection_id_fkey"
            columns: ["replaced_selection_id"]
            isOneToOne: false
            referencedRelation: "character_spell_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selections_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_selections_timing_class_id_fkey"
            columns: ["timing_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_slot_state: {
        Row: {
          character_id: string
          created_at: string
          slot_key: string
          updated_at: string
          used: number
        }
        Insert: {
          character_id: string
          created_at?: string
          slot_key: string
          updated_at?: string
          used?: number
        }
        Update: {
          character_id?: string
          created_at?: string
          slot_key?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_slot_state_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_vehicle_equipment: {
        Row: {
          character_id: string
          character_vehicle_id: string
          created_at: string
          equipment_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          character_vehicle_id: string
          created_at?: string
          equipment_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          character_vehicle_id?: string
          created_at?: string
          equipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_vehicle_equipment_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_vehicle_equipment_item_owner_fkey"
            columns: ["character_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "character_equipment"
            referencedColumns: ["character_id", "id"]
          },
          {
            foreignKeyName: "character_vehicle_equipment_vehicle_owner_fkey"
            columns: ["character_id", "character_vehicle_id"]
            isOneToOne: false
            referencedRelation: "character_vehicles"
            referencedColumns: ["character_id", "id"]
          },
        ]
      }
      character_vehicles: {
        Row: {
          character_id: string
          created_at: string
          current_hit_points: number | null
          custom_name: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          current_hit_points?: number | null
          custom_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          current_hit_points?: number | null
          custom_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_vehicles_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      characteristic_durations: {
        Row: {
          amount: number | null
          characteristic_id: string
          kind: string
          scaling: Json | null
        }
        Insert: {
          amount?: number | null
          characteristic_id: string
          kind: string
          scaling?: Json | null
        }
        Update: {
          amount?: number | null
          characteristic_id?: string
          kind?: string
          scaling?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "characteristic_durations_characteristic_id_fkey"
            columns: ["characteristic_id"]
            isOneToOne: true
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
        ]
      }
      characteristic_ranges: {
        Row: {
          characteristic_id: string
          kind: string
          max: number | null
          min: number | null
          scaling: Json | null
          unit_code: string | null
        }
        Insert: {
          characteristic_id: string
          kind: string
          max?: number | null
          min?: number | null
          scaling?: Json | null
          unit_code?: string | null
        }
        Update: {
          characteristic_id?: string
          kind?: string
          max?: number | null
          min?: number | null
          scaling?: Json | null
          unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characteristic_ranges_characteristic_id_fkey"
            columns: ["characteristic_id"]
            isOneToOne: true
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
        ]
      }
      characteristic_shape_dimensions: {
        Row: {
          amount: number
          characteristic_id: string
          dimension: string
          scaling: Json | null
          unit_code: string
        }
        Insert: {
          amount: number
          characteristic_id: string
          dimension: string
          scaling?: Json | null
          unit_code: string
        }
        Update: {
          amount?: number
          characteristic_id?: string
          dimension?: string
          scaling?: Json | null
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "characteristic_shape_dimensions_characteristic_id_fkey"
            columns: ["characteristic_id"]
            isOneToOne: false
            referencedRelation: "characteristic_shapes"
            referencedColumns: ["characteristic_id"]
          },
        ]
      }
      characteristic_shapes: {
        Row: {
          characteristic_id: string
          kind: string
        }
        Insert: {
          characteristic_id: string
          kind: string
        }
        Update: {
          characteristic_id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "characteristic_shapes_characteristic_id_fkey"
            columns: ["characteristic_id"]
            isOneToOne: true
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
        ]
      }
      characteristics: {
        Row: {
          code: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          inspiration: boolean
          label: string
          portrait_asset_id: string | null
          rule_pack_revision_id: string | null
          status: string
          stream_version: number
          system_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          inspiration?: boolean
          label: string
          portrait_asset_id?: string | null
          rule_pack_revision_id?: string | null
          status?: string
          stream_version?: number
          system_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          inspiration?: boolean
          label?: string
          portrait_asset_id?: string | null
          rule_pack_revision_id?: string | null
          status?: string
          stream_version?: number
          system_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_portrait_asset_fk"
            columns: ["portrait_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_rule_pack_revision_id_fkey"
            columns: ["rule_pack_revision_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_bonuses: {
        Row: {
          ability_code: string | null
          bonus_kind: string
          charge_id: string
          created_at: string
          id: string
          max: number | null
          min: number | null
          multiplier: number | null
          skill_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          ability_code?: string | null
          bonus_kind: string
          charge_id: string
          created_at?: string
          id: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          skill_id?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          ability_code?: string | null
          bonus_kind?: string
          charge_id?: string
          created_at?: string
          id?: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          skill_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_bonuses_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_bonuses_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_limits: {
        Row: {
          ability_code: string | null
          amount: number | null
          charge_id: string
          class_id: string | null
          cost: number | null
          limit_kind: string
          max: number | null
          min: number | null
          multiplier: number | null
        }
        Insert: {
          ability_code?: string | null
          amount?: number | null
          charge_id: string
          class_id?: string | null
          cost?: number | null
          limit_kind: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
        }
        Update: {
          ability_code?: string | null
          amount?: number | null
          charge_id?: string
          class_id?: string | null
          cost?: number | null
          limit_kind?: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_limits_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: true
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_scaling_levels: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          id: string
          level: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          id: string
          level: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          id?: string
          level?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_scaling_levels_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          created_at: string
          id: string
          reset_kind: string | null
          scaling_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          reset_kind?: string | null
          scaling_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reset_kind?: string | null
          scaling_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_attributes: {
        Row: {
          attribute_code: string
          class_id: string
          sort_order: number
        }
        Insert: {
          attribute_code: string
          class_id: string
          sort_order: number
        }
        Update: {
          attribute_code?: string
          class_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_attributes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_details: {
        Row: {
          class_id: string
          detail_id: string
          sort_order: number
        }
        Insert: {
          class_id: string
          detail_id: string
          sort_order: number
        }
        Update: {
          class_id?: string
          detail_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_details_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
        ]
      }
      class_features: {
        Row: {
          class_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          class_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          class_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_features_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      class_hitpoints: {
        Row: {
          ability_code: string
          class_id: string
          die_config: string
        }
        Insert: {
          ability_code: string
          class_id: string
          die_config: string
        }
        Update: {
          ability_code?: string
          class_id?: string
          die_config?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_hitpoints_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_multiclass: {
        Row: {
          class_id: string
          id: string
        }
        Insert: {
          class_id: string
          id?: string
        }
        Update: {
          class_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_multiclass_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_multiclass_proficiency_grants: {
        Row: {
          multiclass_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          multiclass_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          multiclass_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_multiclass_proficiency_grants_multiclass_id_fkey"
            columns: ["multiclass_id"]
            isOneToOne: false
            referencedRelation: "class_multiclass"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_multiclass_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_multiclass_requirement_groups: {
        Row: {
          id: string
          multiclass_id: string
          sort_order: number
        }
        Insert: {
          id: string
          multiclass_id: string
          sort_order: number
        }
        Update: {
          id?: string
          multiclass_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_multiclass_requirement_groups_multiclass_id_fkey"
            columns: ["multiclass_id"]
            isOneToOne: false
            referencedRelation: "class_multiclass"
            referencedColumns: ["id"]
          },
        ]
      }
      class_multiclass_requirements: {
        Row: {
          ability_code: string
          id: string
          min: number
          requirement_group_id: string
          sort_order: number
        }
        Insert: {
          ability_code: string
          id: string
          min: number
          requirement_group_id: string
          sort_order: number
        }
        Update: {
          ability_code?: string
          id?: string
          min?: number
          requirement_group_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_multiclass_requirements_requirement_group_id_fkey"
            columns: ["requirement_group_id"]
            isOneToOne: false
            referencedRelation: "class_multiclass_requirement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      class_proficiency_grants: {
        Row: {
          class_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          class_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          class_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_proficiency_grants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_resources: {
        Row: {
          available_at_level: number
          charge_id: string
          class_id: string
          description: string | null
          id: string
          label: string
          sort_order: number | null
        }
        Insert: {
          available_at_level: number
          charge_id: string
          class_id: string
          description?: string | null
          id?: string
          label: string
          sort_order?: number | null
        }
        Update: {
          available_at_level?: number
          charge_id?: string
          class_id?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_resources_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_specializations: {
        Row: {
          class_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          class_id: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          class_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_specializations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spell_limits: {
        Row: {
          cantrips_limit: number | null
          class_level: number
          id: string
          learned_spells_limit: number | null
          prepared_spells_limit: number | null
          spellcasting_id: string
        }
        Insert: {
          cantrips_limit?: number | null
          class_level: number
          id?: string
          learned_spells_limit?: number | null
          prepared_spells_limit?: number | null
          spellcasting_id: string
        }
        Update: {
          cantrips_limit?: number | null
          class_level?: number
          id?: string
          learned_spells_limit?: number | null
          prepared_spells_limit?: number | null
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spell_limits_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: false
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spell_slots: {
        Row: {
          slot_count: number
          spell_level: number
          spell_limit_id: string
        }
        Insert: {
          slot_count: number
          spell_level: number
          spell_limit_id: string
        }
        Update: {
          slot_count?: number
          spell_level?: number
          spell_limit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spell_slots_spell_limit_id_fkey"
            columns: ["spell_limit_id"]
            isOneToOne: false
            referencedRelation: "class_spell_limits"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting: {
        Row: {
          ability_code: string | null
          available_at_level: number | null
          available_spell_ids: string[]
          charge_id: string
          class_id: string
          id: string
          magic_name: string | null
          max_spell_level: number
          sort_order: number | null
        }
        Insert: {
          ability_code?: string | null
          available_at_level?: number | null
          available_spell_ids?: string[]
          charge_id: string
          class_id: string
          id?: string
          magic_name?: string | null
          max_spell_level: number
          sort_order?: number | null
        }
        Update: {
          ability_code?: string | null
          available_at_level?: number | null
          available_spell_ids?: string[]
          charge_id?: string
          class_id?: string
          id?: string
          magic_name?: string | null
          max_spell_level?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_spellcasting_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting_attributes: {
        Row: {
          attribute_code: string
          sort_order: number
          spellcasting_id: string
        }
        Insert: {
          attribute_code: string
          sort_order: number
          spellcasting_id: string
        }
        Update: {
          attribute_code?: string
          sort_order?: number
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_attributes_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: false
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting_details: {
        Row: {
          detail_id: string
          sort_order: number
          spellcasting_id: string
        }
        Insert: {
          detail_id: string
          sort_order: number
          spellcasting_id: string
        }
        Update: {
          detail_id?: string
          sort_order?: number
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_spellcasting_details_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: false
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting_prepare_limit: {
        Row: {
          rounding: string | null
          scaling: string | null
          spellcasting_id: string
        }
        Insert: {
          rounding?: string | null
          scaling?: string | null
          spellcasting_id: string
        }
        Update: {
          rounding?: string | null
          scaling?: string | null
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_prepare_limit_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: true
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting_prepare_limit_levels: {
        Row: {
          amount: number
          class_level: number
          spellcasting_id: string
        }
        Insert: {
          amount: number
          class_level: number
          spellcasting_id: string
        }
        Update: {
          amount?: number
          class_level?: number
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_prepare_limit_levels_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: false
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_spellcasting_prepare_limit_methods: {
        Row: {
          method_code: string
          sort_order: number
          spellcasting_id: string
        }
        Insert: {
          method_code: string
          sort_order: number
          spellcasting_id: string
        }
        Update: {
          method_code?: string
          sort_order?: number
          spellcasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_spellcasting_prepare_limit_methods_spellcasting_id_fkey"
            columns: ["spellcasting_id"]
            isOneToOne: false
            referencedRelation: "class_spellcasting"
            referencedColumns: ["id"]
          },
        ]
      }
      class_starting_gold: {
        Row: {
          class_id: string
          currency_id: string
          die_config: string
          multiplier: number
        }
        Insert: {
          class_id: string
          currency_id: string
          die_config: string
          multiplier: number
        }
        Update: {
          class_id?: string
          currency_id?: string
          die_config?: string
          multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_starting_gold_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_starting_gold_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      class_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          class_id: string
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          class_id: string
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          class_id?: string
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active_version_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_master: boolean | null
          label: string
          parent_class_id: string | null
          starting_equipment_id: string | null
          status: string
          subclass_selection_level: number | null
          system_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id: string
          is_master?: boolean | null
          label: string
          parent_class_id?: string | null
          starting_equipment_id?: string | null
          status?: string
          subclass_selection_level?: number | null
          system_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_master?: boolean | null
          label?: string
          parent_class_id?: string | null
          starting_equipment_id?: string | null
          status?: string
          subclass_selection_level?: number | null
          system_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "class_versions"
            referencedColumns: ["class_id", "id"]
          },
          {
            foreignKeyName: "classes_parent_system_fk"
            columns: ["parent_class_id", "system_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "system_id"]
          },
          {
            foreignKeyName: "classes_starting_equipment_id_fkey"
            columns: ["starting_equipment_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_types_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          condition_type_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          condition_type_id: string
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          condition_type_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_condition_immunities: {
        Row: {
          condition_type_id: string
          creature_id: string
        }
        Insert: {
          condition_type_id: string
          creature_id: string
        }
        Update: {
          condition_type_id?: string
          creature_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creature_condition_immunities_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_condition_immunities_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_damage_immunities: {
        Row: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          damage_type_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_damage_immunities_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_damage_immunities_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_damage_resistances: {
        Row: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          damage_type_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_damage_resistances_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_damage_resistances_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_damage_vulnerabilities: {
        Row: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          damage_type_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          damage_type_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_damage_vulnerabilities_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_damage_vulnerabilities_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_details: {
        Row: {
          creature_id: string
          detail_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          detail_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          detail_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_details_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_features: {
        Row: {
          creature_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_features_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_proficiency_grants: {
        Row: {
          creature_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          creature_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          creature_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creature_proficiency_grants_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_speeds: {
        Row: {
          amount: number
          creature_id: string
          sort_order: number
          speed_id: string
          unit_code: string
        }
        Insert: {
          amount: number
          creature_id: string
          sort_order: number
          speed_id: string
          unit_code: string
        }
        Update: {
          amount?: number
          creature_id?: string
          sort_order?: number
          speed_id?: string
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "creature_speeds_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_speeds_speed_id_fkey"
            columns: ["speed_id"]
            isOneToOne: false
            referencedRelation: "speeds"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creature_types_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      creature_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          creature_id: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          creature_id: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          creature_id?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creature_versions_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creature_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      creatures: {
        Row: {
          ability_scores: Json | null
          active_version_id: string | null
          alignment_id: string | null
          armor_class: number | null
          armor_class_note: string | null
          carrying_capacity_amount: number | null
          carrying_capacity_unit: string | null
          category: string
          challenge_rating_id: string | null
          companion_profile: Json | null
          cost: Json | null
          created_at: string
          creature_type_id: string | null
          description: string | null
          hit_dice: string | null
          hit_dice_count: number | null
          hit_dice_modifier: number | null
          hit_die: number | null
          hit_points: number | null
          id: string
          is_master: boolean | null
          label: string
          logistics_notes: string[] | null
          mount_profile: Json | null
          npc_profile: Json | null
          passive_perception: number | null
          quote: string | null
          senses: string[] | null
          size_code: string | null
          status: string
          system_id: string
          tags: string[] | null
          updated_at: string
          user_id: string | null
          xp: number | null
        }
        Insert: {
          ability_scores?: Json | null
          active_version_id?: string | null
          alignment_id?: string | null
          armor_class?: number | null
          armor_class_note?: string | null
          carrying_capacity_amount?: number | null
          carrying_capacity_unit?: string | null
          category: string
          challenge_rating_id?: string | null
          companion_profile?: Json | null
          cost?: Json | null
          created_at?: string
          creature_type_id?: string | null
          description?: string | null
          hit_dice?: string | null
          hit_dice_count?: number | null
          hit_dice_modifier?: number | null
          hit_die?: number | null
          hit_points?: number | null
          id: string
          is_master?: boolean | null
          label: string
          logistics_notes?: string[] | null
          mount_profile?: Json | null
          npc_profile?: Json | null
          passive_perception?: number | null
          quote?: string | null
          senses?: string[] | null
          size_code?: string | null
          status?: string
          system_id: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          xp?: number | null
        }
        Update: {
          ability_scores?: Json | null
          active_version_id?: string | null
          alignment_id?: string | null
          armor_class?: number | null
          armor_class_note?: string | null
          carrying_capacity_amount?: number | null
          carrying_capacity_unit?: string | null
          category?: string
          challenge_rating_id?: string | null
          companion_profile?: Json | null
          cost?: Json | null
          created_at?: string
          creature_type_id?: string | null
          description?: string | null
          hit_dice?: string | null
          hit_dice_count?: number | null
          hit_dice_modifier?: number | null
          hit_die?: number | null
          hit_points?: number | null
          id?: string
          is_master?: boolean | null
          label?: string
          logistics_notes?: string[] | null
          mount_profile?: Json | null
          npc_profile?: Json | null
          passive_perception?: number | null
          quote?: string | null
          senses?: string[] | null
          size_code?: string | null
          status?: string
          system_id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatures_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "creature_versions"
            referencedColumns: ["creature_id", "id"]
          },
          {
            foreignKeyName: "creatures_alignment_id_fkey"
            columns: ["alignment_id"]
            isOneToOne: false
            referencedRelation: "alignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_challenge_rating_id_fkey"
            columns: ["challenge_rating_id"]
            isOneToOne: false
            referencedRelation: "challenge_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_creature_type_id_fkey"
            columns: ["creature_type_id"]
            isOneToOne: false
            referencedRelation: "creature_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currencies_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_bonus_kinds: {
        Row: {
          bonus_kind: string
          damage_id: string
          sort_order: number
        }
        Insert: {
          bonus_kind: string
          damage_id: string
          sort_order?: number
        }
        Update: {
          bonus_kind?: string
          damage_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "damage_bonus_kinds_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_bonuses: {
        Row: {
          ability_code: string | null
          bonus_kind: string
          created_at: string
          damage_id: string
          id: string
          max: number | null
          min: number | null
          multiplier: number | null
          skill_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          ability_code?: string | null
          bonus_kind: string
          created_at?: string
          damage_id: string
          id: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          skill_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ability_code?: string | null
          bonus_kind?: string
          created_at?: string
          damage_id?: string
          id?: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          skill_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_bonuses_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_bonuses_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_scaling_levels: {
        Row: {
          amount: number | null
          created_at: string
          damage_id: string
          dice: string | null
          id: string
          level: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          damage_id: string
          dice?: string | null
          id: string
          level: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          damage_id?: string
          dice?: string | null
          id?: string
          level?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_scaling_levels_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_types_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_values: {
        Row: {
          amount: number | null
          created_at: string
          damage_id: string
          dice: string | null
          id: string
          max: number | null
          min: number | null
          multiplier: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          damage_id: string
          dice?: string | null
          id: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          damage_id?: string
          dice?: string | null
          id?: string
          max?: number | null
          min?: number | null
          multiplier?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_values_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
        ]
      }
      damages: {
        Row: {
          amount_kind: string | null
          amount_multiplier: number | null
          class_id: string | null
          created_at: string
          damage_type_id: string
          id: string
          scaling_kind: string
          scaling_source: string | null
          sort_order: number
          updated_at: string
          value_kind: string
        }
        Insert: {
          amount_kind?: string | null
          amount_multiplier?: number | null
          class_id?: string | null
          created_at?: string
          damage_type_id: string
          id: string
          scaling_kind: string
          scaling_source?: string | null
          sort_order?: number
          updated_at?: string
          value_kind: string
        }
        Update: {
          amount_kind?: string | null
          amount_multiplier?: number | null
          class_id?: string | null
          created_at?: string
          damage_type_id?: string
          id?: string
          scaling_kind?: string
          scaling_source?: string | null
          sort_order?: number
          updated_at?: string
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "damages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damages_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      details: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      effect_generic_outcomes: {
        Row: {
          effect_kind: string
          id: string
          json_data: Json
        }
        Insert: {
          effect_kind: string
          id: string
          json_data: Json
        }
        Update: {
          effect_kind?: string
          id?: string
          json_data?: Json
        }
        Relationships: []
      }
      effect_invocations: {
        Row: {
          activation_type: string
          activation_value: number | null
          allow_repeated_targets: boolean | null
          created_at: string
          effect_id: string
          excluded_creature_type_ids: string[] | null
          max_targets: number | null
          max_targets_scaling: Json | null
          range_characteristic_id: string
          resolution_count: number | null
          resolution_count_scaling: Json | null
          resource_charge_id: string | null
          resource_cost: number | null
          saving_throw_id: string | null
          shape_characteristic_id: string | null
          target_disposition_kind: string | null
          target_selection_kind: string | null
          trigger_code: string
          updated_at: string
        }
        Insert: {
          activation_type: string
          activation_value?: number | null
          allow_repeated_targets?: boolean | null
          created_at?: string
          effect_id: string
          excluded_creature_type_ids?: string[] | null
          max_targets?: number | null
          max_targets_scaling?: Json | null
          range_characteristic_id: string
          resolution_count?: number | null
          resolution_count_scaling?: Json | null
          resource_charge_id?: string | null
          resource_cost?: number | null
          saving_throw_id?: string | null
          shape_characteristic_id?: string | null
          target_disposition_kind?: string | null
          target_selection_kind?: string | null
          trigger_code: string
          updated_at?: string
        }
        Update: {
          activation_type?: string
          activation_value?: number | null
          allow_repeated_targets?: boolean | null
          created_at?: string
          effect_id?: string
          excluded_creature_type_ids?: string[] | null
          max_targets?: number | null
          max_targets_scaling?: Json | null
          range_characteristic_id?: string
          resolution_count?: number | null
          resolution_count_scaling?: Json | null
          resource_charge_id?: string | null
          resource_cost?: number | null
          saving_throw_id?: string | null
          shape_characteristic_id?: string | null
          target_disposition_kind?: string | null
          target_selection_kind?: string | null
          trigger_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effect_invocations_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: true
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_invocations_range_characteristic_id_fkey"
            columns: ["range_characteristic_id"]
            isOneToOne: false
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_invocations_resource_charge_id_fkey"
            columns: ["resource_charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_invocations_saving_throw_id_fkey"
            columns: ["saving_throw_id"]
            isOneToOne: false
            referencedRelation: "saving_throws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_invocations_shape_characteristic_id_fkey"
            columns: ["shape_characteristic_id"]
            isOneToOne: false
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
        ]
      }
      effect_path_choice_options: {
        Row: {
          description: string | null
          id: string
          label: string | null
          path_id: string
          result_block_id: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id: string
          label?: string | null
          path_id: string
          result_block_id: string
          sort_order: number
        }
        Update: {
          description?: string | null
          id?: string
          label?: string | null
          path_id?: string
          result_block_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "effect_path_choice_options_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "effect_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_path_choice_options_result_block_id_fkey"
            columns: ["result_block_id"]
            isOneToOne: false
            referencedRelation: "effect_result_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      effect_path_roll_table_rows: {
        Row: {
          created_at: string
          id: string
          path_id: string
          repeat_config: Json | null
          resolution_kind: string
          result_block_id: string | null
          roll_max: number | null
          roll_min: number | null
          roll_value: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          path_id: string
          repeat_config?: Json | null
          resolution_kind?: string
          result_block_id?: string | null
          roll_max?: number | null
          roll_min?: number | null
          roll_value?: number | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          path_id?: string
          repeat_config?: Json | null
          resolution_kind?: string
          result_block_id?: string | null
          roll_max?: number | null
          roll_min?: number | null
          roll_value?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effect_path_roll_table_rows_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "effect_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_path_roll_table_rows_result_block_id_fkey"
            columns: ["result_block_id"]
            isOneToOne: false
            referencedRelation: "effect_result_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      effect_paths: {
        Row: {
          allow_repeated_targets: boolean | null
          created_at: string
          die: string | null
          effect_id: string
          excluded_creature_type_ids: string[] | null
          group_type: string
          id: string
          max_targets: number | null
          max_targets_scaling: Json | null
          origin_kind: string | null
          path_code: string
          range_override_characteristic_id: string | null
          resolution_count: number | null
          resolution_count_scaling: Json | null
          result_block_id: string | null
          roll_table_kind: string | null
          selection_kind: string
          sort_order: number
          target_disposition_kind: string | null
          target_selection_kind: string | null
          updated_at: string
        }
        Insert: {
          allow_repeated_targets?: boolean | null
          created_at?: string
          die?: string | null
          effect_id: string
          excluded_creature_type_ids?: string[] | null
          group_type: string
          id: string
          max_targets?: number | null
          max_targets_scaling?: Json | null
          origin_kind?: string | null
          path_code: string
          range_override_characteristic_id?: string | null
          resolution_count?: number | null
          resolution_count_scaling?: Json | null
          result_block_id?: string | null
          roll_table_kind?: string | null
          selection_kind: string
          sort_order: number
          target_disposition_kind?: string | null
          target_selection_kind?: string | null
          updated_at?: string
        }
        Update: {
          allow_repeated_targets?: boolean | null
          created_at?: string
          die?: string | null
          effect_id?: string
          excluded_creature_type_ids?: string[] | null
          group_type?: string
          id?: string
          max_targets?: number | null
          max_targets_scaling?: Json | null
          origin_kind?: string | null
          path_code?: string
          range_override_characteristic_id?: string | null
          resolution_count?: number | null
          resolution_count_scaling?: Json | null
          result_block_id?: string | null
          roll_table_kind?: string | null
          selection_kind?: string
          sort_order?: number
          target_disposition_kind?: string | null
          target_selection_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effect_paths_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_paths_range_override_characteristic_id_fkey"
            columns: ["range_override_characteristic_id"]
            isOneToOne: false
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_paths_result_block_id_fkey"
            columns: ["result_block_id"]
            isOneToOne: false
            referencedRelation: "effect_result_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      effect_result_block_outcomes: {
        Row: {
          effect_kind: string
          outcome_id: string
          result_block_id: string
          sort_order: number
        }
        Insert: {
          effect_kind: string
          outcome_id: string
          result_block_id: string
          sort_order: number
        }
        Update: {
          effect_kind?: string
          outcome_id?: string
          result_block_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "effect_result_block_outcomes_result_block_id_fkey"
            columns: ["result_block_id"]
            isOneToOne: false
            referencedRelation: "effect_result_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      effect_result_blocks: {
        Row: {
          created_at: string
          duration_id: string | null
          id: string
          lifecycle_consume_on_first_event: string | null
          lifecycle_end_on_events: string[] | null
          lifecycle_recurring_kind: string | null
          result_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_id?: string | null
          id: string
          lifecycle_consume_on_first_event?: string | null
          lifecycle_end_on_events?: string[] | null
          lifecycle_recurring_kind?: string | null
          result_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_id?: string | null
          id?: string
          lifecycle_consume_on_first_event?: string | null
          lifecycle_end_on_events?: string[] | null
          lifecycle_recurring_kind?: string | null
          result_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effect_result_blocks_duration_id_fkey"
            columns: ["duration_id"]
            isOneToOne: false
            referencedRelation: "characteristics"
            referencedColumns: ["id"]
          },
        ]
      }
      effects: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      encounter_actors: {
        Row: {
          conditions: Json
          created_at: string
          current_hit_points: number
          encounter_id: string
          gm_notes: string | null
          id: string
          initiative: number | null
          kind: string
          label: string
          manual_order: number | null
          max_hit_points: number
          public: boolean
          resources: Json
          snapshot: Json
          source_id: string | null
          source_revision: number | null
          stable_tie_key: string
          system_id: string | null
          temp_hit_points: number
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          current_hit_points?: number
          encounter_id: string
          gm_notes?: string | null
          id?: string
          initiative?: number | null
          kind: string
          label: string
          manual_order?: number | null
          max_hit_points?: number
          public?: boolean
          resources?: Json
          snapshot: Json
          source_id?: string | null
          source_revision?: number | null
          stable_tie_key: string
          system_id?: string | null
          temp_hit_points?: number
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          current_hit_points?: number
          encounter_id?: string
          gm_notes?: string | null
          id?: string
          initiative?: number | null
          kind?: string
          label?: string
          manual_order?: number | null
          max_hit_points?: number
          public?: boolean
          resources?: Json
          snapshot?: Json
          source_id?: string | null
          source_revision?: number | null
          stable_tie_key?: string
          system_id?: string | null
          temp_hit_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_actors_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_current_projections: {
        Row: {
          encounter_id: string
          projection: Json
          projection_checksum: string
          projection_schema_version: number
          stream_version: number
          updated_at: string
        }
        Insert: {
          encounter_id: string
          projection: Json
          projection_checksum: string
          projection_schema_version: number
          stream_version: number
          updated_at?: string
        }
        Update: {
          encounter_id?: string
          projection?: Json
          projection_checksum?: string
          projection_schema_version?: number
          stream_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_current_projections_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_events: {
        Row: {
          actor_user_id: string
          campaign_id: string
          command_fingerprint: string
          command_id: string
          command_payload: Json
          command_type: string
          correlation_id: string | null
          created_at: string
          encounter_id: string
          id: string
          result_payload: Json
          version: number
        }
        Insert: {
          actor_user_id: string
          campaign_id: string
          command_fingerprint: string
          command_id: string
          command_payload: Json
          command_type: string
          correlation_id?: string | null
          created_at?: string
          encounter_id: string
          id?: string
          result_payload: Json
          version: number
        }
        Update: {
          actor_user_id?: string
          campaign_id?: string
          command_fingerprint?: string
          command_id?: string
          command_payload?: Json
          command_type?: string
          correlation_id?: string | null
          created_at?: string
          encounter_id?: string
          id?: string
          result_payload?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounter_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_events_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_reminders: {
        Row: {
          actor_id: string | null
          encounter_id: string
          id: string
          label: string
          notes: string | null
          public: boolean
          round: number | null
          sort_order: number
          timing: string
        }
        Insert: {
          actor_id?: string | null
          encounter_id: string
          id?: string
          label: string
          notes?: string | null
          public?: boolean
          round?: number | null
          sort_order?: number
          timing: string
        }
        Update: {
          actor_id?: string | null
          encounter_id?: string
          id?: string
          label?: string
          notes?: string | null
          public?: boolean
          round?: number | null
          sort_order?: number
          timing?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_reminders_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "encounter_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_reminders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_scene_events: {
        Row: {
          actor_user_id: string
          command_fingerprint: string
          command_id: string
          command_type: string
          created_at: string
          delta: Json
          encounter_id: string
          id: string
          scene_id: string
          version: number
        }
        Insert: {
          actor_user_id: string
          command_fingerprint: string
          command_id: string
          command_type: string
          created_at?: string
          delta: Json
          encounter_id: string
          id?: string
          scene_id: string
          version: number
        }
        Update: {
          actor_user_id?: string
          command_fingerprint?: string
          command_id?: string
          command_type?: string
          created_at?: string
          delta?: Json
          encounter_id?: string
          id?: string
          scene_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounter_scene_events_scene_id_encounter_id_fkey"
            columns: ["scene_id", "encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_scenes"
            referencedColumns: ["id", "encounter_id"]
          },
        ]
      }
      encounter_scenes: {
        Row: {
          attach_command_fingerprint: string
          attach_command_id: string
          campaign_id: string
          created_at: string
          definition_id: string
          definition_snapshot: Json
          definition_version: number
          encounter_id: string
          id: string
          projection: Json
          projection_checksum: string
          projection_schema_version: number
          updated_at: string
          version: number
        }
        Insert: {
          attach_command_fingerprint: string
          attach_command_id: string
          campaign_id: string
          created_at?: string
          definition_id: string
          definition_snapshot: Json
          definition_version: number
          encounter_id: string
          id?: string
          projection: Json
          projection_checksum: string
          projection_schema_version: number
          updated_at?: string
          version?: number
        }
        Update: {
          attach_command_fingerprint?: string
          attach_command_id?: string
          campaign_id?: string
          created_at?: string
          definition_id?: string
          definition_snapshot?: Json
          definition_version?: number
          encounter_id?: string
          id?: string
          projection?: Json
          projection_checksum?: string
          projection_schema_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounter_scenes_definition_id_campaign_id_fkey"
            columns: ["definition_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_scene_definitions"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "encounter_scenes_encounter_id_campaign_id_fkey"
            columns: ["encounter_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      encounter_templates: {
        Row: {
          campaign_id: string
          command_fingerprint: string
          command_id: string
          created_at: string
          enemies: Json
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          command_fingerprint: string
          command_id: string
          created_at?: string
          enemies: Json
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          command_fingerprint?: string
          command_id?: string
          created_at?: string
          enemies?: Json
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounter_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          campaign_id: string
          created_at: string
          current_actor_id: string | null
          id: string
          name: string
          round: number
          rule_pack_revision_id: string | null
          session_id: string
          status: string
          template_id: string
          template_version: number
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          current_actor_id?: string | null
          id?: string
          name: string
          round?: number
          rule_pack_revision_id?: string | null
          session_id: string
          status?: string
          template_id: string
          template_version: number
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          current_actor_id?: string | null
          id?: string
          name?: string
          round?: number
          rule_pack_revision_id?: string | null
          session_id?: string
          status?: string
          template_id?: string
          template_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_current_actor_fk"
            columns: ["current_actor_id"]
            isOneToOne: false
            referencedRelation: "encounter_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_rule_pack_revision_id_fkey"
            columns: ["rule_pack_revision_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "encounter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          active_version_id: string | null
          armor_class: number | null
          capacity_amount: number | null
          capacity_unit: string | null
          category: string
          charge_id: string | null
          cost_amount: number | null
          cost_currency_id: string | null
          created_at: string
          description: string | null
          id: string
          is_master: boolean | null
          label: string
          max_bonus: number | null
          max_stack: number | null
          parent_equipment_id: string | null
          quote: string | null
          rarity_id: string
          requires_attunement: boolean
          restriction_id: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
          weight_amount: number | null
          weight_unit: string | null
        }
        Insert: {
          active_version_id?: string | null
          armor_class?: number | null
          capacity_amount?: number | null
          capacity_unit?: string | null
          category: string
          charge_id?: string | null
          cost_amount?: number | null
          cost_currency_id?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_master?: boolean | null
          label: string
          max_bonus?: number | null
          max_stack?: number | null
          parent_equipment_id?: string | null
          quote?: string | null
          rarity_id: string
          requires_attunement?: boolean
          restriction_id?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Update: {
          active_version_id?: string | null
          armor_class?: number | null
          capacity_amount?: number | null
          capacity_unit?: string | null
          category?: string
          charge_id?: string | null
          cost_amount?: number | null
          cost_currency_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_master?: boolean | null
          label?: string
          max_bonus?: number | null
          max_stack?: number | null
          parent_equipment_id?: string | null
          quote?: string | null
          rarity_id?: string
          requires_attunement?: boolean
          restriction_id?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "equipment_versions"
            referencedColumns: ["equipment_id", "id"]
          },
          {
            foreignKeyName: "equipment_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_cost_currency_id_fkey"
            columns: ["cost_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_parent_system_fk"
            columns: ["parent_equipment_id", "system_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id", "system_id"]
          },
          {
            foreignKeyName: "equipment_rarity_id_fkey"
            columns: ["rarity_id"]
            isOneToOne: false
            referencedRelation: "rarities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_attributes: {
        Row: {
          attribute_code: string
          equipment_id: string
          sort_order: number
        }
        Insert: {
          attribute_code: string
          equipment_id: string
          sort_order: number
        }
        Update: {
          attribute_code?: string
          equipment_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_attributes_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_contains: {
        Row: {
          contained_equipment_id: string
          equipment_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          contained_equipment_id: string
          equipment_id: string
          quantity: number
          sort_order: number
        }
        Update: {
          contained_equipment_id?: string
          equipment_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_contains_contained_equipment_id_fkey"
            columns: ["contained_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_contains_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_effects: {
        Row: {
          effect_id: string
          equipment_id: string
          sort_order: number
        }
        Insert: {
          effect_id: string
          equipment_id: string
          sort_order: number
        }
        Update: {
          effect_id?: string
          equipment_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_effects_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_features: {
        Row: {
          equipment_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          equipment_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          equipment_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_features_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_modifier_grants: {
        Row: {
          equipment_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Insert: {
          equipment_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Update: {
          equipment_id?: string
          modifier_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_modifier_grants_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_modifier_grants_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_properties: {
        Row: {
          equipment_id: string
          property_code: string
          sort_order: number
        }
        Insert: {
          equipment_id: string
          property_code: string
          sort_order: number
        }
        Update: {
          equipment_id?: string
          property_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_properties_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          equipment_id: string
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          equipment_id: string
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          equipment_id?: string
          id?: string
          projection_schema_version?: number
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_versions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_bodies: {
        Row: {
          created_at: string
          id: string
          node_subject_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          node_subject_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          node_subject_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      facet_body_groups: {
        Row: {
          created_at: string
          facet_body_id: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_body_id: string
          id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_body_id?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_body_groups_facet_body_id_fkey"
            columns: ["facet_body_id"]
            isOneToOne: false
            referencedRelation: "facet_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_body_selection_items: {
        Row: {
          ancestry_option_id: string | null
          background_id: string | null
          class_id: string | null
          created_at: string
          creature_id: string | null
          equipment_id: string | null
          facet_body_id: string
          feat_id: string | null
          feature_id: string | null
          option_id: string | null
          proficiency_kind: string | null
          race_id: string | null
          resource_id: string | null
          sort_order: number
          spell_id: string | null
          subclass_id: string | null
          subrace_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          ancestry_option_id?: string | null
          background_id?: string | null
          class_id?: string | null
          created_at?: string
          creature_id?: string | null
          equipment_id?: string | null
          facet_body_id: string
          feat_id?: string | null
          feature_id?: string | null
          option_id?: string | null
          proficiency_kind?: string | null
          race_id?: string | null
          resource_id?: string | null
          sort_order: number
          spell_id?: string | null
          subclass_id?: string | null
          subrace_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          ancestry_option_id?: string | null
          background_id?: string | null
          class_id?: string | null
          created_at?: string
          creature_id?: string | null
          equipment_id?: string | null
          facet_body_id?: string
          feat_id?: string | null
          feature_id?: string | null
          option_id?: string | null
          proficiency_kind?: string | null
          race_id?: string | null
          resource_id?: string | null
          sort_order?: number
          spell_id?: string | null
          subclass_id?: string | null
          subrace_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facet_body_selection_items_ancestry_option_id_fkey"
            columns: ["ancestry_option_id"]
            isOneToOne: false
            referencedRelation: "race_ancestry_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_facet_body_id_fkey"
            columns: ["facet_body_id"]
            isOneToOne: false
            referencedRelation: "facet_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "class_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_body_selection_items_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_body_selections: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          facet_body_id: string
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          facet_body_id: string
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          facet_body_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_body_selections_facet_body_id_fkey"
            columns: ["facet_body_id"]
            isOneToOne: true
            referencedRelation: "facet_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_conditions: {
        Row: {
          constraint_code: string
          created_at: string
          facet_body_group_id: string
          id: string
          kind: string
          predicate_code: string | null
          relation_code: string | null
          sort_order: number
          updated_at: string
          where_facet_body_id: string | null
        }
        Insert: {
          constraint_code: string
          created_at?: string
          facet_body_group_id: string
          id: string
          kind: string
          predicate_code?: string | null
          relation_code?: string | null
          sort_order: number
          updated_at?: string
          where_facet_body_id?: string | null
        }
        Update: {
          constraint_code?: string
          created_at?: string
          facet_body_group_id?: string
          id?: string
          kind?: string
          predicate_code?: string | null
          relation_code?: string | null
          sort_order?: number
          updated_at?: string
          where_facet_body_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facet_conditions_facet_body_group_id_fkey"
            columns: ["facet_body_group_id"]
            isOneToOne: false
            referencedRelation: "facet_body_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_conditions_where_facet_body_id_fkey"
            columns: ["where_facet_body_id"]
            isOneToOne: false
            referencedRelation: "facet_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_context_bodies: {
        Row: {
          facet_body_id: string
          facet_context_id: string
        }
        Insert: {
          facet_body_id: string
          facet_context_id: string
        }
        Update: {
          facet_body_id?: string
          facet_context_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_context_bodies_facet_body_id_fkey"
            columns: ["facet_body_id"]
            isOneToOne: false
            referencedRelation: "facet_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_context_bodies_facet_context_id_fkey"
            columns: ["facet_context_id"]
            isOneToOne: true
            referencedRelation: "facet_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_contexts: {
        Row: {
          created_at: string
          facet_group_id: string
          id: string
          node_subject_code: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_group_id: string
          id: string
          node_subject_code: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_group_id?: string
          id?: string
          node_subject_code?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_contexts_facet_group_id_fkey"
            columns: ["facet_group_id"]
            isOneToOne: false
            referencedRelation: "facet_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_exists_selection_items: {
        Row: {
          ancestry_option_id: string | null
          background_id: string | null
          class_id: string | null
          created_at: string
          creature_id: string | null
          equipment_id: string | null
          facet_condition_id: string
          feat_id: string | null
          feature_id: string | null
          option_id: string | null
          proficiency_kind: string | null
          race_id: string | null
          resource_id: string | null
          sort_order: number
          spell_id: string | null
          subclass_id: string | null
          subrace_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          ancestry_option_id?: string | null
          background_id?: string | null
          class_id?: string | null
          created_at?: string
          creature_id?: string | null
          equipment_id?: string | null
          facet_condition_id: string
          feat_id?: string | null
          feature_id?: string | null
          option_id?: string | null
          proficiency_kind?: string | null
          race_id?: string | null
          resource_id?: string | null
          sort_order: number
          spell_id?: string | null
          subclass_id?: string | null
          subrace_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          ancestry_option_id?: string | null
          background_id?: string | null
          class_id?: string | null
          created_at?: string
          creature_id?: string | null
          equipment_id?: string | null
          facet_condition_id?: string
          feat_id?: string | null
          feature_id?: string | null
          option_id?: string | null
          proficiency_kind?: string | null
          race_id?: string | null
          resource_id?: string | null
          sort_order?: number
          spell_id?: string | null
          subclass_id?: string | null
          subrace_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facet_exists_selection_items_ancestry_option_id_fkey"
            columns: ["ancestry_option_id"]
            isOneToOne: false
            referencedRelation: "race_ancestry_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "class_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_subclass_id_fkey"
            columns: ["subclass_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_exists_selection_items_subrace_id_fkey"
            columns: ["subrace_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_exists_selections: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          facet_condition_id: string
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          facet_condition_id: string
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          facet_condition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_exists_selections_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_groups: {
        Row: {
          created_at: string
          facet_id: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_id: string
          id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_id?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_groups_facet_id_fkey"
            columns: ["facet_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_ability_items: {
        Row: {
          ability_code: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          ability_code: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          ability_code?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_ability_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_charge_limit_kind_items: {
        Row: {
          charge_limit_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          charge_limit_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          charge_limit_kind?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_charge_limit_kind_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_charge_reset_kind_items: {
        Row: {
          charge_reset_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          charge_reset_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          charge_reset_kind?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_charge_reset_kind_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_class_items: {
        Row: {
          class_id: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          class_id: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          class_id?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_class_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_class_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_condition_type_items: {
        Row: {
          condition_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          condition_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          condition_type_id?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_condition_type_items_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_condition_type_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_creature_category_items: {
        Row: {
          category_code: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          category_code: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          category_code?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_creature_category_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_creature_type_items: {
        Row: {
          creature_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          creature_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          creature_type_id?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_creature_type_items_creature_type_id_fkey"
            columns: ["creature_type_id"]
            isOneToOne: false
            referencedRelation: "creature_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_creature_type_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_damage_type_items: {
        Row: {
          damage_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          damage_type_id: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          damage_type_id?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_damage_type_items_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_damage_type_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_duration_kind_items: {
        Row: {
          duration_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          duration_kind: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          duration_kind?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_duration_kind_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_durations: {
        Row: {
          created_at: string
          duration_kind: string | null
          facet_condition_id: string
          max_amount: number | null
          min_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_kind?: string | null
          facet_condition_id: string
          max_amount?: number | null
          min_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_kind?: string | null
          facet_condition_id?: string
          max_amount?: number | null
          min_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_durations_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_equipment_categories: {
        Row: {
          category_code: string
          created_at: string
          facet_condition_id: string
          updated_at: string
        }
        Insert: {
          category_code: string
          created_at?: string
          facet_condition_id: string
          updated_at?: string
        }
        Update: {
          category_code?: string
          created_at?: string
          facet_condition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_equipment_categories_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_equipment_items: {
        Row: {
          equipment_id: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          equipment_id: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          equipment_id?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_equipment_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_equipment_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_equipment_property_items: {
        Row: {
          facet_condition_id: string
          property_code: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          property_code: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          property_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_equipment_property_item_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_feat_items: {
        Row: {
          facet_condition_id: string
          feat_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          feat_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          feat_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_feat_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_feat_items_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_feature_items: {
        Row: {
          facet_condition_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_feature_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_feature_items_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_heritage_items: {
        Row: {
          facet_condition_id: string
          heritage_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          heritage_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          heritage_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_heritage_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_heritage_items_heritage_id_fkey"
            columns: ["heritage_id"]
            isOneToOne: false
            referencedRelation: "heritages"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_language_items: {
        Row: {
          facet_condition_id: string
          language_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          language_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          language_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_language_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_language_items_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_magic_school_items: {
        Row: {
          facet_condition_id: string
          magic_school_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          magic_school_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          magic_school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_magic_school_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_magic_school_items_magic_school_id_fkey"
            columns: ["magic_school_id"]
            isOneToOne: false
            referencedRelation: "magic_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_numeric_ranges: {
        Row: {
          created_at: string
          facet_condition_id: string
          max_value: number | null
          min_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_condition_id: string
          max_value?: number | null
          min_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_condition_id?: string
          max_value?: number | null
          min_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_numeric_ranges_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_option_items: {
        Row: {
          facet_condition_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_option_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_option_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_proficiency_levels: {
        Row: {
          created_at: string
          facet_condition_id: string
          proficiency_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_condition_id: string
          proficiency_level: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_condition_id?: string
          proficiency_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_proficiency_levels_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_range_kind_items: {
        Row: {
          facet_condition_id: string
          range_kind: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          range_kind: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          range_kind?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_range_kind_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_ranges: {
        Row: {
          created_at: string
          facet_condition_id: string
          max_distance: number | null
          min_distance: number | null
          range_kind: string | null
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          facet_condition_id: string
          max_distance?: number | null
          min_distance?: number | null
          range_kind?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          facet_condition_id?: string
          max_distance?: number | null
          min_distance?: number | null
          range_kind?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_ranges_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_selectables: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          facet_condition_id: string
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          facet_condition_id: string
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          facet_condition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_selectables_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: true
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_size_items: {
        Row: {
          facet_condition_id: string
          size_code: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          size_code: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          size_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_size_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_skill_items: {
        Row: {
          facet_condition_id: string
          skill_id: string
          sort_order: number
        }
        Insert: {
          facet_condition_id: string
          skill_id: string
          sort_order: number
        }
        Update: {
          facet_condition_id?: string
          skill_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_skill_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_skill_items_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_spell_items: {
        Row: {
          facet_condition_id: string
          sort_order: number
          spell_id: string
        }
        Insert: {
          facet_condition_id: string
          sort_order: number
          spell_id: string
        }
        Update: {
          facet_condition_id?: string
          sort_order?: number
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_spell_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_predicate_spell_items_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_subclass_specialization_items: {
        Row: {
          facet_condition_id: string
          sort_order: number
          specialization_id: string
        }
        Insert: {
          facet_condition_id: string
          sort_order: number
          specialization_id: string
        }
        Update: {
          facet_condition_id?: string
          sort_order?: number
          specialization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_subclass_specialization_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_predicate_vehicle_category_items: {
        Row: {
          category_code: string
          facet_condition_id: string
          sort_order: number
        }
        Insert: {
          category_code: string
          facet_condition_id: string
          sort_order: number
        }
        Update: {
          category_code?: string
          facet_condition_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "facet_predicate_vehicle_category_items_facet_condition_id_fkey"
            columns: ["facet_condition_id"]
            isOneToOne: false
            referencedRelation: "facet_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      facets: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      feat_details: {
        Row: {
          detail_id: string
          feat_id: string
          sort_order: number
        }
        Insert: {
          detail_id: string
          feat_id: string
          sort_order: number
        }
        Update: {
          detail_id?: string
          feat_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_details_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_effects: {
        Row: {
          effect_id: string
          feat_id: string
          sort_order: number
        }
        Insert: {
          effect_id: string
          feat_id: string
          sort_order: number
        }
        Update: {
          effect_id?: string
          feat_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_effects_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_feat_grants: {
        Row: {
          feat_grant_id: string
          feat_id: string
          sort_order: number
        }
        Insert: {
          feat_grant_id: string
          feat_id: string
          sort_order: number
        }
        Update: {
          feat_grant_id?: string
          feat_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_feat_grants_feat_grant_id_fkey"
            columns: ["feat_grant_id"]
            isOneToOne: false
            referencedRelation: "feat_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_feat_grants_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_features: {
        Row: {
          feat_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          feat_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          feat_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_features_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_grant_feats: {
        Row: {
          feat_grant_id: string
          feat_id: string
        }
        Insert: {
          feat_grant_id: string
          feat_id: string
        }
        Update: {
          feat_grant_id?: string
          feat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_grant_feats_feat_grant_id_fkey"
            columns: ["feat_grant_id"]
            isOneToOne: false
            referencedRelation: "feat_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_grant_feats_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_grant_scaling_level_feats: {
        Row: {
          feat_id: string
          scaling_level_id: string
        }
        Insert: {
          feat_id: string
          scaling_level_id: string
        }
        Update: {
          feat_id?: string
          scaling_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_grant_scaling_level_feats_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_grant_scaling_level_feats_scaling_level_id_fkey"
            columns: ["scaling_level_id"]
            isOneToOne: false
            referencedRelation: "feat_grant_scaling_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_grant_scaling_levels: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          feat_grant_id: string
          id: string
          level: number
          selection_count: number | null
          selection_duplicate_policy: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          feat_grant_id: string
          id?: string
          level: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          feat_grant_id?: string
          id?: string
          level?: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_grant_scaling_levels_feat_grant_id_fkey"
            columns: ["feat_grant_id"]
            isOneToOne: false
            referencedRelation: "feat_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_grants: {
        Row: {
          authoring_mode_kind: string
          charge_id: string | null
          class_id: string | null
          created_at: string
          id: string
          restriction_id: string | null
          scaling_kind: string
          scaling_source: string | null
          selection_count: number | null
          selection_duplicate_policy: string | null
          selection_kind: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          restriction_id?: string | null
          scaling_kind: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          restriction_id?: string | null
          scaling_kind?: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_grants_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_grants_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_modifier_grants: {
        Row: {
          feat_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Insert: {
          feat_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Update: {
          feat_id?: string
          modifier_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_modifier_grants_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_modifier_grants_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_proficiency_grants: {
        Row: {
          feat_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          feat_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          feat_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_proficiency_grants_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_sense_grants: {
        Row: {
          feat_id: string
          sense_grant_id: string
          sort_order: number
        }
        Insert: {
          feat_id: string
          sense_grant_id: string
          sort_order: number
        }
        Update: {
          feat_id?: string
          sense_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feat_sense_grants_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_sense_grants_sense_grant_id_fkey"
            columns: ["sense_grant_id"]
            isOneToOne: false
            referencedRelation: "sense_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_spell_grants: {
        Row: {
          feat_id: string
          sort_order: number
          spell_grant_id: string
        }
        Insert: {
          feat_id: string
          sort_order: number
          spell_grant_id: string
        }
        Update: {
          feat_id?: string
          sort_order?: number
          spell_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_spell_grants_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_spell_grants_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feat_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          feat_id: string
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          feat_id: string
          id: string
          projection_schema_version: number
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          feat_id?: string
          id?: string
          projection_schema_version?: number
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feat_versions_feat_id_fkey"
            columns: ["feat_id"]
            isOneToOne: false
            referencedRelation: "feats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feat_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      feats: {
        Row: {
          active_version_id: string | null
          charge_id: string | null
          created_at: string
          description: string
          id: string
          is_master: boolean | null
          label: string
          prerequisite_id: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          charge_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_master?: boolean | null
          label: string
          prerequisite_id?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          charge_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_master?: boolean | null
          label?: string
          prerequisite_id?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feats_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "feat_versions"
            referencedColumns: ["feat_id", "id"]
          },
          {
            foreignKeyName: "feats_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feats_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feats_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_attributes: {
        Row: {
          attribute_code: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          attribute_code: string
          feature_id: string
          sort_order: number
        }
        Update: {
          attribute_code?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_attributes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_details: {
        Row: {
          detail_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          detail_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          detail_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_details_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_effects: {
        Row: {
          effect_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          effect_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          effect_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_effects_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_feat_grants: {
        Row: {
          feat_grant_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          feat_grant_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          feat_grant_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_feat_grants_feat_grant_id_fkey"
            columns: ["feat_grant_id"]
            isOneToOne: false
            referencedRelation: "feat_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_feat_grants_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_modifier_grants: {
        Row: {
          feature_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Insert: {
          feature_id: string
          modifier_grant_id: string
          sort_order: number
        }
        Update: {
          feature_id?: string
          modifier_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_modifier_grants_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_modifier_grants_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_option_levels: {
        Row: {
          count: number
          feature_id: string
          id: string
          level: number
          replace_count: number | null
          sort_order: number
        }
        Insert: {
          count: number
          feature_id: string
          id?: string
          level: number
          replace_count?: number | null
          sort_order: number
        }
        Update: {
          count?: number
          feature_id?: string
          id?: string
          level?: number
          replace_count?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_option_levels_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_options: {
        Row: {
          feature_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          feature_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          feature_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_options_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_proficiency_grants: {
        Row: {
          feature_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          feature_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          feature_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_proficiency_grants_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_sense_grants: {
        Row: {
          feature_id: string
          sense_grant_id: string
          sort_order: number
        }
        Insert: {
          feature_id: string
          sense_grant_id: string
          sort_order: number
        }
        Update: {
          feature_id?: string
          sense_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_sense_grants_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_sense_grants_sense_grant_id_fkey"
            columns: ["sense_grant_id"]
            isOneToOne: false
            referencedRelation: "sense_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_spell_grants: {
        Row: {
          feature_id: string
          sort_order: number
          spell_grant_id: string
        }
        Insert: {
          feature_id: string
          sort_order: number
          spell_grant_id: string
        }
        Update: {
          feature_id?: string
          sort_order?: number
          spell_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_spell_grants_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_spell_grants_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          available_at_level: number | null
          charge_id: string | null
          created_at: string
          description: string
          id: string
          label: string
          restriction_id: string | null
          roll_definitions: Json
          section_code: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          available_at_level?: number | null
          charge_id?: string | null
          created_at?: string
          description: string
          id?: string
          label: string
          restriction_id?: string | null
          roll_definitions?: Json
          section_code?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          available_at_level?: number | null
          charge_id?: string | null
          created_at?: string
          description?: string
          id?: string
          label?: string
          restriction_id?: string | null
          roll_definitions?: Json
          section_code?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      heritages: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heritages_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_currency_balances: {
        Row: {
          amount: number
          campaign_denomination_id: string | null
          created_at: string
          group_id: string | null
          id: string
          owner_id: string
          ruleset_currency_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          campaign_denomination_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          owner_id: string
          ruleset_currency_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign_denomination_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          owner_id?: string
          ruleset_currency_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_currency_balances_campaign_denomination_id_fkey"
            columns: ["campaign_denomination_id"]
            isOneToOne: false
            referencedRelation: "campaign_currency_denominations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_currency_balances_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "inventory_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_currency_balances_owner_id_group_id_fkey"
            columns: ["owner_id", "group_id"]
            isOneToOne: false
            referencedRelation: "inventory_currency_groups"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "inventory_currency_balances_ruleset_currency_id_fkey"
            columns: ["ruleset_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_currency_groups: {
        Row: {
          container_item_id: string | null
          created_at: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          container_item_id?: string | null
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          container_item_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_currency_groups_owner_id_container_item_id_fkey"
            columns: ["owner_id", "container_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "inventory_currency_groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "inventory_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          attuned: boolean
          container_id: string | null
          created_at: string
          custom_name: string | null
          equipment_id: string
          equipped: boolean
          id: string
          notes: string | null
          owner_id: string
          placement_id: string | null
          placement_kind: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          attuned?: boolean
          container_id?: string | null
          created_at?: string
          custom_name?: string | null
          equipment_id: string
          equipped?: boolean
          id?: string
          notes?: string | null
          owner_id: string
          placement_id?: string | null
          placement_kind?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          attuned?: boolean
          container_id?: string | null
          created_at?: string
          custom_name?: string | null
          equipment_id?: string
          equipped?: boolean
          id?: string
          notes?: string | null
          owner_id?: string
          placement_id?: string | null
          placement_kind?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_owner_id_container_id_fkey"
            columns: ["owner_id", "container_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "inventory_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "inventory_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_owners: {
        Row: {
          campaign_id: string | null
          character_id: string | null
          created_at: string
          id: string
          kind: string
          updated_at: string
          vehicle_id: string | null
          version: number
        }
        Insert: {
          campaign_id?: string | null
          character_id?: string | null
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          vehicle_id?: string | null
          version?: number
        }
        Update: {
          campaign_id?: string | null
          character_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          vehicle_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_owners_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_owners_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_owners_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "campaign_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "languages_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifestyles_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_command_leases: {
        Row: {
          authority_id: string
          expires_at: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authority_id: string
          expires_at: string
          session_id: string
          updated_at?: string
        }
        Update: {
          authority_id?: string
          expires_at?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_command_leases_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_schools: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_schools_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string
          crop_height: number | null
          crop_width: number | null
          crop_x: number | null
          crop_y: number | null
          declared_bytes: number
          declared_mime_type: string
          deleted_at: string | null
          height: number | null
          id: string
          idempotency_key: string
          original_file_name: string
          owner_user_id: string
          processing_started_at: string | null
          profile: string
          raw_object_key: string
          ready_at: string | null
          rejection_reason: string | null
          status: string
          target_key: string
          unreferenced_at: string | null
          updated_at: string
          verified_bytes: number | null
          verified_mime_type: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          crop_height?: number | null
          crop_width?: number | null
          crop_x?: number | null
          crop_y?: number | null
          declared_bytes: number
          declared_mime_type: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          idempotency_key: string
          original_file_name: string
          owner_user_id: string
          processing_started_at?: string | null
          profile: string
          raw_object_key: string
          ready_at?: string | null
          rejection_reason?: string | null
          status?: string
          target_key: string
          unreferenced_at?: string | null
          updated_at?: string
          verified_bytes?: number | null
          verified_mime_type?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          crop_height?: number | null
          crop_width?: number | null
          crop_x?: number | null
          crop_y?: number | null
          declared_bytes?: number
          declared_mime_type?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          idempotency_key?: string
          original_file_name?: string
          owner_user_id?: string
          processing_started_at?: string | null
          profile?: string
          raw_object_key?: string
          ready_at?: string | null
          rejection_reason?: string | null
          status?: string
          target_key?: string
          unreferenced_at?: string | null
          updated_at?: string
          verified_bytes?: number | null
          verified_mime_type?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_object_deletions: {
        Row: {
          created_at: string
          object_key: string
        }
        Insert: {
          created_at?: string
          object_key: string
        }
        Update: {
          created_at?: string
          object_key?: string
        }
        Relationships: []
      }
      media_variants: {
        Row: {
          asset_id: string
          byte_size: number
          created_at: string
          height: number | null
          id: string
          kind: string
          mime_type: string
          object_key: string
          width: number | null
        }
        Insert: {
          asset_id: string
          byte_size: number
          created_at?: string
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          object_key: string
          width?: number | null
        }
        Update: {
          asset_id?: string
          byte_size?: number
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          object_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_grant_charge_levels: {
        Row: {
          amount: number
          created_at: string
          id: string
          level: number
          modifier_grant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id: string
          level: number
          modifier_grant_id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          level?: number
          modifier_grant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_grant_charge_levels_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grant_payloads"
            referencedColumns: ["modifier_grant_id"]
          },
        ]
      }
      modifier_grant_domain_params: {
        Row: {
          ability_code: string | null
          attack_domain_code: string | null
          condition_type_id: string | null
          created_at: string
          modifier_grant_id: string
          sense_code: string | null
          skill_id: string | null
          speed_id: string | null
          spell_level: number | null
          updated_at: string
          value_domain_code: string
        }
        Insert: {
          ability_code?: string | null
          attack_domain_code?: string | null
          condition_type_id?: string | null
          created_at?: string
          modifier_grant_id: string
          sense_code?: string | null
          skill_id?: string | null
          speed_id?: string | null
          spell_level?: number | null
          updated_at?: string
          value_domain_code: string
        }
        Update: {
          ability_code?: string | null
          attack_domain_code?: string | null
          condition_type_id?: string | null
          created_at?: string
          modifier_grant_id?: string
          sense_code?: string | null
          skill_id?: string | null
          speed_id?: string | null
          spell_level?: number | null
          updated_at?: string
          value_domain_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_grant_domain_params_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_domain_params_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: true
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_domain_params_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_domain_params_speed_id_fkey"
            columns: ["speed_id"]
            isOneToOne: false
            referencedRelation: "speeds"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_grant_optional_abilities: {
        Row: {
          ability_code: string
          modifier_grant_id: string
          sort_order: number
        }
        Insert: {
          ability_code: string
          modifier_grant_id: string
          sort_order: number
        }
        Update: {
          ability_code?: string
          modifier_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifier_grant_optional_abilities_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_grant_payloads: {
        Row: {
          attribute_id: string | null
          charge_amount: number | null
          charge_limit_kind: string | null
          charge_max: number | null
          charge_min: number | null
          charge_multiplier: number | null
          charge_scaling_kind: string | null
          condition_type_id: string | null
          created_at: string
          damage_type_id: string | null
          dice: string | null
          duration_kind: string | null
          modifier_grant_id: string
          modifier_kind: string
          movement_mode_id: string | null
          numeric_ability_code: string | null
          numeric_amount: number | null
          numeric_class_id: string | null
          numeric_max: number | null
          numeric_min: number | null
          numeric_multiplier: number | null
          numeric_skill_id: string | null
          numeric_value_kind: string | null
          range_kind: string | null
          reset_kind: string | null
          set_amount: number | null
          shape_kind: string | null
          updated_at: string
          value_domain_code: string
        }
        Insert: {
          attribute_id?: string | null
          charge_amount?: number | null
          charge_limit_kind?: string | null
          charge_max?: number | null
          charge_min?: number | null
          charge_multiplier?: number | null
          charge_scaling_kind?: string | null
          condition_type_id?: string | null
          created_at?: string
          damage_type_id?: string | null
          dice?: string | null
          duration_kind?: string | null
          modifier_grant_id: string
          modifier_kind: string
          movement_mode_id?: string | null
          numeric_ability_code?: string | null
          numeric_amount?: number | null
          numeric_class_id?: string | null
          numeric_max?: number | null
          numeric_min?: number | null
          numeric_multiplier?: number | null
          numeric_skill_id?: string | null
          numeric_value_kind?: string | null
          range_kind?: string | null
          reset_kind?: string | null
          set_amount?: number | null
          shape_kind?: string | null
          updated_at?: string
          value_domain_code: string
        }
        Update: {
          attribute_id?: string | null
          charge_amount?: number | null
          charge_limit_kind?: string | null
          charge_max?: number | null
          charge_min?: number | null
          charge_multiplier?: number | null
          charge_scaling_kind?: string | null
          condition_type_id?: string | null
          created_at?: string
          damage_type_id?: string | null
          dice?: string | null
          duration_kind?: string | null
          modifier_grant_id?: string
          modifier_kind?: string
          movement_mode_id?: string | null
          numeric_ability_code?: string | null
          numeric_amount?: number | null
          numeric_class_id?: string | null
          numeric_max?: number | null
          numeric_min?: number | null
          numeric_multiplier?: number | null
          numeric_skill_id?: string | null
          numeric_value_kind?: string | null
          range_kind?: string | null
          reset_kind?: string | null
          set_amount?: number | null
          shape_kind?: string | null
          updated_at?: string
          value_domain_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_grant_payloads_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_payloads_damage_type_id_fkey"
            columns: ["damage_type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_payloads_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: true
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_payloads_numeric_class_id_fkey"
            columns: ["numeric_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grant_payloads_numeric_skill_id_fkey"
            columns: ["numeric_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_grants: {
        Row: {
          count: number | null
          created_at: string
          grant_kind: string
          id: string
          modifier_kind: string
          restriction_id: string | null
          scope: string
          selection_duplicate_policy: string | null
          selection_kind: string
          sort_order: number
          system_id: string
          updated_at: string
          value_domain_code: string
        }
        Insert: {
          count?: number | null
          created_at?: string
          grant_kind?: string
          id: string
          modifier_kind: string
          restriction_id?: string | null
          scope: string
          selection_duplicate_policy?: string | null
          selection_kind: string
          sort_order: number
          system_id: string
          updated_at?: string
          value_domain_code: string
        }
        Update: {
          count?: number | null
          created_at?: string
          grant_kind?: string
          id?: string
          modifier_kind?: string
          restriction_id?: string | null
          scope?: string
          selection_duplicate_policy?: string | null
          selection_kind?: string
          sort_order?: number
          system_id?: string
          updated_at?: string
          value_domain_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_grants_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_grants_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_intents: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          delivered_at: string | null
          failed_at: string | null
          grouping_key: string | null
          id: string
          last_error_code: string | null
          next_attempt_at: string
          occurred_at: string
          operation: string
          payload: Json
          recipient_notification_id: string
          source_kind: string
          source_public_id: string
          workflow_key: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          grouping_key?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string
          occurred_at: string
          operation: string
          payload?: Json
          recipient_notification_id: string
          source_kind: string
          source_public_id: string
          workflow_key: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          grouping_key?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string
          occurred_at?: string
          operation?: string
          payload?: Json
          recipient_notification_id?: string
          source_kind?: string
          source_public_id?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_intents_recipient_notification_id_fkey"
            columns: ["recipient_notification_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["notification_recipient_id"]
          },
        ]
      }
      notification_feed_items: {
        Row: {
          category: string
          created_at: string
          delivery_intent_id: string
          grouping_key: string | null
          id: string
          occurred_at: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          seen_at: string | null
          source_kind: string
          source_public_id: string
          workflow_key: string
        }
        Insert: {
          category: string
          created_at?: string
          delivery_intent_id: string
          grouping_key?: string | null
          id?: string
          occurred_at: string
          payload: Json
          read_at?: string | null
          recipient_user_id: string
          seen_at?: string | null
          source_kind: string
          source_public_id: string
          workflow_key: string
        }
        Update: {
          category?: string
          created_at?: string
          delivery_intent_id?: string
          grouping_key?: string | null
          id?: string
          occurred_at?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          seen_at?: string | null
          source_kind?: string
          source_public_id?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_feed_items_delivery_intent_id_fkey"
            columns: ["delivery_intent_id"]
            isOneToOne: true
            referencedRelation: "notification_delivery_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          email_enabled: boolean
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      option_attributes: {
        Row: {
          attribute_code: string
          option_id: string
          sort_order: number
        }
        Insert: {
          attribute_code: string
          option_id: string
          sort_order: number
        }
        Update: {
          attribute_code?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_attributes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      option_details: {
        Row: {
          detail_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          detail_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          detail_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_details_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      option_effects: {
        Row: {
          effect_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          effect_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          effect_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_effects_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      option_feat_grants: {
        Row: {
          feat_grant_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          feat_grant_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          feat_grant_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_feat_grants_feat_grant_id_fkey"
            columns: ["feat_grant_id"]
            isOneToOne: false
            referencedRelation: "feat_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_feat_grants_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      option_modifier_grants: {
        Row: {
          modifier_grant_id: string
          option_id: string
          sort_order: number
        }
        Insert: {
          modifier_grant_id: string
          option_id: string
          sort_order: number
        }
        Update: {
          modifier_grant_id?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_modifier_grants_modifier_grant_id_fkey"
            columns: ["modifier_grant_id"]
            isOneToOne: false
            referencedRelation: "modifier_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_modifier_grants_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      option_proficiency_grants: {
        Row: {
          option_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          option_id: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          option_id?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_proficiency_grants_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_proficiency_grants_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      option_sense_grants: {
        Row: {
          option_id: string
          sense_grant_id: string
          sort_order: number
        }
        Insert: {
          option_id: string
          sense_grant_id: string
          sort_order: number
        }
        Update: {
          option_id?: string
          sense_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_sense_grants_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_sense_grants_sense_grant_id_fkey"
            columns: ["sense_grant_id"]
            isOneToOne: false
            referencedRelation: "sense_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      option_spell_grants: {
        Row: {
          option_id: string
          sort_order: number
          spell_grant_id: string
        }
        Insert: {
          option_id: string
          sort_order: number
          spell_grant_id: string
        }
        Update: {
          option_id?: string
          sort_order?: number
          spell_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_spell_grants_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_spell_grants_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          charge_id: string | null
          created_at: string
          description: string
          id: string
          label: string
          restriction_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          charge_id?: string | null
          created_at?: string
          description: string
          id?: string
          label: string
          restriction_id?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          charge_id?: string | null
          created_at?: string
          description?: string
          id?: string
          label?: string
          restriction_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "options_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      passives: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passives_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_equipment: {
        Row: {
          equipment_id: string
          proficiency_grant_id: string
        }
        Insert: {
          equipment_id: string
          proficiency_grant_id: string
        }
        Update: {
          equipment_id?: string
          proficiency_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_grant_equipment_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_equipment_filter_properties: {
        Row: {
          proficiency_grant_id: string
          property_code: string
        }
        Insert: {
          proficiency_grant_id: string
          property_code: string
        }
        Update: {
          proficiency_grant_id?: string
          property_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_equipment_filter_pr_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grant_equipment_filters"
            referencedColumns: ["proficiency_grant_id"]
          },
        ]
      }
      proficiency_grant_equipment_filters: {
        Row: {
          category_code: string | null
          proficiency_grant_id: string
        }
        Insert: {
          category_code?: string | null
          proficiency_grant_id: string
        }
        Update: {
          category_code?: string | null
          proficiency_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_equipment_filters_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: true
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_equipment_properties: {
        Row: {
          proficiency_grant_id: string
          property_code: string
        }
        Insert: {
          proficiency_grant_id: string
          property_code: string
        }
        Update: {
          proficiency_grant_id?: string
          property_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_equipment_propertie_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_equipment_property_filters: {
        Row: {
          category_code: string | null
          proficiency_grant_id: string
        }
        Insert: {
          category_code?: string | null
          proficiency_grant_id: string
        }
        Update: {
          category_code?: string | null
          proficiency_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_equipment_property__proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: true
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_languages: {
        Row: {
          language_id: string
          proficiency_grant_id: string
        }
        Insert: {
          language_id: string
          proficiency_grant_id: string
        }
        Update: {
          language_id?: string
          proficiency_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_languages_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_grant_languages_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_save_abilities: {
        Row: {
          ability_code: string
          proficiency_grant_id: string
          sort_order: number
        }
        Insert: {
          ability_code: string
          proficiency_grant_id: string
          sort_order: number
        }
        Update: {
          ability_code?: string
          proficiency_grant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_save_abilities_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grant_skills: {
        Row: {
          proficiency_grant_id: string
          skill_id: string
        }
        Insert: {
          proficiency_grant_id: string
          skill_id: string
        }
        Update: {
          proficiency_grant_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grant_skills_proficiency_grant_id_fkey"
            columns: ["proficiency_grant_id"]
            isOneToOne: false
            referencedRelation: "proficiency_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_grant_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      proficiency_grants: {
        Row: {
          authoring_mode_kind: string
          count: number | null
          created_at: string
          grant_kind: string
          id: string
          level: string
          proficiency_kind: string
          restriction_id: string | null
          rounding: string | null
          selection_duplicate_policy: string | null
          selection_kind: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          count?: number | null
          created_at?: string
          grant_kind?: string
          id?: string
          level: string
          proficiency_kind: string
          restriction_id?: string | null
          rounding?: string | null
          selection_duplicate_policy?: string | null
          selection_kind: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          count?: number | null
          created_at?: string
          grant_kind?: string
          id?: string
          level?: string
          proficiency_kind?: string
          restriction_id?: string | null
          rounding?: string | null
          selection_duplicate_policy?: string | null
          selection_kind?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_grants_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_asset_id: string | null
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          id: string
          notification_recipient_id: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_asset_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id: string
          notification_recipient_id?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_asset_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string
          notification_recipient_id?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_asset_fk"
            columns: ["avatar_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      race_ancestries: {
        Row: {
          description: string | null
          id: string
          label: string
          race_id: string
        }
        Insert: {
          description?: string | null
          id: string
          label: string
          race_id: string
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_ancestries_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_ancestry_option_features: {
        Row: {
          ancestry_option_id: string
          feature_id: string
          sort_order: number
        }
        Insert: {
          ancestry_option_id: string
          feature_id: string
          sort_order: number
        }
        Update: {
          ancestry_option_id?: string
          feature_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_ancestry_option_features_ancestry_option_id_fkey"
            columns: ["ancestry_option_id"]
            isOneToOne: false
            referencedRelation: "race_ancestry_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_ancestry_option_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      race_ancestry_options: {
        Row: {
          ancestry_id: string
          description: string | null
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          ancestry_id: string
          description?: string | null
          id: string
          label: string
          sort_order: number
        }
        Update: {
          ancestry_id?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_ancestry_options_ancestry_id_fkey"
            columns: ["ancestry_id"]
            isOneToOne: false
            referencedRelation: "race_ancestries"
            referencedColumns: ["id"]
          },
        ]
      }
      race_details: {
        Row: {
          detail_id: string
          race_id: string
          sort_order: number
        }
        Insert: {
          detail_id: string
          race_id: string
          sort_order: number
        }
        Update: {
          detail_id?: string
          race_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_details_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_features: {
        Row: {
          feature_id: string
          race_id: string
          sort_order: number
        }
        Insert: {
          feature_id: string
          race_id: string
          sort_order: number
        }
        Update: {
          feature_id?: string
          race_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_heritages: {
        Row: {
          heritage_id: string
          race_id: string
          sort_order: number
        }
        Insert: {
          heritage_id: string
          race_id: string
          sort_order: number
        }
        Update: {
          heritage_id?: string
          race_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_heritages_heritage_id_fkey"
            columns: ["heritage_id"]
            isOneToOne: false
            referencedRelation: "heritages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_heritages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_speeds: {
        Row: {
          amount: number
          race_id: string
          speed_id: string
          unit_code: string
        }
        Insert: {
          amount: number
          race_id: string
          speed_id: string
          unit_code: string
        }
        Update: {
          amount?: number
          race_id?: string
          speed_id?: string
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_speeds_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_speeds_speed_id_fkey"
            columns: ["speed_id"]
            isOneToOne: false
            referencedRelation: "speeds"
            referencedColumns: ["id"]
          },
        ]
      }
      race_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          race_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          race_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          race_id?: string
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_versions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          active_version_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_master: boolean | null
          label: string
          parent_race_id: string | null
          quote: string | null
          selection_mode: string | null
          size_code: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id: string
          is_master?: boolean | null
          label: string
          parent_race_id?: string | null
          quote?: string | null
          selection_mode?: string | null
          size_code?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_master?: boolean | null
          label?: string
          parent_race_id?: string | null
          quote?: string | null
          selection_mode?: string | null
          size_code?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "races_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "race_versions"
            referencedColumns: ["race_id", "id"]
          },
          {
            foreignKeyName: "races_parent_system_fk"
            columns: ["parent_race_id", "system_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id", "system_id"]
          },
          {
            foreignKeyName: "races_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      rarities: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rarities_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_pack_revisions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          checksum: string
          created_at: string
          created_by: string
          document: Json
          evaluator_kind: string
          evaluator_version: string
          id: string
          model_contract_version: number
          revision: number
          rule_pack_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          checksum: string
          created_at?: string
          created_by: string
          document: Json
          evaluator_kind?: string
          evaluator_version?: string
          id?: string
          model_contract_version?: number
          revision: number
          rule_pack_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          checksum?: string
          created_at?: string
          created_by?: string
          document?: Json
          evaluator_kind?: string
          evaluator_version?: string
          id?: string
          model_contract_version?: number
          revision?: number
          rule_pack_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_pack_revisions_rule_pack_id_fkey"
            columns: ["rule_pack_id"]
            isOneToOne: false
            referencedRelation: "rule_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_packs: {
        Row: {
          active_revision_id: string | null
          created_at: string
          id: string
          ruleset_code: string
          updated_at: string
          version: string
        }
        Insert: {
          active_revision_id?: string | null
          created_at?: string
          id?: string
          ruleset_code: string
          updated_at?: string
          version: string
        }
        Update: {
          active_revision_id?: string | null
          created_at?: string
          id?: string
          ruleset_code?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_packs_active_revision_fk"
            columns: ["active_revision_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      saving_throw_dc_bonuses: {
        Row: {
          ability_code: string | null
          amount: number | null
          bonus_kind: string
          created_at: string
          id: string
          saving_throw_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ability_code?: string | null
          amount?: number | null
          bonus_kind: string
          created_at?: string
          id: string
          saving_throw_id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          ability_code?: string | null
          amount?: number | null
          bonus_kind?: string
          created_at?: string
          id?: string
          saving_throw_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saving_throw_dc_bonuses_saving_throw_id_fkey"
            columns: ["saving_throw_id"]
            isOneToOne: false
            referencedRelation: "saving_throws"
            referencedColumns: ["id"]
          },
        ]
      }
      saving_throws: {
        Row: {
          ability_code: string
          base_dc: number | null
          created_at: string
          dc_method: string
          id: string
          updated_at: string
        }
        Insert: {
          ability_code: string
          base_dc?: number | null
          created_at?: string
          dc_method: string
          id: string
          updated_at?: string
        }
        Update: {
          ability_code?: string
          base_dc?: number | null
          created_at?: string
          dc_method?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sense_grant_scaling_level_senses: {
        Row: {
          scaling_level_id: string
          sense_id: string
        }
        Insert: {
          scaling_level_id: string
          sense_id: string
        }
        Update: {
          scaling_level_id?: string
          sense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_grant_scaling_level_senses_scaling_level_id_fkey"
            columns: ["scaling_level_id"]
            isOneToOne: false
            referencedRelation: "sense_grant_scaling_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_grant_scaling_level_senses_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "senses"
            referencedColumns: ["id"]
          },
        ]
      }
      sense_grant_scaling_levels: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          id: string
          level: number
          selection_count: number | null
          selection_duplicate_policy: string | null
          sense_grant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          id?: string
          level: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sense_grant_id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          id?: string
          level?: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sense_grant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_grant_scaling_levels_sense_grant_id_fkey"
            columns: ["sense_grant_id"]
            isOneToOne: false
            referencedRelation: "sense_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      sense_grant_senses: {
        Row: {
          sense_grant_id: string
          sense_id: string
        }
        Insert: {
          sense_grant_id: string
          sense_id: string
        }
        Update: {
          sense_grant_id?: string
          sense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_grant_senses_sense_grant_id_fkey"
            columns: ["sense_grant_id"]
            isOneToOne: false
            referencedRelation: "sense_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_grant_senses_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "senses"
            referencedColumns: ["id"]
          },
        ]
      }
      sense_grants: {
        Row: {
          authoring_mode_kind: string
          charge_id: string | null
          class_id: string | null
          created_at: string
          id: string
          range_amount: number | null
          range_id: string | null
          range_kind: string | null
          range_scaling: Json | null
          range_unit: string | null
          restriction_id: string | null
          scaling_kind: string
          scaling_source: string | null
          selection_count: number | null
          selection_duplicate_policy: string | null
          selection_kind: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          range_amount?: number | null
          range_id?: string | null
          range_kind?: string | null
          range_scaling?: Json | null
          range_unit?: string | null
          restriction_id?: string | null
          scaling_kind: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          range_amount?: number | null
          range_id?: string | null
          range_kind?: string | null
          range_scaling?: Json | null
          range_unit?: string | null
          restriction_id?: string | null
          scaling_kind?: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_grants_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_grants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_grants_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      senses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "senses_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      social_action_rate_limits: {
        Row: {
          action_count: number
          action_kind: string
          created_at: string
          updated_at: string
          user_id: string
          window_kind: string
          window_started_at: string
        }
        Insert: {
          action_count: number
          action_kind: string
          created_at?: string
          updated_at?: string
          user_id: string
          window_kind: string
          window_started_at: string
        }
        Update: {
          action_count?: number
          action_kind?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          window_kind?: string
          window_started_at?: string
        }
        Relationships: []
      }
      social_applications: {
        Row: {
          applicant_profile_id: string
          blocked_at: string | null
          created_at: string
          expectations_snapshot: Json
          expired_at: string | null
          id: string
          listing_id: string
          listing_version: number
          message: string
          responded_at: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
          withdrawn_at: string | null
        }
        Insert: {
          applicant_profile_id: string
          blocked_at?: string | null
          created_at?: string
          expectations_snapshot: Json
          expired_at?: string | null
          id?: string
          listing_id: string
          listing_version: number
          message: string
          responded_at?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
          withdrawn_at?: string | null
        }
        Update: {
          applicant_profile_id?: string
          blocked_at?: string | null
          created_at?: string
          expectations_snapshot?: Json
          expired_at?: string | null
          id?: string
          listing_id?: string
          listing_version?: number
          message?: string
          responded_at?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_applications_applicant_profile_id_fkey"
            columns: ["applicant_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "social_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      social_blocks: {
        Row: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at: string
        }
        Insert: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at?: string
        }
        Update: {
          blocked_profile_id?: string
          blocker_profile_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_blocks_blocked_profile_id_fkey"
            columns: ["blocked_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_blocks_blocker_profile_id_fkey"
            columns: ["blocker_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_listings: {
        Row: {
          allowed_content_rules: string
          attendance_policy: string
          audience: string
          campaign_format: string
          campaign_id: string
          capacity: number
          city: string | null
          content_boundaries: string
          content_guidance: string
          content_maturity: string
          created_at: string
          id: string
          is_free: boolean
          local_start_time: string | null
          moderation_status: string
          play_mode: string
          price_amount: number | null
          price_currency: string | null
          published_at: string | null
          recurrence: string | null
          safety_details: string
          safety_practices: string[]
          schedule_kind: string
          schedule_summary: string
          search_vector: unknown
          starts_at: string | null
          state_code: string | null
          status: string
          summary: string
          system_id: string
          table_conduct: string
          time_zone: string
          title: string
          tone_details: string | null
          tone_tags: string[]
          updated_at: string
          version: number
          weekday: number | null
        }
        Insert: {
          allowed_content_rules: string
          attendance_policy: string
          audience: string
          campaign_format: string
          campaign_id: string
          capacity: number
          city?: string | null
          content_boundaries: string
          content_guidance: string
          content_maturity: string
          created_at?: string
          id?: string
          is_free?: boolean
          local_start_time?: string | null
          moderation_status?: string
          play_mode: string
          price_amount?: number | null
          price_currency?: string | null
          published_at?: string | null
          recurrence?: string | null
          safety_details: string
          safety_practices: string[]
          schedule_kind: string
          schedule_summary: string
          search_vector?: unknown
          starts_at?: string | null
          state_code?: string | null
          status?: string
          summary: string
          system_id: string
          table_conduct: string
          time_zone: string
          title: string
          tone_details?: string | null
          tone_tags: string[]
          updated_at?: string
          version?: number
          weekday?: number | null
        }
        Update: {
          allowed_content_rules?: string
          attendance_policy?: string
          audience?: string
          campaign_format?: string
          campaign_id?: string
          capacity?: number
          city?: string | null
          content_boundaries?: string
          content_guidance?: string
          content_maturity?: string
          created_at?: string
          id?: string
          is_free?: boolean
          local_start_time?: string | null
          moderation_status?: string
          play_mode?: string
          price_amount?: number | null
          price_currency?: string | null
          published_at?: string | null
          recurrence?: string | null
          safety_details?: string
          safety_practices?: string[]
          schedule_kind?: string
          schedule_summary?: string
          search_vector?: unknown
          starts_at?: string | null
          state_code?: string | null
          status?: string
          summary?: string
          system_id?: string
          table_conduct?: string
          time_zone?: string
          title?: string
          tone_details?: string | null
          tone_tags?: string[]
          updated_at?: string
          version?: number
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_listings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_listings_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      social_moderation_actions: {
        Row: {
          action: string
          affected_listing_id: string | null
          affected_profile_id: string | null
          after_state: Json
          before_state: Json
          created_at: string
          id: string
          moderator_user_id: string
          reason: string
          report_id: string
        }
        Insert: {
          action: string
          affected_listing_id?: string | null
          affected_profile_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: string
          moderator_user_id: string
          reason: string
          report_id: string
        }
        Update: {
          action?: string
          affected_listing_id?: string | null
          affected_profile_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: string
          moderator_user_id?: string
          reason?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_moderation_actions_affected_listing_id_fkey"
            columns: ["affected_listing_id"]
            isOneToOne: false
            referencedRelation: "social_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_moderation_actions_affected_profile_id_fkey"
            columns: ["affected_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "social_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          adult_attested_at: string | null
          content_preference: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          adult_attested_at?: string | null
          content_preference?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          adult_attested_at?: string | null
          content_preference?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      social_reports: {
        Row: {
          created_at: string
          details: string
          evidence_snapshot: Json
          id: string
          reason: string
          reporter_profile_id: string
          resolved_at: string | null
          review_started_at: string | null
          status: string
          target_application_id: string | null
          target_listing_id: string | null
          target_profile_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          details: string
          evidence_snapshot: Json
          id?: string
          reason: string
          reporter_profile_id: string
          resolved_at?: string | null
          review_started_at?: string | null
          status?: string
          target_application_id?: string | null
          target_listing_id?: string | null
          target_profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          details?: string
          evidence_snapshot?: Json
          id?: string
          reason?: string
          reporter_profile_id?: string
          resolved_at?: string | null
          review_started_at?: string | null
          status?: string
          target_application_id?: string | null
          target_listing_id?: string | null
          target_profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_target_application_id_fkey"
            columns: ["target_application_id"]
            isOneToOne: false
            referencedRelation: "social_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_target_listing_id_fkey"
            columns: ["target_listing_id"]
            isOneToOne: false
            referencedRelation: "social_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speeds: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "speeds_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_attributes: {
        Row: {
          attribute_code: string
          sort_order: number
          spell_id: string
        }
        Insert: {
          attribute_code: string
          sort_order: number
          spell_id: string
        }
        Update: {
          attribute_code?: string
          sort_order?: number
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_attributes_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_catalog_classes: {
        Row: {
          authored_version_id: string
          class_id: string
          spell_id: string
        }
        Insert: {
          authored_version_id: string
          class_id: string
          spell_id: string
        }
        Update: {
          authored_version_id?: string
          class_id?: string
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_catalog_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_catalog_classes_spell_id_authored_version_id_fkey"
            columns: ["spell_id", "authored_version_id"]
            isOneToOne: false
            referencedRelation: "spell_versions"
            referencedColumns: ["spell_id", "id"]
          },
          {
            foreignKeyName: "spell_catalog_classes_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_catalog_index_versions: {
        Row: {
          authored_version_id: string
          spell_id: string
        }
        Insert: {
          authored_version_id: string
          spell_id: string
        }
        Update: {
          authored_version_id?: string
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_catalog_index_versions_spell_id_authored_version_id_fkey"
            columns: ["spell_id", "authored_version_id"]
            isOneToOne: false
            referencedRelation: "spell_versions"
            referencedColumns: ["spell_id", "id"]
          },
          {
            foreignKeyName: "spell_catalog_index_versions_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: true
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_classes: {
        Row: {
          class_id: string
          spell_id: string
        }
        Insert: {
          class_id: string
          spell_id: string
        }
        Update: {
          class_id?: string
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_classes_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_effects: {
        Row: {
          effect_id: string
          sort_order: number
          spell_id: string
        }
        Insert: {
          effect_id: string
          sort_order: number
          spell_id: string
        }
        Update: {
          effect_id?: string
          sort_order?: number
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_effects_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_grant_attributes: {
        Row: {
          attribute_code: string
          sort_order: number
          spell_grant_id: string
        }
        Insert: {
          attribute_code: string
          sort_order: number
          spell_grant_id: string
        }
        Update: {
          attribute_code?: string
          sort_order?: number
          spell_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_grant_attributes_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_grant_scaling_level_spells: {
        Row: {
          scaling_level_id: string
          sort_order: number
          spell_id: string
        }
        Insert: {
          scaling_level_id: string
          sort_order: number
          spell_id: string
        }
        Update: {
          scaling_level_id?: string
          sort_order?: number
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_grant_scaling_level_spells_scaling_level_id_fkey"
            columns: ["scaling_level_id"]
            isOneToOne: false
            referencedRelation: "spell_grant_scaling_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_grant_scaling_level_spells_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_grant_scaling_levels: {
        Row: {
          authoring_mode_kind: string
          created_at: string
          id: string
          level: number
          selection_count: number | null
          selection_duplicate_policy: string | null
          sort_order: number
          spell_grant_id: string
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          created_at?: string
          id?: string
          level: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sort_order: number
          spell_grant_id: string
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          created_at?: string
          id?: string
          level?: number
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          sort_order?: number
          spell_grant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_grant_scaling_levels_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_grant_spells: {
        Row: {
          sort_order: number
          spell_grant_id: string
          spell_id: string
        }
        Insert: {
          sort_order: number
          spell_grant_id: string
          spell_id: string
        }
        Update: {
          sort_order?: number
          spell_grant_id?: string
          spell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_grant_spells_spell_grant_id_fkey"
            columns: ["spell_grant_id"]
            isOneToOne: false
            referencedRelation: "spell_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_grant_spells_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_grants: {
        Row: {
          authoring_mode_kind: string
          cast_at_level: number | null
          casting_ability_code: string | null
          charge_id: string | null
          class_id: string | null
          created_at: string
          filter_id: string | null
          id: string
          restriction_id: string | null
          scaling_kind: string
          scaling_source: string | null
          selection_count: number | null
          selection_duplicate_policy: string | null
          selection_kind: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authoring_mode_kind: string
          cast_at_level?: number | null
          casting_ability_code?: string | null
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          filter_id?: string | null
          id?: string
          restriction_id?: string | null
          scaling_kind: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string
          cast_at_level?: number | null
          casting_ability_code?: string | null
          charge_id?: string | null
          class_id?: string | null
          created_at?: string
          filter_id?: string | null
          id?: string
          restriction_id?: string | null
          scaling_kind?: string
          scaling_source?: string | null
          selection_count?: number | null
          selection_duplicate_policy?: string | null
          selection_kind?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_grants_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_grants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_grants_filter_id_fkey"
            columns: ["filter_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_grants_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          spell_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          spell_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          spell_id?: string
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spell_versions_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spell_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      spells: {
        Row: {
          active_version_id: string | null
          casting_time_amount: number
          casting_time_unit: string
          created_at: string
          description: string
          id: string
          is_master: boolean | null
          label: string
          level: number
          magic_school_id: string
          material_description: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          casting_time_amount: number
          casting_time_unit: string
          created_at?: string
          description: string
          id?: string
          is_master?: boolean | null
          label: string
          level: number
          magic_school_id: string
          material_description?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          casting_time_amount?: number
          casting_time_unit?: string
          created_at?: string
          description?: string
          id?: string
          is_master?: boolean | null
          label?: string
          level?: number
          magic_school_id?: string
          material_description?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spells_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "spell_versions"
            referencedColumns: ["spell_id", "id"]
          },
          {
            foreignKeyName: "spells_magic_school_id_fkey"
            columns: ["magic_school_id"]
            isOneToOne: false
            referencedRelation: "magic_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      starting_equipment_currencies: {
        Row: {
          amount: number
          currency_id: string
          option_item_id: string
        }
        Insert: {
          amount: number
          currency_id: string
          option_item_id: string
        }
        Update: {
          amount?: number
          currency_id?: string
          option_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_currencies_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starting_equipment_currencies_option_item_id_fkey"
            columns: ["option_item_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_option_items"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_groups: {
        Row: {
          created_at: string
          equipment_set_id: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipment_set_id: string
          id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipment_set_id?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_groups_equipment_set_id_fkey"
            columns: ["equipment_set_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_option_item_equipment: {
        Row: {
          equipment_id: string
          option_item_id: string
        }
        Insert: {
          equipment_id: string
          option_item_id: string
        }
        Update: {
          equipment_id?: string
          option_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_option_item_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starting_equipment_option_item_equipment_option_item_id_fkey"
            columns: ["option_item_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_option_items"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_option_item_properties: {
        Row: {
          option_item_id: string
          property_code: string
        }
        Insert: {
          option_item_id: string
          property_code: string
        }
        Update: {
          option_item_id?: string
          property_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_option_item_properties_option_item_id_fkey"
            columns: ["option_item_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_option_items"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_option_items: {
        Row: {
          authoring_mode_kind: string | null
          category_code: string | null
          count: number | null
          created_at: string
          equipment_option_id: string
          id: string
          quantity: number | null
          selection_kind: string | null
          sort_order: number
          starting_equipment_kind: string
          updated_at: string
        }
        Insert: {
          authoring_mode_kind?: string | null
          category_code?: string | null
          count?: number | null
          created_at?: string
          equipment_option_id: string
          id: string
          quantity?: number | null
          selection_kind?: string | null
          sort_order: number
          starting_equipment_kind: string
          updated_at?: string
        }
        Update: {
          authoring_mode_kind?: string | null
          category_code?: string | null
          count?: number | null
          created_at?: string
          equipment_option_id?: string
          id?: string
          quantity?: number | null
          selection_kind?: string | null
          sort_order?: number
          starting_equipment_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_option_items_equipment_option_id_fkey"
            columns: ["equipment_option_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_options"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_options: {
        Row: {
          created_at: string
          eligibility_facet_id: string | null
          equipment_group_id: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligibility_facet_id?: string | null
          equipment_group_id: string
          id: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligibility_facet_id?: string | null
          equipment_group_id?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_options_eligibility_facet_id_fkey"
            columns: ["eligibility_facet_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starting_equipment_options_equipment_group_id_fkey"
            columns: ["equipment_group_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_equipment_sets: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          starting_equipment_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          sort_order: number
          starting_equipment_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          starting_equipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_equipment_sets_starting_equipment_id_fkey"
            columns: ["starting_equipment_id"]
            isOneToOne: false
            referencedRelation: "starting_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      system_vocabulary_snapshots: {
        Row: {
          checksum: string
          created_at: string
          document: Json
          id: string
          schema_version: number
          system_id: string
          vocabulary_version: number
        }
        Insert: {
          checksum: string
          created_at?: string
          document: Json
          id: string
          schema_version: number
          system_id: string
          vocabulary_version: number
        }
        Update: {
          checksum?: string
          created_at?: string
          document?: Json
          id?: string
          schema_version?: number
          system_id?: string
          vocabulary_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_vocabulary_snapshots_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          active_vocabulary_snapshot_id: string | null
          created_at: string
          description: string | null
          id: string
          label: string
          ruleset_code: string
          ruleset_version: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_vocabulary_snapshot_id?: string | null
          created_at?: string
          description?: string | null
          id: string
          label: string
          ruleset_code: string
          ruleset_version: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_vocabulary_snapshot_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          ruleset_code?: string
          ruleset_version?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "systems_active_vocabulary_snapshot_fk"
            columns: ["id", "active_vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["system_id", "id"]
          },
        ]
      }
      terrains: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          short: string | null
          system_id: string
          tooltip: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: string
          label: string
          short?: string | null
          system_id: string
          tooltip?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          short?: string | null
          system_id?: string
          tooltip?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terrains_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roll_history: {
        Row: {
          character_id: string | null
          character_label: string
          consumed_at: string | null
          created_at: string
          evidence: Json
          id: string
          normalized_expression: string
          ruleset_code: string
          ruleset_version: string
          source: Json
          system_id: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          character_label: string
          consumed_at?: string | null
          created_at?: string
          evidence: Json
          id?: string
          normalized_expression: string
          ruleset_code: string
          ruleset_version: string
          source: Json
          system_id: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          character_label?: string
          consumed_at?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          normalized_expression?: string
          ruleset_code?: string
          ruleset_version?: string
          source?: Json
          system_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roll_history_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roll_history_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_details: {
        Row: {
          detail_id: string
          sort_order: number
          vehicle_id: string
        }
        Insert: {
          detail_id: string
          sort_order: number
          vehicle_id: string
        }
        Update: {
          detail_id?: string
          sort_order?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_details_detail_id_fkey"
            columns: ["detail_id"]
            isOneToOne: false
            referencedRelation: "details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_details_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_features: {
        Row: {
          feature_id: string
          sort_order: number
          vehicle_id: string
        }
        Insert: {
          feature_id: string
          sort_order: number
          vehicle_id: string
        }
        Update: {
          feature_id?: string
          sort_order?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_features_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_versions: {
        Row: {
          authored_checksum: string
          authored_dependency_vector: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          vehicle_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Insert: {
          authored_checksum: string
          authored_dependency_vector?: Json
          authored_document: Json
          compiled_checksum: string
          compiled_document: Json
          compiler_version: string
          created_at?: string
          document_schema_version: number
          id: string
          projection_schema_version: number
          vehicle_id: string
          version: number
          vocabulary_snapshot_id: string
        }
        Update: {
          authored_checksum?: string
          authored_dependency_vector?: Json
          authored_document?: Json
          compiled_checksum?: string
          compiled_document?: Json
          compiler_version?: string
          created_at?: string
          document_schema_version?: number
          id?: string
          projection_schema_version?: number
          vehicle_id?: string
          version?: number
          vocabulary_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_versions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_versions_vocabulary_snapshot_id_fkey"
            columns: ["vocabulary_snapshot_id"]
            isOneToOne: false
            referencedRelation: "system_vocabulary_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active_version_id: string | null
          armor_class: number | null
          cargo_capacity: string | null
          category: string
          cost: Json | null
          created_at: string
          crew_max: number | null
          crew_min: number | null
          description: string | null
          hit_points: number | null
          id: string
          is_master: boolean | null
          label: string
          passenger_capacity: number | null
          properties: string[] | null
          size_code: string | null
          speed: number | null
          speed_note: string | null
          status: string
          system_id: string
          updated_at: string
          user_id: string | null
          weight_amount: number | null
          weight_unit: string | null
        }
        Insert: {
          active_version_id?: string | null
          armor_class?: number | null
          cargo_capacity?: string | null
          category: string
          cost?: Json | null
          created_at?: string
          crew_max?: number | null
          crew_min?: number | null
          description?: string | null
          hit_points?: number | null
          id: string
          is_master?: boolean | null
          label: string
          passenger_capacity?: number | null
          properties?: string[] | null
          size_code?: string | null
          speed?: number | null
          speed_note?: string | null
          status?: string
          system_id: string
          updated_at?: string
          user_id?: string | null
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Update: {
          active_version_id?: string | null
          armor_class?: number | null
          cargo_capacity?: string | null
          category?: string
          cost?: Json | null
          created_at?: string
          crew_max?: number | null
          crew_min?: number | null
          description?: string | null
          hit_points?: number | null
          id?: string
          is_master?: boolean | null
          label?: string
          passenger_capacity?: number | null
          properties?: string[] | null
          size_code?: string | null
          speed?: number | null
          speed_note?: string | null
          status?: string
          system_id?: string
          updated_at?: string
          user_id?: string | null
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_active_version_fk"
            columns: ["id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "vehicle_versions"
            referencedColumns: ["vehicle_id", "id"]
          },
          {
            foreignKeyName: "vehicles_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      vtt_map_tiles: {
        Row: {
          asset_id: string
          byte_size: number
          column_index: number
          created_at: string
          height: number
          object_key: string
          row_index: number
          width: number
        }
        Insert: {
          asset_id: string
          byte_size: number
          column_index: number
          created_at?: string
          height: number
          object_key: string
          row_index: number
          width: number
        }
        Update: {
          asset_id?: string
          byte_size?: number
          column_index?: number
          created_at?: string
          height?: number
          object_key?: string
          row_index?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "vtt_map_tiles_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_direct_ownership_policies: {
        Args: { target_table: string }
        Returns: undefined
      }
      apply_system_derived_policies: {
        Args: { target_table: string }
        Returns: undefined
      }
      apply_system_vocabulary_policies: {
        Args: { target_table: string }
        Returns: undefined
      }
      apply_updated_at_triggers: {
        Args: { p_schema?: string }
        Returns: undefined
      }
      base36_encode: { Args: { value: number }; Returns: string }
      can_access_authored_route_id: {
        Args: { p_subject_id: string; p_subject_kind: string }
        Returns: boolean
      }
      claim_notification_delivery_intents: {
        Args: { p_limit: number; p_now: string; p_stale_before: string }
        Returns: {
          attempt_count: number
          email_enabled: boolean
          grouping_key: string
          id: string
          in_app_enabled: boolean
          operation: string
          payload: Json
          recipient_email: string
          recipient_notification_id: string
          recipient_user_id: string
          recipient_username: string
          source_kind: string
          source_public_id: string
          workflow_key: string
        }[]
      }
      jsonb_has_all: { Args: { arr: Json }; Returns: boolean }
      notification_expire_due_campaign_invites: {
        Args: { p_limit: number; p_now: string }
        Returns: number
      }
      notification_mark_delivery_failed: {
        Args: { p_error_code: string; p_failed_at: string; p_intent_id: string }
        Returns: undefined
      }
      notification_mark_delivery_retry: {
        Args: {
          p_error_code: string
          p_intent_id: string
          p_next_attempt_at: string
        }
        Returns: undefined
      }
      notification_mark_delivery_succeeded: {
        Args: { p_delivered_at: string; p_intent_id: string }
        Returns: undefined
      }
      record_notification_feed_item: {
        Args: { p_intent_id: string }
        Returns: string
      }
      set_admin_claims: { Args: { event: Json }; Returns: Json }
      srd_authored_route_number: {
        Args: { subject_id: string }
        Returns: number
      }
    }
    Enums: {
      spell_state: "PREPARED" | "KNOWN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals },
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
      spell_state: ["PREPARED", "KNOWN"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
