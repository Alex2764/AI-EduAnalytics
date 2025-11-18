import React from 'react';

type InputType = 'text' | 'number' | 'date' | 'email' | 'password';

interface InputProps {
  label?: string;
  type?: InputType;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  onFocus,
  onClick,
  onKeyDown,
  placeholder,
  required = false,
  min,
  max,
  step,
  error,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label>
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={typeof value === 'number' ? String(value) : (value || '')}
        onChange={onChange}
        onFocus={onFocus}
        onClick={onClick}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={error ? 'border-red-500' : ''}
      />
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
};