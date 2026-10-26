import { readTestActor } from '../../tests/fixtures/storedActors'
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
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { shieldWoodPlus1 } from '@artificer-toolkit/source-data/srd/equipment/shield-wood-plus-1.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SUBJECT_COMPILER_VERSION } from '@artificer-toolkit/schema/api/authoredPublication'
import { srdPrintedArmorClass, srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { toCreatureFeatureEffects } from '../../tests/fixtures/creatureWeaponEffects'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  RoomCommandRefusal,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

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
    feature.id === bite.id
      ? { ...feature, effects: toCreatureFeatureEffects(club.effects) }
      : feature
  ),
  equipmentLoadout: [
    {
      id: loadoutEntryId,
      equipmentId: club.id,
      quantity: 1,
      useState: 'MAIN_HAND' as const,
      attuned: false,
      actionFeatureIds: [bite.id]
    },
    {
      id: unchangedLoadoutEntryId,
      equipmentId: dagger.id,
      quantity: 1,
      useState: 'OFF_HAND' as const,
      attuned: false,
      actionFeatureIds: []
    }
  ]
}

const shieldEntryId = '10000000-0000-4000-8000-000000000104'
const shieldedCreature = {
  ...creature,
  equipmentLoadout: [
    creature.equipmentLoadout[0],
    {
      id: shieldEntryId,
      equipmentId: shieldWood.id,
      quantity: 1,
      useState: 'OFF_HAND' as const,
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

// A +1 shield whose armor class modifier carries no restriction: a Creature folds it as a Character
// does, so it applies while held (ATTACK-6.T4a).
const unrestrictedShield = {
  ...shieldWoodPlus1,
  id: '10000000-0000-4000-8000-000000000105',
  label: 'Unrestricted Shield',
  modifiers: shieldWoodPlus1.modifiers?.map(
    ({ restrictions: _restrictions, ...modifier }) => modifier
  )
}

async function seedCampaign(authored: typeof creature = creature) {
  const base = await fixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...authored, subjectKind: 'CREATURE', document: authored }),
      importedSubject({
        ...unrestrictedShield,
        subjectKind: 'EQUIPMENT',
        document: unrestrictedShield
      }),
      importedSubject({ ...shieldWood, subjectKind: 'EQUIPMENT', document: shieldWood }),
      importedSubject({
        ...shieldWoodPlus1,
        subjectKind: 'EQUIPMENT',
        document: shieldWoodPlus1
      }),
      importedSubject({ ...club, subjectKind: 'EQUIPMENT', document: club }),
      importedSubject({
        ...compatibleClub,
        subjectKind: 'EQUIPMENT',
        document: compatibleClub
      }),
      importedSubject({ ...dagger, subjectKind: 'EQUIPMENT', document: dagger }),
      importedSubject({ ...greatclub, subjectKind: 'EQUIPMENT', document: greatclub })
    ]
  })
  // A variant's stored compilation resolves its parents, so it is stored after them (D163).
  for (const variant of [unrestrictedShield, shieldWoodPlus1])
    await base.t.mutation(internal.content.import.syncEquipmentDerived, {
      id: variant.id,
      checksum: checksumRuleDocument(variant)
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
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  return { ...base, campaign }
}

function blueprintInput(
  authored: typeof creature,
  campaign: Awaited<ReturnType<typeof seedCampaign>>['campaign']
) {
  return {
    gameSystemId: campaign.gameSystemId,
    name: 'Creature equipment fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE' as const, sourceId: authored.id },
      { kind: 'CUSTOM' as const, label: 'Unchanged dummy', maxHitPoints: 4 }
    ]
  }
}

async function setup(authored: typeof creature = creature) {
  const base = await seedCampaign(authored)
  const { campaign } = base
  const blueprint = await base.owner.caller.mutation(
    createBlueprint,
    blueprintInput(authored, campaign)
  )
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const creatureActor = run.actors.find((actor) => actor.kind === 'CREATURE')
  const customActor = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!creatureActor || !customActor) throw new Error('Missing Encounter actor fixtures.')
  await attachFixtureRoom(base.t, campaign.id)
  return { ...base, campaign, run, creatureActor, customActor }
}

/** The Run's rows as the room last published them: it holds the Run until it checkpoints (D85). */
async function stored(
  t: Awaited<ReturnType<typeof setup>>['t'],
  campaignId: string,
  encounterId: string
) {
  await checkpointLiveRoom(campaignId)
  return t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    const actors = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect()
    return {
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run,
      actors,
      actorStates: await Promise.all(actors.map((row) => readTestActor(ctx, row)))
    }
  })
}

