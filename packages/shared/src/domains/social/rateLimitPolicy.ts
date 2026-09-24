// Existing fixed UTC windows count successful source transactions, not rejected attempts.
export const SOCIAL_RATE_LIMITS = {
  APPLICATION: [
    { window: 'HOUR', limit: 10 },
    { window: 'DAY', limit: 30 }
  ],
  INVITE: [{ window: 'HOUR', limit: 20 }],
  REPORT: [
    { window: 'HOUR', limit: 5 },
    { window: 'DAY', limit: 20 }
  ],
  BLOCK: [{ window: 'HOUR', limit: 30 }]
} as const
