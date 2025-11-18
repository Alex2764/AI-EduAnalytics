import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Class, Student, Test, Result } from '../types';

interface AppContextType {
  // State
  classes: Class[];
  students: Student[];
  tests: Test[];
  results: Result[];
  loading: boolean;
  error: string | null;

  // Classes
  addClass: (classData: Omit<Class, 'id'>) => Promise<void>;
  updateClass: (id: string, classData: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  // Students
  addStudent: (studentData: Omit<Student, 'id'>) => Promise<void>;
  addMultipleStudents: (studentsData: Omit<Student, 'id'>[]) => Promise<void>;
  updateStudent: (id: string, studentData: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  // Tests
  addTest: (testData: Omit<Test, 'id'>) => Promise<void>;
  updateTest: (id: string, testData: Partial<Test>) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;

  // Results
  addResult: (resultData: Omit<Result, 'id'>) => Promise<void>;
  addMultipleResults: (resultsData: Omit<Result, 'id'>[]) => Promise<void>;
  updateResult: (id: string, resultData: Partial<Result>) => Promise<void>;
  deleteResult: (id: string) => Promise<void>;
  saveResults: (testId: string, resultsData: Omit<Result, 'id'>[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================
  // FETCH DATA FROM SUPABASE
  // ========================================
  
  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Map Supabase data to our Class type
      const mappedClasses: Class[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        schoolYear: item.school_year,
        createdDate: item.created_date || new Date(item.created_at).toISOString()
      }));
      
      setClasses(mappedClasses);
    } catch (err: any) {
      console.error('Error fetching classes:', err);
      setError(err.message);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('class_name', { ascending: true })
        .order('number', { ascending: true });

      if (error) throw error;
      
      // Map Supabase data to our Student type
      const mappedStudents: Student[] = (data || []).map((item: any) => ({
        id: item.id,
        firstName: item.first_name,
        middleName: item.middle_name,
        lastName: item.last_name,
        class: item.class_name, // Using class_name from table
        number: item.number,
        gender: item.gender || 'male' // Default to 'male' if gender is null
      }));
      
      setStudents(mappedStudents);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError(err.message);
    }
  }, []);

  const fetchTests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Map Supabase data to our Test type
      const mappedTests: Test[] = (data || []).map((item: any) => {
        const maxPoints = item.max_points;
        // Load gradeScale from database or create default
        let gradeScale;
        if (item.grade_scale) {
          gradeScale = item.grade_scale;
        } else {
          gradeScale = {
            grade2: 0,
            grade3: Math.round(maxPoints * 0.40),
            grade4: Math.round(maxPoints * 0.60),
            grade5: Math.round(maxPoints * 0.76),
            grade6: Math.round(maxPoints * 0.92),
          };
        }
        
              return {
                id: item.id,
                name: item.name,
                class: item.class_name, // Using class_name from table
                type: item.type as any,
                date: item.date,
                maxPoints: maxPoints,
                gradeScale: gradeScale,
                questions: item.questions || [],
              };
      });
      
      setTests(mappedTests);
    } catch (err: any) {
      console.error('Error fetching tests:', err);
      setError(err.message);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .order('date_added', { ascending: false });

      if (error) throw error;
      
      // Map Supabase data to our Result type
      const mappedResults: Result[] = (data || []).map((item: any) => ({
        id: item.id,
        studentId: item.student_id,
        testId: item.test_id,
        points: Number(item.points),
        grade: item.grade,
        percentage: Number(item.percentage),
        dateAdded: item.date_added,
        participated: item.participated !== false, // Default to true if null/undefined
        cancelled: item.cancelled || false, // Default to false if null/undefined
        cancelReason: item.cancel_reason || undefined,
        questionResults: item.question_results || []
      }));
      
      setResults(mappedResults);
    } catch (err: any) {
      console.error('Error fetching results:', err);
      setError(err.message);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchClasses(),
        fetchStudents(),
        fetchTests(),
        fetchResults()
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchClasses, fetchStudents, fetchTests, fetchResults]);

  // ========================================
  // CLASSES CRUD
  // ========================================

  const addClass = async (classData: Omit<Class, 'id'>) => {
    try {
      const { error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          school_year: classData.schoolYear,
          created_date: classData.createdDate
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchClasses();
    } catch (err: any) {
      console.error('Error adding class:', err);
      setError(err.message);
      throw err;
    }
  };

  const updateClass = async (id: string, classData: Partial<Class>) => {
    try {
      const updateData: any = {};
      if (classData.name) updateData.name = classData.name;
      if (classData.schoolYear) updateData.school_year = classData.schoolYear;
      if (classData.createdDate) updateData.created_date = classData.createdDate;

      const { error } = await supabase
        .from('classes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      await fetchClasses();
    } catch (err: any) {
      console.error('Error updating class:', err);
      setError(err.message);
      throw err;
    }
  };

  const deleteClass = async (id: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchClasses();
    } catch (err: any) {
      console.error('Error deleting class:', err);
      setError(err.message);
      throw err;
    }
  };

  // ========================================
  // STUDENTS CRUD
  // ========================================

  const addStudent = async (studentData: Omit<Student, 'id'>) => {
    try {
      // Find class_id by class name
      const classRecord = classes.find(c => c.name === studentData.class);
      
      const { error } = await supabase
        .from('students')
        .insert([{
          first_name: studentData.firstName,
          middle_name: studentData.middleName,
          last_name: studentData.lastName,
          class_id: classRecord?.id || null,
          class_name: studentData.class,
          number: studentData.number,
          gender: studentData.gender
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchStudents();
    } catch (err: any) {
      console.error('Error adding student:', err);
      setError(err.message);
      throw err;
    }
  };

  const addMultipleStudents = async (studentsData: Omit<Student, 'id'>[]) => {
    try {
      const insertData = studentsData.map(student => {
        const classRecord = classes.find(c => c.name === student.class);
        return {
          first_name: student.firstName,
          middle_name: student.middleName,
          last_name: student.lastName,
          class_id: classRecord?.id || null,
          class_name: student.class,
          number: student.number,
          gender: student.gender
        };
      });

      const { error } = await supabase
        .from('students')
        .insert(insertData)
        .select();

      if (error) throw error;
      
      await fetchStudents();
    } catch (err: any) {
      console.error('Error adding multiple students:', err);
      setError(err.message);
      throw err;
    }
  };

  const updateStudent = async (id: string, studentData: Partial<Student>) => {
    try {
      const updateData: any = {};
      if (studentData.firstName) updateData.first_name = studentData.firstName;
      if (studentData.middleName) updateData.middle_name = studentData.middleName;
      if (studentData.lastName) updateData.last_name = studentData.lastName;
      if (studentData.number) updateData.number = studentData.number;
      if (studentData.gender) updateData.gender = studentData.gender;
      
      if (studentData.class) {
        const classRecord = classes.find(c => c.name === studentData.class);
        updateData.class_id = classRecord?.id || null;
        updateData.class_name = studentData.class;
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      await fetchStudents();
    } catch (err: any) {
      console.error('Error updating student:', err);
      setError(err.message);
      throw err;
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchStudents();
    } catch (err: any) {
      console.error('Error deleting student:', err);
      setError(err.message);
      throw err;
    }
  };

  // ========================================
  // TESTS CRUD
  // ========================================

  const addTest = async (testData: Omit<Test, 'id'>) => {
    try {
      // Find class_id by class name
      const classRecord = classes.find(c => c.name === testData.class);
      
            const { error } = await supabase
              .from('tests')
              .insert([{
                name: testData.name,
                class_id: classRecord?.id || null,
                class_name: testData.class,
                type: testData.type,
                date: testData.date,
                max_points: testData.maxPoints,
                grade_scale: testData.gradeScale,
                questions: testData.questions || []
              }])
              .select()
              .single();

      if (error) throw error;
      
      await fetchTests();
    } catch (err: any) {
      console.error('Error adding test:', err);
      setError(err.message);
      throw err;
    }
  };

  const updateTest = async (id: string, testData: Partial<Test>) => {
    try {
      const updateData: any = {};
      if (testData.name) updateData.name = testData.name;
      if (testData.type) updateData.type = testData.type;
      if (testData.date) updateData.date = testData.date;
      if (testData.maxPoints) updateData.max_points = testData.maxPoints;
            if (testData.gradeScale) updateData.grade_scale = testData.gradeScale;
            if (testData.questions) updateData.questions = testData.questions;
      
      if (testData.class) {
        const classRecord = classes.find(c => c.name === testData.class);
        updateData.class_id = classRecord?.id || null;
        updateData.class_name = testData.class;
      }

      const { error } = await supabase
        .from('tests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      await fetchTests();
    } catch (err: any) {
      console.error('Error updating test:', err);
      setError(err.message);
      throw err;
    }
  };

  const deleteTest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchTests();
    } catch (err: any) {
      console.error('Error deleting test:', err);
      setError(err.message);
      throw err;
    }
  };

  // ========================================
  // RESULTS CRUD
  // ========================================

  const addResult = async (resultData: Omit<Result, 'id'>) => {
    try {
      const { error } = await supabase
        .from('results')
        .insert([{
          student_id: resultData.studentId,
          test_id: resultData.testId,
          points: resultData.points,
          grade: resultData.grade,
          percentage: resultData.percentage,
          date_added: resultData.dateAdded,
          cancelled: resultData.cancelled || false,
          cancel_reason: resultData.cancelReason || null,
          question_results: resultData.questionResults || null
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchResults();
    } catch (err: any) {
      console.error('Error adding result:', err);
      setError(err.message);
      throw err;
    }
  };

  const addMultipleResults = async (resultsData: Omit<Result, 'id'>[]) => {
    try {
      const insertData = resultsData.map(r => ({
        student_id: r.studentId,
        test_id: r.testId,
        points: r.points,
        grade: r.grade,
        percentage: r.percentage,
        date_added: r.dateAdded,
        cancelled: r.cancelled || false,
        cancel_reason: r.cancelReason || null,
        question_results: r.questionResults || null
      }));

      const { error } = await supabase
        .from('results')
        .insert(insertData)
        .select();

      if (error) throw error;
      
      await fetchResults();
    } catch (err: any) {
      console.error('Error adding multiple results:', err);
      setError(err.message);
      throw err;
    }
  };

  const updateResult = async (id: string, resultData: Partial<Result>) => {
    try {
      const updateData: any = {};
      if (resultData.points !== undefined) updateData.points = resultData.points;
      if (resultData.grade) updateData.grade = resultData.grade;
      if (resultData.percentage !== undefined) updateData.percentage = resultData.percentage;
      if (resultData.dateAdded) updateData.date_added = resultData.dateAdded;
      if (resultData.cancelled !== undefined) updateData.cancelled = resultData.cancelled;
      if (resultData.cancelReason !== undefined) updateData.cancel_reason = resultData.cancelReason;
      if (resultData.questionResults !== undefined) updateData.question_results = resultData.questionResults;

      const { error } = await supabase
        .from('results')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      await fetchResults();
    } catch (err: any) {
      console.error('Error updating result:', err);
      setError(err.message);
      throw err;
    }
  };

  const deleteResult = async (id: string) => {
    try {
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchResults();
    } catch (err: any) {
      console.error('Error deleting result:', err);
      setError(err.message);
      throw err;
    }
  };

  const saveResults = async (testId: string, resultsData: Omit<Result, 'id'>[]) => {
    try {
      // Delete existing results for this test
      const { error: deleteError } = await supabase
        .from('results')
        .delete()
        .eq('test_id', testId);

      if (deleteError) throw deleteError;

      // Insert new results
      const insertData = resultsData.map(r => ({
        student_id: r.studentId,
        test_id: r.testId,
        points: r.points,
        grade: r.grade,
        percentage: r.percentage,
        date_added: r.dateAdded,
        participated: r.participated,
        cancelled: r.cancelled || false,
        cancel_reason: r.cancelReason || null,
        question_results: r.questionResults || null
      }));

      const { error } = await supabase
        .from('results')
        .insert(insertData)
        .select();

      if (error) throw error;
      
      await fetchResults();
    } catch (err: any) {
      console.error('Error saving results:', err);
      setError(err.message);
      throw err;
    }
  };

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const value: AppContextType = {
    classes,
    students,
    tests,
    results,
    loading,
    error,
    addClass,
    updateClass,
    deleteClass,
    addStudent,
    addMultipleStudents,
    updateStudent,
    deleteStudent,
    addTest,
    updateTest,
    deleteTest,
    addResult,
    addMultipleResults,
    updateResult,
    deleteResult,
    saveResults
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};