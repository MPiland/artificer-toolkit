import { createFunctionHandle } from 'convex/server'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { api, components, internal } from '../../convex/_generated/api'
import type { readySheetFixture } from './readyCharacter'

/** A second authenticated user; `join` makes them an active PLAYER without a Character. */
export async function createPartyPlayer(
  t: Awaited<ReturnType<typeof readySheetFixture>>['t'],
  campaign: Pick<CampaignDetailDto, 'id' | 'createdAt'>
) {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Party member',
          email: 'party-roll@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing party member identity')
  await caller.mutation(api.account.updateProfile, { username: 'PartyPlayer', bio: null })
  const join = () =>
    t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: identity.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
  return { caller, userId: identity.userId, join }
}
