import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { describe, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { healthBand } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readRunActor, readRunState } from './documents'
import * as rollRandom from '../lib/rollRandom'

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

const wolfBite = wolf.features?.find((feature) => feature.label === 'Bite')
const wolfBiteEffect = wolfBite?.effects?.[0]
if (!wolfBite || !wolfBiteEffect || wolfBiteEffect.invocation.kind !== 'ACTION')
  throw new Error('Missing Wolf Bite fixture.')
const biteInvocation = wolfBiteEffect.invocation

/** A one-damage, any-range action so the journey needs no Scene geometry. */
function oneDamageBite() {
  return {
    ...structuredClone(wolfBiteEffect!),
    invocation: {
      ...biteInvocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: biteInvocation.range.id, rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
    },
    paths: wolfBiteEffect!.paths?.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      return {
        ...path,
        pathCode: 'ON_USE' as const,
        resultBlock: {
          ...path.resultBlock,
          outcomes: path.resultBlock.outcomes.map((outcome) => {
            if (outcome.effectKind !== 'DAMAGE') throw new Error('Expected Bite damage.')
            return {
              id: outcome.id,
              effectKind: 'DAMAGE' as const,
              damageTypeId: outcome.damageTypeId,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }
          })
        }
      }
    })
  }
}

const deafenedCondition = srdSystemRecord.conditionTypes.find(
  (condition) => condition.code === 'DEAFENED'
)
if (!deafenedCondition) throw new Error('Missing Deafened condition.')
const deafened = deafenedCondition

const creature = {
  ...wolf,
  id: crypto.randomUUID(),
  features: wolf.features?.map((feature) =>
    feature.label === 'Bite' ? { ...feature, effects: [oneDamageBite()] } : feature
  )
}

async function setup() {
  const characterEffect = oneDamageBite()
  const base = await setupCharacterRun({
    spellcasting: {
      ...wizard.spellcasting!,
      spellLimits: [
        {
          classLevel: 1,
          slots: [{ spellLevel: 1, slotCount: 2 }],
          learnedSpellsLimit: 0,
          cantripsLimit: 0
        }
      ]
    },
    features: [
      {
        ...structuredClone(wolfBite!),
        id: crypto.randomUUID(),
        availableAtLevel: 1,
        effects: [characterEffect]
      }
    ]
  })
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) =>
          definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID || definition.id === deafened.id
      ),
      ...initiative.definitions
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Live Character state journey',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const hero = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const enemy = run.actors.find((actor) => actor.kind === 'CREATURE')
  if (!hero || !enemy) throw new Error('Missing journey actors.')
  const actionIds = await base.t.run(async (ctx) => {
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.owner.userId,
      base.character.id,
      base.campaign.id
    )
    const heroAction = facts?.ruleEvaluation.facts.actionCandidates.find(
      (candidate) => candidate.effectId === characterEffect.id
    )
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row || !heroAction) throw new Error('Missing journey action sources.')
    const enemyAction = discoverEncounterFeatureActionCapabilities({
      actor: await readRunActor(ctx, readRunState(row), enemy.id),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find((capability) => capability.mechanicFacts.invocation.triggerCode === 'ACTIVATED')
    if (!enemyAction) throw new Error('Missing journey Creature action.')
    return { hero: heroAction.actionId, enemy: enemyAction.actionId }
  })
  return { ...base, run, hero, enemy, actionIds }
}

type Fixture = Awaited<ReturnType<typeof setup>>

function execute(
  fixture: Fixture,
  command: (base: { encounterId: string; commandId: string }) => EncounterExecuteInput['command']
) {
  return fixture.owner.caller.mutation(internal.encounters.commands.execute, {
    command: command({ encounterId: fixture.run.id, commandId: crypto.randomUUID() })
  })
}

async function sheetCommand(
  fixture: Fixture,
  command: (base: { commandId: string; expectedVersion: number }) => CharacterSheetCommandInputDto
) {
  const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
    id: fixture.character.id
  })
  if (!sheet) throw new Error('Missing journey Sheet.')
  await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: fixture.character.id,
    command: command({ commandId: crypto.randomUUID(), expectedVersion: sheet.meta.streamVersion })
  })
}

