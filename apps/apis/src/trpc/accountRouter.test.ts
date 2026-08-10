import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'
import {
  authenticatedContext,
  pendingInvitationContext,
  unauthenticatedContext
} from './routerTestFixtures.js'

const accountProfileRepository = vi.hoisted(() => ({
  findUserIdByUsername: vi.fn(async (): Promise<string | null> => 'user-1'),
  findForUser: vi.fn(
    async (): Promise<{ username: string | null; bio: string | null } | null> => ({
      username: 'morgan',
      bio: 'Forge keeper.'
    })
  ),
  isUsernameTaken: vi.fn(async (username: string) => username === 'taken_name'),
  upsertForUser: vi.fn(
    async (_userId: string, profile: { username: string; bio: string | null }) => profile
  )
}))
const updateAuthUserById = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      data: { user: Record<string, unknown> } | null
      error: { message: string; status: number } | null
    }> => ({ data: { user: {} }, error: null })
  )
)
const getAuthUserById = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { user: { app_metadata: { provider: 'email' }, email: 'player@example.com' } },
    error: null
  }))
)
const signInWithPassword = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      data: { session: { access_token: string; refresh_token: string } | null }
      error: { status: number } | null
    }> => ({
      data: { session: { access_token: 'access-token', refresh_token: 'refresh-token' } },
      error: null
    })
  )
)
const createSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAccountProfileRepository: () => accountProfileRepository
}))
vi.mock('@artificer-toolkit/functions/clients', () => ({
  createSupabaseClient
}))

const withDb = vi.hoisted(() => vi.fn())
const withAuthenticatedDb = vi.hoisted(() => vi.fn())

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()

  withDb.mockImplementation(
    async <TResult>(
      _context: TrpcContext,
      callback: (db: DBLike) => Promise<TResult>
    ): Promise<TResult> => callback({} as DBLike)
  )
  withAuthenticatedDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string, auth: AuthenticatedTrpcContext) => Promise<TResult>
    ): Promise<TResult> => {
      const userId = actual.requireUserId(context)
      try {
        return await callback({} as DBLike, userId, {
          isSuperAdmin: context.isSuperAdmin === true,
          userId
        })
      } catch (error) {
        throw actual.toTrpcError(error)
      }
    }
  )

  return {
    ...actual,
    withDb,
    withAuthenticatedDb
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseClient.mockReturnValue({
    auth: {
      admin: {
        getUserById: getAuthUserById,
        updateUserById: updateAuthUserById
      },
      signInWithPassword
    }
  })
})

import { appRouter } from './router.js'

describe('tRPC account router', () => {
  it('checks username policy and availability without exposing profile data', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(caller.account.usernameStatus({ username: 'open_name' })).resolves.toEqual({
      status: 'available'
    })
    await expect(caller.account.usernameStatus({ username: 'taken_name' })).resolves.toEqual({
      status: 'taken'
    })
    await expect(caller.account.usernameStatus({ username: 'admin' })).resolves.toEqual({
      status: 'not_allowed'
    })
    expect(accountProfileRepository.isUsernameTaken).toHaveBeenCalledTimes(2)
  })

  it('signs in by username without returning the account email', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'morgan', password: 'password1234' })
    ).resolves.toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
    expect(accountProfileRepository.findUserIdByUsername).toHaveBeenCalledWith('morgan')
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password1234'
    })
    expect(createSupabaseClient).toHaveBeenCalledWith('203.0.113.10')
  })

  it('hides provider details for unexpected username sign-in failures', async () => {
    signInWithPassword.mockRejectedValueOnce(new Error('provider/config detail'))
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'morgan', password: 'password1234' })
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal Server Error'
    })
  })

  it('preserves Supabase rate-limit responses during username sign-in', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { status: 429 }
    })
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'morgan', password: 'password1234' })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })

  it('does not reveal whether a username exists during sign-in', async () => {
    accountProfileRepository.findUserIdByUsername.mockResolvedValueOnce(null)
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'unknown_user', password: 'password1234' })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid username or password.'
    })
    expect(getAuthUserById).not.toHaveBeenCalled()
  })

  it('completes an invitation with a required username', async () => {
    const caller = appRouter.createCaller(pendingInvitationContext)

    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })

    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'player_one',
      bio: 'Forge keeper.'
    })

    expect(updateAuthUserById).toHaveBeenCalledWith('user-1', {
      password: 'new-password-123',
      app_metadata: {
        provider: 'email',
        registration_completed: true
      }
    })
  })

  it('does not expose provider details when invitation completion fails', async () => {
    updateAuthUserById.mockResolvedValueOnce({
      data: { user: {} },
      error: { message: 'provider detail', status: 500 }
    })
    const caller = appRouter.createCaller(pendingInvitationContext)

    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Could not complete registration.'
    })
  })

  it('rejects invitation completion after account setup is complete', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.completeInvitation({
        password: 'replacement-password-123',
        username: 'player_one'
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(getAuthUserById).not.toHaveBeenCalled()
    expect(updateAuthUserById).not.toHaveBeenCalled()
  })

  it('blocks product APIs until an invited user completes password setup', async () => {
    const caller = appRouter.createCaller(pendingInvitationContext)

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })
  })

  it('reads and updates only the authenticated user profile', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.account.profile()).resolves.toEqual({
      username: 'morgan',
      bio: 'Forge keeper.'
    })
    await expect(
      caller.account.updateProfile({
        bio: '  Builds worlds.  '
      })
    ).resolves.toEqual({
      username: 'morgan',
      bio: 'Builds worlds.'
    })

    expect(accountProfileRepository.findForUser).toHaveBeenCalledWith('user-1')
    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'morgan',
      bio: 'Builds worlds.'
    })
  })

  it('lets an account claim or replace its username', async () => {
    accountProfileRepository.findForUser.mockResolvedValueOnce({ username: null, bio: null })
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.updateProfile({ username: 'legacy_player', bio: null })
    ).resolves.toEqual({ username: 'legacy_player', bio: null })
    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'legacy_player',
      bio: null
    })

    await expect(
      caller.account.updateProfile({ username: 'replacement_name', bio: null })
    ).resolves.toEqual({ username: 'replacement_name', bio: null })
    expect(accountProfileRepository.upsertForUser).toHaveBeenLastCalledWith('user-1', {
      username: 'replacement_name',
      bio: null
    })
  })

  it('reports a rename race as a conflict', async () => {
    const { UsernameConflictError } =
      await vi.importActual<typeof import('@artificer-toolkit/db')>('@artificer-toolkit/db')
    accountProfileRepository.upsertForUser.mockRejectedValueOnce(new UsernameConflictError())
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.updateProfile({ username: 'raced_name', bio: 'Forge keeper.' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
