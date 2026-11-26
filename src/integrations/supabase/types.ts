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
      account_deletions: {
        Row: {
          deleted_at: string
          email: string | null
          name: string | null
          source: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          email?: string | null
          name?: string | null
          source?: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          email?: string | null
          name?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          app_version: string | null
          event: string
          id: string
          occurred_at: string
          platform: string
          properties: Json | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          event: string
          id?: string
          occurred_at?: string
          platform?: string
          properties?: Json | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          event?: string
          id?: string
          occurred_at?: string
          platform?: string
          properties?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      app_store_daily: {
        Row: {
          fetched_at: string
          report_date: string
          units: number
          updates: number
        }
        Insert: {
          fetched_at?: string
          report_date: string
          units?: number
          updates?: number
        }
        Update: {
          fetched_at?: string
          report_date?: string
          units?: number
          updates?: number
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          activity: string | null
          checkin_date: string
          created_at: string
          group_id: string
          health_workout: Json | null
          id: string
          mood: string | null
          note: string | null
          photo_url: string | null
          user_id: string
        }
        Insert: {
          activity?: string | null
          checkin_date?: string
          created_at?: string
          group_id: string
          health_workout?: Json | null
          id?: string
          mood?: string | null
          note?: string | null
          photo_url?: string | null
          user_id: string
        }
        Update: {
          activity?: string | null
          checkin_date?: string
          created_at?: string
          group_id?: string
          health_workout?: Json | null
          id?: string
          mood?: string | null
          note?: string | null
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          group_id: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          group_id?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          group_id?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      crew_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          goal_prompt_seen_at: string | null
          group_id: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          goal_prompt_seen_at?: string | null
          group_id: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          goal_prompt_seen_at?: string | null
          group_id?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      daily_posts: {
        Row: {
          check_in_id: string | null
          check_in_missed: boolean
          created_at: string
          group_id: string
          id: string
          local_date: string
          morning_missed: boolean
          morning_ritual_posted_at: string | null
          morning_ritual_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_id?: string | null
          check_in_missed?: boolean
          created_at?: string
          group_id: string
          id?: string
          local_date: string
          morning_missed?: boolean
          morning_ritual_posted_at?: string | null
          morning_ritual_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_id?: string | null
          check_in_missed?: boolean
          created_at?: string
          group_id?: string
          id?: string
          local_date?: string
          morning_missed?: boolean
          morning_ritual_posted_at?: string | null
          morning_ritual_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_posts_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_thoughts: {
        Row: {
          created_at: string
          group_id: string
          id: string
          local_date: string
          photo_url: string | null
          text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          local_date: string
          photo_url?: string | null
          text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          local_date?: string
          photo_url?: string | null
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_thoughts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      deferred_invites: {
        Row: {
          claimed_at: string | null
          created_at: string
          group_id: string
          id: string
          ip_hash: string
          ip_prefix_hash: string | null
          platform: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          ip_hash: string
          ip_prefix_hash?: string | null
          platform: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          ip_hash?: string
          ip_prefix_hash?: string | null
          platform?: string
        }
        Relationships: []
      }
      earned_badges: {
        Row: {
          earned_at: string
          group_id: string
          id: string
          streak_days: number
          user_id: string
        }
        Insert: {
          earned_at?: string
          group_id: string
          id?: string
          streak_days: number
          user_id: string
        }
        Update: {
          earned_at?: string
          group_id?: string
          id?: string
          streak_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earned_badges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      evening_push_sends: {
        Row: {
          created_at: string
          group_ids: string[]
          hour: number
          local_date: string
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_ids?: string[]
          hour: number
          local_date: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_ids?: string[]
          hour?: number
          local_date?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difficulty: string | null
          equipment: string
          id: string
          image_bg: string | null
          image_peak: string | null
          image_start: string | null
          instructions: string[]
          log_type: string
          name: string
          owner_id: string | null
          primary_muscles: string[]
          secondary_muscles: string[]
          source: string
          tips: string[]
          variation_group: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          equipment?: string
          id?: string
          image_bg?: string | null
          image_peak?: string | null
          image_start?: string | null
          instructions?: string[]
          log_type?: string
          name: string
          owner_id?: string | null
          primary_muscles?: string[]
          secondary_muscles?: string[]
          source?: string
          tips?: string[]
          variation_group?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          equipment?: string
          id?: string
          image_bg?: string | null
          image_peak?: string | null
          image_start?: string | null
          instructions?: string[]
          log_type?: string
          name?: string
          owner_id?: string | null
          primary_muscles?: string[]
          secondary_muscles?: string[]
          source?: string
          tips?: string[]
          variation_group?: string | null
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      follow_notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          push_claimed_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: string
          push_claimed_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          push_claimed_at?: string | null
          recipient_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          accepted_at: string | null
          created_at: string
          follower_id: string
          following_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          follower_id: string
          following_id: string
          status: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          follower_id?: string
          following_id?: string
          status?: string
        }
        Relationships: []
      }
      group_member_departures: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          left_at: string
          pact_signed_at: string | null
          personal_goal: string | null
          personal_goal_set_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          left_at?: string
          pact_signed_at?: string | null
          personal_goal?: string | null
          personal_goal_set_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string
          pact_signed_at?: string | null
          personal_goal?: string | null
          personal_goal_set_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_member_departures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string
          pact_nudged_at: string | null
          pact_signed_at: string | null
          personal_goal: string | null
          personal_goal_set_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          pact_nudged_at?: string | null
          pact_signed_at?: string | null
          personal_goal?: string | null
          personal_goal_set_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          pact_nudged_at?: string | null
          pact_signed_at?: string | null
          personal_goal?: string | null
          personal_goal_set_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          image_url: string | null
          shared_plan_slug: string | null
          shared_workout_code: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          image_url?: string | null
          shared_plan_slug?: string | null
          shared_workout_code?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          image_url?: string | null
          shared_plan_slug?: string | null
          shared_workout_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_shared_plan_slug_fkey"
            columns: ["shared_plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "group_messages_shared_workout_code_fkey"
            columns: ["shared_workout_code"]
            isOneToOne: false
            referencedRelation: "shared_workouts"
            referencedColumns: ["code"]
          },
        ]
      }
      groups: {
        Row: {
          about: string | null
          created_at: string
          days_per_week: number
          discoverable: boolean
          duration_days: number
          emoji: string
          ended_at: string | null
          ended_by: string | null
          frequency: string
          goal: string | null
          id: string
          kind: string
          name: string
          owner_id: string
          pact_promise: string | null
          previous_duration_days: number | null
          previous_start_date: string | null
          solo_nudge_count: number
          solo_nudged_at: string | null
          start_date: string
        }
        Insert: {
          about?: string | null
          created_at?: string
          days_per_week?: number
          discoverable?: boolean
          duration_days?: number
          emoji?: string
          ended_at?: string | null
          ended_by?: string | null
          frequency?: string
          goal?: string | null
          id?: string
          kind?: string
          name: string
          owner_id: string
          pact_promise?: string | null
          previous_duration_days?: number | null
          previous_start_date?: string | null
          solo_nudge_count?: number
          solo_nudged_at?: string | null
          start_date?: string
        }
        Update: {
          about?: string | null
          created_at?: string
          days_per_week?: number
          discoverable?: boolean
          duration_days?: number
          emoji?: string
          ended_at?: string | null
          ended_by?: string | null
          frequency?: string
          goal?: string | null
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          pact_promise?: string | null
          previous_duration_days?: number | null
          previous_start_date?: string | null
          solo_nudge_count?: number
          solo_nudged_at?: string | null
          start_date?: string
        }
        Relationships: []
      }
      health_preferences: {
        Row: {
          connected: boolean
          show_workouts: boolean
          user_id: string
        }
        Insert: {
          connected?: boolean
          show_workouts?: boolean
          user_id: string
        }
        Update: {
          connected?: boolean
          show_workouts?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      member_nudges: {
        Row: {
          created_at: string
          group_id: string
          id: string
          local_date: string
          nudger_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          local_date: string
          nudger_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          local_date?: string
          nudger_id?: string
          target_id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          daily_reminder_enabled: boolean
          daily_reminder_time: string
          email_enabled: boolean
          group_activity_enabled: boolean
          group_milestones_enabled: boolean
          morning_ritual_reminder_enabled: boolean
          nudges_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
          workout_complete_enabled: boolean
          workout_start_enabled: boolean
        }
        Insert: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          email_enabled?: boolean
          group_activity_enabled?: boolean
          group_milestones_enabled?: boolean
          morning_ritual_reminder_enabled?: boolean
          nudges_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
          workout_complete_enabled?: boolean
          workout_start_enabled?: boolean
        }
        Update: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          email_enabled?: boolean
          group_activity_enabled?: boolean
          group_milestones_enabled?: boolean
          morning_ritual_reminder_enabled?: boolean
          nudges_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
          workout_complete_enabled?: boolean
          workout_start_enabled?: boolean
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          item_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          item_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          item_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_step_events: {
        Row: {
          id: string
          journey_id: string
          occurred_at: string
          path: string
          step: string
          user_id: string | null
        }
        Insert: {
          id?: string
          journey_id: string
          occurred_at?: string
          path: string
          step: string
          user_id?: string | null
        }
        Update: {
          id?: string
          journey_id?: string
          occurred_at?: string
          path?: string
          step?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pact_member_seen: {
        Row: {
          created_at: string
          group_id: string
          kind: string
          pact_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          kind: string
          pact_start: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          kind?: string
          pact_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pact_member_seen_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_queue: {
        Row: {
          entered_at: string
          goal: string | null
          id: string
          matched_at: string | null
          recent_activity_at: string
          released_count: number
          reliability_score_internal: number
          solo_group_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          entered_at?: string
          goal?: string | null
          id?: string
          matched_at?: string | null
          recent_activity_at?: string
          released_count?: number
          reliability_score_internal?: number
          solo_group_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          entered_at?: string
          goal?: string | null
          id?: string
          matched_at?: string | null
          recent_activity_at?: string
          released_count?: number
          reliability_score_internal?: number
          solo_group_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_queue_solo_group_id_fkey"
            columns: ["solo_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          created_at: string
          duration_days: number
          ended_at: string | null
          ended_by: string | null
          ended_reason: string | null
          expires_at: string
          group_id: string | null
          id: string
          matched_at: string
          shared_streak: number
          started_at: string | null
          status: string
          user_1_accepted_at: string | null
          user_1_id: string
          user_2_accepted_at: string | null
          user_2_id: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          expires_at?: string
          group_id?: string | null
          id?: string
          matched_at?: string
          shared_streak?: number
          started_at?: string | null
          status?: string
          user_1_accepted_at?: string | null
          user_1_id: string
          user_2_accepted_at?: string | null
          user_2_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          expires_at?: string
          group_id?: string | null
          id?: string
          matched_at?: string
          shared_streak?: number
          started_at?: string | null
          status?: string
          user_1_accepted_at?: string | null
          user_1_id?: string
          user_2_accepted_at?: string | null
          user_2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          minutes: string | null
          moves: Json
          muscles: Json
          note: string | null
          plan_id: string
          title: string
          week_number: number | null
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          minutes?: string | null
          moves?: Json
          muscles?: Json
          note?: string | null
          plan_id: string
          title: string
          week_number?: number | null
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          minutes?: string | null
          moves?: Json
          muscles?: Json
          note?: string | null
          plan_id?: string
          title?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_workout_logs: {
        Row: {
          check_in_id: string | null
          completed_at: string
          day_number: number
          id: string
          user_plan_id: string
          week: number
        }
        Insert: {
          check_in_id?: string | null
          completed_at?: string
          day_number: number
          id?: string
          user_plan_id: string
          week: number
        }
        Update: {
          check_in_id?: string | null
          completed_at?: string
          day_number?: number
          id?: string
          user_plan_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_workout_logs_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: true
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workout_logs_user_plan_id_fkey"
            columns: ["user_plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          cover_credit: string | null
          cover_url: string | null
          created_at: string
          days_per_week: number
          equipment_key: string
          focus_line: string | null
          gear: string[]
          gear_short: string | null
          goal: string
          id: string
          is_published: boolean
          level: string
          minutes: string
          name: string
          note: string | null
          progression_rule: string
          safety_note: string
          slug: string
          sort_order: number
          summary: string
          week_notes: Json
          weeks: number
        }
        Insert: {
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          days_per_week: number
          equipment_key: string
          focus_line?: string | null
          gear?: string[]
          gear_short?: string | null
          goal: string
          id?: string
          is_published?: boolean
          level: string
          minutes: string
          name: string
          note?: string | null
          progression_rule: string
          safety_note: string
          slug: string
          sort_order?: number
          summary: string
          week_notes?: Json
          weeks: number
        }
        Update: {
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          days_per_week?: number
          equipment_key?: string
          focus_line?: string | null
          gear?: string[]
          gear_short?: string | null
          goal?: string
          id?: string
          is_published?: boolean
          level?: string
          minutes?: string
          name?: string
          note?: string | null
          progression_rule?: string
          safety_note?: string
          slug?: string
          sort_order?: number
          summary?: string
          week_notes?: Json
          weeks?: number
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "daily_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "daily_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_version: string
          avatar_color: string
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          health_prompt_seen_at: string | null
          id: string
          interests: string[]
          is_private: boolean
          name: string
          new_version_enabled: boolean
          new_version_seen_at: string | null
          plan_quiz: Json | null
          streak_freezes_available: number
          timezone: string
          username: string | null
          weight_unit: string
          whats_new_seen: string | null
        }
        Insert: {
          app_version?: string
          avatar_color?: string
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          health_prompt_seen_at?: string | null
          id: string
          interests?: string[]
          is_private?: boolean
          name?: string
          new_version_enabled?: boolean
          new_version_seen_at?: string | null
          plan_quiz?: Json | null
          streak_freezes_available?: number
          timezone?: string
          username?: string | null
          weight_unit?: string
          whats_new_seen?: string | null
        }
        Update: {
          app_version?: string
          avatar_color?: string
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          health_prompt_seen_at?: string | null
          id?: string
          interests?: string[]
          is_private?: boolean
          name?: string
          new_version_enabled?: boolean
          new_version_seen_at?: string | null
          plan_quiz?: Json | null
          streak_freezes_available?: number
          timezone?: string
          username?: string | null
          weight_unit?: string
          whats_new_seen?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          claimed_at: string | null
          created_at: string
          event: string
          id: string
          ip_hash: string
          partner_id: string
          platform: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          event: string
          id?: string
          ip_hash: string
          partner_id: string
          platform: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          event?: string
          id?: string
          ip_hash?: string
          partner_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_installs: {
        Row: {
          created_at: string
          id: string
          linked_at: string | null
          partner_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          linked_at?: string | null
          partner_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          linked_at?: string | null
          partner_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_installs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          created_at: string
          dashboard_key: string
          id: string
          instagram_followers: number
          name: string
          payout_per_member_cents: number
          short_link: string | null
          slug: string
          tiktok_followers: number
        }
        Insert: {
          created_at?: string
          dashboard_key?: string
          id?: string
          instagram_followers?: number
          name: string
          payout_per_member_cents?: number
          short_link?: string | null
          slug: string
          tiktok_followers?: number
        }
        Update: {
          created_at?: string
          dashboard_key?: string
          id?: string
          instagram_followers?: number
          name?: string
          payout_per_member_cents?: number
          short_link?: string | null
          slug?: string
          tiktok_followers?: number
        }
        Relationships: []
      }
      shared_plans: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_id: string
          plan_slug: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_id: string
          plan_slug: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_id?: string
          plan_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_plans_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
      shared_workouts: {
        Row: {
          code: string
          created_at: string
          exercises: Json
          id: string
          name: string
          owner_id: string
          workout_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          exercises?: Json
          id?: string
          name: string
          owner_id: string
          workout_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          exercises?: Json
          id?: string
          name?: string
          owner_id?: string
          workout_id?: string | null
        }
        Relationships: []
      }
      streak_freezes_used: {
        Row: {
          created_at: string
          freeze_date: string
          group_id: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          freeze_date: string
          group_id: string
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          created_at?: string
          freeze_date?: string
          group_id?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_freezes_used_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          entitlement: string | null
          expires_at: string | null
          is_active: boolean
          last_event_at: string | null
          last_event_type: string | null
          period_type: string | null
          product_id: string | null
          store: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_event_at?: string | null
          last_event_type?: string | null
          period_type?: string | null
          product_id?: string | null
          store?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_event_at?: string | null
          last_event_type?: string | null
          period_type?: string | null
          product_id?: string | null
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badge_counts: {
        Row: {
          count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          current_week: number
          id: string
          next_day: number
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_week?: number
          id?: string
          next_day?: number
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_week?: number
          id?: string
          next_day?: number
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_cheers: {
        Row: {
          created_at: string
          emoji: string
          group_id: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          group_id: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          group_id?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_cheers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_cheers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          check_in_ids: string[]
          commitment_text: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          group_id: string
          id: string
          local_date: string
          logged_at: string | null
          post_id: string | null
          proof_completed: boolean
          start_notification_sent: boolean
          started_at: string
          status: string
          summary: Json | null
          title: string | null
          updated_at: string
          user_id: string
          workout_id: string | null
        }
        Insert: {
          check_in_ids?: string[]
          commitment_text?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          group_id: string
          id?: string
          local_date: string
          logged_at?: string | null
          post_id?: string | null
          proof_completed?: boolean
          start_notification_sent?: boolean
          started_at?: string
          status?: string
          summary?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
          workout_id?: string | null
        }
        Update: {
          check_in_ids?: string[]
          commitment_text?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          group_id?: string
          id?: string
          local_date?: string
          logged_at?: string | null
          post_id?: string | null
          proof_completed?: boolean
          start_notification_sent?: boolean
          started_at?: string
          status?: string
          summary?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "daily_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_set_logs: {
        Row: {
          created_at: string
          done_at: string
          exercise_id: string
          id: string
          is_pr: boolean
          local_date: string
          position: number
          reps: number | null
          seconds: number | null
          session_id: string | null
          set_no: number
          unit: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          done_at?: string
          exercise_id: string
          id?: string
          is_pr?: boolean
          local_date: string
          position?: number
          reps?: number | null
          seconds?: number | null
          session_id?: string | null
          set_no: number
          unit?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          done_at?: string
          exercise_id?: string
          id?: string
          is_pr?: boolean
          local_date?: string
          position?: number
          reps?: number | null
          seconds?: number | null
          session_id?: string | null
          set_no?: number
          unit?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          exercises: Json
          id: string
          last_done_at: string | null
          name: string
          source_session_id: string | null
          source_share_code: string | null
          source_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercises?: Json
          id?: string
          last_done_at?: string | null
          name: string
          source_session_id?: string | null
          source_share_code?: string | null
          source_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercises?: Json
          id?: string
          last_done_at?: string | null
          name?: string
          source_session_id?: string | null
          source_share_code?: string | null
          source_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      caller_on_new_version: { Args: never; Returns: boolean }
      can_read_follow_notification: {
        Args: { actor: string; recipient: string }
        Returns: boolean
      }
      can_read_follow_notifications: { Args: never; Returns: boolean }
      cancel_crew_join_request: {
        Args: { _request_id: string }
        Returns: string
      }
      claim_evening_push: {
        Args: { _hour: number; _local_date: string; _user_id: string }
        Returns: boolean
      }
      claim_follow_pushes: {
        Args: { actor: string }
        Returns: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          push_claimed_at: string | null
          recipient_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "follow_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_crew_join_goal: {
        Args: { _goal?: string; _group_id: string }
        Returns: boolean
      }
      crew_active_plans: {
        Args: never
        Returns: {
          current_week: number
          plan_name: string
          plan_slug: string
          user_id: string
          weeks: number
        }[]
      }
      crew_checkin_status: {
        Args: never
        Returns: {
          activity: string
          checkin_date: string
          created_at: string
          group_id: string
          id: string
          mood: string
          note: string
          photo_url: string
          user_id: string
        }[]
      }
      crew_daily_status: {
        Args: never
        Returns: {
          check_in_id: string
          check_in_missed: boolean
          group_id: string
          local_date: string
          morning_ritual_posted_at: string
          morning_ritual_text: string
          user_id: string
        }[]
      }
      crew_is_active: { Args: { _group_id: string }; Returns: boolean }
      crew_on_plan: {
        Args: { _plan_id: string }
        Returns: {
          current_week: number
          status: string
          user_id: string
        }[]
      }
      crew_workout_status: {
        Args: never
        Returns: {
          group_id: string
          id: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      decide_crew_join_request: {
        Args: { _decision: string; _request_id: string }
        Returns: Json
      }
      end_crew: { Args: { _group_id: string }; Returns: undefined }
      follow_user: { Args: { target: string }; Returns: Json }
      get_follow_profile_stats: { Args: { target: string }; Returns: Json }
      get_my_app_prefs: {
        Args: never
        Returns: {
          app_version: string
          bio: string
          birthday: string
          interests: string[]
          is_private: boolean
          new_version_enabled: boolean
          new_version_seen_at: string
          username: string
        }[]
      }
      get_profile: { Args: { target: string }; Returns: Json }
      get_usernames: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          username: string
        }[]
      }
      get_visible_follow_profile_stats: {
        Args: { target: string; viewer: string }
        Returns: Json
      }
      increment_badge_counts: {
        Args: { _user_ids: string[] }
        Returns: {
          count: number
          user_id: string
        }[]
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_new_version_user: { Args: { _user_id: string }; Returns: boolean }
      is_profile_username_available: {
        Args: { candidate: string }
        Returns: boolean
      }
      leave_crew: { Args: { _group_id: string }; Returns: undefined }
      list_profile_follows: {
        Args: {
          direction: string
          page_offset?: number
          page_size?: number
          target: string
        }
        Returns: {
          avatar: string
          first_name: string
          id: string
          username: string
        }[]
      }
      lock_follow_pair: { Args: { _a: string; _b: string }; Returns: undefined }
      manage_redesign_crew: {
        Args: { _action: string; _group_id: string; _member_id: string }
        Returns: undefined
      }
      merge_solo_into_partner: {
        Args: { _solo: string; _target: string; _user: string }
        Returns: undefined
      }
      plan_tags_for_check_ins: {
        Args: { _check_in_ids: string[] }
        Returns: {
          check_in_id: string
          day_number: number
          plan_name: string
          plan_slug: string
          week: number
        }[]
      }
      post_health_check_in: {
        Args: {
          _activity: string
          _date: string
          _groups: string[]
          _health: Json
          _mood: string
          _note: string
          _photo: string
        }
        Returns: {
          check_in_id: string
          crew_id: string
        }[]
      }
      remove_follower: { Args: { follower: string }; Returns: undefined }
      request_crew_join: { Args: { _group_id: string }; Returns: Json }
      respond_follow_request: {
        Args: { accept: boolean; follower: string }
        Returns: Json
      }
      review_content_report: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      safety_blocked_pairs: {
        Args: { _user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      safety_pair_blocked: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      safety_visible: { Args: { _author: string }; Returns: boolean }
      set_profile_privacy: { Args: { private: boolean }; Returns: undefined }
      shares_active_crew_with: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      shares_group_with: { Args: { _a: string; _b: string }; Returns: boolean }
      start_next_pact: {
        Args: {
          _days_per_week: number
          _duration_days: number
          _group_id: string
          _start: string
        }
        Returns: string
      }
      submit_content_report: {
        Args: {
          _block: boolean
          _details: string
          _group: string
          _reason: string
          _reported: string
          _target: string
          _type: string
        }
        Returns: undefined
      }
      unfollow_user: { Args: { target: string }; Returns: undefined }
      workout_detail_for_check_in: {
        Args: { _check_in_id: string }
        Returns: Json
      }
      workout_summaries_for_check_ins: {
        Args: { _check_in_ids: string[] }
        Returns: {
          check_in_id: string
          session_id: string
          summary: Json
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