async function storedCharacter(fixture: Fixture) {
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!row) throw new Error('Missing journey Character.')
    return characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson)) as CharacterAuthored
  })
}

type CommandResult = Awaited<ReturnType<typeof execute>>

function advance(fixture: Fixture, result: CommandResult) {
  const expectedVersion = result.projection.version
  return execute(fixture, (base) => ({ ...base, type: 'ADVANCE_TURN', expectedVersion }))
}

async function start(fixture: Fixture) {
  let result = await execute(fixture, (base) => ({
    ...base,
    type: 'START',
    expectedVersion: fixture.run.version
  }))
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (!pending || pending.kind !== 'INITIATIVE_ORDER' || !pending.optionIds[0])
      throw new Error('Unexpected Automatic initiative decision.')
    const occurrence = result.occurrence
    const expectedVersion = result.projection.version
    result = await execute(fixture, (base) => ({
      ...base,
      type: 'RESOLVE_RULE_OCCURRENCE',
      expectedVersion,
      correlationId: null,
      occurrenceId: occurrence.occurrenceId,
      expectedOccurrenceVersion: occurrence.occurrenceVersion,
      resolution: {
        kind: 'INITIATIVE_ENTITY',
        requestId: pending.requestId,
        entityId: pending.optionIds[0]!
      }
    }))
  }
  expect(result.projection.status).toBe('ACTIVE')
  return result
}

/** Advances to the Creature's next turn and has it bite the Character. */
async function enemyBitesHero(fixture: Fixture, from: CommandResult) {
  let result = await advance(fixture, from)
  while (result.projection.currentActorId !== fixture.enemy.id)
    result = await advance(fixture, result)
  const expectedVersion = result.projection.version
  result = await execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    expectedVersion,
    actorId: fixture.enemy.id,
    targetActorId: fixture.hero.id,
    actionId: fixture.actionIds.enemy,
    optionalCombatIntent: null,
    sceneContext: null
  }))
  expect(result.occurrence?.status).toBe('COMPLETE')
  return result
}

/** Commits a Builder edit of the current Character document, as its player would. */
async function builderEdit(
  fixture: Fixture,
  change: (character: CharacterAuthored) => CharacterAuthored
) {
  const current = await storedCharacter(fixture)
  const draft = await fixture.player.caller.mutation(api.characters.drafts.create, {
    id: current.id,
    systemId: srdSystemRecord.id
  })
  await fixture.player.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'edit',
    character: change(current)
  })
}

function projectedHero(fixture: Fixture, result: CommandResult) {
  const actor = encounterGmProjectionDtoSchema
    .parse(result.projection)
    .actors.find((candidate) => candidate.id === fixture.hero.id)
  if (!actor) throw new Error('Missing projected Character actor.')
  return actor
}

