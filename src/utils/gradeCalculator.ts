interface GradeResult {
  grade: string;
  percentage: number;
}

const GRADE_THRESHOLDS = {
  EXCELLENT: 92,
  VERY_GOOD: 76,
  GOOD: 60,
  SATISFACTORY: 40,
  MINIMUM: 0
} as const;

const GRADE_RANGES = {
  EXCELLENT: 15,
  VERY_GOOD: 15,
  GOOD: 19,
  SATISFACTORY: 40
} as const;

export const calculateGrade = (points: number, maxPoints: number): GradeResult => {
  const percentage = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
  
  let grade = '';
  
  if (percentage >= GRADE_THRESHOLDS.EXCELLENT) {
    grade = '6.00';
  } else if (percentage >= GRADE_THRESHOLDS.VERY_GOOD) {
    const gradeValue = 5 + ((percentage - GRADE_THRESHOLDS.VERY_GOOD) / GRADE_RANGES.EXCELLENT) * 0.99;
    grade = gradeValue.toFixed(2);
  } else if (percentage >= GRADE_THRESHOLDS.GOOD) {
    const gradeValue = 4 + ((percentage - GRADE_THRESHOLDS.GOOD) / GRADE_RANGES.VERY_GOOD) * 0.99;
    grade = gradeValue.toFixed(2);
  } else if (percentage >= GRADE_THRESHOLDS.SATISFACTORY) {
    const gradeValue = 3 + ((percentage - GRADE_THRESHOLDS.SATISFACTORY) / GRADE_RANGES.GOOD) * 0.99;
    grade = gradeValue.toFixed(2);
  } else if (percentage > GRADE_THRESHOLDS.MINIMUM) {
    const gradeValue = 2 + (percentage / GRADE_RANGES.SATISFACTORY) * 0.99;
    grade = gradeValue.toFixed(2);
  }

  return { grade, percentage };
};
