export const sanitizeState = (state) => ({ ...state, updated: Date.now() });
