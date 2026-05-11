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
      bookings: {
        Row: {
          booked_at: string
          cancelled_at: string | null
          id: string
          iso_week: string
          notes: string | null
          reschedule_count_iso_week: number
          rescheduled_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        Insert: {
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          iso_week: string
          notes?: string | null
          reschedule_count_iso_week?: number
          rescheduled_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        Update: {
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          iso_week?: string
          notes?: string | null
          reschedule_count_iso_week?: number
          rescheduled_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          color: string | null
          created_at: string
          default_duration_min: number
          description_en: string | null
          description_ro: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_ro: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_duration_min?: number
          description_en?: string | null
          description_ro?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ro: string
        }
        Update: {
          color?: string | null
          created_at?: string
          default_duration_min?: number
          description_en?: string | null
          description_ro?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ro?: string
        }
        Relationships: []
      }
      dietary_questionnaires: {
        Row: {
          additional_notes: string | null
          egg_allergy: boolean
          exclude_alcohol: boolean
          exclude_beef: boolean
          exclude_caffeine: boolean
          exclude_dairy: boolean
          exclude_eggs: boolean
          exclude_gluten: boolean
          exclude_nuts: boolean
          exclude_pork: boolean
          exclude_poultry: boolean
          exclude_processed_foods: boolean
          exclude_seafood: boolean
          exclude_soy: boolean
          exclude_sugar: boolean
          fish_allergy: boolean
          gluten_intolerance: boolean
          high_protein: boolean
          keto: boolean
          lactose_intolerance: boolean
          low_carb: boolean
          low_fat: boolean
          nut_allergy: boolean
          paleo: boolean
          pescatarian: boolean
          shellfish_allergy: boolean
          soy_allergy: boolean
          updated_at: string
          user_id: string
          vegan: boolean
          vegetarian: boolean
        }
        Insert: {
          additional_notes?: string | null
          egg_allergy?: boolean
          exclude_alcohol?: boolean
          exclude_beef?: boolean
          exclude_caffeine?: boolean
          exclude_dairy?: boolean
          exclude_eggs?: boolean
          exclude_gluten?: boolean
          exclude_nuts?: boolean
          exclude_pork?: boolean
          exclude_poultry?: boolean
          exclude_processed_foods?: boolean
          exclude_seafood?: boolean
          exclude_soy?: boolean
          exclude_sugar?: boolean
          fish_allergy?: boolean
          gluten_intolerance?: boolean
          high_protein?: boolean
          keto?: boolean
          lactose_intolerance?: boolean
          low_carb?: boolean
          low_fat?: boolean
          nut_allergy?: boolean
          paleo?: boolean
          pescatarian?: boolean
          shellfish_allergy?: boolean
          soy_allergy?: boolean
          updated_at?: string
          user_id: string
          vegan?: boolean
          vegetarian?: boolean
        }
        Update: {
          additional_notes?: string | null
          egg_allergy?: boolean
          exclude_alcohol?: boolean
          exclude_beef?: boolean
          exclude_caffeine?: boolean
          exclude_dairy?: boolean
          exclude_eggs?: boolean
          exclude_gluten?: boolean
          exclude_nuts?: boolean
          exclude_pork?: boolean
          exclude_poultry?: boolean
          exclude_processed_foods?: boolean
          exclude_seafood?: boolean
          exclude_soy?: boolean
          exclude_sugar?: boolean
          fish_allergy?: boolean
          gluten_intolerance?: boolean
          high_protein?: boolean
          keto?: boolean
          lactose_intolerance?: boolean
          low_carb?: boolean
          low_fat?: boolean
          nut_allergy?: boolean
          paleo?: boolean
          pescatarian?: boolean
          shellfish_allergy?: boolean
          soy_allergy?: boolean
          updated_at?: string
          user_id?: string
          vegan?: boolean
          vegetarian?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dietary_questionnaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          resend_id: string | null
          status: string
          subject: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freeze_periods: {
        Row: {
          created_at: string
          duration_days: number | null
          end_date: string
          id: string
          plan_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          end_date: string
          id?: string
          plan_id: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          end_date?: string
          id?: string
          plan_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freeze_periods_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freeze_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_document: {
        Row: {
          body_md: string
          created_at: string
          id: string
          is_current: boolean
          version: string
        }
        Insert: {
          body_md: string
          created_at?: string
          id?: string
          is_current?: boolean
          version: string
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          is_current?: boolean
          version?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          body_md: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          logged_on: string
          note: string | null
          protein_g: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          logged_on: string
          note?: string | null
          protein_g?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          logged_on?: string
          note?: string | null
          protein_g?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          preferred_payment_method:
            | Database["public"]["Enums"]["payment_method"]
            | null
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["plan_request_status"]
          tier_id: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["plan_request_status"]
          tier_id: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["plan_request_status"]
          tier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "plan_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_tiers: {
        Row: {
          category: string
          code: string
          created_at: string
          display_order: number
          duration_months: number
          id: string
          is_active: boolean
          name_en: string | null
          name_ro: string
          price_female_ron: number
          price_male_ron: number
          price_ron: number | null
          sessions_per_month: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          display_order?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ro: string
          price_female_ron: number
          price_male_ron: number
          price_ron?: number | null
          sessions_per_month: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          display_order?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ro?: string
          price_female_ron?: number
          price_male_ron?: number
          price_ron?: number | null
          sessions_per_month?: number
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sessions_total: number
          sessions_used: number
          start_date: string
          tier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sessions_total: number
          sessions_used?: number
          start_date: string
          tier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sessions_total?: number
          sessions_used?: number
          start_date?: string
          tier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "plan_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          full_name: string | null
          gdpr_consented_at: string | null
          gdpr_version: string | null
          id: string
          locale: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          sex: string | null
          tdee_activity: string | null
          tdee_age: number | null
          tdee_height_cm: number | null
          tdee_value: number | null
          trainer: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string | null
          gdpr_consented_at?: string | null
          gdpr_version?: string | null
          id: string
          locale?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sex?: string | null
          tdee_activity?: string | null
          tdee_age?: number | null
          tdee_height_cm?: number | null
          tdee_value?: number | null
          trainer?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string | null
          gdpr_consented_at?: string | null
          gdpr_version?: string | null
          id?: string
          locale?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sex?: string | null
          tdee_activity?: string | null
          tdee_age?: number | null
          tdee_height_cm?: number | null
          tdee_value?: number | null
          trainer?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          back_path: string | null
          created_at: string
          front_path: string | null
          id: string
          note: string | null
          side_path: string | null
          taken_on: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          back_path?: string | null
          created_at?: string
          front_path?: string | null
          id?: string
          note?: string | null
          side_path?: string | null
          taken_on: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          back_path?: string | null
          created_at?: string
          front_path?: string | null
          id?: string
          note?: string | null
          side_path?: string | null
          taken_on?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bookings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          schedule_template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          schedule_template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          schedule_template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "schedule_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_template: {
        Row: {
          capacity: number
          class_id: string | null
          day_of_week: number
          duration_min: number
          id: string
          is_enabled: boolean
          start_hour: number
          start_minute: number
          trainer: string | null
        }
        Insert: {
          capacity?: number
          class_id?: string | null
          day_of_week: number
          duration_min?: number
          id?: string
          is_enabled?: boolean
          start_hour: number
          start_minute?: number
          trainer?: string | null
        }
        Update: {
          capacity?: number
          class_id?: string | null
          day_of_week?: number
          duration_min?: number
          id?: string
          is_enabled?: boolean
          start_hour?: number
          start_minute?: number
          trainer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          booked_count: number
          capacity: number
          class_id: string | null
          created_at: string
          end_at: string
          id: string
          session_date: string
          start_at: string
          trainer: string | null
          unlock_at: string
        }
        Insert: {
          booked_count?: number
          capacity: number
          class_id?: string | null
          created_at?: string
          end_at: string
          id?: string
          session_date: string
          start_at: string
          trainer?: string | null
          unlock_at: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          class_id?: string | null
          created_at?: string
          end_at?: string
          id?: string
          session_date?: string
          start_at?: string
          trainer?: string | null
          unlock_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_on: string
          note: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_on: string
          note?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_on?: string
          note?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_plan_request: {
        Args: {
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_request_id: string
          p_start_date?: string
        }
        Returns: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sessions_total: number
          sessions_used: number
          start_date: string
          tier_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_session: {
        Args: { p_session_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          id: string
          iso_week: string
          notes: string | null
          reschedule_count_iso_week: number
          rescheduled_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_session_for: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          id: string
          iso_week: string
          notes: string | null
          reschedule_count_iso_week: number
          rescheduled_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          id: string
          iso_week: string
          notes: string | null
          reschedule_count_iso_week: number
          rescheduled_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      freeze_membership: {
        Args: { p_duration_days: number; p_start_date: string }
        Returns: {
          created_at: string
          duration_days: number | null
          end_date: string
          id: string
          plan_id: string
          start_date: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "freeze_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      reschedule_booking: {
        Args: { p_booking_id: string; p_new_session_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          id: string
          iso_week: string
          notes: string | null
          reschedule_count_iso_week: number
          rescheduled_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      weekly_change_count: { Args: { p_user_id: string }; Returns: number }
    }
    Enums: {
      booking_status: "booked" | "cancelled" | "completed" | "no_show"
      payment_method: "bank_transfer" | "pos" | "cash"
      plan_request_status: "pending" | "approved" | "rejected" | "cancelled"
      user_role: "member" | "admin"
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
      booking_status: ["booked", "cancelled", "completed", "no_show"],
      payment_method: ["bank_transfer", "pos", "cash"],
      plan_request_status: ["pending", "approved", "rejected", "cancelled"],
      user_role: ["member", "admin"],
    },
  },
} as const
