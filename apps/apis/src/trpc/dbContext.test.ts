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
