import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { useAppContext } from '../../context/AppContext';
import { getCurrentDate } from '../../utils/dateFormatter';
import type { TestType } from '../../types';

const testTypeOptions: { value: TestType; label: string }[] = [
  { value: 'Нормален тест', label: 'Нормален тест' },
  { value: 'Класна работа', label: 'Класна работа' },
  { value: 'Входно ниво', label: 'Входно ниво' },
  { value: 'Изходно ниво', label: 'Изходно ниво' },
  { value: 'Междинно ниво', label: 'Междинно ниво' },
  { value: 'Текуща оценка', label: 'Текуща оценка' },
];

export const TestForm: React.FC = () => {
  const { classes, addTest } = useAppContext();
  const [testName, setTestName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [testType, setTestType] = useState<TestType>('Нормален тест');
  const [testDate, setTestDate] = useState(getCurrentDate());
  const [maxPoints, setMaxPoints] = useState<number | ''>('');
  const [error, setError] = useState('');

  const classOptions = classes.map(cls => ({
    value: cls.name,
    label: cls.name,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!testName || !selectedClass || !testDate || maxPoints === '' || maxPoints === 0) {
      setError('Моля попълнете всички полета!');
      return;
    }

    if (typeof maxPoints === 'number' && maxPoints <= 0) {
      setError('Максималните точки трябва да са по-големи от 0!');
      return;
    }

    addTest({
      name: testName,
      class: selectedClass,
      type: testType,
      date: testDate,
      maxPoints: maxPoints as number,
    });

    // Reset form
    setTestName('');
    setSelectedClass('');
    setTestType('Нормален тест');
    setTestDate(getCurrentDate());
    setMaxPoints('');
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="text-lg font-semibold mb-4">Създай нов тест</h3>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <Input
          label="Име на тест"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          placeholder="Въведете име на теста"
          required
        />
        
        <Select
          label="Клас"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="Изберете клас"
          required
        />
        
        <Select
          label="Тип тест"
          value={testType}
          onChange={(e) => setTestType(e.target.value as TestType)}
          options={testTypeOptions}
          required
        />
        
        <Input
          label="Дата"
          type="date"
          value={testDate}
          onChange={(e) => setTestDate(e.target.value)}
          required
        />
        
        <Input
          label="Максимални точки"
          type="number"
          value={maxPoints}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '') {
              setMaxPoints('');
            } else {
              const num = parseInt(value);
              setMaxPoints(isNaN(num) ? '' : num);
            }
          }}
          min={1}
          required
          placeholder="Въведете точки"
        />
        
        <Button type="submit">
          Създай тест
        </Button>
      </div>
    </form>
  );
};
