export const calculateProfitBoost = (monthlyGmv) => {
  const lostRevenue = monthlyGmv * 0.088;
  const recoveredGmv = monthlyGmv * 0.069;
  const annualProfit = recoveredGmv * 12;
  return { lostRevenue, recoveredGmv, annualProfit };
};
