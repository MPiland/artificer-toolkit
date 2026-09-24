import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'

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
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const getPlaySettings = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignPlaySettingsDto
>('campaigns/playSettings:get')
const savePlaySettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

const compatibleClub = {
  ...club,
  id: '10000000-0000-4000-8000-000000000101',
  label: 'Encounter Club'
}
const loadoutEntryId = '10000000-0000-4000-8000-000000000102'
const unchangedLoadoutEntryId = '10000000-0000-4000-8000-000000000103'
const bite = wolf.features?.find((feature) => feature.label === 'Bite')
if (!bite) throw new Error('Missing Wolf Bite fixture.')
const creature = {
  ...wolf,
  features: wolf.features?.map((feature) =>
    feature.id === bite.id ? { ...feature, effects: club.effects } : feature
  ),
  equipmentLoadout: [
    {
      id: loadoutEntryId,
      equipmentId: club.id,
      quantity: 1,
      useState: 'HELD' as const,
      attuned: false,
      actionFeatureIds: [bite.id]
    },
    {
      id: unchangedLoadoutEntryId,
      equipmentId: dagger.id,
      quantity: 1,
      useState: 'CARRIED' as const,
      attuned: false,
      actionFeatureIds: []
    }
  ]
}

function replace(input: {
  encounterId: string
  actorId: string
  equipmentId: string
  commandId?: string
  expectedVersion?: number
  loadoutId?: string
}): { command: Extract<EncounterExecuteInput['command'], { type: 'REPLACE_CREATURE_EQUIPMENT' }> } {
  return {
    command: {
      type: 'REPLACE_CREATURE_EQUIPMENT',
      encounterId: input.encounterId,
      commandId: input.commandId ?? crypto.randomUUID(),
      expectedVersion: input.expectedVersion ?? 0,
      actorId: input.actorId,
      loadoutEntryId: input.loadoutId ?? loadoutEntryId,
      equipmentId: input.equipmentId
    }
  }
}

async function setup() {
  const base = await fixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature }),
      importedSubject({ ...club, subjectKind: 'EQUIPMENT', document: club }),
      importedSubject({
        ...compatibleClub,
        subjectKind: 'EQUIPMENT',
        document: compatibleClub
      }),
      importedSubject({ ...dagger, subjectKind: 'EQUIPMENT', document: dagger })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Creature equipment',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getPlaySettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(savePlaySettings, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Creature equipment fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: creature.id },
      { kind: 'CUSTOM', label: 'Unchanged dummy', maxHitPoints: 4 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const creatureActor = run.actors.find((actor) => actor.kind === 'CREATURE')
  const customActor = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!creatureActor || !customActor) throw new Error('Missing Encounter actor fixtures.')
  return { ...base, campaign, run, creatureActor, customActor }
}

async function stored(t: Awaited<ReturnType<typeof setup>>['t'], encounterId: string) {
  return t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    const actors = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect()
    return { run, actors, receipts: await ctx.db.query('encounterRunCommands').collect() }
  })
}

