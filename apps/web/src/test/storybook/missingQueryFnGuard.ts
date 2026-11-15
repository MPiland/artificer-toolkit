import { afterEach, beforeEach, expect } from 'vitest'

// A backend story whose read has no query function shows a loading or empty state instead of the
// seeded record, so TanStack Query's "No queryFn" report fails the story (D221).
const missingQueryFnReports: string[] = []

for (const level of ['error', 'warn'] as const) {
  const report = console[level]
  console[level] = (...args: unknown[]) => {
    const message = args.map(String).join(' ')
    if (message.includes('No queryFn')) missingQueryFnReports.push(message)
    report(...args)
  }
}

beforeEach(() => {
  missingQueryFnReports.length = 0
})

afterEach(() => {
  expect(missingQueryFnReports).toEqual([])
})
