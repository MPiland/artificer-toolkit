import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import type { CharacterDraftCreateInput } from '@artificer-toolkit/schema/api/characterDrafts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { api, components, internal } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import authSchema from '../../convex/betterAuth/schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

export async function fixture() {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../../convex/betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [{ id: srdSystemRecord.id, document, checksum: checksumRuleDocument(document) }],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  const actors = []
  for (const name of ['Owner', 'Other']) {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name,
            email: `${name}@example.invalid`,
            // Registered accounts always have a username; shared Campaign authorship requires one.
            username: name.toLowerCase(),
            displayUsername: name,
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
            // Long enough that a slow serial suite run never outlives the session mid-test.
            expiresAt: Date.now() + 60 * 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
    const identity = await caller.query(api.account.identity, {})
    if (!identity) throw new Error('Missing test identity.')
    actors.push({ caller, userId: identity.userId })
  }
  return { t, owner: actors[0]!, other: actors[1]! }
}

export function input(): CharacterDraftCreateInput {
  return {
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id
  }
}
