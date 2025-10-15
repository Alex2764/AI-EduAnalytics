import React, { useMemo } from 'react';
import { Modal } from '../common/Modal';
import { StudentStatsCard } from './StudentStatsCard';
import { StudentProgressChart } from './StudentProgressChart';
import { useAppContext } from '../../context/AppContext';
import type { Student } from '../../types';
import {
  getStudentResults,
  calculateStudentStats,
  getStudentProgressData,
  compareWithClassAverage,
  getGradeColor,
  getGradeBorderColor,
} from '../../utils/studentAnalytics';
import { formatDate } from '../../utils/dateFormatter';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const { tests, results, students } = useAppContext();

  // Memoized calculations for performance
  const studentResults = useMemo(
    () => getStudentResults(student.id, tests, results),
    [student.id, tests, results]
  );

  const studentStats = useMemo(
    () => calculateStudentStats(student.id, tests, results),
    [student.id, tests, results]
  );

  const progressData = useMemo(
    () => getStudentProgressData(student.id, tests, results),
    [student.id, tests, results]
  );

  const classComparison = useMemo(
    () => compareWithClassAverage(student.id, student.class, students, tests, results),
    [student.id, student.class, students, tests, results]
  );

  const fullName = `${student.firstName} ${student.middleName} ${student.lastName}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Профил на ученик" size="xl">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{fullName}</h2>
              <div className="flex gap-4 text-sm text-gray-600">
                <span className="font-medium">Клас: <span className="text-blue-700">{student.class}</span></span>
                <span className="font-medium">№ в клас: <span className="text-blue-700">{student.number}</span></span>
                <span className="font-medium">Пол: <span className="text-blue-700">{student.gender === 'male' ? '👨 Момче' : '👩 Момиче'}</span></span>
              </div>
            </div>
            <div className="text-6xl opacity-80">{student.gender === 'male' ? '👨' : '👩'}</div>
          </div>
        </div>

        {/* Check if student has any results */}
        {studentStats.totalTests === 0 ? (
          <div className="bg-yellow-50 p-8 rounded-lg text-center border border-yellow-200">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Няма данни за този ученик
            </h3>
            <p className="text-yellow-700">
              Ученикът все още не е написал нито един тест
            </p>
          </div>
        ) : (
          <>
            {/* Overview Statistics */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Обща статистика</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StudentStatsCard
                  title="Написани тестове"
                  value={studentStats.totalTests}
                  icon="📝"
                  color="blue"
                />
                <StudentStatsCard
                  title="Среден успех"
                  value={studentStats.averageGrade.toFixed(2)}
                  subtitle={`${studentStats.averagePercentage.toFixed(1)}%`}
                  icon="📊"
                  color="purple"
                />
                <StudentStatsCard
                  title="Най-висока оценка"
                  value={studentStats.highestGrade.toFixed(2)}
                  icon="🏆"
                  color="green"
                />
                <StudentStatsCard
                  title="Най-ниска оценка"
                  value={studentStats.lowestGrade.toFixed(2)}
                  icon="📉"
                  color="orange"
                />
              </div>
            </div>

            {/* Grade Distribution */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Разпределение на оценките</h3>
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-green-100 p-4 rounded-lg text-center border-l-4 border-green-500">
                  <div className="text-2xl mb-1">🏆</div>
                  <h4 className="font-semibold text-green-800 text-sm mb-1">Отличен</h4>
                  <p className="text-3xl font-bold text-green-800">
                    {studentStats.gradeDistribution.excellent}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {studentStats.totalTests > 0
                      ? `${((studentStats.gradeDistribution.excellent / studentStats.totalTests) * 100).toFixed(0)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-blue-100 p-4 rounded-lg text-center border-l-4 border-blue-500">
                  <div className="text-2xl mb-1">⭐</div>
                  <h4 className="font-semibold text-blue-800 text-sm mb-1">Мн. добър</h4>
                  <p className="text-3xl font-bold text-blue-800">
                    {studentStats.gradeDistribution.veryGood}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {studentStats.totalTests > 0
                      ? `${((studentStats.gradeDistribution.veryGood / studentStats.totalTests) * 100).toFixed(0)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-yellow-100 p-4 rounded-lg text-center border-l-4 border-yellow-500">
                  <div className="text-2xl mb-1">👍</div>
                  <h4 className="font-semibold text-yellow-800 text-sm mb-1">Добър</h4>
                  <p className="text-3xl font-bold text-yellow-800">
                    {studentStats.gradeDistribution.good}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {studentStats.totalTests > 0
                      ? `${((studentStats.gradeDistribution.good / studentStats.totalTests) * 100).toFixed(0)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-orange-100 p-4 rounded-lg text-center border-l-4 border-orange-500">
                  <div className="text-2xl mb-1">📌</div>
                  <h4 className="font-semibold text-orange-800 text-sm mb-1">Среден</h4>
                  <p className="text-3xl font-bold text-orange-800">
                    {studentStats.gradeDistribution.average}
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    {studentStats.totalTests > 0
                      ? `${((studentStats.gradeDistribution.average / studentStats.totalTests) * 100).toFixed(0)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-red-100 p-4 rounded-lg text-center border-l-4 border-red-500">
                  <div className="text-2xl mb-1">⚠️</div>
                  <h4 className="font-semibold text-red-800 text-sm mb-1">Слаб</h4>
                  <p className="text-3xl font-bold text-red-800">
                    {studentStats.gradeDistribution.poor}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {studentStats.totalTests > 0
                      ? `${((studentStats.gradeDistribution.poor / studentStats.totalTests) * 100).toFixed(0)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Class Comparison */}
            {classComparison.totalStudents > 1 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Сравнение с класа</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Успех на ученика</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {classComparison.studentAverage.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Среден успех на класа</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {classComparison.classAverage.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Разлика</p>
                    <p
                      className={`text-2xl font-bold ${
                        classComparison.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {classComparison.difference >= 0 ? '+' : ''}
                      {classComparison.difference.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Позиция в класа</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      {classComparison.rank}/{classComparison.totalStudents}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Топ {classComparison.percentile.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Chart */}
            {progressData.length > 1 && (
              <div>
                <StudentProgressChart data={progressData} />
              </div>
            )}

            {/* Test Type Statistics */}
            {studentStats.testTypeStats.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Статистика по типове тестове</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Тип тест
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Брой тестове
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Средна оценка
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Среден процент
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {studentStats.testTypeStats.map((stat, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                            {stat.type}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{stat.count}</td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`inline-block px-3 py-1 rounded-full font-semibold ${getGradeColor(
                                stat.averageGrade
                              )}`}
                            >
                              {stat.averageGrade.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {stat.averagePercentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tests History */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">История на резултатите</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Всички тестове, подредени по дата (най-нови отгоре)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        №
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Име на тест
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Тип
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Точки
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Процент
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Оценка
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {studentResults.map((result, index) => {
                      const gradeNum = parseFloat(result.grade);
                      return (
                        <tr key={result.testId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-700">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {result.testName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{result.testType}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {formatDate(result.testDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {result.points}/{result.maxPoints}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {result.percentage.toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`inline-block px-4 py-1.5 rounded-full font-bold border-2 ${getGradeColor(
                                gradeNum
                              )} ${getGradeBorderColor(gradeNum)}`}
                            >
                              {result.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};


