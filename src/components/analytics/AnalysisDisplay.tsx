import React, { useState } from 'react';

interface AnalysisData {
  lowest_results_analysis: string;
  highest_results_analysis: string;
  gaps_analysis: string;
  results_analysis: string;
  improvement_measures: string;
}

interface AnalysisDisplayProps {
  analysis: AnalysisData;
}

interface SectionConfig {
  key: keyof AnalysisData;
  title: string;
  icon?: string;
  color?: string;
}

const sections: SectionConfig[] = [
  {
    key: 'lowest_results_analysis',
    title: 'Анализ на най-ниски резултати',
    icon: '📉',
    color: 'orange',
  },
  {
    key: 'highest_results_analysis',
    title: 'Анализ на най-високи резултати',
    icon: '📈',
    color: 'green',
  },
  {
    key: 'gaps_analysis',
    title: 'Анализ на пропуски в знанията',
    icon: '🔍',
    color: 'blue',
  },
  {
    key: 'results_analysis',
    title: 'Анализ на резултатите',
    icon: '📊',
    color: 'purple',
  },
  {
    key: 'improvement_measures',
    title: 'Мерки за подобрение',
    icon: '💡',
    color: 'teal',
  },
];

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis }) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Грешка при копиране:', err);
    }
  };

  const getColorClasses = (color: string = 'blue') => {
    const colors: Record<string, { bg: string; border: string; iconBg: string; text: string }> = {
      orange: {
        bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
        border: 'border-orange-200',
        iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
        text: 'text-orange-900',
      },
      green: {
        bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
        border: 'border-green-200',
        iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
        text: 'text-green-900',
      },
      blue: {
        bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
        border: 'border-blue-200',
        iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
        text: 'text-blue-900',
      },
      purple: {
        bg: 'bg-gradient-to-br from-purple-50 to-indigo-50',
        border: 'border-purple-200',
        iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
        text: 'text-purple-900',
      },
      teal: {
        bg: 'bg-gradient-to-br from-teal-50 to-cyan-50',
        border: 'border-teal-200',
        iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
        text: 'text-teal-900',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="ai-analysis-sections-grid">
      {sections.map((section, index) => {
        const text = analysis[section.key];
        const isLast = index === sections.length - 1;
        const isCopied = copiedStates[section.key] || false;
        const colorClasses = getColorClasses(section.color);

        return (
          <div
            key={section.key}
            className={`ai-analysis-section-card ${colorClasses.bg} ${colorClasses.border} ${isLast ? 'ai-analysis-section-card-full' : ''}`}
          >
            {/* Header with icon, title and copy button */}
            <div className="ai-analysis-section-header">
              <div className="ai-analysis-section-title-wrapper">
                <div className={`ai-analysis-section-icon ${colorClasses.iconBg}`}>
                  <span>{section.icon || '📋'}</span>
                </div>
                <h3 className={`ai-analysis-section-title ${colorClasses.text}`}>
                  {section.title}
                </h3>
              </div>
              <button
                onClick={() => handleCopy(section.key, text)}
                className={`ai-analysis-section-copy-btn ${isCopied ? 'ai-analysis-section-copy-btn-copied' : ''}`}
                title="Копирай текст"
              >
                {isCopied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Копирано!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Копирай</span>
                  </>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="ai-analysis-section-content">
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
