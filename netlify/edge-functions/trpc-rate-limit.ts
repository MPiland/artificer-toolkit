export default function trpcRateLimit(): undefined {
  return undefined
}

export const config = {
  name: 'tRPC rate limit',
  path: '/api/trpc/*',
  rateLimit: {
    aggregateBy: ['ip', 'domain'],
    windowLimit: 60,
    windowSize: 60
  }
}
