import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto,
  EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ActiveRuleEffectOwner } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { prepareActiveRuleEffectRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'

import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

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

const ids = {
  character: '00000000-0000-4000-8000-000000000001',
  secondCharacter: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  actor: '00000000-0000-4000-8000-000000000004',
  secondActor: '00000000-0000-4000-8000-000000000005',
  occurrence: '00000000-0000-4000-8000-000000000006',
  command: '00000000-0000-4000-8000-000000000007',
  definition: '00000000-0000-4000-8000-000000000008',
  entry: '00000000-0000-4000-8000-000000000009',
  system: '00000000-0000-4000-8000-000000000010',
  maintenanceDefinition: '00000000-0000-4000-8000-000000000011'
}

function ownerDefinition(characterId: string): ActiveRuleEffectDefinitionDto {
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'CHARACTER',
      sourceAggregateId: characterId,
      sourceOccurrenceId: ids.occurrence,
      rootCommandId: ids.command
    },
    authoredEffectId: ids.definition,
    compiledEntryId: ids.entry,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: ids.definition,
        gameSystemId: ids.system,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    }
  }
}

function encounterDefinition(encounterId: string, actorId: string): ActiveRuleEffectDefinitionDto {
  const definition = ownerDefinition(ids.character)
  return {
    ...definition,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId: ids.occurrence,
      rootCommandId: ids.command,
      sourceActorId: actorId
    },
    recurrence: {
      ...definition.recurrence,
      lifetimeScope: 'ENCOUNTER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN',
        anchor: 'HOLDER'
      }
    }
  }
}

const ownerLifecycle: ActiveRuleEffectLifecycleDto = { schemaVersion: 1, remainingTicks: null }
const encounterLifecycle: ActiveRuleEffectLifecycleDto = { schemaVersion: 1, remainingTicks: 3 }

const descriptor: EncounterMaintainedEffectDescriptorDto = {
  schemaVersion: 2,
  maintenanceDefinitionId: ids.maintenanceDefinition,
  definitionChecksum: 'b'.repeat(64),
  provenance: { kind: 'ACTION', sourceActionId: ids.command, sourceOccurrenceId: ids.occurrence },
  sourceActorId: ids.actor,
  replacementPolicy: 'REPLACE_SAME_DEFINITION',
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
}

async function fixture() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Effect store',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
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
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Effect store fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
  })
  const run = await base.other.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const customActor = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!characterActor || !customActor) throw new Error('Missing fixture actors.')
  return { ...base, run, characterActor, customActor }
}

