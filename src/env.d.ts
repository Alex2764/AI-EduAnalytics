/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 * 
 * This file provides type safety for import.meta.env variables.
 * All environment variables must be prefixed with VITE_ to be exposed to the client.
 */

interface ImportMetaEnv {
  /**
   * Supabase project URL
   * @example https://xxxxx.supabase.co
   */
  readonly VITE_SUPABASE_URL: string;

  /**
   * Supabase anonymous/public key
   * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   */
  readonly VITE_SUPABASE_ANON_KEY: string;

  /**
   * Backend API base URL
   * @default http://localhost:8000
   * @example http://localhost:8000
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

