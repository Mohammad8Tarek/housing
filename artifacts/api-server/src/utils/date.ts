export const toDate = (date: any): Date | null => {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

export const isValidDate = (date: any) => {
  return date instanceof Date && !isNaN(date.getTime());
};
