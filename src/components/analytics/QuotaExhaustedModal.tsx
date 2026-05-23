import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface QuotaExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gemini API лимит" size="sm">
      <div className="p-6 text-center space-y-4">
        <p className="text-lg font-semibold text-gray-900">
          Лимитът е изчерпан. Опитай пак, утре!
        </p>
        <p className="text-sm text-gray-600">
          Всички Gemini ключове са използвани за днес. Квотата обикновено се възстановява утре.
        </p>
        <p className="text-sm text-gray-600">
          Алтернатива: добавете <strong>GROQ_API_KEY</strong> в{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">backend/.env</code> (безплатен ключ от{' '}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
          >
            console.groq.com
          </a>
          ), рестартирайте backend — анализът ще минава през Groq, а Gemini само ще редактира (по-малко
          квота).
        </p>
        <Button onClick={onClose} className="btn-primary w-full">
          Разбрах
        </Button>
      </div>
    </Modal>
  );
};
