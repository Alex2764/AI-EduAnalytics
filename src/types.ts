export interface Class {
  id: string;
  name: string;
  schoolYear: string;
  createdDate: string;
}

export type GenderType = 'male' | 'female';

export interface Student {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  class: string;
  number: number;
  gender: GenderType;
}

export type TestType = 
  | 'Нормален тест'
  | 'Класна работа' 
  | 'Входно ниво'
  | 'Изходно ниво'
  | 'Междинно ниво'
  | 'Текуща оценка';

export type TestMode = 'offline' | 'online';

export interface GradeScale {
  grade2: number | string; // Минимални точки за оценка 2
  grade3: number | string; // Минимални точки за оценка 3
  grade4: number | string; // Минимални точки за оценка 4
  grade5: number | string; // Минимални точки за оценка 5
  grade6: number | string; // Минимални точки за оценка 6
}

export type QuestionType = 'multiple_choice' | 'short_answer';

export interface QuestionGroupContent {
  text: string;
  correctAnswer: string;
  options?: string[];
}

export interface Question {
  id: string;
  text: string;
  points: number;
  type: QuestionType;
  options?: string[];
  correctAnswer?: string;
  group1?: QuestionGroupContent;
  group2?: QuestionGroupContent;
}

export interface Test {
  id: string;
  name: string;
  class: string;
  type: TestType;
  date: string;
  maxPoints: number;
  gradeScale: GradeScale; // Задължителна скала за оценяване
  hasGroups: boolean;
  mode: TestMode;
  questions: Question[]; // Въпроси в теста
}

export interface QuestionResult {
  questionId: string;
  points: number;
}

export interface Result {
  id: string;
  studentId: string;
  testId: string;
  points: number;
  grade: string;
  percentage: number;
  dateAdded: string;
  participated: boolean;
  cancelled: boolean; // Анулиран тест (напр. при преписване)
  cancelReason?: string; // Причина за анулиране
  questionResults?: QuestionResult[]; // Детайлни точки по въпроси
}

export type SubmissionStatus = 'pending_review' | 'finalized';

export interface SubmissionAnswer {
  questionId: string;
  answer: string;
  auto_points: number;
}

export interface Submission {
  id: string;
  testId: string;
  studentName: string;
  groupNumber: number;
  answers: SubmissionAnswer[];
  autoPoints: number;
  status: SubmissionStatus;
  createdAt: string;
}
