import type { Student, Test, Result } from '../types';

export interface StudentResult {
  testId: string;
  testName: string;
  testType: string;
  testDate: string;
  points: number;
  maxPoints: number;
  percentage: number;
  grade: string;
}

export interface StudentStats {
  totalTests: number;
  averageGrade: number;
  averagePercentage: number;
  highestGrade: number;
  lowestGrade: number;
  gradeDistribution: {
    excellent: number; // 6
    veryGood: number; // 5
    good: number; // 4
    average: number; // 3
    poor: number; // 2
  };
  testTypeStats: TestTypeStats[];
}

export interface TestTypeStats {
  type: string;
  count: number;
  averageGrade: number;
  averagePercentage: number;
}

export interface ProgressDataPoint {
  date: string;
  grade: number;
  testName: string;
}

export interface ClassComparison {
  studentAverage: number;
  classAverage: number;
  difference: number;
  percentile: number; // Position in class (0-100%)
  rank: number; // Actual rank (1, 2, 3, etc.)
  totalStudents: number;
}

export interface GenderStats {
  male: {
    count: number;
    averageGrade: number;
    averagePercentage: number;
    averagePoints: number;
    participationRate: number; // percentage of male students who took the test
  };
  female: {
    count: number;
    averageGrade: number;
    averagePercentage: number;
    averagePoints: number;
    participationRate: number; // percentage of female students who took the test
  };
  totalStudents: {
    male: number;
    female: number;
  };
}

/**
 * Get all results for a specific student with test details
 */
export const getStudentResults = (
  studentId: string,
  tests: Test[],
  results: Result[]
): StudentResult[] => {
  const studentResults = results.filter(r => r.studentId === studentId);
  
  const validResults = studentResults
    .map(result => {
      const test = tests.find(t => t.id === result.testId);
      if (!test) return null;
      
      return {
        testId: test.id,
        testName: test.name,
        testType: test.type as any,
        testDate: test.date,
        points: result.points,
        maxPoints: test.maxPoints,
        percentage: result.percentage,
        grade: result.grade,
      };
    })
    .filter((r): r is StudentResult => r !== null);
    
  return validResults.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
};

/**
 * Calculate comprehensive statistics for a student
 */
export const calculateStudentStats = (
  studentId: string,
  tests: Test[],
  results: Result[]
): StudentStats => {
  const studentResults = getStudentResults(studentId, tests, results);
  
  if (studentResults.length === 0) {
    return {
      totalTests: 0,
      averageGrade: 0,
      averagePercentage: 0,
      highestGrade: 0,
      lowestGrade: 0,
      gradeDistribution: {
        excellent: 0,
        veryGood: 0,
        good: 0,
        average: 0,
        poor: 0,
      },
      testTypeStats: [],
    };
  }

  // Calculate grades
  const grades = studentResults.map(r => parseFloat(r.grade));
  const percentages = studentResults.map(r => r.percentage);
  
  const averageGrade = grades.reduce((sum, g) => sum + g, 0) / grades.length;
  const averagePercentage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  const highestGrade = Math.max(...grades);
  const lowestGrade = Math.min(...grades);

  // Grade distribution
  const gradeDistribution = {
    excellent: grades.filter(g => g >= 6.0).length,
    veryGood: grades.filter(g => g >= 5.0 && g < 6.0).length,
    good: grades.filter(g => g >= 4.0 && g < 5.0).length,
    average: grades.filter(g => g >= 3.0 && g < 4.0).length,
    poor: grades.filter(g => g >= 2.0 && g < 3.0).length,
  };

  // Test type statistics
  const testTypes = [...new Set(studentResults.map(r => r.testType))];
  const testTypeStats = testTypes.map(type => {
    const typeResults = studentResults.filter(r => r.testType === type);
    const typeGrades = typeResults.map(r => parseFloat(r.grade));
    const typePercentages = typeResults.map(r => r.percentage);
    
    return {
      type,
      count: typeResults.length,
      averageGrade: typeGrades.reduce((sum, g) => sum + g, 0) / typeGrades.length,
      averagePercentage: typePercentages.reduce((sum, p) => sum + p, 0) / typePercentages.length,
    };
  }).sort((a, b) => b.averageGrade - a.averageGrade);

  return {
    totalTests: studentResults.length,
    averageGrade,
    averagePercentage,
    highestGrade,
    lowestGrade,
    gradeDistribution,
    testTypeStats,
  };
};

/**
 * Get progress data for charting (chronological order)
 */
