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
      check_ins: {
        Row: {
          activity: string | null
          checkin_date: string
          created_at: string
          group_id: string
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
          platform: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          ip_hash: string
          platform: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          ip_hash?: string
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
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
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
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          image_url?: string | null
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
        ]
      }
      groups: {
        Row: {
          created_at: string
          days_per_week: number
          duration_days: number
          emoji: string
          frequency: string
          goal: string | null
          id: string
          name: string
          owner_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          days_per_week?: number
          duration_days?: number
          emoji?: string
          frequency?: string
          goal?: string | null
          id?: string
          name: string
          owner_id: string
          start_date?: string
        }
        Update: {
          created_at?: string
          days_per_week?: number
          duration_days?: number
          emoji?: string
          frequency?: string
          goal?: string | null
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          daily_reminder_enabled: boolean
          daily_reminder_time: string
          email_enabled: boolean
          group_activity_enabled: boolean
          morning_ritual_reminder_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          email_enabled?: boolean
          group_activity_enabled?: boolean
          morning_ritual_reminder_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          email_enabled?: boolean
          group_activity_enabled?: boolean
          morning_ritual_reminder_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
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
          avatar_color: string
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          streak_freezes_available: number
          timezone: string
        }
        Insert: {
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string
          streak_freezes_available?: number
          timezone?: string
        }
        Update: {
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          streak_freezes_available?: number
          timezone?: string
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
      streak_freezes_used: {
        Row: {
          created_at: string
          freeze_date: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          freeze_date: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          freeze_date?: string
          group_id?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      shares_group_with: { Args: { _a: string; _b: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
