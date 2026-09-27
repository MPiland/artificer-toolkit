import { describe, expect, it } from 'vitest'
import { characterSheetCommandInputDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seededSrdCreature, seededSrdLoadoutEquipment } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { createActiveRuleEffectStore } from '../rules/effectStore'

function srdId(entries: readonly { id: string; code: string }[], code: string) {
  const entry = entries.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`The SRD ${code} is missing.`)
  return entry.id
}
const conditionId = (code: string) => srdId(SRD_CONDITION_TYPES, code)
const damageTypeId = (code: string) => srdId(SRD_DAMAGE_TYPES, code)

/** Every die the room rolls, as 0-based faces in request order. */
function scripted(faces: readonly number[]) {
  const queue = [...faces]
  return (maximum: number) => {
    const face = queue.shift()
    if (face === undefined || face >= maximum) throw new Error(`Unexpected roll (d${maximum}).`)
    return face
  }
}

/**
 * The seeded SRD Creature attacking the player's Character in an Assisted Run. The GM rolls the
 * Creature's dice automatically; the player's Character rolls its own saves (D19).
 */
async function setup(input: {
  creature: string
  feature: string
  conditionCodes?: readonly string[]
  /** The grip of a versatile weapon attack, which is its own action. */
  grip?: 'ONE_HANDED' | 'TWO_HANDED'
  playerAutoRoll: boolean
  /** The Creature's current hit points, when not its maximum. */
  creatureHitPoints?: number
}) {
  const base = await setupCharacterRun()
  await setAutoRollDice(base.t, base.owner.userId, true)
  await setAutoRollDice(base.t, base.player.userId, input.playerAutoRoll)
  const creature = seededSrdCreature(input.creature)
  const conditionIds = (input.conditionCodes ?? []).map(conditionId)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID || conditionIds.includes(definition.id)
    )
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature }),
      ...seededSrdLoadoutEquipment(creature).map(importedSubject)
    ]
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: `${input.creature} fixture`,
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('The SRD attack fixture actors are missing.')
  const featureId = creature.features?.find((feature) => feature.label === input.feature)?.id
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('The SRD attack fixture Run is missing.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, state, [actor.id, target.id])
    const actorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!actorRow) throw new Error('The SRD attack fixture Creature is missing.')
    const actorState = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
    if (input.creatureHitPoints !== undefined) {
      const hurt = { ...actorState, currentHitPoints: input.creatureHitPoints }
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(hurt),
        stateChecksum: checksumCanonicalJson(hurt)
      })
    }
    return discoverEncounterFeatureActionCapabilities({
      actor: actorState,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find(
      (capability) =>
        capability.ownerFeatureId === featureId && capability.grip === (input.grip ?? null)
    )?.actionId
  })
  if (!actionId) throw new Error(`The seeded ${input.creature} ${input.feature} is not an action.`)
  return {
    ...base,
    run,
    command: {
      type: 'RESOLVE_ACTION' as const,
      acceptedWieldConflict: null,
      // No Scene is bound, so the attack's reach can't be measured (D11).
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED' as const],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: actor.id,
      targetActorId: target.id,
      actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
  }
}

type Fixture = Awaited<ReturnType<typeof setup>>

/** The settled action's Character mechanics receipt. */
async function settledBatch(base: Fixture) {
  const receipt = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', base.command.commandId)
      )
      .unique()
  )
  if (!receipt) throw new Error('The SRD attack receipt is missing.')
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    result.status !== 'COMPLETE' ||
    result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
  )
    throw new Error('Expected a Character mechanics receipt.')
  const batch = result.applicationOutputs
  return {
    ...batch,
    damage: batch.applications.flatMap((application) =>
      application.kind === 'DAMAGE' ? [[application.requestedAmount, application.damageTypeId]] : []
    )
  }
}

function answerSave(base: Fixture, result: EncounterCommandResultDto, face: number) {
  const pending = result.occurrence?.pending
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save prompt.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
}

