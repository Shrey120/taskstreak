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
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          updated_at: string | null
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string
          endpoint: string
          id: string
          p256dh: string
          tz_offset_minutes: number | null
          updated_at: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_id: string
          endpoint: string
          id?: string
          p256dh: string
          tz_offset_minutes?: number | null
          updated_at?: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          tz_offset_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sent_reminders: {
        Row: {
          created_at: string
          device_id: string
          id: string
          reminder_date: string
          reminder_type: string
          task_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          reminder_date: string
          reminder_type?: string
          task_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          reminder_date?: string
          reminder_type?: string
          task_id?: string
        }
        Relationships: []
      }
      subtask_completions: {
        Row: {
          completed_date: string
          created_at: string
          device_id: string
          id: string
          subtask_id: string
          task_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          device_id: string
          id?: string
          subtask_id: string
          task_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          device_id?: string
          id?: string
          subtask_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtask_completions_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtask_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          is_completed: boolean
          name: string
          scheduled_time: string | null
          task_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          is_completed?: boolean
          name: string
          scheduled_time?: string | null
          task_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          is_completed?: boolean
          name?: string
          scheduled_time?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          amount_earned: number
          completed_date: string
          created_at: string | null
          device_id: string
          id: string
          streak_bonus: boolean | null
          task_id: string
        }
        Insert: {
          amount_earned: number
          completed_date: string
          created_at?: string | null
          device_id: string
          id?: string
          streak_bonus?: boolean | null
          task_id: string
        }
        Update: {
          amount_earned?: number
          completed_date?: string
          created_at?: string | null
          device_id?: string
          id?: string
          streak_bonus?: boolean | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          amount: number
          base_amount: number
          created_at: string | null
          current_streak: number | null
          device_id: string
          difficulty: number
          frequency_type: string
          frequency_value: Json
          id: string
          is_hourly: boolean
          name: string
          per_minute_rate: number
          scheduled_time: string | null
          start_date: string
          streaks_completed: number
          trait: string
          traits: string[]
        }
        Insert: {
          amount: number
          base_amount?: number
          created_at?: string | null
          current_streak?: number | null
          device_id: string
          difficulty: number
          frequency_type: string
          frequency_value: Json
          id?: string
          is_hourly?: boolean
          name: string
          per_minute_rate?: number
          scheduled_time?: string | null
          start_date?: string
          streaks_completed?: number
          trait?: string
          traits?: string[]
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string | null
          current_streak?: number | null
          device_id?: string
          difficulty?: number
          frequency_type?: string
          frequency_value?: Json
          id?: string
          is_hourly?: boolean
          name?: string
          per_minute_rate?: number
          scheduled_time?: string | null
          start_date?: string
          streaks_completed?: number
          trait?: string
          traits?: string[]
        }
        Relationships: []
      }
      trait_xp: {
        Row: {
          device_id: string
          id: string
          total_xp: number
          trait: string
          updated_at: string
        }
        Insert: {
          device_id: string
          id?: string
          total_xp?: number
          trait: string
          updated_at?: string
        }
        Update: {
          device_id?: string
          id?: string
          total_xp?: number
          trait?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          username: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          device_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          device_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          device_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      withdraw_history: {
        Row: {
          amount: number
          created_at: string
          device_id: string
          id: string
          reason: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          device_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          device_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          device_id: string
          event_date: string
          id: string
          reason: string
          task_id: string | null
          trait: string
        }
        Insert: {
          amount: number
          created_at?: string
          device_id: string
          event_date: string
          id?: string
          reason: string
          task_id?: string | null
          trait: string
        }
        Update: {
          amount?: number
          created_at?: string
          device_id?: string
          event_date?: string
          id?: string
          reason?: string
          task_id?: string | null
          trait?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
