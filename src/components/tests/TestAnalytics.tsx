import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAppContext } from '../../context/AppContext';
import { formatDate } from '../../utils/dateFormatter';
import { calculateGenderStats, getNonParticipatingStudents, getCancelledTestStudents, calculateQuestionStats } from '../../utils/studentAnalytics';

interface TestAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
}

export const TestAnalytics: React.FC<TestAnalyticsProps> = ({ isOpen, onClose, testId }) => {
  const { tests, results, students } = useAppContext();

  const test = tests.find(t => t.id === testId);
  const allTestResults = results.filter(r => r.testId === testId);
  const testResults = allTestResults.filter(r => r.participated && !r.cancelled); // Only participated and not cancelled students
  const classStudents = students.filter(s => s.class === test?.class);
  
  // Calculate gender statistics and get non-participating students early
  const genderStats = test ? calculateGenderStats(testId, test.class, students, allTestResults) : null;
  const nonParticipatingStudents = test ? getNonParticipatingStudents(testId, test.class, students, allTestResults) : [];
  const cancelledStudents = test ? getCancelledTestStudents(testId, test.class, students, allTestResults) : [];
  const questionStats = test ? calculateQuestionStats(testId, tests, allTestResults) : [];

  if (!test) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Анализ на тест" size="lg">
        <div className="text-center py-8">
          <p className="text-gray-500">Тестът не е намерен</p>
          <Button variant="secondary" onClick={onClose} className="mt-4">
            Затвори
          </Button>
        </div>
      </Modal>
    );
  }

  // If no results exist at all, show message
  if (allTestResults.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Анализ на тест" size="lg">
        <div className="text-center py-8">
          <p className="text-gray-500">Няма резултати за анализ</p>
          <Button variant="secondary" onClick={onClose} className="mt-4">
            Затвори
          </Button>
        </div>
      </Modal>
    );
  }

  // If no students participated (all marked as not participated), show special message
  if (testResults.length === 0 && allTestResults.length > 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Анализ на тест" size="lg">
        <div className="analytics-container">
          {/* Header with Test Info */}
          <div className="analytics-header">
            <div className="test-title">
              <h2 className="test-name">{test.name}</h2>
              <div className="test-badge">{test.class}</div>
            </div>
            <div className="test-meta">
              <div className="meta-item">
                <span className="meta-label">Тип</span>
                <span className="meta-value">{test.type}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Дата</span>
                <span className="meta-value">{formatDate(test.date)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Макс. точки</span>
                <span className="meta-value">{test.maxPoints}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Резултати</span>
                <span className="meta-value">0/{classStudents.length}</span>
              </div>
            </div>
          </div>

          {/* No Participation Message */}
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Никой ученик не е участвал в този тест
            </h3>
            <p className="text-gray-600 mb-6">
              Всички ученици от клас {test.class} са маркирани като "НЕ участват"
            </p>
            <Button variant="secondary" onClick={onClose}>
              Затвори
            </Button>
          </div>

          {/* Show non-participating students */}
          {nonParticipatingStudents.length > 0 && (
            <div className="non-participating-section">
              <h3 className="section-title">Ученици, които НЕ са правили теста</h3>
              <div className="non-participating-list">
                <div className="participation-summary">
                  <span className="summary-text">
                    Общо: <strong>{nonParticipatingStudents.length}</strong> ученика не са участвали
                  </span>
                </div>
                <div className="students-grid">
                  {nonParticipatingStudents.map((student) => (
                    <div key={student.id} className="student-card">
                      <div className="student-info">
                        <div className="student-number">№{student.number}</div>
                        <div className="student-name">
                          {student.firstName} {student.middleName} {student.lastName}
                        </div>
                        <div className="student-gender">
                          {student.gender === 'male' ? '👨 Момче' : '👩 Момиче'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // Calculate statistics
  const totalStudents = classStudents.length;
  const totalResults = testResults.length;
  
  // Grade distribution (българска система на закръгляване)
  const gradeStats = {
    6: testResults.filter(r => parseFloat(r.grade) >= 5.50).length, // 5.50+ → 6
    5: testResults.filter(r => parseFloat(r.grade) >= 4.50 && parseFloat(r.grade) < 5.50).length, // 4.50-5.49 → 5
    4: testResults.filter(r => parseFloat(r.grade) >= 3.50 && parseFloat(r.grade) < 4.50).length, // 3.50-4.49 → 4
    3: testResults.filter(r => parseFloat(r.grade) >= 2.50 && parseFloat(r.grade) < 3.50).length, // 2.50-3.49 → 3
    2: testResults.filter(r => parseFloat(r.grade) >= 2.0 && parseFloat(r.grade) < 2.50).length, // 2.00-2.49 → 2
  };

  const gradePercentages = {
    6: totalResults > 0 ? ((gradeStats[6] / totalResults) * 100).toFixed(1) : '0',
    5: totalResults > 0 ? ((gradeStats[5] / totalResults) * 100).toFixed(1) : '0',
    4: totalResults > 0 ? ((gradeStats[4] / totalResults) * 100).toFixed(1) : '0',
    3: totalResults > 0 ? ((gradeStats[3] / totalResults) * 100).toFixed(1) : '0',
    2: totalResults > 0 ? ((gradeStats[2] / totalResults) * 100).toFixed(1) : '0',
  };

  // Calculate averages
  const avgPoints = totalResults > 0 ? 
    (testResults.reduce((sum, r) => sum + r.points, 0) / totalResults).toFixed(1) : '0';
  
  const avgPercentage = totalResults > 0 ? 
    (testResults.reduce((sum, r) => sum + r.percentage, 0) / totalResults).toFixed(1) : '0';

  const gradeValues = testResults.map(r => parseFloat(r.grade) || 0);
  const avgGrade = totalResults > 0 ? 
    (gradeValues.reduce((sum, g) => sum + g, 0) / totalResults).toFixed(2) : '0.00';

  const goodGrades = gradeStats[5] + gradeStats[6];
  const goodGradesPercentage = totalResults > 0 ? ((goodGrades / totalResults) * 100).toFixed(1) : '0';

  const passRate = totalResults > 0 ? 
    ((testResults.filter(r => parseFloat(r.grade) >= 2.50).length / totalResults) * 100).toFixed(1) : '0';

  // Gender statistics and non-participating students are already calculated above
  
  // Ensure we have valid data
  if (!genderStats) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Анализ на тест" size="lg">
        <div className="text-center py-8">
          <p className="text-gray-500">Грешка при зареждане на данните</p>
          <Button variant="secondary" onClick={onClose} className="mt-4">
            Затвори
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Анализ на тест" size="xl">
      <div className="analytics-container">
        {/* Header with Test Info */}
        <div className="analytics-header">
          <div className="test-title">
            <h2 className="test-name">{test.name}</h2>
            <div className="test-badge">{test.class}</div>
          </div>
          <div className="test-meta">
            <div className="meta-item">
              <span className="meta-label">Тип</span>
              <span className="meta-value">{test.type}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Дата</span>
              <span className="meta-value">{formatDate(test.date)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Макс. точки</span>
              <span className="meta-value">{test.maxPoints}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Резултати</span>
              <span className="meta-value">{totalResults}/{totalStudents}</span>
            </div>
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div className="metrics-dashboard">
          <div className="metric-card primary">
            <div className="metric-icon">👥</div>
            <div className="metric-content">
              <div className="metric-value">{totalStudents}</div>
              <div className="metric-label">Ученици</div>
            </div>
          </div>
          
          <div className="metric-card secondary">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <div className="metric-value">{totalResults}</div>
              <div className="metric-label">Резултати</div>
            </div>
          </div>
          
          <div className="metric-card success">
            <div className="metric-icon">⭐</div>
            <div className="metric-content">
              <div className="metric-value">{avgGrade}</div>
              <div className="metric-label">Среден успех</div>
            </div>
          </div>
          
          <div className="metric-card warning">
            <div className="metric-icon">🎯</div>
            <div className="metric-content">
              <div className="metric-value">{goodGradesPercentage}%</div>
              <div className="metric-label">Добри (5-6)</div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="performance-section">
          <h3 className="section-title">Преглед на успеваемостта</h3>
          <div className="performance-grid">
            <div className="performance-item">
              <div className="performance-number">{avgPoints}</div>
              <div className="performance-text">Средни точки</div>
            </div>
            <div className="performance-item">
              <div className="performance-number">{avgPercentage}%</div>
              <div className="performance-text">Среден процент</div>
            </div>
            <div className="performance-item">
              <div className="performance-number">{passRate}%</div>
              <div className="performance-text">Успеваемост (≥3)</div>
            </div>
          </div>
        </div>

        {/* Gender Statistics */}
        <div className="gender-statistics">
          <h3 className="section-title">Статистика по пол</h3>
          <div className="gender-grid">
            <div className="gender-card male">
              <div className="gender-icon">👨</div>
              <div className="gender-content">
                <h4 className="gender-title">Момчета</h4>
                <div className="gender-stats">
                  <div className="stat-row">
                    <span className="stat-label">Участвали в теста:</span>
                    <span className="stat-value">{genderStats.male.count}/{genderStats.totalStudents.male}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Участие:</span>
                    <span className="stat-value">{genderStats.male.participationRate.toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Среден успех:</span>
                    <span className="stat-value">{genderStats.male.averageGrade.toFixed(2)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Среден процент:</span>
                    <span className="stat-value">{genderStats.male.averagePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Средни точки:</span>
                    <span className="stat-value">{genderStats.male.averagePoints.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="gender-card female">
              <div className="gender-icon">👩</div>
              <div className="gender-content">
                <h4 className="gender-title">Момичета</h4>
                <div className="gender-stats">
                  <div className="stat-row">
                    <span className="stat-label">Участвали в теста:</span>
                    <span className="stat-value">{genderStats.female.count}/{genderStats.totalStudents.female}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Участие:</span>
                    <span className="stat-value">{genderStats.female.participationRate.toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Среден успех:</span>
                    <span className="stat-value">{genderStats.female.averageGrade.toFixed(2)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Среден процент:</span>
                    <span className="stat-value">{genderStats.female.averagePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Средни точки:</span>
                    <span className="stat-value">{genderStats.female.averagePoints.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Non-Participating Students */}
        {nonParticipatingStudents.length > 0 && (
          <div className="non-participating-section">
            <h3 className="section-title">Ученици, които НЕ са правили теста</h3>
            <div className="non-participating-list">
              <div className="participation-summary">
                <span className="summary-text">
                  Общо: <strong>{nonParticipatingStudents.length}</strong> ученика не са участвали
                </span>
              </div>
              <div className="students-grid">
                {nonParticipatingStudents.map((student) => (
                  <div key={student.id} className="student-card">
                    <div className="student-info">
                      <div className="student-number">№{student.number}</div>
                      <div className="student-name">
                        {student.firstName} {student.middleName} {student.lastName}
                      </div>
                      <div className="student-gender">
                        {student.gender === 'male' ? '👨 Момче' : '👩 Момиче'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grade Distribution */}
        <div className="grade-distribution">
          <h3 className="section-title">Разпределение на оценките</h3>
          <div className="grade-grid">
            <div className="grade-card excellent">
              <div className="grade-number">6</div>
              <div className="grade-label">Отличен</div>
              <div className="grade-stats">
                <div className="grade-count">{gradeStats[6]} ученика</div>
                <div className="grade-percentage">{gradePercentages[6]}%</div>
              </div>
            </div>
            
            <div className="grade-card very-good">
              <div className="grade-number">5</div>
              <div className="grade-label">Много добър</div>
              <div className="grade-stats">
                <div className="grade-count">{gradeStats[5]} ученика</div>
                <div className="grade-percentage">{gradePercentages[5]}%</div>
              </div>
            </div>
            
            <div className="grade-card good">
              <div className="grade-number">4</div>
              <div className="grade-label">Добър</div>
              <div className="grade-stats">
                <div className="grade-count">{gradeStats[4]} ученика</div>
                <div className="grade-percentage">{gradePercentages[4]}%</div>
              </div>
            </div>
            
            <div className="grade-card satisfactory">
              <div className="grade-number">3</div>
              <div className="grade-label">Среден</div>
              <div className="grade-stats">
                <div className="grade-count">{gradeStats[3]} ученика</div>
                <div className="grade-percentage">{gradePercentages[3]}%</div>
              </div>
            </div>
            
            <div className="grade-card poor">
              <div className="grade-number">2</div>
              <div className="grade-label">Слаб</div>
              <div className="grade-stats">
                <div className="grade-count">{gradeStats[2]} ученика</div>
                <div className="grade-percentage">{gradePercentages[2]}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Statistics Section */}
        {questionStats.length > 0 && (
          <div className="question-stats-section">
            <h3 className="section-title">📊 Статистика по въпроси</h3>
            <p className="section-subtitle">Детайлен анализ на успеваемостта по всеки въпрос</p>
            
            <div className="stats-grid-container">
              <div className="stats-grid">
                {questionStats.map((qStat, index) => {
                  const successPercentage = ((qStat.averagePoints / qStat.maxPoints) * 100);
                  const getCardClass = (percentage: number) => {
                    if (percentage >= 80) return 'stats-card excellent';
                    if (percentage >= 60) return 'stats-card good';
                    if (percentage >= 40) return 'stats-card average';
                    return 'stats-card poor';
                  };

                  return (
                    <div key={qStat.questionId} className={getCardClass(successPercentage)}>
                      <div className="question-info">
                        <span className="question-icon">
                          {successPercentage >= 80 ? '✅' : 
                           successPercentage >= 60 ? '⚠️' : 
                           successPercentage >= 40 ? '🔶' : '❌'}
                        </span>
                        <span className="question-text">Задача {index + 1}</span>
                      </div>
                      <div className="percentage-display">
                        <span className="percentage-value">{successPercentage.toFixed(0)}%</span>
                        <span className="percentage-label">успех</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Cancelled Tests Section */}
        {cancelledStudents.length > 0 && (
          <div className="non-participating-section">
            <h3 className="section-title">🚫 Анулирани тестове</h3>
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="participation-summary">
                <span className="summary-text text-red-800">
                  Общо: <strong>{cancelledStudents.length}</strong> ученика с анулирани тестове
                </span>
              </div>
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Тези резултати не се включват в статистиката и средния успех на класа
              </p>
              <div className="students-grid">
                {cancelledStudents.map(({ student, reason }) => (
                  <div key={student.id} className="student-card bg-red-100 border-2 border-red-300">
                    <div className="student-info">
                      <div className="student-number bg-red-600 text-white">№{student.number}</div>
                      <div className="student-name font-semibold">
                        {student.firstName} {student.middleName} {student.lastName}
                      </div>
                      <div className="student-gender">
                        {student.gender === 'male' ? '👨 Момче' : '👩 Момиче'}
                      </div>
                      <div className="mt-2 text-xs text-red-700 font-medium">
                        📋 Причина: {reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};
