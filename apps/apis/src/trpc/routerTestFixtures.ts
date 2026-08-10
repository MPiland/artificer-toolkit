import type { TrpcContext } from './dbContext.js'

export const authenticatedContext = {
  invitationSetupPending: false,
  userId: 'user-1'
} satisfies TrpcContext

export const pendingInvitationContext = {
  invitationSetupPending: true,
  userId: 'user-1'
} satisfies TrpcContext

export const unauthenticatedContext = {
  clientIp: '203.0.113.10',
  invitationSetupPending: false,
  userId: null
} satisfies TrpcContext
