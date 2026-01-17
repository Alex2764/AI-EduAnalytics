import React from 'react';

interface StepperProps {
  steps: { label: string; icon?: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick }) => {
  return (
    <div className="stepper-container">
      <div className="stepper-wrapper">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          // Позволяваме кликване на завършени, активни стъпки, или стъпка 4 (обобщение) винаги
          const isClickable = onStepClick && (isCompleted || isActive || stepNumber === 4);

          return (
            <React.Fragment key={index}>
              <div
                className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
                onClick={() => isClickable && onStepClick?.(stepNumber)}
              >
                <div className="stepper-step-circle">
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <div className="stepper-step-label">{step.label}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`stepper-line ${isCompleted ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