export const getStudentProgressData = (
  studentId: string,
  tests: Test[],
  results: Result[]
): ProgressDataPoint[] => {
  const studentResults = getStudentResults(studentId, tests, results);
  
  return studentResults
    .map(result => ({
      date: result.testDate,
      grade: parseFloat(result.grade),
      testName: result.testName,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Compare student performance with class average
 */
export const compareWithClassAverage = (
  studentId: string,
  className: string,
  students: Student[],
  tests: Test[],
  results: Result[]
): ClassComparison => {
  // Get student's average
  const studentStats = calculateStudentStats(studentId, tests, results);
  const studentAverage = studentStats.averageGrade;

  // Get all students in the class
  const classStudents = students.filter(s => s.class === className);
  
  // Calculate average for each student in class
  const studentAverages = classStudents
    .map(student => {
      const stats = calculateStudentStats(student.id, tests, results);
      return {
        studentId: student.id,
        average: stats.totalTests > 0 ? stats.averageGrade : 0,
        totalTests: stats.totalTests,
      };
    })
    .filter(s => s.totalTests > 0); // Only students with tests

  if (studentAverages.length === 0) {
    return {
      studentAverage,
      classAverage: 0,
      difference: 0,
      percentile: 0,
      rank: 1,
      totalStudents: 1,
    };
  }

  // Calculate class average
  const classAverage = 
    studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length;

  // Calculate rank and percentile
  const sortedAverages = studentAverages
    .sort((a, b) => b.average - a.average);
  
  const rank = sortedAverages.findIndex(s => s.studentId === studentId) + 1;
  const percentile = ((sortedAverages.length - rank) / sortedAverages.length) * 100;

  return {
    studentAverage,
    classAverage,
    difference: studentAverage - classAverage,
    percentile,
    rank,
    totalStudents: sortedAverages.length,
  };
};

/**
 * Get grade color class based on grade value
 */
export const getGradeColor = (grade: number | string): string => {
  const gradeNum = typeof grade === 'string' ? parseFloat(grade) : grade;
  
  if (gradeNum >= 6.0) return 'text-green-700 bg-green-50';
  if (gradeNum >= 5.0) return 'text-blue-700 bg-blue-50';
  if (gradeNum >= 4.0) return 'text-yellow-700 bg-yellow-50';
  if (gradeNum >= 3.0) return 'text-orange-700 bg-orange-50';
  return 'text-red-700 bg-red-50';
};

/**
 * Get grade border color class
 */
export const getGradeBorderColor = (grade: number | string): string => {
  const gradeNum = typeof grade === 'string' ? parseFloat(grade) : grade;
  
  if (gradeNum >= 6.0) return 'border-green-500';
  if (gradeNum >= 5.0) return 'border-blue-500';
  if (gradeNum >= 4.0) return 'border-yellow-500';
  if (gradeNum >= 3.0) return 'border-orange-500';
  return 'border-red-500';
};

/**
 * Get students who did not participate in a specific test
 */
export const getNonParticipatingStudents = (
  testId: string,
  className: string,
  students: Student[],
  results: Result[]
): Student[] => {
  const classStudents = students.filter(s => s.class === className);
  const testResults = results.filter(r => r.testId === testId);
  
  // Find students who don't have results OR have participated=false
  const nonParticipatingStudents = classStudents.filter(student => {
    const hasResult = testResults.find(r => r.studentId === student.id);
    return !hasResult || (hasResult && !hasResult.participated);
  });
  
  return nonParticipatingStudents;
};

/**
 * Calculate gender-based statistics for a specific test
 */
export const calculateGenderStats = (
  testId: string,
  className: string,
  students: Student[],
  results: Result[]
): GenderStats => {
  // Get all students in the class
  const classStudents = students.filter(s => s.class === className);
  
  // Get results for this specific test
  const testResults = results.filter(r => r.testId === testId);
  
  // Separate students by gender
  const maleStudents = classStudents.filter(s => s.gender === 'male');
  const femaleStudents = classStudents.filter(s => s.gender === 'female');
  
  // Get results by gender (only participated students)
  const maleResults = testResults.filter(result => {
    const student = students.find(s => s.id === result.studentId);
    return student && student.gender === 'male' && result.participated;
  });
  
  const femaleResults = testResults.filter(result => {
    const student = students.find(s => s.id === result.studentId);
    return student && student.gender === 'female' && result.participated;
  });
  
  // Calculate male statistics
  const maleStats = {
    count: maleResults.length,
    averageGrade: maleResults.length > 0 
      ? maleResults.reduce((sum, r) => sum + parseFloat(r.grade), 0) / maleResults.length 
      : 0,
    averagePercentage: maleResults.length > 0 
      ? maleResults.reduce((sum, r) => sum + r.percentage, 0) / maleResults.length 
      : 0,
    averagePoints: maleResults.length > 0 
      ? maleResults.reduce((sum, r) => sum + r.points, 0) / maleResults.length 
      : 0,
    participationRate: maleStudents.length > 0 
      ? (maleResults.length / maleStudents.length) * 100 
      : 0,
  };
  
  // Calculate female statistics
  const femaleStats = {
    count: femaleResults.length,
    averageGrade: femaleResults.length > 0 
      ? femaleResults.reduce((sum, r) => sum + parseFloat(r.grade), 0) / femaleResults.length 
      : 0,
    averagePercentage: femaleResults.length > 0 
      ? femaleResults.reduce((sum, r) => sum + r.percentage, 0) / femaleResults.length 
      : 0,
    averagePoints: femaleResults.length > 0 
      ? femaleResults.reduce((sum, r) => sum + r.points, 0) / femaleResults.length 
      : 0,
    participationRate: femaleStudents.length > 0 
      ? (femaleResults.length / femaleStudents.length) * 100 
      : 0,
  };
  
  return {
    male: maleStats,
    female: femaleStats,
    totalStudents: {
      male: maleStudents.length,
      female: femaleStudents.length,
    },
  };
};


