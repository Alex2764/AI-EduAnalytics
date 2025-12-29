import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { StudentProfileModal } from '../students/StudentProfileModal';
import { useAppContext } from '../../context/AppContext';
import { validateStudentData } from '../../utils/validation';
import type { Student, GenderType } from '../../types';

interface StudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
}

export const StudentsModal: React.FC<StudentsModalProps> = ({ isOpen, onClose, className }) => {
  const { students, updateStudent, deleteStudent, addStudent } = useAppContext();
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    number: 1,
    gender: 'male' as GenderType,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    number: 1,
    gender: 'male' as GenderType,
  });
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const classStudents = students
    .filter(s => s.class === className)
    .sort((a, b) => a.number - b.number);

  const handleAddStudent = async () => {
    setErrors([]);
    const { firstName, middleName, lastName, number } = formData;

    const validationErrors = validateStudentData(firstName, middleName, lastName);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (classStudents.some(s => s.number === number)) {
      setErrors(['Ученик с този номер вече съществува в класа!']);
      return;
    }

    try {
      // Add new student
      await addStudent({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        class: className,
        number,
        gender: formData.gender,
      });

      // Reset form
      setFormData({ firstName: '', middleName: '', lastName: '', number: 1, gender: 'male' as GenderType });
    } catch (err: any) {
      setErrors([err.message || 'Грешка при запазване на ученик!']);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    
    setEditErrors([]);
    const { firstName, middleName, lastName, number } = editFormData;

    const validationErrors = validateStudentData(firstName, middleName, lastName);
    if (validationErrors.length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    if (classStudents.some(s => s.number === number && s.id !== editingStudent.id)) {
      setEditErrors(['Ученик с този номер вече съществува в класа!']);
      return;
    }

    try {
      await updateStudent(editingStudent.id, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        number,
        gender: editFormData.gender,
      });

      // Close modal and reset
      setShowEditModal(false);
      setEditingStudent(null);
      setEditFormData({ firstName: '', middleName: '', lastName: '', number: 1, gender: 'male' as GenderType });
      setEditErrors([]);
    } catch (err: any) {
      setEditErrors([err.message || 'Грешка при запазване на промените!']);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      number: student.number,
      gender: student.gender,
    });
    setEditErrors([]);
    setShowEditModal(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (window.confirm(`Сигурни ли сте, че искате да изтриете ${student.firstName} ${student.lastName}?`)) {
      try {
        await deleteStudent(studentId);
      } catch (err: any) {
        alert(err.message || 'Грешка при изтриване на ученик!');
      }
    }
  };

  const cancelEdit = () => {
    setShowEditModal(false);
    setEditingStudent(null);
    setEditFormData({ firstName: '', middleName: '', lastName: '', number: 1, gender: 'male' as GenderType });
    setEditErrors([]);
  };

  const handleViewProfile = (student: Student) => {
    setSelectedStudent(student);
    setShowProfileModal(true);
  };

  const getNextAvailableNumber = () => {
    const usedNumbers = classStudents.map(s => s.number);
    for (let i = 1; i <= 50; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }
    return usedNumbers.length + 1;
  };

  React.useEffect(() => {
    if (!editingStudent && formData.number === 1) {
      setFormData(prev => ({ ...prev, number: getNextAvailableNumber() }));
    }
  }, [classStudents.length, editingStudent]);

  // Hide footer when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('students-modal-open');
    } else {
      document.body.classList.remove('students-modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('students-modal-open');
    };
  }, [isOpen]);

  const handleBulkAdd = async () => {
    setBulkErrors([]);
    const lines = bulkText.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      setBulkErrors(['Моля, въведете поне един ученик!']);
      return;
    }

    const studentsToAdd: Array<Omit<Student, 'id'>> = [];
    const validationErrors: string[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Pattern: "1. Име Презиме Фамилия (момче/момиче)" или "1 Име Презиме Фамилия (момче/момиче)"
      // Extract gender from parentheses if present
      const genderMatch = trimmedLine.match(/\(([^)]+)\)\s*$/);
      let gender: GenderType = 'male'; // Default gender
      let lineWithoutGender = trimmedLine;
      
      if (genderMatch) {
        const genderText = genderMatch[1].toLowerCase().trim();
        if (genderText === 'момиче') {
          gender = 'female';
        } else if (genderText === 'момче') {
          gender = 'male';
        }
        // Remove gender part from line
        lineWithoutGender = trimmedLine.replace(/\s*\([^)]+\)\s*$/, '').trim();
      }
      
      const match = lineWithoutGender.match(/^(\d+)[\.\):\s]+(.+)$/);
      
      if (!match) {
        validationErrors.push(`Ред ${index + 1}: Невалиден формат. Използвайте: "№. Име Презиме Фамилия (момче/момиче)"`);
        return;
      }

      const number = parseInt(match[1]);
      const nameParts = match[2].trim().split(/\s+/);

      if (nameParts.length < 3) {
        validationErrors.push(`Ред ${index + 1}: Моля въведете Име, Презиме и Фамилия`);
        return;
      }

      // Check if number already exists
      if (classStudents.some(s => s.number === number)) {
        validationErrors.push(`Ред ${index + 1}: Ученик с номер ${number} вече съществува в класа!`);
        return;
      }

      // Check for duplicate numbers in the input
      if (studentsToAdd.some(s => s.number === number)) {
        validationErrors.push(`Ред ${index + 1}: Дублиран номер ${number} във въведения текст!`);
        return;
      }

      const firstName = nameParts[0];
      const middleName = nameParts[1];
      const lastName = nameParts.slice(2).join(' '); // Support for composite last names

      const fieldErrors = validateStudentData(firstName, middleName, lastName);
      if (fieldErrors.length > 0) {
        validationErrors.push(`Ред ${index + 1}: ${fieldErrors.join(', ')}`);
        return;
      }

      studentsToAdd.push({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        class: className,
        number: number,
        gender: gender,
      });
    });

    if (validationErrors.length > 0) {
      setBulkErrors(validationErrors);
      return;
    }

    if (studentsToAdd.length === 0) {
      setBulkErrors(['Не са намерени валидни ученици за добавяне!']);
      return;
    }

    // Add all students
    try {
      // Use addMultipleStudents if available, otherwise add one by one
      if (studentsToAdd.length > 0) {
        // Check if we should use bulk add or individual adds
        // For now, add one by one to handle errors better
        for (const student of studentsToAdd) {
          await addStudent(student);
        }
      }

      // Clear the form and show success
      setBulkText('');
      setShowBulkForm(false);
      alert(`Успешно добавени ${studentsToAdd.length} ученици!`);
    } catch (err: any) {
      setBulkErrors([err.message || 'Грешка при добавяне на ученици!']);
    }
  };


  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Управление на ученици" size="xl">
      <div className="students-container">
        {/* Header with Class Info */}
        <div className="students-header">
          <div className="class-title">
            <h2 className="class-name">Клас {className}</h2>
            <div className="students-count">{classStudents.length} ученици</div>
          </div>
          <div className="class-stats">
            <div className="stat-item">
              <span className="stat-label">Общо</span>
              <span className="stat-value">{classStudents.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Последен номер</span>
              <span className="stat-value">{classStudents.length > 0 ? Math.max(...classStudents.map(s => s.number)) : 0}</span>
            </div>
          </div>
        </div>

        {/* Toggle between single and bulk add */}
        <div className="mb-4 flex gap-2">
          <Button
            onClick={() => setShowBulkForm(false)}
            variant={!showBulkForm ? 'primary' : 'secondary'}
            className="flex-1"
          >
            Единичен ученик
          </Button>
          <Button
            onClick={() => setShowBulkForm(true)}
            variant={showBulkForm ? 'primary' : 'secondary'}
            className="flex-1"
          >
            Списък по номера
          </Button>
        </div>

        {/* Bulk Add Form */}
        {showBulkForm && (
          <div className="student-form-section mb-6">
            <h3 className="section-title">
              Масово добавяне на ученици по номера
            </h3>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">Как да използвам:</h4>
              <p className="text-sm text-blue-800 mb-2">
                Въведете учениците по следния формат (един на ред):
              </p>
              <div className="bg-white p-3 rounded border border-blue-200 font-mono text-sm">
                <div>1. Иван Петров Иванов (момче)</div>
                <div>2. Мария Георгиева Димитрова (момиче)</div>
                <div>3. Петър Илиев Стоянов (момче)</div>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                * Поддържа формати: "1. Име Презиме Фамилия (момче/момиче)" или "1) Име Презиме Фамилия (момче/момиче)"
              </p>
            </div>

            {bulkErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="text-red-800 font-medium mb-2">Грешки при валидацията:</h4>
                <ul className="text-red-700 text-sm space-y-1 max-h-40 overflow-y-auto">
                  {bulkErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Въведете списък с ученици (момче/момиче):
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="1. Иван Петров Иванов (момче)&#10;2. Мария Георгиева Димитрова (момиче)&#10;3. Петър Илиев Стоянов (момче)"
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setBulkText('');
                  setBulkErrors([]);
                }}
              >
                Изчисти
              </Button>
              <Button onClick={handleBulkAdd}>
                Добави всички ученици
              </Button>
            </div>
          </div>
        )}

        {/* Add Student Form */}
        {!showBulkForm && (
        <div className="student-form-section">
          <h3 className="section-title">
            Добавяне на нов ученик
          </h3>

          {errors.length > 0 && (
            <div className="form-errors">
              {errors.map((error, index) => (
                <div key={index} className="error-item">{error}</div>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Име *</label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Име"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Презире *</label>
              <Input
                value={formData.middleName}
                onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                placeholder="Презиме"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Фамилия *</label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Фамилия"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">№ в клас *</label>
              <Input
                type="text"
                value={String(formData.number || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  const num = value === '' ? 1 : parseInt(value) || 1;
                  setFormData(prev => ({ ...prev, number: num }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="Номер"
                required
                className="student-input number-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Пол *</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as GenderType }))}
                className="student-input"
                required
              >
                <option value="male">Момче</option>
                <option value="female">Момиче</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <Button onClick={handleAddStudent} className="add-btn">
              Добави ученик
            </Button>
          </div>
        </div>
        )}

        {/* Students List */}
        <div className="students-list-section">
          <h3 className="section-title">Списък на учениците ({classStudents.length})</h3>
          
          {classStudents.length > 0 ? (
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th className="col-class-number">№ в клас</th>
                    <th className="col-name">Име</th>
                    <th className="col-middle">Презире</th>
                    <th className="col-last">Фамилия</th>
                    <th className="col-gender">Пол</th>
                    <th className="col-actions">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student) => (
                    <tr key={student.id} className="student-row">
                      <td className="col-class-number">
                        <div className="class-number">{student.number}</div>
                      </td>
                      <td className="col-name">
                        <div className="student-name">{student.firstName}</div>
                      </td>
                      <td className="col-middle">
                        <div className="student-middle">{student.middleName}</div>
                      </td>
                      <td className="col-last">
                        <div className="student-last">{student.lastName}</div>
                      </td>
                      <td className="col-gender">
                        <div className="gender-display">
                          {student.gender === 'male' ? 'Момче' : 'Момиче'}
                        </div>
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons">
                          <Button
                            onClick={() => handleViewProfile(student)}
                            className="btn-primary-action profile-btn"
                          >
                            Профил
                          </Button>
                          <Button
                            onClick={() => handleEditStudent(student)}
                            variant="secondary"
                            className="btn-warning edit-btn"
                          >
                            Редактирай
                          </Button>
                          <Button
                            onClick={() => handleDeleteStudent(student.id)}
                            variant="danger"
                            className="delete-btn"
                          >
                            Изтрий
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"></div>
              <h4 className="empty-title">Все още няма добавени ученици</h4>
              <p className="empty-description">Използвайте формата по-горе за да добавите първия ученик в този клас</p>
            </div>
          )}
        </div>
      </div>
    </Modal>

      {/* Student Profile Modal */}
      {selectedStudent && (
        <StudentProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          student={selectedStudent}
        />
      )}

      {/* Edit Student Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={cancelEdit} 
        title="Редактиране на ученик"
        size="md"
      >
        <div className="student-form-section">
          {editErrors.length > 0 && (
            <div className="form-errors">
              {editErrors.map((error, index) => (
                <div key={index} className="error-item">{error}</div>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Име *</label>
              <Input
                value={editFormData.firstName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Име"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Презире *</label>
              <Input
                value={editFormData.middleName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, middleName: e.target.value }))}
                placeholder="Презиме"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Фамилия *</label>
              <Input
                value={editFormData.lastName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Фамилия"
                required
                className="student-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">№ в клас *</label>
              <Input
                type="text"
                value={String(editFormData.number || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  const num = value === '' ? 1 : parseInt(value) || 1;
                  setEditFormData(prev => ({ ...prev, number: num }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="Номер"
                required
                className="student-input number-input"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Пол *</label>
              <select
                value={editFormData.gender}
                onChange={(e) => setEditFormData(prev => ({ ...prev, gender: e.target.value as GenderType }))}
                className="student-input"
                required
              >
                <option value="male">Момче</option>
                <option value="female">Момиче</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <Button onClick={handleSaveEdit} className="add-btn">
              Запази промените
            </Button>
            <Button variant="secondary" onClick={cancelEdit} className="cancel-btn">
              Откажи
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
