import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { templateAPI, aiSettingsAPI, type TemplateInfo, type AISettings } from '../../lib/api';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // AI Settings state
  const [teacherName, setTeacherName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Load AI settings function
  const loadAISettings = useCallback(async () => {
    try {
      const settings = await aiSettingsAPI.getAISettings();
      setTeacherName(settings.teacher_name || '');
      setSubject(settings.subject || '');
    } catch (err: any) {
      console.error('Error loading AI settings:', err);
      // Don't show error for loading - settings might not exist yet
    }
  }, []);

  // Load templates function
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await templateAPI.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Грешка при зареждане на шаблони');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load templates and AI settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadAISettings();
    }
  }, [isOpen, loadTemplates, loadAISettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError(null);
    setSuccess(null);

    try {
      await aiSettingsAPI.updateAISettings({
        teacher_name: teacherName.trim() || null,
        subject: subject.trim() || null,
      });
      setSuccess('AI настройките са запазени успешно!');
    } catch (err: any) {
      setError(err.message || 'Грешка при запазване на настройки');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.docx')) {
        setError('Само .docx файлове са разрешени!');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Файлът е твърде голям! Максимум 10MB.');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Моля изберете файл!');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await templateAPI.uploadTemplate(selectedFile);
      setSuccess(`Шаблонът "${selectedFile.name}" е качен успешно!`);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('template-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Грешка при качване на шаблон');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (templateName: string) => {
    const confirmed = window.confirm(`Сигурни ли сте, че искате да изтриете шаблона "${templateName}"?`);
    
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await templateAPI.deleteTemplate(templateName);
      setSuccess(`Шаблонът "${templateName}" е изтрит успешно!`);
      await loadTemplates();
    } catch (err: any) {
      console.error('❌ Delete error:', err);
      setError(err.message || 'Грешка при изтриване на шаблон');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Settings - Управление на шаблони" size="xl">
      <div className="space-y-6 p-4">
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* AI Settings Section */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold mb-3">AI Настройки</h3>
          <div className="space-y-4">
            <Input
              label="Име на преподавател (за използване от AI)"
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Напр: Александър Георгиев"
            />
            <Input
              label="Предмет (за използване от AI)"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Напр: Математика, Информатика"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary"
              >
                {savingSettings ? 'Запазване...' : 'Запази настройки'}
              </Button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">ℹ️ Защо тези полета?</p>
              <p>AI използва това име на преподавател и предмет, когато не са предоставени в конкретния тест или клас. Тези стойности се използват като резервни по време на генериране на анализ.</p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold mb-3">Качи нов шаблон</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="template-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Избери Word документ (.docx)
              </label>
              <input
                id="template-upload"
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploading}
              />
              {selectedFile && (
                <div className="mt-2 text-sm text-gray-600">
                  Избран файл: <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
                </div>
              )}
            </div>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="btn-success"
            >
              {uploading ? 'Качване...' : 'Качи шаблон'}
            </Button>
          </div>
        </div>

        {/* Templates List */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Налични шаблони</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Зареждане...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Няма налични шаблони</div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.name}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{template.name}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Размер: {formatFileSize(template.size)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleDelete(template.name)}
                        variant="danger"
                        className="text-sm"
                        title={`Изтрий шаблон: ${template.name}`}
                      >
                        Изтрий
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-semibold mb-2">ℹ️ Информация:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Последно каченият шаблон се използва автоматично за генериране на анализи</li>
            <li>Шаблоните трябва да са Word документи (.docx) с максимален размер 10MB</li>
            <li>Шаблонът трябва да съдържа {'{{variable}}'} placeholders за да работи правилно</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

