import React, { useState } from 'react';
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

  const classStudents = students
    .filter(s => s.class === className)
    .sort((a, b) => a.number - b.number);

  const handleAddStudent = () => {
    setErrors([]);
    const { firstName, middleName, lastName, number } = formData;

    const validationErrors = validateStudentData(firstName, middleName, lastName);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (classStudents.some(s => s.number === number && s.id !== editingStudent?.id)) {
      setErrors(['Ученик с този номер вече съществува в класа!']);
      return;
    }

    if (editingStudent) {
      // Update existing student
      updateStudent(editingStudent.id, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        number,
        gender: formData.gender,
      });
    } else {
      // Add new student
      addStudent({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        class: className,
        number,
        gender: formData.gender,
      });
    }

    // Reset form
    setFormData({ firstName: '', middleName: '', lastName: '', number: 1, gender: 'male' as GenderType });
    setEditingStudent(null);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      number: student.number,
      gender: student.gender,
    });
    setErrors([]);
  };

  const handleDeleteStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (window.confirm(`Сигурни ли сте, че искате да изтриете ${student.firstName} ${student.lastName}?`)) {
      deleteStudent(studentId);
    }
  };

  const cancelEdit = () => {
    setEditingStudent(null);
    setFormData({ firstName: '', middleName: '', lastName: '', number: 1, gender: 'male' as GenderType });
    setErrors([]);
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

        {/* Add/Edit Student Form */}
        <div className="student-form-section">
          <h3 className="section-title">
            {editingStudent ? 'Редактиране на ученик' : 'Добавяне на нов ученик'}
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
                type="number"
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: parseInt(e.target.value) || 1 }))}
                placeholder="Номер"
                min={1}
                max={50}
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
                <option value="male">👨 Момче</option>
                <option value="female">👩 Момиче</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <Button onClick={handleAddStudent} className="add-btn">
              {editingStudent ? 'Запази промените' : 'Добави ученик'}
            </Button>
            {editingStudent && (
              <Button variant="secondary" onClick={cancelEdit} className="cancel-btn">
                Откажи
              </Button>
            )}
          </div>
        </div>

        {/* Students List */}
        <div className="students-list-section">
          <h3 className="section-title">Списък на учениците ({classStudents.length})</h3>
          
          {classStudents.length > 0 ? (
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th className="col-number">№</th>
                    <th className="col-name">Име</th>
                    <th className="col-middle">Презире</th>
                    <th className="col-last">Фамилия</th>
                    <th className="col-class-number">№ в клас</th>
                    <th className="col-gender">Пол</th>
                    <th className="col-actions">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student, index) => (
                    <tr key={student.id} className="student-row">
                      <td className="col-number">
                        <div className="student-index">{index + 1}</div>
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
                      <td className="col-class-number">
                        <div className="class-number">{student.number}</div>
                      </td>
                      <td className="col-gender">
                        <div className="gender-display">
                          {student.gender === 'male' ? '👨 Момче' : '👩 Момиче'}
                        </div>
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons">
                          <Button
                            onClick={() => handleViewProfile(student)}
                            className="profile-btn bg-purple-600 hover:bg-purple-700"
                          >
                            Профил
                          </Button>
                          <Button
                            onClick={() => handleEditStudent(student)}
                            variant="secondary"
                            className="edit-btn"
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
              <div className="empty-icon">👥</div>
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
    </>
  );
};