describe('native Encounter REPLACE_CREATURE_EQUIPMENT commands', () => {
  it('pins an equivalent current Equipment source, preserves unrelated Encounter state, and replays without source reads', async () => {
    const { t, owner, other, run, creatureActor, customActor } = await setup()
    const before = await stored(t, run.id)
    const command = replace({
      encounterId: run.id.toUpperCase(),
      actorId: creatureActor.id.toUpperCase(),
      equipmentId: compatibleClub.id.toUpperCase(),
      commandId: crypto.randomUUID().toUpperCase()
    })
    const first = await owner.caller.mutation(execute, command)
    expect(first.projection).toMatchObject({ id: run.id, version: 1, currentActorId: null })
    const after = await stored(t, run.id)
    const beforeCreature = before.actors.find((actor) => actor.id === creatureActor.id)
    const afterCreature = after.actors.find((actor) => actor.id === creatureActor.id)
    const beforeCustom = before.actors.find((actor) => actor.id === customActor.id)
    const afterCustom = after.actors.find((actor) => actor.id === customActor.id)
    if (!beforeCreature || !afterCreature || !beforeCustom || !afterCustom)
      throw new Error('Missing stored Encounter actors.')
    const beforeState = encounterRunActorStateSchema.parse(JSON.parse(beforeCreature.stateJson))
    const afterState = encounterRunActorStateSchema.parse(JSON.parse(afterCreature.stateJson))
    if (
      typeof beforeState.snapshot !== 'object' ||
      beforeState.snapshot === null ||
      Array.isArray(beforeState.snapshot) ||
      !Array.isArray(beforeState.snapshot.equipmentSources)
    )
      throw new Error('Missing Creature snapshot payload.')
    expect(afterState).toMatchObject({
      id: beforeState.id,
      currentHitPoints: beforeState.currentHitPoints,
      maxHitPoints: beforeState.maxHitPoints,
      tempHitPoints: beforeState.tempHitPoints,
      resources: beforeState.resources,
      initiative: beforeState.initiative,
      snapshot: {
        payload: beforeState.snapshot.payload,
        equipmentLoadoutOverride: [
          { id: loadoutEntryId, equipmentId: compatibleClub.id },
          { id: unchangedLoadoutEntryId, equipmentId: dagger.id }
        ],
        equipmentSources: expect.arrayContaining([
          expect.objectContaining({
            loadoutEntryId,
            equipmentId: compatibleClub.id,
            sourceRevision: 1,
            sourceChecksum: checksumRuleDocument(compatibleClub)
          })
        ])
      }
    })
    expect(afterCustom.stateJson).toBe(beforeCustom.stateJson)
    const receipt = after.receipts.find(
      (candidate) => candidate.commandId === command.command.commandId.toLowerCase()
    )
    if (receipt?.commandType !== 'REPLACE_CREATURE_EQUIPMENT')
      throw new Error('Missing Creature Equipment replacement receipt.')
    expect(receipt.creatureEquipmentReplacement).toMatchObject({
      actorId: creatureActor.id,
      loadoutEntryId,
      equipmentId: compatibleClub.id,
      sourceRevision: 1,
      sourceVersionId: expect.any(String),
      sourceChecksum: checksumRuleDocument(compatibleClub)
    })
    expect(afterState.snapshot).toEqual({
      ...beforeState.snapshot,
      equipmentLoadoutOverride: expect.any(Array),
      equipmentSources: [
        {
          loadoutEntryId,
          equipmentId: compatibleClub.id,
          sourceRevision: 1,
          sourceVersionId: receipt.creatureEquipmentReplacement.sourceVersionId,
          sourceChecksum: checksumRuleDocument(compatibleClub),
          payload: compatibleClub
        },
        beforeState.snapshot.equipmentSources[1]
      ]
    })
    await expect(
      owner.caller.mutation(execute, {
        command: { ...command.command, equipmentId: dagger.id }
      })
    ).rejects.toThrow('different input')
    await owner.caller.mutation(execute, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        actorId: creatureActor.id,
        initiative: 10,
        manualOrder: 0
      }
    })
    const started = await owner.caller.mutation(execute, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    })
    const initiativeBefore = await t.run(async (ctx) => ({
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      sides: await ctx.db.query('encounterInitiativeSides').collect()
    }))
    const active = await owner.caller.mutation(
      execute,
      replace({
        encounterId: run.id,
        actorId: creatureActor.id,
        equipmentId: compatibleClub.id,
        expectedVersion: 3
      })
    )
    expect(active.projection).toMatchObject({
      status: 'ACTIVE',
      version: 4,
      currentActorId: started.projection.currentActorId
    })
    expect(active.projection.currentActorId).not.toBeNull()
    await expect(
      t.run(async (ctx) => ({
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        sides: await ctx.db.query('encounterInitiativeSides').collect()
      }))
    ).resolves.toEqual(initiativeBefore)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', compatibleClub.id))
        .unique()
      if (!root) throw new Error('Missing compatible Equipment root.')
      await ctx.db.patch(root._id, { ownerUserId: other.userId })
    })
    await expect(
      owner.caller.mutation(execute, {
        command: {
          ...command.command,
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: compatibleClub.id,
          commandId: command.command.commandId.toLowerCase()
        }
      })
    ).resolves.toEqual(first)
  }, 30000)

  it('rejects invalid, stale, wrong-kind, and incompatible replacement requests without writes', async () => {
    const { t, owner, run, creatureActor, customActor } = await setup()
    const before = await stored(t, run.id)
    const rejected: readonly [ReturnType<typeof replace>, string][] = [
      [
        replace({
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: compatibleClub.id,
          loadoutId: crypto.randomUUID()
        }),
        'Creature Equipment loadout entry was not found.'
      ],
      [
        replace({
          encounterId: run.id,
          actorId: customActor.id,
          equipmentId: compatibleClub.id
        }),
        'Only a Creature with a frozen source can replace Equipment.'
      ],
      [
        replace({ encounterId: run.id, actorId: creatureActor.id, equipmentId: dagger.id }),
        'Replacement Equipment is incompatible with the Creature Feature actions.'
      ],
      [
        replace({
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: compatibleClub.id,
          expectedVersion: 1
        }),
        'Encounter version is stale.'
      ]
    ]
    for (const [input, message] of rejected)
      await expect(owner.caller.mutation(execute, input)).rejects.toThrow(message)
    expect(await stored(t, run.id)).toEqual(before)
  }, 30000)

  it('rejects unauthorised and unavailable Equipment replacements without writes', async () => {
    const { t, owner, other, run, creatureActor } = await setup()
    const before = await stored(t, run.id)
    const command = replace({
      encounterId: run.id,
      actorId: creatureActor.id,
      equipmentId: compatibleClub.id
    })
    await expect(other.caller.mutation(execute, command)).rejects.toThrow('Campaign not found.')
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', compatibleClub.id))
        .unique()
      if (!root) throw new Error('Missing compatible Equipment root.')
      await ctx.db.patch(root._id, { ownerUserId: other.userId })
    })
    await expect(owner.caller.mutation(execute, command)).rejects.toThrow(
      'Encounter source is unavailable in the selected Game System.'
    )
    expect(await stored(t, run.id)).toEqual(before)
  }, 30000)
})
