/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          timezone: string
          onboarding_completed: boolean
          is_admin?: boolean
          push_enabled: boolean
          in_app_feed_enabled: boolean
          night_suppression_enabled: boolean
          suppression_start: string
          suppression_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          timezone?: string
          onboarding_completed?: boolean
          is_admin?: boolean
          push_enabled?: boolean
          in_app_feed_enabled?: boolean
          night_suppression_enabled?: boolean
          suppression_start?: string
          suppression_end?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          timezone?: string
          onboarding_completed?: boolean
          is_admin?: boolean
          push_enabled?: boolean
          in_app_feed_enabled?: boolean
          night_suppression_enabled?: boolean
          suppression_start?: string
          suppression_end?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      babies: {
        Row: {
          id: string
          profile_id: string
          name: string
          date_of_birth: string
          biggest_issue?: string | null
          feeding_type?: string | null
          bedtime_range?: string | null
          ai_memory?: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          date_of_birth: string
          biggest_issue?: string | null
          feeding_type?: string | null
          bedtime_range?: string | null
          ai_memory?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          date_of_birth?: string
          biggest_issue?: string | null
          feeding_type?: string | null
          bedtime_range?: string | null
          ai_memory?: string | null
          created_at?: string
        }
        Relationships: []
      }
      baby_shares: {
        Row: {
          id: string
          baby_id: string
          profile_id?: string | null
          email: string
          access_role: string
          status: string
          invite_token_hash?: string | null
          invite_expires_at?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          profile_id?: string | null
          email: string
          access_role?: string
          status?: string
          invite_token_hash?: string | null
          invite_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          baby_id?: string
          profile_id?: string | null
          email?: string
          access_role?: string
          status?: string
          invite_token_hash?: string | null
          invite_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_preferences: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      sleep_logs: {
        Row: {
          id: string
          baby_id: string
          logged_by: string | null
          started_at: string
          ended_at: string | null
          is_night: boolean
          notes: string | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          logged_by?: string | null
          started_at: string
          ended_at?: string | null
          is_night?: boolean
          notes?: string | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          baby_id?: string
          logged_by?: string | null
          started_at?: string
          ended_at?: string | null
          is_night?: boolean
          notes?: string | null
          tags?: string[]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      daily_plans: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      sleep_plan_profiles: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      sleep_plan_change_events: {
        Row: {
          id: string
          baby_id: string
          sleep_plan_profile_id: string
          plan_date?: string | null
          change_scope: string
          change_source: string
          change_kind: string
          evidence_confidence: string
          summary: string
          rationale?: string | null
          before_snapshot: any
          after_snapshot: any
          created_at: string
        }
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          profile_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string
          price_id: string | null
          plan?: string | null
          is_trial?: boolean | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status: string
          price_id?: string | null
          plan?: string | null
          is_trial?: boolean | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          price_id?: string | null
          plan?: string | null
          is_trial?: boolean | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          profile_id: string | null
          email: string | null
          category: string
          message: string
          origin_page: string | null
          support_page?: string | null
          user_agent?: string | null
          status: string
          created_at: string
          updated_at?: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          email?: string | null
          category: string
          message: string
          origin_page?: string | null
          support_page?: string | null
          user_agent?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          email?: string | null
          category?: string
          message?: string
          origin_page?: string | null
          support_page?: string | null
          user_agent?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          profile_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          id: string
          profile_id: string
          title: string
          body: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          title: string
          body: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          title?: string
          body?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          id: string
          profile_id: string
          usage_date: string
          message_count: number
          last_incremented_at: string
          created_at: string
          updated_at: string
        }
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      notification_feed: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      notifications: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      caregiver_invitations: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      caregiver_shares: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
      messages: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: []
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
        Relationships: any[]
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, any>
        Returns: any
      }
    }
    Enums: {
      [key: string]: any
    }
    CompositeTypes: {
      [key: string]: any
    }
  }
}
