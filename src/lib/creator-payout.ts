export const PRICE = 12.99; // monthly subscription
export const STORE_FEE = 0.15; // app store fee
export const CUT = 0.2; // creator's share after store fee
export const RATE = PRICE * (1 - STORE_FEE) * CUT; // ≈ $2.21 per paying member per month
export const PLAN_MONTHS = 12; // planner horizon
export const PLAN_CHURN = 0.05; // monthly cancellation assumption
