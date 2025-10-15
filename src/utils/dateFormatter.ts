export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('bg-BG');
};

export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};