describe('Encounter reads of live Character state', () => {
  it('keeps Encounter commands and projections current after Sheet edits made after Run creation', async () => {
    // Sheet edits: damage, a spent slot, an equipped item and a condition, all after Run creation.
    const fixture = await setup()
    const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
      id: fixture.character.id
    })
    const item = sheet?.inventory.items[0]
    if (!sheet || !item) throw new Error('Missing journey inventory.')
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 2
    }))
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:1'
    }))
    await sheetCommand(fixture, (base) => ({ ...base, type: 'EQUIP_ITEM', itemId: item.id }))
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADD_CONDITION',
      conditionTypeId: deafened.id
    }))
    const edited = await storedCharacter(fixture)
    expect(edited.state.hitpoints.current).toBe(fixture.hero.currentHitPoints - 2)

    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(10)
    try {
      let result = await start(fixture)
      expect(projectedHero(fixture, result)).toMatchObject({
        currentHitPoints: edited.state.hitpoints.current,
        sourceRevision: null
      })

      const acted = new Set<string>()
      while (acted.size < 2) {
        const currentActorId = result.projection.currentActorId
        if (currentActorId === fixture.enemy.id && !acted.has(currentActorId)) {
          const expectedVersion = result.projection.version
          const commandId = crypto.randomUUID()
          result = await execute(fixture, (base) => ({
            ...base,
            commandId,
            type: 'RESOLVE_ACTION',
            acceptedWieldConflict: null,
            acknowledgedWarnings: [],
            expectedVersion,
            actorId: fixture.enemy.id,
            targetActorId: fixture.hero.id,
            actionId: fixture.actionIds.enemy,
            optionalCombatIntent: null,
            sceneContext: null
          }))
          expect(result.occurrence?.status).toBe('COMPLETE')
          expect(projectedHero(fixture, result)).toMatchObject({
            currentHitPoints: edited.state.hitpoints.current - 1,
            conditions: [expect.objectContaining({ conditionTypeId: deafened.id })]
          })
          // The outcome was planned against the Character's current Sheet condition.
          const receipt = await fixture.t.run((ctx) =>
            ctx.db
              .query('encounterRuleReceipts')
              .withIndex('by_campaignId_commandId', (q) =>
                q.eq('campaignId', fixture.campaign.id).eq('commandId', commandId)
              )
              .unique()
          )
          const outputs = receipt
            ? storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
            : null
          if (outputs?.status !== 'COMPLETE') throw new Error('Missing Creature action receipt.')
          expect(outputs.applicationOutputs).toMatchObject({
            targetTransition: { before: { conditionIds: [deafened.id] } }
          })
          acted.add(currentActorId)
        } else if (currentActorId === fixture.hero.id && !acted.has(currentActorId)) {
          const expectedVersion = result.projection.version
          result = await execute(fixture, (base) => ({
            ...base,
            type: 'RESOLVE_ACTION',
            acceptedWieldConflict: null,
            acknowledgedWarnings: [],
            expectedVersion,
            actorId: fixture.hero.id,
            targetActorId: fixture.enemy.id,
            actionId: fixture.actionIds.hero,
            optionalCombatIntent: null,
            sceneContext: null
          }))
          expect(result.occurrence?.status).toBe('COMPLETE')
          // Creature hit points stay Run-owned.
          expect(
            result.projection.actors.find((actor) => actor.id === fixture.enemy.id)
          ).toMatchObject({ currentHitPoints: fixture.enemy.currentHitPoints - 1 })
          acted.add(currentActorId)
        }
        if (acted.size < 2) result = await advance(fixture, result)
      }
      const round = result.projection.round
      while (result.projection.round === round) result = await advance(fixture, result)
      expect(result.projection.round).toBe(round + 1)
    } finally {
      random.mockRestore()
    }

    const final = await storedCharacter(fixture)
    expect(final.state.hitpoints.current).toBe(edited.state.hitpoints.current - 1)
    expect(final.state.spellSlots).toEqual(edited.state.spellSlots)
    expect(final.state.equipment.equipped).toContain(item.id)
    for (const caller of [fixture.owner.caller, fixture.player.caller]) {
      const projection = await caller.query(api.encounters.projectionReads.get, {
        encounterId: fixture.run.id
      })
      const hero = projection.actors.find((actor) => actor.id === fixture.hero.id)
      expect(hero?.healthBand).toBeDefined()
      if (hero && 'currentHitPoints' in hero)
        expect(hero.currentHitPoints).toBe(final.state.hitpoints.current)
    }

    // A later Sheet change shows in the live read without another Encounter command.
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 1
    }))
    const gm = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    const healed = gm.actors.find((actor) => actor.id === fixture.hero.id)
    expect(healed && 'currentHitPoints' in healed ? healed.currentHitPoints : null).toBe(
      final.state.hitpoints.current + 1
    )
  }, 60000)

  it('shows a changed Character maximum without blocking Encounter commands on it', async () => {
    const fixture = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(10)
    try {
      let result = await start(fixture)
      const initial = projectedHero(fixture, result)

      // Constitution 13 -> 15 through the Builder: +1 maximum at level 1.
      await builderEdit(fixture, (character) => {
        const abilities = character.intent.abilities
        if (abilities?.method !== 'STANDARD_ARRAY') throw new Error('Expected a standard array.')
        return {
          ...character,
          intent: {
            ...character.intent,
            abilities: {
              ...abilities,
              assignments: abilities.assignments.map((assignment) =>
                assignment.ability === 'STRENGTH'
                  ? { ...assignment, option: '13' as const }
                  : assignment.ability === 'CONSTITUTION'
                    ? { ...assignment, option: '15' as const }
                    : assignment
              )
            }
          }
        }
      })
      result = await enemyBitesHero(fixture, result)
      const constitution = projectedHero(fixture, result)
      expect(constitution.maxHitPoints).toBe(initial.maxHitPoints + 1)

      // A level-up through the Builder raises the maximum again.
      await builderEdit(fixture, (character) => {
        const [entry] = character.intent.classes ?? []
        const hitpoints = character.intent.hitpoints
        if (!entry || hitpoints?.method !== 'FIXED') throw new Error('Unexpected level fixture.')
        return {
          ...character,
          intent: {
            ...character.intent,
            classes: [{ ...entry, classLevel: 2 }],
            hitpoints: {
              ...hitpoints,
              levels: [
                ...hitpoints.levels,
                { level: 2, classId: entry.classId, classLevel: 2, value: 6 }
              ]
            }
          }
        }
      })
      result = await enemyBitesHero(fixture, result)
      const levelled = projectedHero(fixture, result)
      expect(levelled.maxHitPoints).toBe(constitution.maxHitPoints + 6 + 2)

      // A Sheet maximum adjustment; the health band uses current over the new maximum.
      await sheetCommand(fixture, (base) => ({
        ...base,
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: {
          id: crypto.randomUUID(),
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 30
        }
      }))
      result = await enemyBitesHero(fixture, result)
      const adjusted = projectedHero(fixture, result)
      expect(adjusted.maxHitPoints).toBe(levelled.maxHitPoints + 30)
      expect(adjusted.healthBand).toBe(healthBand(adjusted.currentHitPoints, adjusted.maxHitPoints))
      expect(adjusted.healthBand).not.toBe('HEALTHY')
      for (const caller of [fixture.owner.caller, fixture.player.caller]) {
        const live = await caller.query(api.encounters.projectionReads.get, {
          encounterId: fixture.run.id
        })
        const hero = live.actors.find((actor) => actor.id === fixture.hero.id)
        expect(hero?.healthBand).toBe(adjusted.healthBand)
        if (hero && 'maxHitPoints' in hero) expect(hero.maxHitPoints).toBe(adjusted.maxHitPoints)
      }
    } finally {
      random.mockRestore()
    }
  }, 60000)
})

