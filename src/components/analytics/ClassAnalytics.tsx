import React, { useState } from 'react';
import { Select } from '../common/Select';
import { StatCard } from './StatCard';
import { useAppContext } from '../../context/AppContext';

export const ClassAnalytics: React.FC = () => {
  const { classes, students, tests, results } = useAppContext();
  const [selectedClass, setSelectedClass] = useState('');

  const classOptions = classes.map(cls => ({
    value: cls.name,
    label: cls.name,
  }));

  if (!selectedClass) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Анализи и статистики</h2>
        
        <Select
          label="Изберете клас за анализ"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="Изберете клас"
        />

        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Изберете клас за да видите анализите
          </h3>
          <p className="text-gray-600">
            Ще видите детайлна статистика за успеваемостта на учениците
          </p>
        </div>
      </div>
    );
  }

  const classStudents = students.filter(s => s.class === selectedClass);
  const classTests = tests.filter(t => t.class === selectedClass);
  const classResults = results.filter(r => {
    const student = students.find(s => s.id === r.studentId);
    return student && student.class === selectedClass;
  });

  if (classStudents.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Анализи и статистики</h2>
        
        <Select
          label="Изберете клас за анализ"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="Изберете клас"
        />

        <div className="bg-yellow-50 p-6 rounded-lg text-center">
          <p className="text-yellow-800">Няма ученици в този клас.</p>
        </div>
      </div>
    );
  }

  if (classTests.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Анализи и статистики</h2>
        
        <Select
          label="Изберете клас за анализ"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="Изберете клас"
        />

        <div className="bg-blue-50 p-6 rounded-lg text-center">
          <p className="text-blue-800">Няма тестове за този клас.</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalStudents = classStudents.length;
  const totalResults = classResults.length;

  // Grade distribution (българска система на закръгляване)
  const gradeStats = {
    6: classResults.filter(r => parseFloat(r.grade) >= 5.50).length, // 5.50+ → 6
    5: classResults.filter(r => parseFloat(r.grade) >= 4.50 && parseFloat(r.grade) < 5.50).length, // 4.50-5.49 → 5
    4: classResults.filter(r => parseFloat(r.grade) >= 3.50 && parseFloat(r.grade) < 4.50).length, // 3.50-4.49 → 4
    3: classResults.filter(r => parseFloat(r.grade) >= 2.50 && parseFloat(r.grade) < 3.50).length, // 2.50-3.49 → 3
    2: classResults.filter(r => parseFloat(r.grade) >= 2.0 && parseFloat(r.grade) < 2.50).length, // 2.00-2.49 → 2
  };

  const gradePercentages = {
    6: totalResults > 0 ? ((gradeStats[6] / totalResults) * 100).toFixed(1) : '0',
    5: totalResults > 0 ? ((gradeStats[5] / totalResults) * 100).toFixed(1) : '0',
    4: totalResults > 0 ? ((gradeStats[4] / totalResults) * 100).toFixed(1) : '0',
    3: totalResults > 0 ? ((gradeStats[3] / totalResults) * 100).toFixed(1) : '0',
    2: totalResults > 0 ? ((gradeStats[2] / totalResults) * 100).toFixed(1) : '0',
  };

  // Calculate average grade
  const gradeValues = classResults.map(r => parseFloat(r.grade) || 0);
  const avgGrade = totalResults > 0 ? 
    (gradeValues.reduce((sum, g) => sum + g, 0) / totalResults).toFixed(2) : '0.00';

  // Good grades percentage (5-6)
  const goodGrades = gradeStats[5] + gradeStats[6];
  const goodGradesPercentage = totalResults > 0 ? ((goodGrades / totalResults) * 100).toFixed(1) : '0';

  // Analysis by test type
  const testTypes = [...new Set(classTests.map(t => t.type))];
  const testTypeAnalysis = testTypes.map(type => {
    const typeTests = classTests.filter(t => t.type === type);
    const typeResults = classResults.filter(r => {
      const test = tests.find(t => t.id === r.testId);
      return test && test.type === type;
    });

    const avgGradeForType = typeResults.length > 0 ? 
      (typeResults.reduce((sum, r) => sum + parseFloat(r.grade), 0) / typeResults.length).toFixed(2) : '0.00';

    const passRate = typeResults.length > 0 ? 
      ((typeResults.filter(r => parseFloat(r.grade) >= 2.50).length / typeResults.length) * 100).toFixed(1) : '0';

    return {
      type,
      testsCount: typeTests.length,
      resultsCount: typeResults.length,
      avgGrade: avgGradeForType,
      passRate,
    };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Анализи и статистики</h2>
      
      <Select
        label="Изберете клас за анализ"
        value={selectedClass}
        onChange={(e) => setSelectedClass(e.target.value)}
        options={classOptions}
        placeholder="Изберете клас"
      />

      {/* Overall Statistics */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Обща статистика за клас {selectedClass}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Ученици в класа"
            value={totalStudents.toString()}
            color="green"
            icon="👥"
          />
          <StatCard
            title="Общо резултати"
            value={totalResults.toString()}
            color="blue"
            icon="📝"
          />
          <StatCard
            title="Среден успех"
            value={avgGrade}
            color="purple"
            icon="📊"
          />
          <StatCard
            title="Добри оценки (5-6)"
            value={`${goodGradesPercentage}%`}
            color="orange"
            icon="🎯"
          />
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Разпределение на оценките</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-green-100 p-4 rounded-lg text-center border-l-4 border-green-500">
            <h4 className="font-semibold text-green-800">Отличен (6)</h4>
            <p className="text-2xl font-bold text-green-800">{gradeStats[6]} бр.</p>
            <p className="text-sm text-green-700">{gradePercentages[6]}%</p>
          </div>
          <div className="bg-blue-100 p-4 rounded-lg text-center border-l-4 border-blue-500">
            <h4 className="font-semibold text-blue-800">Много добър (5)</h4>
            <p className="text-2xl font-bold text-blue-800">{gradeStats[5]} бр.</p>
            <p className="text-sm text-blue-700">{gradePercentages[5]}%</p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg text-center border-l-4 border-yellow-500">
            <h4 className="font-semibold text-yellow-800">Добър (4)</h4>
            <p className="text-2xl font-bold text-yellow-800">{gradeStats[4]} бр.</p>
            <p className="text-sm text-yellow-700">{gradePercentages[4]}%</p>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg text-center border-l-4 border-orange-500">
            <h4 className="font-semibold text-orange-800">Среден (3)</h4>
            <p className="text-2xl font-bold text-orange-800">{gradeStats[3]} бр.</p>
            <p className="text-sm text-orange-700">{gradePercentages[3]}%</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg text-center border-l-4 border-red-500">
            <h4 className="font-semibold text-red-800">Слаб (2)</h4>
            <p className="text-2xl font-bold text-red-800">{gradeStats[2]} бр.</p>
            <p className="text-sm text-red-700">{gradePercentages[2]}%</p>
          </div>
        </div>
      </div>

      {/* Analysis by Test Type */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Анализ по типове тестове</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип тест</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Брой тестове</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Среден успех</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Успеваемост (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {testTypeAnalysis.map((analysis, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{analysis.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{analysis.testsCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{analysis.avgGrade}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{analysis.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
