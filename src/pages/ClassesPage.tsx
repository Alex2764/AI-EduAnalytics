import React, { useState } from 'react';
import { ClassForm } from '../components/classes/ClassForm';
import { ClassList } from '../components/classes/ClassList';
import { StudentBulkForm } from '../components/classes/StudentBulkForm';
import { StudentsModal } from '../components/classes/StudentsModal';

export const ClassesPage: React.FC = () => {
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState('');

  const handleManageStudents = (className: string) => {
    setSelectedClassName(className);
    setShowStudentsModal(true);
  };


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Управление на класове</h2>
      
      <ClassForm />
      
      <ClassList onManageStudents={handleManageStudents} />
      
      {/* Bulk Student Form Modal */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
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
    </div>
  );
};
