import { describe, expect, it } from 'vitest'
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
import { seededSrdCreature } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'

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
  playerAutoRoll: boolean
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
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
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
    return discoverEncounterFeatureActionCapabilities({
      actor: encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson)),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find((capability) => capability.ownerFeatureId === featureId)?.actionId
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
})
