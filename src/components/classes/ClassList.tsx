import React from 'react';
import { Button } from '../common/Button';
import { Table } from '../common/Table';
import { useAppContext } from '../../context/AppContext';

interface ClassListProps {
  onManageStudents: (className: string) => void;
}

export const ClassList: React.FC<ClassListProps> = ({ onManageStudents }) => {
  const { classes, students, deleteClass } = useAppContext();

  const handleDeleteClass = (classId: string) => {
    const classToDelete = classes.find(c => c.id === classId);
    if (!classToDelete) return;

    const studentCount = students.filter(s => s.class === classToDelete.name).length;
    
    let confirmMessage = `Сигурни ли сте, че искате да изтриете класа ${classToDelete.name}?`;
    if (studentCount > 0) {
      confirmMessage = `В класа ${classToDelete.name} има ${studentCount} ученици. Сигурни ли сте, че искате да изтриете класа? Това ще изтрие и всички ученици и техните резултати!`;
    }

    if (window.confirm(confirmMessage)) {
      deleteClass(classId);
    }
  };

  const columns = [
    { key: 'index', label: '№' },
    { key: 'name', label: 'Клас' },
    { key: 'schoolYear', label: 'Учебна година' },
    { key: 'studentCount', label: 'Брой ученици' },
    { key: 'actions', label: 'Действия' },
  ];

  const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));

  const renderRow = (classItem: any, index: number) => {
    const studentCount = students.filter(s => s.class === classItem.name).length;
    
    return (
      <tr key={classItem.id} className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{classItem.name}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{classItem.schoolYear}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{studentCount}</td>
        <td className="px-6 py-4 text-sm text-gray-900">
          <div className="flex space-x-2">
            <Button
              onClick={() => onManageStudents(classItem.name)}
              className="text-sm py-2 px-4"
            >
              Управление на ученици
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDeleteClass(classItem.id)}
              className="text-sm py-2 px-4"
            >
              Изтрий
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Създадени класове</h3>
      <Table
        columns={columns}
        data={sortedClasses}
        renderRow={renderRow}
        emptyMessage="Няма създадени класове"
      />
    </div>
  );
};
