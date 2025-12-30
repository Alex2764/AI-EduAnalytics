/**
 * Environment variables validation
 * 
 * Validates that all required environment variables are set on application startup.
 * Throws an error if any required variables are missing.
 */

import { logger } from '@/utils/logger';

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  VITE_API_BASE_URL: 'http://localhost:8000',
} as const;

/**
 * Validate that all required environment variables are set
 * 
 * @throws {Error} If any required environment variables are missing
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of REQUIRED_ENV_VARS) {
    const value = import.meta.env[key];
    
    if (!value || value.trim() === '') {
      missing.push(key);
    } else {
      // Basic validation for specific variables
      if (key === 'VITE_SUPABASE_URL' && !value.startsWith('http')) {
        warnings.push(`${key} should be a valid URL starting with http:// or https://`);
      }
      
      if (key === 'VITE_SUPABASE_ANON_KEY' && value.length < 20) {
        warnings.push(`${key} appears to be invalid (too short)`);
      }
    }
  }

  // Check optional variables and log warnings
  for (const [key, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = import.meta.env[key];
    
    if (!value) {
      logger.warn(`Optional environment variable ${key} is not set, using default: ${defaultValue}`);
    }
  }

  // Throw error if required variables are missing
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}\n\n` +
      `Please set these variables in your .env file or environment.\n` +
      `Required variables:\n` +
      missing.map(key => `  - ${key}`).join('\n');
    
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Log warnings if any
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning));
  }

  // Log success in development
  if (import.meta.env.DEV) {
    logger.info('Environment variables validated successfully');
    logger.debug('Required variables:', REQUIRED_ENV_VARS);
    logger.debug('Optional variables:', Object.keys(OPTIONAL_ENV_VARS));
  }
}

/**
 * Get environment variable with optional default
 * 
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = import.meta.env[key];
  
  if (!value && defaultValue) {
    return defaultValue;
  }
  
  if (!value) {
    throw new Error(`Environment variable ${key} is not set and no default provided`);
  }
  
  return value;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

