export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validateNumber = (value: string, min?: number, max?: number): boolean => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

export const validateStudentData = (firstName: string, middleName: string, lastName: string): string[] => {
  const errors: string[] = [];
  
  if (!validateRequired(firstName)) errors.push('Име е задължително');
  if (!validateRequired(middleName)) errors.push('Презире е задължително');
  if (!validateRequired(lastName)) errors.push('Фамилия е задължително');
  
  return errors;
};
