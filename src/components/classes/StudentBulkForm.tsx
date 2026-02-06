import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAppContext } from '../../context/AppContext';
import { validateStudentData } from '../../utils/validation';
import type { Student, GenderType } from '../../types';

interface StudentBulkFormProps {
  className: string;
  onClose: () => void;
}

interface StudentFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: GenderType;
}

export const StudentBulkForm: React.FC<StudentBulkFormProps> = ({ className, onClose }) => {
  const { students, addMultipleStudents } = useAppContext();
  const [studentCount, setStudentCount] = useState(25);
  const [studentData, setStudentData] = useState<StudentFormData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize student data array
  useEffect(() => {
    const existingStudents = students.filter(s => s.class === className);
    const initialData: StudentFormData[] = [];
    
    for (let i = 0; i < studentCount; i++) {
      const existingStudent = existingStudents.find(s => s.number === i + 1);
      initialData.push({
        firstName: existingStudent?.firstName || '',
        middleName: existingStudent?.middleName || '',
        lastName: existingStudent?.lastName || '',
        gender: existingStudent?.gender || 'male',
      });
    }
    
    setStudentData(initialData);
  }, [studentCount, className, students.length]);


  const handleStudentDataChange = (index: number, field: keyof StudentFormData, value: string | GenderType) => {
    const newData = [...studentData];
    newData[index] = { ...newData[index], [field]: value };
    setStudentData(newData);
  };

  const handleSave = async () => {
    setErrors([]);
    const newStudents: Omit<Student, 'id'>[] = [];
    const validationErrors: string[] = [];

    studentData.forEach((student, index) => {
      const { firstName, middleName, lastName } = student;
      
      // Skip empty rows
      if (!firstName && !middleName && !lastName) return;
      
      // Validate partially filled rows
      const fieldErrors = validateStudentData(firstName, middleName, lastName);
      if (fieldErrors.length > 0) {
        validationErrors.push(`Ред ${index + 1}: ${fieldErrors.join(', ')}`);
        return;
      }

      newStudents.push({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        class: className,
        number: index + 1,
        gender: student.gender,
      });
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (newStudents.length === 0) {
      setErrors(['Моля въведете поне един ученик!']);
      return;
    }

    try {
      setLoading(true);
      await addMultipleStudents(newStudents);
      onClose();
    } catch (err: unknown) {
      setErrors([err instanceof Error ? err.message : 'Грешка при добавяне на ученици!']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Добавяне на ученици в клас {className}</h3>
        <p className="text-gray-600">
          Въведете данните на учениците. Можете да оставите редове празни ако няма толкова ученици.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-medium mb-2">Грешки при валидацията:</h4>
          <ul className="text-red-700 text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <Input
          label="Брой ученици"
          type="text"
          value={String(studentCount || '')}
          onChange={(e) => {
            const value = e.target.value;
            const newCount = value === '' ? 25 : parseInt(value) || 25;
            setStudentCount(Math.min(Math.max(newCount, 1), 35));
          }}
          onFocus={(e) => e.target.select()}
          placeholder="25"
          className="w-32"
        />
        <Button
          onClick={() => {
            const newData: StudentFormData[] = [];
            for (let i = 0; i < studentCount; i++) {
              newData.push({
                firstName: '',
                middleName: '',
                lastName: '',
                gender: 'male' as GenderType,
              });
            }
            setStudentData(newData);
          }}
          variant="secondary"
          className="mt-6"
        >
          🔄 Обнови полетата
        </Button>
      </div>

      <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-5 gap-4 mb-4 font-medium text-gray-700 border-b pb-2">
          <div>№ в клас</div>
          <div>Име</div>
          <div>Презире</div>
          <div>Фамилия</div>
          <div>Пол</div>
        </div>

        <div className="space-y-3">
          {studentData.map((student, index) => (
            <div key={index} className="grid grid-cols-5 gap-4 items-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-600">{index + 1}.</div>
              <Input
                value={student.firstName}
                onChange={(e) => handleStudentDataChange(index, 'firstName', e.target.value)}
                placeholder="Име"
                className="mb-0"
              />
              <Input
                value={student.middleName}
                onChange={(e) => handleStudentDataChange(index, 'middleName', e.target.value)}
                placeholder="Презире"
                className="mb-0"
              />
              <Input
                value={student.lastName}
                onChange={(e) => handleStudentDataChange(index, 'lastName', e.target.value)}
                placeholder="Фамилия"
                className="mb-0"
              />
              <select
                value={student.gender}
                onChange={(e) => handleStudentDataChange(index, 'gender', e.target.value as GenderType)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="male">Момче</option>
                <option value="female">Момиче</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4 border-t">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Откажи
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Запазване...' : '💾 Запази учениците'}
        </Button>
      </div>
    </div>
  );
};
