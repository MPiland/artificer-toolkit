import { expect, it } from 'vitest'
import { toTrpcError } from './dbContext.js'

it('maps username uniqueness races to a conflict response', () => {
  const error = new Error('That username is already taken.')
  error.name = 'UsernameConflictError'

  expect(toTrpcError(error)).toMatchObject({
    code: 'CONFLICT',
    message: 'That username is already taken.'
  })
})

it('maps authored creation limits to a rate-limit response', () => {
  const error = new Error(
    'You can create at most 10 authored records per minute. Try again when the minute resets.'
  )
  error.name = 'AuthoredContentCreationRateLimitError'

  expect(toTrpcError(error)).toMatchObject({
    code: 'TOO_MANY_REQUESTS',
    message: error.message
  })
})
