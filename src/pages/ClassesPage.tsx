import React, { useState, useEffect } from 'react';
import { ClassForm } from '../components/classes/ClassForm';
import { ClassList } from '../components/classes/ClassList';
import { StudentBulkForm } from '../components/classes/StudentBulkForm';
import { StudentsModal } from '../components/classes/StudentsModal';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import './ClassesPage.css';

export const ClassesPage: React.FC = () => {
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [showClassFormModal, setShowClassFormModal] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState('');

  const handleManageStudents = (className: string) => {
    setSelectedClassName(className);
    setShowStudentsModal(true);
  };

  // Hide footer when Create Class Modal is open
  useEffect(() => {
    if (showClassFormModal) {
      document.body.classList.add('class-form-modal-open');
    } else {
      document.body.classList.remove('class-form-modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('class-form-modal-open');
    };
  }, [showClassFormModal]);


  return (
    <div className="classes-page-container">
      <div className="classes-page-header">
        <div className="classes-page-header-content">
          <h2>Управление на класове</h2>
          <p>Създаване и управление на класове и ученици</p>
        </div>
        <Button onClick={() => setShowClassFormModal(true)} className="btn-success">
          + Създай нов клас
        </Button>
      </div>
      
      <ClassList onManageStudents={handleManageStudents} />
      
      {/* Bulk Student Form Modal */}
      {showBulkForm && (
        <div className="classes-bulk-modal-overlay">
          <div className="classes-bulk-modal-content">
            <StudentBulkForm 
              className={selectedClassName}
              onClose={() => setShowBulkForm(false)}
            />
          </div>
        </div>
      )}

      {/* Students Management Modal */}
      <StudentsModal
        isOpen={showStudentsModal}
        onClose={() => setShowStudentsModal(false)}
        className={selectedClassName}
      />

      {/* Create Class Modal */}
      <Modal
        isOpen={showClassFormModal}
        onClose={() => setShowClassFormModal(false)}
        title="Създай нов клас"
      >
        <ClassForm onSuccess={() => setShowClassFormModal(false)} />
      </Modal>
    </div>
  );
};
