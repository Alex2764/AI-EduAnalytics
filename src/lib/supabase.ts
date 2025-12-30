import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Type-safe environment variables
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create typed Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Export helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> = 
  Database['public']['Enums'][T]

