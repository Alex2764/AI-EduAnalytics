import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { useAppContext } from '../../context/AppContext';

const classOptions = [
  { value: '5А', label: '5А' },
  { value: '5Б', label: '5Б' },
  { value: '6А', label: '6А' },
  { value: '6Б', label: '6Б' },
  { value: '7А', label: '7А' },
  { value: '7Б', label: '7Б' },
  { value: '8А', label: '8А' },
  { value: '8Б', label: '8Б' },
  { value: '9А', label: '9А' },
  { value: '9Б', label: '9Б' },
  { value: '10А', label: '10А' },
  { value: '10Б', label: '10Б' },
  { value: '11А', label: '11А' },
  { value: '11Б', label: '11Б' },
  { value: '12А', label: '12А' },
  { value: '12Б', label: '12Б' },
];

interface ClassFormProps {
  onSuccess?: () => void;
}

export const ClassForm: React.FC<ClassFormProps> = ({ onSuccess }) => {
  const { addClass, classes } = useAppContext();
  const [className, setClassName] = useState('');
  const [schoolYear, setSchoolYear] = useState('2024/2025');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!className || !schoolYear) {
      setError('Моля попълнете всички полета!');
      return;
    }

    // Check if class already exists
    if (classes.some(c => c.name === className && c.schoolYear === schoolYear)) {
      setError('Този клас вече съществува за тази учебна година!');
      return;
    }

    try {
      await addClass({
        name: className,
        schoolYear: schoolYear,
        createdDate: new Date().toISOString(),
      });

      // Reset form
      setClassName('');
      setSchoolYear('2024/2025');
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при създаване на клас!');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="form-row">
        <Select
          label="Име на клас"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          options={classOptions}
          placeholder="Изберете клас"
          required
        />
        
        <Input
          label="Учебна година"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="2024/2025"
          required
        />
        
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="submit">
            Създай клас
          </Button>
        </div>
      </div>
    </form>
  );
};
