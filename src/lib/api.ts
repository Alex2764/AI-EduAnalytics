/**
 * API helper for backend API calls
 */

import { getResponseErrorMessage, isBackendConnectionError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';

// Backend API base URL - defaults to localhost:8000
// To override, set VITE_API_BASE_URL in .env file
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Handle fetch response errors consistently
 */
async function handleFetchError(response: Response, defaultMessage: string): Promise<never> {
  const errorMessage = await getResponseErrorMessage(response, defaultMessage);
  logger.error(`API error (${response.status}):`, errorMessage);
  throw new Error(errorMessage);
}

export interface TemplateInfo {
  name: string;
  is_default: boolean;
  size: number;
}

export interface AISettings {
  teacher_name?: string | null;
  subject?: string | null;
  temperature?: number;
  max_output_tokens?: number;
}

export interface DefaultTemplateResponse {
  default_template: string;
  exists: boolean;
  path: string | null;
}

// ════════════════════════════════════════════════════════
// TEMPLATE MANAGEMENT
// ════════════════════════════════════════════════════════

export const templateAPI = {
  /**
   * Get list of available templates
   */
  async getTemplates(): Promise<TemplateInfo[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await handleFetchError(response, 'Грешка при зареждане на шаблони');
      }

      return response.json();
    } catch (error) {
      // Re-throw network errors with better message
      if (error instanceof Error && isBackendConnectionError(error.message)) {
        throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
      }
      throw error;
    }
  },

  /**
   * Upload a new template
   */
  async uploadTemplate(file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/templates/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        await handleFetchError(response, 'Грешка при качване на шаблон');
      }
    } catch (error) {
      if (error instanceof Error && isBackendConnectionError(error.message)) {
        throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
      }
      throw error;
    }
  },

  // Removed setDefaultTemplate - no longer using default template concept

  /**
   * Delete a template
   */
  async deleteTemplate(templateName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/${encodeURIComponent(templateName)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await handleFetchError(response, 'Грешка при изтриване на шаблон');
      }
    } catch (error) {
      if (error instanceof Error && isBackendConnectionError(error.message)) {
        throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
      }
      throw error;
    }
  },
};

// ════════════════════════════════════════════════════════
// AI SETTINGS
// ════════════════════════════════════════════════════════

export const aiSettingsAPI = {
  /**
   * Get AI settings
   */
  async getAISettings(): Promise<AISettings> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await handleFetchError(response, 'Грешка при зареждане на AI настройки');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && isBackendConnectionError(error.message)) {
        throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
      }
      throw error;
    }
  },

  /**
   * Update AI settings
   */
  async updateAISettings(settings: Partial<AISettings>): Promise<AISettings> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        await handleFetchError(response, 'Грешка при запазване на AI настройки');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && isBackendConnectionError(error.message)) {
        throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
      }
      throw error;
    }
  },
};

/**
 * Generate AI-powered test analysis report
 */
export interface GenerateReportParams {
  testId: string;
  classId: string;
  teacherName?: string;
}

/**
 * Generate and download AI analysis report
 * @param params Report generation parameters
 * @returns Promise that resolves when download starts
 */
export async function generateReport(params: GenerateReportParams): Promise<void> {
  const { testId, classId, teacherName } = params;

  const requestBody = {
    test_id: testId,
    class_id: classId,
    teacher_name: teacherName || null,
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

  if (!response.ok) {
    // Handle 404 errors for missing templates with user-friendly message
    if (response.status === 404) {
      const errorMessage = await getResponseErrorMessage(response, 'Грешка при генериране на анализ');
      if (errorMessage.includes('No templates available') || errorMessage.includes('not found') || errorMessage.includes('No templates')) {
        throw new Error('Няма налични шаблони. Моля, качете шаблон от AI Settings преди да генерирате анализ.');
      }
    }
    
    await handleFetchError(response, 'Грешка при генериране на анализ');
  }

  // Get the filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'Analiz_Report.docx';
  
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  // Convert response to blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  } catch (error) {
    // Re-throw network errors with better message
    if (error instanceof Error && isBackendConnectionError(error.message)) {
      throw new Error('Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.');
    }
    throw error;
  }
}