function effectId(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

describe('native active Rule Effect store', () => {
  it('isolates Character and actor owners, canonicalizes UUIDs, and allocates ordinals from the existing owner maximum', async () => {
    const { t, character, run, customActor, characterActor } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const secondCharacterOwner: ActiveRuleEffectOwner = {
      kind: 'CHARACTER',
      characterId: ids.secondCharacter
    }
    const actorOwner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: run.id,
      targetActorId: customActor.id
    }
    const secondActorOwner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: run.id,
      targetActorId: characterActor.id
    }
    const characterDefinition = ownerDefinition(character.id)
    const actorDefinition = encounterDefinition(run.id, customActor.id)
    const firstId = effectId(20)
    const secondId = effectId(21)
    const actorId = effectId(22)
    const values = await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const first = await store.create({
        id: firstId.toUpperCase(),
        owner: { kind: 'CHARACTER', characterId: character.id.toUpperCase() },
        definition: characterDefinition,
        lifecycle: ownerLifecycle
      })
      const second = await store.create({
        id: secondId,
        owner: characterOwner,
        definition: characterDefinition,
        lifecycle: ownerLifecycle
      })
      const actor = await store.create({
        id: actorId,
        owner: actorOwner,
        definition: actorDefinition,
        lifecycle: encounterLifecycle
      })
      return {
        first,
        second,
        actor,
        character: await store.list(characterOwner),
        otherActor: await store.list(secondActorOwner),
        missing: await store.findById(characterOwner, effectId(99))
      }
    })
    expect(values.first).toMatchObject({
      id: firstId,
      owner: characterOwner,
      createdOrdinal: 1,
      version: 1
    })
    expect(values.second.createdOrdinal).toBe(2)
    expect(values.actor).toMatchObject({ id: actorId, owner: actorOwner, createdOrdinal: 1 })
    expect(values.character.map((effect) => effect.id)).toEqual([firstId, secondId])
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(
          secondCharacterOwner
        )
      )
    ).rejects.toThrow('Character owner is unavailable')
    expect(values.otherActor).toEqual([])
    expect(values.missing).toBeNull()
  })

  it('matches prepared Character and actor records at explicit times and detects stale ordinals', async () => {
    const { t, character, run, customActor } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const actorOwner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: run.id,
      targetActorId: customActor.id
    }
    const characterDefinition = ownerDefinition(character.id)
    const actorDefinition = encounterDefinition(run.id, customActor.id)
    const values = await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const characterFirstInput = {
        id: effectId(220),
        owner: characterOwner,
        definition: characterDefinition,
        lifecycle: ownerLifecycle,
        occurredAt: '2026-09-14T00:00:00.000Z'
      }
      const characterFirstForecast = prepareActiveRuleEffectRecord({
        ...characterFirstInput,
        currentEffects: []
      })
      const characterFirst = await store.create(characterFirstInput)
      const characterSecondInput = {
        ...characterFirstInput,
        id: effectId(221),
        occurredAt: '2026-09-14T00:00:01.000Z'
      }
      const staleCharacterSecondForecast = prepareActiveRuleEffectRecord({
        ...characterSecondInput,
        currentEffects: []
      })
      const characterSecondForecast = prepareActiveRuleEffectRecord({
        ...characterSecondInput,
        currentEffects: [characterFirst]
      })
      const characterSecond = await store.create(characterSecondInput)
      const actorFirstInput = {
        id: effectId(222),
        owner: actorOwner,
        definition: actorDefinition,
        lifecycle: encounterLifecycle,
        occurredAt: '2026-09-14T00:00:02.000Z'
      }
      const actorFirstForecast = prepareActiveRuleEffectRecord({
        ...actorFirstInput,
        currentEffects: []
      })
      const actorFirst = await store.create(actorFirstInput)
      const actorSecondInput = {
        ...actorFirstInput,
        id: effectId(223),
        occurredAt: '2026-09-14T00:00:03.000Z'
      }
      const actorSecondForecast = prepareActiveRuleEffectRecord({
        ...actorSecondInput,
        currentEffects: [actorFirst]
      })
      const actorSecond = await store.create(actorSecondInput)
      return {
        characterFirstForecast,
        characterFirst,
        staleCharacterSecondForecast,
        characterSecondForecast,
        characterSecond,
        actorFirstForecast,
        actorFirst,
        actorSecondForecast,
        actorSecond
      }
    })
    expect(values.characterFirst).toEqual(values.characterFirstForecast)
    expect(values.characterSecond).toEqual(values.characterSecondForecast)
    expect(values.actorFirst).toEqual(values.actorFirstForecast)
    expect(values.actorSecond).toEqual(values.actorSecondForecast)
    expect(values.characterSecond).not.toEqual(values.staleCharacterSecondForecast)
    expect(values.characterSecond.createdOrdinal).toBe(2)
    expect(values.actorSecond.createdOrdinal).toBe(2)
    expect(values.actorFirst.sourceEncounterId).toBeNull()
  })

  it('increments lifecycle versions exactly once and rejects stale lifecycle writes and deletion without changing the row', async () => {
    const { t, character } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const characterDefinition = ownerDefinition(character.id)
    const id = effectId(30)
    await t.run(async (ctx) => {
      await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id,
        owner: characterOwner,
        definition: characterDefinition,
        lifecycle: ownerLifecycle
      })
    })
    const updated = await t.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
        id,
        owner: characterOwner,
        expectedVersion: 1,
        lifecycle: ownerLifecycle
      })
    )
    expect(updated).toMatchObject({ version: 2, lifecycle: ownerLifecycle })
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
          id,
          owner: characterOwner,
          expectedVersion: 1,
          lifecycle: ownerLifecycle
        })
      )
    ).rejects.toThrow()
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).deleteCas({
          id,
          owner: characterOwner,
          expectedVersion: 1,
          removal: 'REMOVED'
        })
      )
    ).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).findById(
          characterOwner,
          id
        )
      )
    ).toMatchObject({
      version: 2,
      lifecycle: ownerLifecycle
    })
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
          id,
          owner: characterOwner,
          expectedVersion: 2,
          lifecycle: { schemaVersion: 1, remainingTicks: 1 }
        })
      )
    ).rejects.toThrow()
  })

  it('rejects checksum corruption when reading persisted effect and maintained state rows', async () => {
    const { t, character, run, customActor } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const characterDefinition = ownerDefinition(character.id)
    const id = effectId(40)
    const stateId = effectId(41)
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      await store.create({
        id,
        owner: characterOwner,
        definition: characterDefinition,
        lifecycle: ownerLifecycle
      })
      await store.createMaintainedState({
        id: stateId,
        encounterId: run.id,
        ownerActorId: customActor.id,
        descriptor: { ...descriptor, sourceActorId: customActor.id }
      })
      const effect = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      const state = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_publicId', (q) => q.eq('id', stateId))
        .unique()
      if (!effect || !state) throw new Error('Missing native effect fixture.')
      await ctx.db.patch(effect._id, { definitionChecksum: '0'.repeat(64) })
      await ctx.db.patch(state._id, { descriptorChecksum: '0'.repeat(64) })
    })
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).findById(
          characterOwner,
          id
        )
      )
    ).rejects.toThrow()
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).findMaintainedStateById({
          encounterId: run.id,
          stateId
        })
      )
    ).rejects.toThrow()
  })

  it('binds maintained states to their source actor and definition, cascades actor dependents, and restricts Character dependents', async () => {
    const { t, character, run, customActor, characterActor } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const actorOwner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: run.id,
      targetActorId: customActor.id
    }
    const actorDefinition = encounterDefinition(run.id, customActor.id)
    const maintainedDescriptor = { ...descriptor, sourceActorId: customActor.id }
    const actorStateId = effectId(50)
    const characterStateId = effectId(51)
    const actorEffectId = effectId(52)
    const characterEffectId = effectId(53)
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const state = await store.createMaintainedState({
        id: actorStateId,
        encounterId: run.id,
        ownerActorId: customActor.id,
        descriptor: maintainedDescriptor
      })
      expect(
        await store.findMaintainedState({
          encounterId: run.id,
          ownerActorId: customActor.id,
          maintenanceDefinitionId: ids.maintenanceDefinition
        })
      ).toMatchObject({ id: state.id })
      await expect(
        store.createMaintainedState({
          id: effectId(54),
          encounterId: run.id,
          ownerActorId: customActor.id,
          descriptor: maintainedDescriptor
        })
      ).rejects.toThrow()
      await expect(
        store.createMaintainedState({
          id: effectId(55),
          encounterId: run.id,
          ownerActorId: characterActor.id,
          descriptor: maintainedDescriptor
        })
      ).rejects.toThrow()
      await store.create({
        id: actorEffectId,
        owner: actorOwner,
        definition: actorDefinition,
        lifecycle: encounterLifecycle,
        maintainedEffectStateId: actorStateId
      })
      await store.deleteMaintainedStateCas({
        id: actorStateId,
        encounterId: run.id,
        ownerActorId: customActor.id,
        expectedVersion: 1,
        removal: 'REMOVED'
      })
      expect(await store.findById(actorOwner, actorEffectId)).toBeNull()
      await store.createMaintainedState({
        id: characterStateId,
        encounterId: run.id,
        ownerActorId: customActor.id,
        descriptor: { ...maintainedDescriptor, maintenanceDefinitionId: effectId(56) }
      })
      await store.create({
        id: characterEffectId,
        owner: characterOwner,
        definition: actorDefinition,
        lifecycle: encounterLifecycle,
        maintainedEffectStateId: characterStateId
      })
    })
    await expect(
      t.run((ctx) =>
        createActiveRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).deleteMaintainedStateCas({
          id: characterStateId,
          encounterId: run.id,
          ownerActorId: customActor.id,
          expectedVersion: 1,
          removal: 'REMOVED'
        })
      )
    ).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).findById(
          characterOwner,
          characterEffectId
        )
      )
    ).not.toBeNull()
  })

  it('enforces the maintained dependent bound across an actor’s states', async () => {
    const { t, character, run, customActor, characterActor } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const actorOwner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: run.id,
      targetActorId: characterActor.id
    }
    const definition = encounterDefinition(run.id, customActor.id)
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const stateIds = [effectId(70), effectId(71)] as const
      for (const [index, stateId] of stateIds.entries()) {
        await store.createMaintainedState({
          id: stateId,
          encounterId: run.id,
          ownerActorId: customActor.id,
          descriptor: {
            ...descriptor,
            sourceActorId: customActor.id,
            maintenanceDefinitionId: effectId(72 + index)
          }
        })
      }
      for (let index = 0; index < 32; index++) {
        await store.create({
          id: effectId(100 + index),
          owner: characterOwner,
          definition,
          lifecycle: encounterLifecycle,
          maintainedEffectStateId: stateIds[0]
        })
        await store.create({
          id: effectId(140 + index),
          owner: actorOwner,
          definition,
          lifecycle: encounterLifecycle,
          maintainedEffectStateId: stateIds[1]
        })
      }
      await expect(
        store.create({
          id: effectId(180),
          owner: characterOwner,
          definition,
          lifecycle: encounterLifecycle,
          maintainedEffectStateId: stateIds[0]
        })
      ).rejects.toThrow()
      expect(
        await store.listDependentEffects({ encounterId: run.id, stateId: stateIds[0] })
      ).toHaveLength(32)
    })
  })

  it('enforces owner and maintained-state limits without deleting existing state', async () => {
    const { t, character, run, customActor } = await fixture()
    const owner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const definition = ownerDefinition(character.id)
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      for (let index = 0; index < MAX_ACTIVE_RULE_EFFECTS_PER_OWNER; index++) {
        await store.create({
          id: effectId(300 + index),
          owner,
          definition,
          lifecycle: ownerLifecycle
        })
      }
      await expect(
        store.create({ id: effectId(400), owner, definition, lifecycle: ownerLifecycle })
      ).rejects.toThrow('at most')
      for (let index = 0; index < MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR; index++) {
        await store.createMaintainedState({
          id: effectId(500 + index),
          encounterId: run.id,
          ownerActorId: customActor.id,
          descriptor: {
            ...descriptor,
            sourceActorId: customActor.id,
            maintenanceDefinitionId: effectId(600 + index)
          }
        })
      }
      await expect(
        store.createMaintainedState({
          id: effectId(700),
          encounterId: run.id,
          ownerActorId: customActor.id,
          descriptor: {
            ...descriptor,
            sourceActorId: customActor.id,
            maintenanceDefinitionId: effectId(701)
          }
        })
      ).rejects.toThrow('at most')
      expect(await store.list(owner)).toHaveLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
      expect(
        await store.listMaintainedStatesByOwner({
          encounterId: run.id,
          ownerActorId: customActor.id
        })
      ).toHaveLength(MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR)
    })
  })

  it('rolls back writes when the surrounding convex-test transaction aborts', async () => {
    const { t, character } = await fixture()
    const characterOwner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId: character.id }
    const characterDefinition = ownerDefinition(character.id)
    const id = effectId(60)
    await expect(
      t.run(async (ctx) => {
        await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id,
          owner: characterOwner,
          definition: characterDefinition,
          lifecycle: ownerLifecycle
        })
        throw new Error('Injected transaction abort')
      })
    ).rejects.toThrow('Injected transaction abort')
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(characterOwner)
      )
    ).toEqual([])
  })
})
