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

export interface GradeScale {
  grade2: number | string; // Минимални точки за оценка 2
  grade3: number | string; // Минимални точки за оценка 3
  grade4: number | string; // Минимални точки за оценка 4
  grade5: number | string; // Минимални точки за оценка 5
  grade6: number | string; // Минимални точки за оценка 6
}

export interface Question {
  id: string;
  text: string;
  points: number;
}

export interface Test {
  id: string;
  name: string;
  class: string;
  type: TestType;
  date: string;
  maxPoints: number;
  gradeScale: GradeScale; // Задължителна скала за оценяване
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
