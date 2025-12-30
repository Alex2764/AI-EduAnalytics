/**
 * Database types for Supabase
 * 
 * This file contains TypeScript types for the Supabase database schema.
 * These types provide type safety when using Supabase client.
 * 
 * To regenerate these types from your Supabase database, run:
 * npx supabase gen types typescript --project-id "your-project-id" > src/types/database.types.ts
 */

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
      classes: {
        Row: {
          id: string
          name: string
          school_year: string
          created_date: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          school_year: string
          created_date?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          school_year?: string
          created_date?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      students: {
        Row: {
          id: string
          first_name: string
          middle_name: string | null
          last_name: string
          class_id: string | null
          class_name: string
          number: number
          gender: 'male' | 'female' | 'М' | 'Ж' | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          first_name: string
          middle_name?: string | null
          last_name: string
          class_id?: string | null
          class_name: string
          number: number
          gender?: 'male' | 'female' | 'М' | 'Ж' | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string
          middle_name?: string | null
          last_name?: string
          class_id?: string | null
          class_name?: string
          number?: number
          gender?: 'male' | 'female' | 'М' | 'Ж' | null
          created_at?: string
          updated_at?: string | null
        }
      }
      tests: {
        Row: {
          id: string
          name: string
          class_id: string | null
          class_name: string
          type: string
          date: string
          max_points: number
          grade_scale: Json | null
          questions: Json | null
          subject: string | null
          teacher_name: string | null
          total_questions: number | null
          mc_questions: number | null
          short_questions: number | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          class_id?: string | null
          class_name: string
          type: string
          date: string
          max_points: number
          grade_scale?: Json | null
          questions?: Json | null
          subject?: string | null
          teacher_name?: string | null
          total_questions?: number | null
          mc_questions?: number | null
          short_questions?: number | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          class_id?: string | null
          class_name?: string
          type?: string
          date?: string
          max_points?: number
          grade_scale?: Json | null
          questions?: Json | null
          subject?: string | null
          teacher_name?: string | null
          total_questions?: number | null
          mc_questions?: number | null
          short_questions?: number | null
          created_at?: string
          updated_at?: string | null
        }
      }
      results: {
        Row: {
          id: string
          student_id: string
          test_id: string
          points: number
          grade: number | string
          percentage: number
          date_added: string
          participated: boolean
          cancelled: boolean
          cancel_reason: string | null
          question_results: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          test_id: string
          points: number
          grade: number | string
          percentage: number
          date_added: string
          participated?: boolean
          cancelled?: boolean
          cancel_reason?: string | null
          question_results?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          test_id?: string
          points?: number
          grade?: number | string
          percentage?: number
          date_added?: string
          participated?: boolean
          cancelled?: boolean
          cancel_reason?: string | null
          question_results?: Json | null
          created_at?: string
          updated_at?: string | null
        }
      }
      test_analytics: {
        Row: {
          id: string
          test_id: string
          statistics: Json | null
          question_success_rates: Json | null
          ai_analysis: Json | null
          calculated_at: string | null
          updated_at: string | null
          ai_generated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          test_id: string
          statistics?: Json | null
          question_success_rates?: Json | null
          ai_analysis?: Json | null
          calculated_at?: string | null
          updated_at?: string | null
          ai_generated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          test_id?: string
          statistics?: Json | null
          question_success_rates?: Json | null
          ai_analysis?: Json | null
          calculated_at?: string | null
          updated_at?: string | null
          ai_generated_at?: string | null
          created_at?: string
        }
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
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update']

// Specific table types
export type ClassRow = Tables<'classes'>
export type StudentRow = Tables<'students'>
export type TestRow = Tables<'tests'>
export type ResultRow = Tables<'results'>
export type TestAnalyticsRow = Tables<'test_analytics'>

