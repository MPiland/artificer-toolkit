import { createFunctionHandle } from 'convex/server'
import { convexToJson, type Value } from 'convex/values'
import { it } from 'vitest'
import type { DevelopmentCampaignInspection } from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { verifyCampaignGmState } from '../../tests/developmentCampaignGmState'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'
import type { TableNames } from '../_generated/dataModel'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import schema from '../schema'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { inProcessDevelopmentClient } from '../../tests/fixtures/liveSessionWorker'

const tableNames = Object.keys(schema.tables) as TableNames[]

it('proves native GM overlays through public Campaign handlers', async () => {
  const { owner: player, other: owner, ...base } = await readySheetFixture()
  const campaign = await owner.caller.mutation(api.campaigns.create.create, {
    name: 'Native GM journey',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  })

  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })

  // Unrelated scope fixture follows gmReads.test; Builder is exercised by the assigned Character.
  const unrelatedCharacterId = await base.t.run(async (ctx) => {
    const current = await readCharacterRow(ctx, base.character.id)
    if (!current) throw new Error('Missing committed Character fixture.')
    const { _id: _storedId, _creationTime: _storedCreationTime, play, ...structure } = current
    const { _id: _playId, _creationTime: _playCreationTime, ...playRecord } = play
    const id = crypto.randomUUID()
    await ctx.db.insert('characters', { ...structure, id })
    await ctx.db.insert('characterPlayStates', { ...playRecord, characterId: id })
    const clone = await readCharacterRow(ctx, id)
    if (!clone) throw new Error('Missing cloned Character fixture.')
    await writeCharacterRecord(ctx, clone, { document: { ...readCharacterRecord(current), id } })
    await ensureAuthoredRouteId(ctx, 'CHARACTER', id, false, player.userId)
    return id
  })
  const outsider = await createOutsider(base)
  const client = inProcessDevelopmentClient
  const inspect = async (): Promise<DevelopmentCampaignInspection> =>
    base.t.run(async (ctx) => {
      const tables = Object.fromEntries(
        await Promise.all(
          tableNames.map(async (name) => [name, await ctx.db.query(name).collect()] as const)
        )
      )
      const scheduled = await ctx.db.system.query('_scheduled_functions').collect()
      const campaignTables: Record<string, Value[]> = {}
      const personalTables: Record<string, Value[]> = {}
      for (const [name, rows] of Object.entries(tables)) {
        campaignTables[name] = rows.filter(
          (row) =>
            isRecord(row) &&
            ((name === 'campaigns' && 'id' in row && row.id === campaign.id) ||
              ('campaignId' in row && row.campaignId === campaign.id))
        )
        personalTables[name] = rows.filter(
          (row) =>
            !isRecord(row) ||
            !(
              (name === 'campaigns' && 'id' in row && row.id === campaign.id) ||
              ('campaignId' in row && row.campaignId === campaign.id)
            )
        )
      }
      personalTables._scheduled_functions = scheduled
      return {
        campaignStateJson: JSON.stringify(convexToJson(campaignTables)),
        personalStateJson: JSON.stringify(convexToJson(personalTables)),
        descendants: {
          sessionIds: [],
          encounterIds: [],
          sceneIds: [],
          definitionSaveIds: [],
          fogSaveIds: [],
          conversationIds: [],
          entryIds: [],
          listingIds: [],
          applicationIds: [],
          cleanupJobIds: []
        }
      }
    })
  await verifyCampaignGmState({
    owner: client(owner.caller),
    player: client(player.caller),
    outsider: client(outsider.caller),
    ownerUserId: owner.userId,
    campaignId: campaign.id,
    characterId: base.character.id,
    unrelatedCharacterId,
    inspect
  })
}, 30_000)

async function createOutsider(base: Pick<Awaited<ReturnType<typeof readySheetFixture>>, 't'>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'GM journey outsider',
          email: 'gm-journey-outsider@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('GM journey outsider identity is unavailable.')
  return { caller, userId: identity.userId }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