async function initiativeRows(t: Awaited<ReturnType<typeof setup>>['t'], campaignId: string) {
  await checkpointLiveRoom(campaignId)
  return t.run(async (ctx) => ({
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect()
  }))
}

describe('native Encounter REPLACE_CREATURE_EQUIPMENT commands', () => {
  useLocalRoomWorker()

  it('pins an equivalent current Equipment source, preserves unrelated Encounter state, and replays without source reads', async () => {
    const { t, campaign, owner, other, run, creatureActor, customActor } = await setup()
    const before = await stored(t, campaign.id, run.id)
    const command = replace({
      encounterId: run.id.toUpperCase(),
      actorId: creatureActor.id.toUpperCase(),
      equipmentId: compatibleClub.id.toUpperCase(),
      commandId: crypto.randomUUID().toUpperCase()
    })
    const first = await executeInRoom(owner.caller, command)
    expect(first.projection).toMatchObject({ id: run.id, version: 1, currentActorId: null })
    const after = await stored(t, campaign.id, run.id)
    const beforeCreature = before.actors.find((actor) => actor.id === creatureActor.id)
    const afterCreature = after.actors.find((actor) => actor.id === creatureActor.id)
    const beforeCustom = before.actors.find((actor) => actor.id === customActor.id)
    const afterCustom = after.actors.find((actor) => actor.id === customActor.id)
    if (!beforeCreature || !afterCreature || !beforeCustom || !afterCustom)
      throw new Error('Missing stored Encounter actors.')
    const beforeState = before.actorStates.find((state) => state.id === creatureActor.id)!
    const afterState = after.actorStates.find((state) => state.id === creatureActor.id)!
    if (beforeState.kind === 'CHARACTER') throw new Error('Expected a Creature actor.')
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
          { id: loadoutEntryId, equipmentId: compatibleClub.id, useState: 'MAIN_HAND' },
          { id: unchangedLoadoutEntryId, equipmentId: dagger.id, useState: 'OFF_HAND' }
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
    // The room holds the command receipt (D85). Its provenance is the pinned source object the
    // actor's snapshot carries (`replaceActorEquipment`), so the snapshot shows what it records.
    expect(afterState.snapshot).toEqual({
      ...beforeState.snapshot,
      equipmentLoadoutOverride: expect.any(Array),
      equipmentSources: [
        {
          loadoutEntryId,
          equipmentId: compatibleClub.id,
          sourceRevision: 1,
          sourceVersionId: expect.any(String),
          sourceChecksum: checksumRuleDocument(compatibleClub),
          compilation: expect.objectContaining({
            compilerVersion: SUBJECT_COMPILER_VERSION,
            authoredChecksum: checksumRuleDocument(compatibleClub)
          })
        },
        beforeState.snapshot.equipmentSources[1]
      ]
    })
    await expectRedactedRoomRefusal(
      executeInRoom(owner.caller, {
        command: { ...command.command, equipmentId: dagger.id }
      }),
      'already used for different input',
      'INVALID_COMMAND'
    )
    await executeInRoom(owner.caller, {
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
    const started = await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    })
    const initiativeBefore = await initiativeRows(t, campaign.id)
    const active = await executeInRoom(
      owner.caller,
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
    await expect(initiativeRows(t, campaign.id)).resolves.toEqual(initiativeBefore)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', compatibleClub.id))
        .unique()
      if (!root) throw new Error('Missing compatible Equipment root.')
      await ctx.db.patch(root._id, { ownerUserId: other.userId })
    })
    // The room answers the retry from its held history, without reading the Equipment source.
    await expect(
      executeInRoom(owner.caller, {
        command: {
          ...command.command,
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: compatibleClub.id,
          commandId: command.command.commandId.toLowerCase()
        }
      })
    ).resolves.toEqual({
      ...first,
      projection: await owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: run.id
      })
    })
  }, 30000)

  it('rejects invalid, stale, wrong-kind, and incompatible replacement requests without writes', async () => {
    const { t, campaign, owner, run, creatureActor, customActor } = await setup()
    const before = await stored(t, campaign.id, run.id)
    // Convex redacts its refusals to the room; only a domain rejection keeps its message.
    const rejected: readonly [ReturnType<typeof replace>, string | typeof RoomCommandRefusal][] = [
      [
        replace({
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: compatibleClub.id,
          loadoutId: crypto.randomUUID()
        }),
        RoomCommandRefusal
      ],
      [
        replace({
          encounterId: run.id,
          actorId: customActor.id,
          equipmentId: compatibleClub.id
        }),
        RoomCommandRefusal
      ],
      [
        replace({ encounterId: run.id, actorId: creatureActor.id, equipmentId: dagger.id }),
        RoomCommandRefusal
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
      await expect(executeInRoom(owner.caller, input)).rejects.toThrow(message)
    expect(await stored(t, campaign.id, run.id)).toEqual(before)
  }, 30000)

  it('copies the authored hands to the instance and refuses a replacement that breaks them', async () => {
    const { t, campaign, owner, run, creatureActor } = await setup()
    const before = await stored(t, campaign.id, run.id)
    const beforeState = before.actorStates.find((state) => state.id === creatureActor.id)
    if (!beforeState || beforeState.kind === 'CHARACTER') throw new Error('Expected a Creature.')
    expect(beforeState.snapshot).toMatchObject({
      payload: {
        equipmentLoadout: [
          { id: loadoutEntryId, useState: 'MAIN_HAND' },
          { id: unchangedLoadoutEntryId, useState: 'OFF_HAND' }
        ]
      }
    })
    // A two-handed weapon cannot replace the off-hand item.
    await expect(
      executeInRoom(
        owner.caller,
        replace({
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: greatclub.id,
          loadoutId: unchangedLoadoutEntryId
        })
      )
    ).rejects.toThrow(RoomCommandRefusal)
    expect(await stored(t, campaign.id, run.id)).toEqual(before)
    // A one-handed replacement keeps the instance's hand.
    await executeInRoom(
      owner.caller,
      replace({
        encounterId: run.id,
        actorId: creatureActor.id,
        equipmentId: club.id,
        loadoutId: unchangedLoadoutEntryId
      })
    )
    const after = await stored(t, campaign.id, run.id)
    const afterState = after.actorStates.find((state) => state.id === creatureActor.id)
    if (!afterState || afterState.kind === 'CHARACTER') throw new Error('Expected a Creature.')
    expect(afterState.snapshot).toMatchObject({
      equipmentLoadoutOverride: [
        { id: loadoutEntryId, equipmentId: club.id, useState: 'MAIN_HAND' },
        { id: unchangedLoadoutEntryId, equipmentId: club.id, useState: 'OFF_HAND' }
      ]
    })
  }, 30000)

  it.each([shieldWoodPlus1, unrestrictedShield])(
    'recomputes the projected armor class when $label replaces the shield',
    async (plusOneShield) => {
      const { t, campaign, owner, run, creatureActor } = await setup(shieldedCreature)
      const armorClassOf = async () => {
        const records = await stored(t, campaign.id, run.id)
        const state = records.actorStates.find((value) => value.id === creatureActor.id)
        if (!state) throw new Error('Missing Creature state.')
        return snapshotStatBlock(state)?.armorClass
      }
      const shieldedArmorClass = srdPrintedArmorClass(wolf) + 2
      expect(await armorClassOf()).toBe(shieldedArmorClass)
      await executeInRoom(
        owner.caller,
        replace({
          encounterId: run.id,
          actorId: creatureActor.id,
          equipmentId: plusOneShield.id,
          loadoutId: shieldEntryId
        })
      )
      expect(await armorClassOf()).toBe(shieldedArmorClass + 1)
    },
    30000
  )

  it('admits a Creature whose held shield modifier carries no restriction', async () => {
    const authored = {
      ...shieldedCreature,
      equipmentLoadout: [
        creature.equipmentLoadout[0],
        { ...shieldedCreature.equipmentLoadout[1], equipmentId: unrestrictedShield.id }
      ]
    }
    const { t, campaign, owner } = await seedCampaign(authored)
    await owner.caller.mutation(createBlueprint, blueprintInput(authored, campaign))
    expect(await t.run((ctx) => ctx.db.query('encounterBlueprints').take(2))).toHaveLength(1)
  }, 30000)

  it('rejects unauthorised and unavailable Equipment replacements without writes', async () => {
    const { t, campaign, owner, other, run, creatureActor } = await setup()
    const before = await stored(t, campaign.id, run.id)
    const command = replace({
      encounterId: run.id,
      actorId: creatureActor.id,
      equipmentId: compatibleClub.id
    })
    await expect(executeInRoom(other.caller, command)).rejects.toThrow('Campaign not found.')
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', compatibleClub.id))
        .unique()
      if (!root) throw new Error('Missing compatible Equipment root.')
      await ctx.db.patch(root._id, { ownerUserId: other.userId })
    })
    // The room reads Equipment from the Campaign's content snapshot, so rebuild it after the edit.
    await attachFixtureRoom(t, campaign.id)
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow(RoomCommandRefusal)
    expect(await stored(t, campaign.id, run.id)).toEqual(before)
  }, 30000)
})