async function revertRejection(fixture: Fixture, expectedVersion: number) {
  const error = await execute(fixture, (base) => ({
    ...base,
    type: 'REVERT_LAST_ACTION',
    expectedVersion
  })).then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a domain rejection.')
  return domainRejectionErrorDataSchema.parse(error.data)
}

describe('GM undo against live Character state', () => {
  it('restores a Character the action damaged, then refuses once its Sheet changes', async () => {
    const fixture = await setup()
    const started = await start(fixture)
    const before = await storedCharacter(fixture)
    const bitten = await enemyBitesHero(fixture, started)
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(
      before.state.hitpoints.current - 1
    )
    await expect(
      fixture.player.caller.mutation(internal.encounters.commands.execute, {
        command: {
          type: 'REVERT_LAST_ACTION',
          encounterId: fixture.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: bitten.projection.version
        }
      })
    ).rejects.toThrow('Campaign not found')
    const undone = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: bitten.projection.version
    }))
    expect(undone.projection.version).toBe(bitten.projection.version + 1)
    const restored = (await storedCharacter(fixture)).state.hitpoints
    expect(restored.current).toBe(before.state.hitpoints.current)
    expect(restored.temp ?? 0).toBe(before.state.hitpoints.temp ?? 0)
    expect(projectedHero(fixture, undone).currentHitPoints).toBe(before.state.hitpoints.current)

    const again = await enemyBitesHero(fixture, undone)
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 1
    }))
    expect(await revertRejection(fixture, again.projection.version)).toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: `${fixture.character.label}'s Sheet changed after this action; adjust manually.`
    })
  }, 60000)
})
