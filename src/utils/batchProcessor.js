export const summarizeBatch = (cases) => {
  const pending = cases.filter(c => !c.is_recovered);
  const totalValue = pending.reduce((sum, c) => sum + c.amount, 0);
  return { count: pending.length, totalValue };
};