describe('seeded SRD Creature hit riders in the room', () => {
  it('deals both damage parts of the Hell Hound’s Bite on one hit', async () => {
    const base = await setup({ creature: 'Hell Hound', feature: 'Bite', playerAutoRoll: true })
    // A natural 19 hits; every damage die rolls 1: 1 + 3 piercing and 1 + 1 fire.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(base)).damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('FIRE')]
    ])
  }, 30000)

  it('rolls every damage die of the Hell Hound’s Bite twice on a critical hit', async () => {
    const base = await setup({ creature: 'Hell Hound', feature: 'Bite', playerAutoRoll: true })
    // A natural 20: 2d8 + 3 piercing and 4d6 fire, every die rolling 1.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([19, 0, 0, 0, 0, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(batch.damage).toEqual([
      [2 + 3, damageTypeId('PIERCING')],
      [4, damageTypeId('FIRE')]
    ])
  }, 30000)

  it('hits with the Aboleth’s newly authored Tentacle (D60)', async () => {
    const base = await setup({ creature: 'Aboleth', feature: 'Tentacle', playerAutoRoll: true })
    // A natural 19 hits; 2d6 + 5 bludgeoning with both dice rolling 1.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.d20).toMatchObject({ selectedNatural: 19, resultPath: 'ON_HIT' })
    expect(batch.damage).toEqual([[7, damageTypeId('BLUDGEONING')]])
  }, 30000)

  it('hits with the new Swarm of Ravens’ Beaks, which add no ability modifier (D60)', async () => {
    const base = await setup({
      creature: 'Swarm of Ravens',
      feature: 'Beaks',
      playerAutoRoll: true
    })
    // A natural 19 hits; 2d6 piercing with both dice rolling 1.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(base)).damage).toEqual([[2, damageTypeId('PIERCING')]])
  }, 30000)

  it('bites a creature in the Swarm of Rats’ space for half dice once it has half of its hit points or fewer (D61)', async () => {
    const bites = (creatureHitPoints: number) =>
      setup({
        creature: 'Swarm of Rats',
        feature: 'Bites',
        playerAutoRoll: true,
        creatureHitPoints
      })
    // Reach 0 ft.; a natural 19 hits for 2d6 piercing, or 1d6 at 12 of 24 hit points or fewer.
    const full = await bites(13)
    const fullResult = await executeInRoom(
      full.owner.caller,
      { command: full.command },
      scripted([18, 2, 3])
    )
    expect(fullResult.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(full)).damage).toEqual([[3 + 4, damageTypeId('PIERCING')]])
    const half = await bites(12)
    const halfResult = await executeInRoom(
      half.owner.caller,
      { command: half.command },
      scripted([18, 2])
    )
    expect(halfResult.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(half)).damage).toEqual([[3, damageTypeId('PIERCING')]])
  }, 60000)

  it('routes the Giant Spider’s poison save to the Character’s player, then halves on a success', async () => {
    const base = await setup({ creature: 'Giant Spider', feature: 'Bite', playerAutoRoll: false })
    // The GM auto-rolls the hit and its piercing damage; the Character's save waits on its player.
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0])
    )
    expect(pending.occurrence).toMatchObject({
      status: 'PENDING',
      pending: { kind: 'D20_EVIDENCE', rollerActorId: base.command.targetActorId }
    })
    const prompt = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      {
        encounterId: base.run.id
      }
    )
    expect(prompt).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: base.command.targetActorId
    })
    // A natural 20 saves against DC 11; the poison dice roll 2 and 2, halved to 2.
    const answered = await executeInRoom(
      base.player.caller,
      answerSave(base, pending, 20),
      scripted([1, 1])
    )
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({
      selectedNatural: 20,
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_SUCCESS'
    })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('POISON')]
    ])
  }, 30000)

  it('auto-rolls the Character’s save when its player auto-rolls, taking full poison on a failure', async () => {
    const base = await setup({ creature: 'Giant Spider', feature: 'Bite', playerAutoRoll: true })
    // Hit, 1 + 3 piercing, then a natural 1 fails the save: 1 + 1 poison.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ selectedNatural: 1, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('POISON')]
    ])
  }, 30000)

  it('knocks the Character prone when it fails its save against the Mastiff’s Bite', async () => {
    const base = await setup({
      creature: 'Mastiff',
      feature: 'Bite',
      conditionCodes: ['PRONE'],
      playerAutoRoll: false
    })
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0])
    )
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 11, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('PRONE'))
  }, 30000)

  it('deals the Spider’s poison only when the Character fails its save', async () => {
    const base = await setup({ creature: 'Spider', feature: 'Bite', playerAutoRoll: false })
    // A natural 19 hits for a fixed 1 piercing; the Character's save waits on its player.
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18])
    )
    const answered = await executeInRoom(
      base.player.caller,
      answerSave(base, pending, 1),
      scripted([2])
    )
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 9, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [1, damageTypeId('PIERCING')],
      [3, damageTypeId('POISON')]
    ])
  }, 30000)

  it('paralyzes the Character with a repeating save when it fails against the Ghoul’s Claws', async () => {
    const base = await setup({
      creature: 'Ghoul',
      feature: 'Claws',
      conditionCodes: ['PARALYZED'],
      playerAutoRoll: false
    })
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0])
    )
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('PARALYZED'))
    expect(batch.activeEffectTransitions).toMatchObject([{ kind: 'CREATE' }])
  }, 30000)

  it('hits with the Ogre’s Greatclub for its printed damage through its held Equipment (D62, M9)', async () => {
    const base = await setup({ creature: 'Ogre', feature: 'Greatclub', playerAutoRoll: true })
    // A natural 19 hits; 2d8 + 4 bludgeoning (the Equipment alone deals 1d8) with both dice rolling 1.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(base)).damage).toEqual([[6, damageTypeId('BLUDGEONING')]])
  }, 30000)

  it('grapples and restrains the Character with one hit of the Giant Toad’s Bite (D62, M9)', async () => {
    const base = await setup({
      creature: 'Giant Toad',
      feature: 'Bite',
      conditionCodes: ['GRAPPLED', 'RESTRAINED'],
      playerAutoRoll: true
    })
    // A natural 19 hits; 1d10 + 2 piercing and 1d10 poison, both dice rolling 1.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.damage).toEqual([
      [3, damageTypeId('PIERCING')],
      [1, damageTypeId('POISON')]
    ])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('GRAPPLED'), conditionId('RESTRAINED')])
    )
  }, 30000)

  it('poisons the Character for 1 minute when it fails its save against the Homunculus’s Bite (D62.2)', async () => {
    const base = await setup({
      creature: 'Homunculus',
      feature: 'Bite',
      conditionCodes: ['POISONED'],
      playerAutoRoll: false
    })
    // A natural 19 hits for a fixed 1 piercing; the Character's save waits on its player.
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18])
    )
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('POISONED'))
    // One active effect times the poison: 10 of the Character's turns, with no repeated save.
    expect(batch.activeEffectTransitions).toMatchObject([
      { kind: 'CREATE', recurrenceStage: 'END_OF_TURN', remainingTicks: 10 }
    ])
  }, 30000)

  it('drains the Character’s hit point maximum with the Wight’s Life Drain until a long rest (D62)', async () => {
    const base = await setup({ creature: 'Wight', feature: 'Life Drain', playerAutoRoll: false })
    // A natural 19 hits for 1d6 + 2 necrotic, the die rolling 4; the Character's save waits on its player.
    const pending = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 3])
    )
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    const batch = await settledBatch(base)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 13, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[6, damageTypeId('NECROTIC')]])
    const maximum = batch.targetTransition.before.maximumHitPoints
    expect(batch.targetTransition.after.maximumHitPoints).toBe(maximum - 6)
    expect(batch.applications).toContainEqual(
      expect.objectContaining({
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: 6,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      })
    )
    const reductions = () =>
      base.t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({
          kind: 'CHARACTER',
          characterId: base.character.id
        })
      )
    expect(await reductions()).toHaveLength(1)

    // A long rest ends the reduction and restores every hit point.
    const streamVersion = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique()
      if (!row) throw new Error('The Life Drain Character is missing.')
      return row.streamVersion
    })
    const input = {
      restKind: 'LONG' as const,
      expectedVersion: streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC' as const,
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false as const
    }
    const preview = await base.player.caller.query(api.characters.rest.preview, {
      id: base.character.id,
      input
    })
    const rested = await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: characterSheetCommandInputDtoSchema.parse({
        ...input,
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        previewFingerprint: preview.previewFingerprint
      })
    })
    expect(await reductions()).toEqual([])
    expect(rested.sheet.overview).toMatchObject({
      currentHitPoints: maximum,
      maxHitPoints: maximum
    })
  }, 30000)

  it('offers the Erinyes’ Longsword one- and two-handed and resolves the chosen grip', async () => {
    const base = await setup({
      creature: 'Erinyes',
      feature: 'Longsword',
      grip: 'TWO_HANDED',
      playerAutoRoll: true
    })
    const choices = await base.owner.caller.query(api.encounters.actionChoices.get, {
      encounterId: base.run.id,
      expectedVersion: base.command.expectedVersion,
      actorId: base.command.actorId
    })
    const longswords = (choices?.actions ?? []).filter((action) => action.grip !== null)
    expect(longswords.map((action) => action.grip?.value).sort()).toEqual([
      'ONE_HANDED',
      'TWO_HANDED'
    ])
    expect(new Set(longswords.map((action) => action.grip?.attackKey)).size).toBe(1)
    expect(longswords.find((action) => action.grip?.value === 'TWO_HANDED')?.id).toBe(
      base.command.actionId
    )
    // A natural 19 hits; the two-handed d10 rolls 10 (a d8 could not): 10 + 4 slashing, then 3d8
    // poison rolling 1s.
    const result = await executeInRoom(
      base.owner.caller,
      { command: base.command },
      scripted([18, 9, 0, 0, 0])
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect((await settledBatch(base)).damage).toEqual([
      [14, damageTypeId('SLASHING')],
      [3, damageTypeId('POISON')]
    ])
  }, 30000)
})
