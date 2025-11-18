/**
 * API helper for backend API calls
 */

// Backend API base URL - defaults to localhost:8000
// To override, set VITE_API_BASE_URL in .env file
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
    const response = await fetch(`${API_BASE_URL}/api/templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to fetch templates');
    }

    return response.json();
  },

  /**
   * Upload a new template
   */
  async uploadTemplate(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/templates/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to upload template');
    }
  },

  // Removed setDefaultTemplate - no longer using default template concept

  /**
   * Delete a template
   */
  async deleteTemplate(templateName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/templates/${encodeURIComponent(templateName)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to delete template');
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
    const response = await fetch(`${API_BASE_URL}/api/ai-settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to fetch AI settings');
    }

    return response.json();
  },

  /**
   * Update AI settings
   */
  async updateAISettings(settings: Partial<AISettings>): Promise<AISettings> {
    const response = await fetch(`${API_BASE_URL}/api/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to update AI settings');
    }

    return response.json();
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
    let errorMessage = `Failed to generate report: ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch (parseError) {
      errorMessage = `Failed to generate report: ${response.status} ${response.statusText}`;
    }
    
    if (response.status === 404 && errorMessage.includes('No templates available')) {
      errorMessage = 'Няма налични шаблони. Моля, качете шаблон от AI Settings преди да генерирате анализ.';
    } else if (response.status === 404 && (errorMessage.includes('not found') || errorMessage.includes('No templates'))) {
      errorMessage = 'Шаблонът не е намерен. Моля, качете шаблон от AI Settings.';
    }
    
    throw new Error(errorMessage);
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
  } catch (fetchError) {
    throw fetchError;
  }
}

