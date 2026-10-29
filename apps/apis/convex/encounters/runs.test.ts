import { readReceiptHeaders } from '../lib/receiptLedgers'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterInputDto,
  EncounterGmProjectionDto,
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { srdPrintedArmorClass, srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { encounterReadTransaction } from './encounterReadPorts'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

async function setup() {
  const base = await readyCharacterFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Run creation',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Training',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
  })
  const input = {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  }
  return { ...base, campaign, blueprint, character, input }
}

describe('native Encounter Run creation', () => {
  it('evaluates a real Creature snapshot through the native policy', async () => {
    const { t, other, input } = await setup()
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
    })
    const blueprint = await other.caller.mutation(createBlueprint, {
      gameSystemId: wolf.systemId,
      name: 'Wolves',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: wolf.id }]
    })
    const result = await other.caller.mutation(createRun, { ...input, blueprintId: blueprint.id })
    const actor = result.actors.find((candidate) => candidate.kind === 'CREATURE')
    expect(actor).toMatchObject({
      sourceId: wolf.id,
      currentHitPoints: wolf.hitPoints,
      statBlock: { armorClass: srdPrintedArmorClass(wolf) }
    })
    expect(actor?.features.map((feature) => feature.id)).toEqual(
      wolf.features?.map((feature) => feature.id) ?? []
    )
    expect(result).not.toHaveProperty('rulePackRevisionId')
  }, 30000)
  it('atomically snapshots assigned Characters and enemies, and replays without source reads', async () => {
    const { t, other, input, character, blueprint } = await setup()
    const uppercaseInput = {
      ...input,
      campaignId: input.campaignId.toUpperCase(),
      blueprintId: input.blueprintId.toUpperCase(),
      commandId: input.commandId.toUpperCase()
    }
    const result = await other.caller.mutation(createRun, uppercaseInput)
    expect(result).toMatchObject({
      status: 'PREPARED',
      version: 0,
      round: 0,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      blueprintChecksum: blueprint.setupChecksum
    })
    expect(result.actors).toHaveLength(2)
    const characterStates = await t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, character.id)
      if (!row) throw new Error('Missing Character')
      return readCharacterRecord(row).state.hitpoints
    })
    expect(result.actors.find((actor) => actor.kind === 'CHARACTER')).toMatchObject({
      sourceId: character.id,
      sourceRevision: null,
      currentHitPoints: characterStates.current,
      tempHitPoints: characterStates.temp ?? 0
    })
    expect(result.actors.find((actor) => actor.kind === 'CUSTOM')).toMatchObject({
      label: 'Dummy',
      currentHitPoints: 10
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', result.id))
        .unique()
      if (!row) throw new Error('Missing Run')
      const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
      expect(checksumCanonicalJson(state)).toBe(row.stateChecksum)
      expect(await readEncounterGmProjection(encounterReadTransaction(ctx), state)).toEqual(result)
      expect(state.sides).toHaveLength(2)
      const actors = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', result.id))
        .collect()
      expect(actors).toHaveLength(2)
      for (const actor of actors) {
        const decoded = await readTestActor(ctx, actor)
        expect(decoded.encounterId).toBe(result.id)
        expect(state.actorIds).toContain(decoded.id)
        expect(state.sides.map((side) => side.id)).toContain(decoded.sideId)
        expect(checksumRunActorPlayState(decoded)).toBe(actor.stateChecksum)
        if (decoded.kind === 'CHARACTER') {
          expect(decoded.sourceId).toBe(character.id)
          expect(decoded).not.toHaveProperty('currentHitPoints')
          expect(decoded).not.toHaveProperty('sourceRevision')
        }
      }
      const blueprintRow = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_publicId', (q) => q.eq('id', blueprint.id))
        .unique()
      if (!blueprintRow) throw new Error('Missing Blueprint')
      await ctx.db.patch(blueprintRow._id, { enemiesJson: 'invalid' })
    })
    expect(await other.caller.mutation(createRun, uppercaseInput)).toEqual(result)
    expect(await other.caller.mutation(createRun, input)).toEqual(result)
    expect(await t.run((ctx) => ctx.db.query('encounterRuns').collect())).toHaveLength(1)
    await expect(
      other.caller.mutation(createRun, { ...input, blueprintId: crypto.randomUUID() })
    ).rejects.toThrow('different input')
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      )
    ).toHaveLength(1)
  }, 30000)

  it('rejects anonymous and non-GM commands without creating state', async () => {
    const { t, owner, input } = await setup()
    await expect(t.mutation(createRun, input)).rejects.toThrow('Unauthenticated')
    await expect(owner.caller.mutation(createRun, input)).rejects.toThrow('Campaign not found')
    expect(await t.run((ctx) => ctx.db.query('encounterRuns').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('encounterRunActors').collect())).toEqual([])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      )
    ).toEqual([])
  }, 30000)

  it('excludes unassigned Characters from the party', async () => {
    const { t, other, input, character } = await setup()
    await other.caller.mutation(createRun, input)
    await t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
        .unique()
      if (!assignment) throw new Error('Missing assignment')
      await ctx.db.delete(assignment._id)
    })
    const unassigned = await other.caller.mutation(createRun, {
      ...input,
      commandId: crypto.randomUUID()
    })
    expect(unassigned.actors.map((actor) => actor.kind)).toEqual(['CUSTOM'])
  }, 30000)

  // A Run moved to another Campaign no longer matches its creation key, so the surviving command
  // header reads as a reused ID.
  it.each([
    ['campaignId', '"reason":"COMMAND_ID_REUSED"'],
    ['gameSystemId', 'Encounter is unavailable.']
  ] as const)(
    'rejects replay when the stored Run has a different %s',
    async (field, message) => {
      const { t, other, input } = await setup()
      const result = await other.caller.mutation(createRun, input)
      await t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', result.id))
          .unique()
        if (!row) throw new Error('Missing Run')
        await ctx.db.patch(row._id, { [field]: crypto.randomUUID() })
      })
      await expect(other.caller.mutation(createRun, input)).rejects.toThrow(message)
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('encounterRunCommands')
            .collect()
            .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
        )
      ).toHaveLength(1)
    },
    30000
  )
})
