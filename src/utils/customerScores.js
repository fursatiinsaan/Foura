export const calculateRecoveryScore = (customerTier, errorType) => {
  let score = 85;
  if (customerTier.includes('VIP')) score += 10;
  if (errorType.includes('TIMEOUT')) score += 4;
  return Math.min(score, 99);
};
