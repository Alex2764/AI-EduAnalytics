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

export interface Test {
  id: string;
  name: string;
  class: string;
  type: TestType;
  date: string;
  maxPoints: number;
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
}
