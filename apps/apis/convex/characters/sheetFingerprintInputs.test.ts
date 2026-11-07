import { makeFunctionReference, type GenericDatabaseReader } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import type { DataModel, TableNames } from '../_generated/dataModel'
import { markContentSnapshotScope } from '../contentSnapshots/marking'
import { withSceneVisionTracking } from '../lib/mutations'
import schema from '../schema'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { characterSheetInputs } from './sheetFingerprintInputs'
import { readCharacterSheetStoreState } from './sheetSections'
import { scheduleCharacterSheetSections } from './sheetSectionStores'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const tableNames = Object.keys(schema.tables) as TableNames[]
/** The stored derivation the fingerprint is compared with, not an input to it. */
const storedDerivationTables = new Set<string>(['characterSheetDerivations'])

/** A reader that records every table the wrapped reads touch. */
function recordReads(db: GenericDatabaseReader<DataModel>, tables: Set<string>) {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'query')
        return (table: TableNames) => {
          tables.add(table)
          return target.query(table)
        }
      if (property === 'get')
        return (...args: unknown[]) => {
          const [first, second] = args.map(String)
          tables.add(
            second !== undefined
              ? first!
              : (tableNames.find((table) => target.normalizeId(table, first!) !== null) ?? first!)
          )
          return Reflect.apply(target.get, target, args)
        }
      const value: unknown = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

async function setup() {
  const base = await readyCharacterFixture()
  const commit = async () => {
    const { draft, character } = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    return character
  }
  const character = await commit()
  const sheetState = (characterId: string) =>
    base.t.query(internal.characters.development.sheetSectionsState, { characterId })
  /** Stores the Sheet now, so a later write is what leaves it stale. */
  const storeCurrent = async (characterId: string) => {
    await base.t.run((ctx) => scheduleCharacterSheetSections(ctx, characterId))
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await sheetState(characterId)).toBe('CURRENT')
  }
  return { ...base, commit, character, sheetState, storeCurrent }
}

describe('Character Sheet fingerprint inputs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('declares every table the fingerprint reads', async () => {
    const { t, owner, other: gm, character } = await setup()
    const readTables = async () => {
      const tables = new Set<string>()
      const state = await t.run((ctx) =>
        readCharacterSheetStoreState(
          { ...ctx, db: recordReads(ctx.db, tables) },
          owner.userId,
          character.id
        )
      )
      expect(state).not.toBeNull()
      return tables
    }
    const personal = await readTables()
    const campaign = await gm.caller.mutation(createCampaign, {
      name: 'Fingerprint inputs',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: owner.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    })
    const assigned = await readTables()
    // The Campaign path reads what the personal path does not, so both are covered.
    expect([...assigned].filter((table) => !personal.has(table))).toContain('campaigns')
    const undeclared = [...new Set([...personal, ...assigned])].filter(
      (table) => !storedDerivationTables.has(table) && !(table in characterSheetInputs)
    )
    expect(undeclared).toEqual([])
  }, 60_000)

  it("queues an effect's owner and its Concentration caster once per transaction", async () => {
    const { t, commit, character, sheetState, storeCurrent } = await setup()
    const caster = await commit()
    await storeCurrent(character.id)
    await storeCurrent(caster.id)
    const now = new Date().toISOString()
    const checksum = 'a'.repeat(64)
    await t.run(async (rawCtx) => {
      const ctx = withSceneVisionTracking(rawCtx)
      const id = await ctx.db.insert('characterActiveRuleEffects', {
        id: crypto.randomUUID(),
        createdOrdinal: 1,
        version: 1,
        definitionJson: '{}',
        definitionChecksum: checksum,
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        lifecycleChecksum: checksum,
        createdAt: now,
        updatedAt: now,
        characterId: character.id,
        concentrationCasterCharacterId: caster.id,
        maintainedEffectStateId: null,
        sourceEncounterId: null
      })
      await ctx.db.patch(id, { version: 2 })
    })
    expect(await sheetState(character.id)).toBe('QUEUED')
    expect(await sheetState(caster.id)).toBe('QUEUED')
    const jobs = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.name === 'characters/sheetSectionDerivation:store'
      )
    )
    // The second write in the transaction keeps each Character's queued store.
    for (const characterId of [character.id, caster.id])
      expect(
        jobs
          .filter((job) => JSON.stringify(job.args).includes(characterId))
          .map((job) => job.state.kind)
          .filter((kind) => kind === 'pending' || kind === 'canceled')
      ).toEqual(['pending'])
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await sheetState(character.id)).toBe('CURRENT')
    expect(await sheetState(caster.id)).toBe('CURRENT')
  }, 60_000)

  it("queues the owner's Characters when their USER source or its snapshot head changes", async () => {
    const { t, owner, character, sheetState, storeCurrent } = await setup()
    const sourceId = crypto.randomUUID()
    const source = await t.run((ctx) =>
      ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: sourceId,
        code: sourceId,
        kind: 'USER',
        ownerUserId: owner.userId
      })
    )
    await storeCurrent(character.id)
    // Publishing into the source marks its snapshot head (ADR 0036).
    await t.run((ctx) =>
      markContentSnapshotScope(
        withSceneVisionTracking(ctx),
        { scope: 'SOURCE', scopeId: sourceId },
        true
      )
    )
    expect(await sheetState(character.id)).toBe('QUEUED')
    await storeCurrent(character.id)
    await t.run((ctx) =>
      withSceneVisionTracking(ctx).db.patch(source, { label: 'Renamed Homebrew' })
    )
    expect(await sheetState(character.id)).toBe('QUEUED')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await sheetState(character.id)).toBe('CURRENT')
  }, 60_000)
})
