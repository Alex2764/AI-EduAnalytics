import type { GradeScale } from '../types';

interface GradeResult {
  grade: string;
  percentage: number;
}

export const calculateGrade = (
  points: number, 
  maxPoints: number, 
  gradeScale: GradeScale
): GradeResult => {
  const percentage = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
  
  // Преобразуване на gradeScale към number
  const grade2 = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
  const grade3 = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
  const grade4 = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
  const grade5 = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
  const grade6 = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;
  
  let grade = '';
  
  // Изчисляваме точната оценка с десетични части
  if (points >= grade6) {
    grade = '6.00';
  } else if (points >= grade5) {
    const range = grade6 - grade5;
    if (range > 0) {
      const progress = points - grade5;
      const gradeValue = 5 + (progress / range) * 0.99; // 5.00 до 5.99
      grade = gradeValue.toFixed(2);
    } else {
      grade = '5.00';
    }
  } else if (points >= grade4) {
    const range = grade5 - grade4;
    if (range > 0) {
      const progress = points - grade4;
      const gradeValue = 4 + (progress / range) * 0.99; // 4.00 до 4.99
      grade = gradeValue.toFixed(2);
    } else {
      grade = '4.00';
    }
  } else if (points >= grade3) {
    const range = grade4 - grade3;
    if (range > 0) {
      const progress = points - grade3;
      const gradeValue = 3 + (progress / range) * 0.49; // 3.00 до 3.49
      grade = gradeValue.toFixed(2);
    } else {
      grade = '3.00';
    }
  } else if (points >= grade2) {
    const range = grade3 - grade2;
    if (range > 0) {
      const progress = points - grade2;
      const gradeValue = 2 + (progress / range) * 0.49; // 2.00 до 2.49
      grade = gradeValue.toFixed(2);
    } else {
      grade = '2.00';
    }
  } else {
    grade = '2.00';
  }

  return { grade, percentage };
};
