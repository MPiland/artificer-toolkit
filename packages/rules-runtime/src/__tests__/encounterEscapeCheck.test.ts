import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_MEDICINE_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  encounterBasicActionCheckPendingSnapshot,
  encounterBasicActionCheckTrigger,
  evaluateEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '../encounterBasicActionCheck.js'
import { encounterBasicActionCheckLabel } from '../encounterMovementPassagePreparation.js'
import {
  completeEncounterEscapeCheckResult,
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds,
  findEncounterHolderContestEscape,
  findEncounterHolderEscape,
  prepareEncounterEscapeCheck
} from '../encounterEscapeCheck.js'
import type { CharacterMovementFacts } from '../encounterMovementTargets.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  characterActor,
  createSrdRulesRuntime,
  creatureRuleFacts,
  srdCreatureActor,
  srdCreatureTarget,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { prepareFixtureSheet, readyFighterFixture } from '../testing/characterContextFixtures.js'
import { helpEffect } from './antitoxinEffectFixture.js'
import { GOBLIN, activeEffect } from './encounterActiveEffectFixtures.js'

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
const ATHLETICS = SRD_ATHLETICS_SKILL_ID
const STRENGTH = SRD_ABILITY_DEFINITION_IDS.STRENGTH
const OCCURRENCE_ID = testUuid(900)
const COMMAND_ID = testUuid(901)
const EFFECT_ID = testUuid(20)
const OUTCOME_ID = testUuid(21)
const MODULE_ID = testUuid(22)
const scores = {
  STRENGTH: 14,
  DEXTERITY: 10,
  CONSTITUTION: 10,
  INTELLIGENCE: 10,
  WISDOM: 10,
  CHARISMA: 10
}

type EscapeModule = Extract<
  Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>['modules'][number]

function escapeModule(overrides: Record<string, unknown> = {}): EscapeModule {
  return {
    id: MODULE_ID,
    order: 0,
    kind: 'ESCAPE_CHECK',
    activation: { code: 'ACTION', amount: 1 },
    checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [STRENGTH] },
    dc: { kind: 'FIXED', value: 13 },
    actorKinds: ['TARGET'],
    ...overrides
  } as EscapeModule
}

function grappled(owner: string, modules: EscapeModule[] = [escapeModule()]) {
  return activeEffect({
    id: EFFECT_ID,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: owner },
    createdOrdinal: 1,
    stateContributions: [
      {
        kind: 'ACTOR_RELATIONSHIP',
        relationshipOutcomeId: OUTCOME_ID,
        sealedReachFeet: 5,
        modules,
        conditionIds: [],
        capabilitySuppressions: []
      }
    ]
  })
}

/** A friendly SRD Goblin whose Strength is 14 and whose Athletics total is exactly 4. */
function holderActor(id: string, checkTotals: Record<string, number> = { [ATHLETICS]: 4 }) {
  const goblin = srdCreatureActor({ id, creature: GOBLIN, disposition: 'FRIENDLY' })
  if (
    typeof goblin.snapshot !== 'object' ||
    goblin.snapshot === null ||
    Array.isArray(goblin.snapshot)
  )
    throw new Error('The fixture Creature snapshot must be an object.')
  return {
    ...goblin,
    snapshot: { ...goblin.snapshot, ruleFacts: { ...creatureRuleFacts(scores), checkTotals } }
  }
}

const holder = holderActor(testUuid(1))
const other = holderActor(testUuid(2))

function prepare(
  overrides: Partial<Parameters<typeof prepareEncounterEscapeCheck>[0]> & {
    effect?: ActiveRuleEffectRecord
  } = {}
) {
  const { effect: given, ...rest } = overrides
  const effect = given ?? grappled(holder.id)
  return prepareEncounterEscapeCheck({
    gameSystemId: SRD_SYSTEM_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'b'.repeat(64),
    system,
    holder: srdCreatureTarget(holder, [effect]),
    activeEffectId: effect.id,
    checkDefinitionId: ATHLETICS,
    ...rest
  })
}

/** The Fighter fixture held by the grapple. */
async function fighterHolder() {
  const fixture = readyFighterFixture()
  const sheet = await prepareFixtureSheet(fixture)
  const characterFacts: CharacterMovementFacts = {
    active: { id: fixture.character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
    character: sheet.prepared.character,
    campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
    prepared: sheet.prepared,
    ruleEvaluation: sheet.ruleEvaluation
  }
  const actor = characterActor({ id: testUuid(5), characterId: fixture.character.id })
  const effect = grappled(actor.id)
  const target = buildMovementTarget({
    actor,
    activeEffects: [effect],
    characterFacts,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID
  })
  return { effect, target, sheet }
}

async function settle(context: ReturnType<typeof prepare>, faces: number[]) {
  const runtime = createSrdRulesRuntime()
  const continuation = await startEncounterBasicActionCheck({
    runtime,
    gameSystemId: SRD_SYSTEM_ID,
    occurrenceId: OCCURRENCE_ID
  })
  const evaluated = await evaluateEncounterBasicActionCheck({
    gameSystemId: SRD_SYSTEM_ID,
    runtime,
    context,
    continuation,
    answer: {
      kind: 'ENTER_DICE',
      requestId: continuation.request.requestId,
      rawFaces: faces,
      rollMode: context.d20.rollMode
    },
    rollD20: () => {
      throw new Error('An entered roll never rolls.')
    },
    expectedOccurrenceId: OCCURRENCE_ID
  })
  return { continuation, evaluated }
}

describe('Escape check', () => {
  it('names a skill check by its ability and an ability check by the ability', () => {
    expect(encounterBasicActionCheckLabel(system, ATHLETICS)).toBe('Strength (Athletics)')
    expect(encounterBasicActionCheckLabel(system, STRENGTH)).toBe('Strength')
    expect(() => encounterBasicActionCheckLabel(system, testUuid(77))).toThrow()
  })

  it('rolls with advantage while the holder carries a Help, naming the Help as the source', () => {
    const grapple = grappled(holder.id)
    const help = helpEffect({ id: testUuid(30), holderActorId: holder.id })
    expect(prepare({ effect: grapple }).d20.rollMode).toBe('NORMAL')
    const helped = prepareEncounterEscapeCheck({
      gameSystemId: SRD_SYSTEM_ID,
      commandId: COMMAND_ID,
      commandFingerprint: 'b'.repeat(64),
      system,
      holder: srdCreatureTarget(holder, [grapple, help]),
      activeEffectId: grapple.id,
      checkDefinitionId: ATHLETICS
    })
    expect(helped.d20.rollMode).toBe('ADVANTAGE')
    expect(helped.d20.contributors).toMatchObject([
      { sourceId: `ACTIVE_EFFECT:${help.id}`, influence: 'ADVANTAGE' }
    ])
  })

  it('finds the fixed-DC escape a holder can attempt, and no other', () => {
    expect(findEncounterHolderEscape(grappled(holder.id))).toEqual({
      escapeSourceId: MODULE_ID,
      activation: { code: 'ACTION', amount: 1 },
      checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [STRENGTH] },
      dc: 13,
      zoneLabel: null
    })
    const zoneId = testUuid(23)
    expect(
      findEncounterHolderEscape(
        activeEffect({
          id: EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: holder.id },
          createdOrdinal: 1,
          stateContributions: [
            {
              kind: 'CONDITION_OWNERSHIP',
              conditionId: testUuid(24),
              baselinePresent: false,
              heldBySpatialEffectId: zoneId
            },
            {
              kind: 'CONDITION_ESCAPE',
              label: 'Web',
              activation: { code: 'ACTION', amount: 1 },
              checks: { skillIds: [], abilityDefinitionIds: [STRENGTH] },
              dc: 15
            }
          ]
        })
      )
    ).toEqual({
      escapeSourceId: zoneId,
      activation: { code: 'ACTION', amount: 1 },
      checks: { skillIds: [], abilityDefinitionIds: [STRENGTH] },
      dc: 15,
      zoneLabel: 'Web'
    })
    expect(
      findEncounterHolderEscape(
        grappled(holder.id, [
          escapeModule({
            dc: { kind: 'CONTEST', checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [] } }
          })
        ])
      )
    ).toBeNull()
    expect(
      findEncounterHolderEscape(
        grappled(holder.id, [escapeModule({ actorKinds: ['CREATURE_WITHIN_REACH'] })])
      )
    ).toBeNull()
    expect(
      findEncounterHolderEscape(
        grappled(holder.id, [
          { id: MODULE_ID, order: 0, kind: 'SOURCE_FOLLOWS_TARGET' } as EscapeModule
        ])
      )
    ).toBeNull()
  })

  it('ends only the conditions the escaped effect alone held', () => {
    const [grappledId, restrainedId, baselineId] = [testUuid(40), testUuid(41), testUuid(42)]
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: holder.id
    }
    const ownership = (conditionId: string, baselinePresent: boolean) => ({
      kind: 'CONDITION_OWNERSHIP' as const,
      conditionId,
      baselinePresent
    })
    const grapple = activeEffect({
      id: EFFECT_ID,
      owner,
      createdOrdinal: 1,
      stateContributions: [
        ownership(grappledId, false),
        ownership(restrainedId, false),
        ownership(baselineId, true)
      ]
    })
    const otherHold = activeEffect({
      id: testUuid(30),
      owner,
      createdOrdinal: 2,
      stateContributions: [ownership(restrainedId, false)]
    })
    expect(encounterEscapeEndedConditionIds([grapple], EFFECT_ID)).toEqual(
      [grappledId, restrainedId].sort()
    )
    expect(encounterEscapeEndedConditionIds([grapple, otherHold], EFFECT_ID)).toEqual([grappledId])
  })

  it('takes the released conditions off a creature holder and no other actor', () => {
    const [grappledId, restrainedId] = [testUuid(40), testUuid(41)]
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: holder.id
    }
    const grapple = activeEffect({
      id: EFFECT_ID,
      owner,
      createdOrdinal: 1,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: grappledId, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP', conditionId: restrainedId, baselinePresent: false }
      ]
    })
    const held = { ...holder, conditions: [grappledId, restrainedId, testUuid(43)] }
    const actors = encounterActorsAfterEscape({
      encounterId: ENCOUNTER_ID,
      actors: [held, other],
      holderId: holder.id,
      holderEffects: [grapple],
      activeEffectId: EFFECT_ID
    })
    expect(actors.find((actor) => actor.id === holder.id)).toMatchObject({
      conditions: [testUuid(43)]
    })
    expect(actors.find((actor) => actor.id === other.id)).toEqual(other)
  })

  it('freezes a Creature’s skill total, DC and label', () => {
    const context = prepare()
    expect(context).toMatchObject({
      kind: 'ENCOUNTER_ESCAPE_CHECK',
      commandId: COMMAND_ID,
      actionLabel: 'Escape',
      actorId: holder.id,
      activeEffectId: EFFECT_ID,
      escapeSourceId: MODULE_ID,
      check: { checkDefinitionId: ATHLETICS, dc: 13, label: 'Strength (Athletics)' },
      d20: { rollMode: 'NORMAL', modifier: 4 }
    })
    expect(encounterBasicActionCheckTrigger(context)).toEqual({
      kind: 'BASIC_ACTION_CHECK',
      actionLabel: 'Escape',
      checkLabel: 'Strength (Athletics)',
      dc: 13
    })
  })

  it('freezes a Creature’s ability check from its score', () => {
    expect(prepare({ checkDefinitionId: STRENGTH })).toMatchObject({
      check: { checkDefinitionId: STRENGTH, dc: 13, label: 'Strength' },
      d20: { rollMode: 'NORMAL', modifier: 2 }
    })
  })

  it('refuses what the module does not allow', () => {
    const effect = grappled(holder.id)
    expect(() => prepare({ checkDefinitionId: SRD_MEDICINE_SKILL_ID })).toThrow('allow')
    expect(() =>
      prepare({
        effect: grappled(holder.id, [
          escapeModule({ checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [] } })
        ]),
        checkDefinitionId: STRENGTH
      })
    ).toThrow('allow')
    expect(() =>
      prepare({
        effect: grappled(holder.id, [
          escapeModule({
            dc: { kind: 'CONTEST', checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [] } }
          })
        ])
      })
    ).toThrow('fixed')
    expect(() =>
      prepare({
        effect: grappled(holder.id, [escapeModule({ actorKinds: ['CREATURE_WITHIN_REACH'] })])
      })
    ).toThrow('fixed')
    expect(() =>
      prepare({ holder: srdCreatureTarget(other, []), activeEffectId: effect.id })
    ).toThrow('hold')
  })

  it('refuses a holder with no total for the chosen check', () => {
    expect(() =>
      prepare({ holder: srdCreatureTarget(holderActor(testUuid(3), {}), [grappled(testUuid(3))]) })
    ).toThrow('no total')
  })

  it('freezes a Character’s skill and ability totals from its rules', async () => {
    const { effect, target, sheet } = await fighterHolder()
    const { abilities, skills } = sheet.ruleEvaluation.output.derivedStats
    const strength = abilities.find((entry) => entry.abilityId === 'STRENGTH')
    const athletics = skills.find((entry) => entry.skillId === 'athletics')
    if (!strength || !athletics)
      throw new Error('The fixture Character has no Strength or Athletics.')
    const skillContext = prepare({ holder: target, activeEffectId: effect.id })
    const abilityContext = prepare({
      holder: target,
      activeEffectId: effect.id,
      checkDefinitionId: STRENGTH
    })
    expect(skillContext.d20.modifier).toBe(athletics.total.effective)
    expect(abilityContext.d20.modifier).toBe(strength.modifier.effective)
    expect(abilityContext.check.label).toBe('Strength')
  })

  it('refuses a Character’s ability check when the System spells the ability with another code', async () => {
    const { effect, target } = await fighterHolder()
    const { characterFacts } = target
    if (!characterFacts) throw new Error('The fixture Character has no facts.')
    const shortCoded = {
      ...target,
      characterFacts: {
        ...characterFacts,
        ruleEvaluation: {
          ...characterFacts.ruleEvaluation,
          facts: {
            ...characterFacts.ruleEvaluation.facts,
            abilityDefinitions: characterFacts.ruleEvaluation.facts.abilityDefinitions.map(
              (definition) => ({
                ...definition,
                code: definition.code === 'STRENGTH' ? 'STR' : definition.code
              })
            )
          }
        }
      }
    }
    expect(() =>
      prepare({ holder: shortCoded, activeEffectId: effect.id, checkDefinitionId: STRENGTH })
    ).toThrow('This actor has no total for the check.')
  })

  it('reaching the DC escapes and a miss does not', async () => {
    const context = prepare()
    const reached = await settle(context, [9])
    expect(reached.evaluated.d20).toMatchObject({ total: 13, dc: 13, selectedNatural: 9 })
    expect(reached.evaluated.reachesDc).toBe(true)
    const escaped = completeEncounterEscapeCheckResult({
      context,
      continuation: reached.continuation,
      evaluated: reached.evaluated,
      effectStillHeld: true,
      removedConditionIds: [testUuid(30)],
      occurrenceVersion: 2,
      initialFactsChecksum: 'c'.repeat(64)
    })
    expect(escaped.applicationOutputs).toMatchObject({
      kind: 'ESCAPE_CHECK',
      actorId: holder.id,
      activeEffectId: EFFECT_ID,
      outcome: 'ESCAPED',
      removedConditionIds: [testUuid(30)]
    })
    const missed = await settle(context, [8])
    expect(missed.evaluated.d20.total).toBe(12)
    expect(
      completeEncounterEscapeCheckResult({
        context,
        continuation: missed.continuation,
        evaluated: missed.evaluated,
        effectStillHeld: true,
        removedConditionIds: [],
        occurrenceVersion: 2,
        initialFactsChecksum: 'c'.repeat(64)
      }).applicationOutputs.outcome
    ).toBe('FAILED')
  })

  it('a grapple already ended when the roll settles is reported, not escaped again', async () => {
    const context = prepare()
    const rolled = await settle(context, [20])
    const result = completeEncounterEscapeCheckResult({
      context,
      continuation: rolled.continuation,
      evaluated: rolled.evaluated,
      effectStillHeld: false,
      removedConditionIds: [],
      occurrenceVersion: 2,
      initialFactsChecksum: 'c'.repeat(64)
    })
    expect(result.applicationOutputs.outcome).toBe('ALREADY_ENDED')
  })

  it('a prompted escape waits on a kernel snapshot carrying its frozen context', async () => {
    const context = prepare()
    const runtime = createSrdRulesRuntime()
    const continuation = await startEncounterBasicActionCheck({
      runtime,
      gameSystemId: SRD_SYSTEM_ID,
      occurrenceId: OCCURRENCE_ID
    })
    expect(
      encounterBasicActionCheckPendingSnapshot({
        continuation,
        context,
        optionalCombatSnapshotChecksum: 'd'.repeat(64)
      })
    ).toMatchObject({
      snapshotKind: 'KERNEL_EVIDENCE',
      applicationContext: { kind: 'ENCOUNTER_ESCAPE_CHECK', actorId: holder.id }
    })
  })
})

describe('the holder a won contested escape moves (MOVE-4.3)', () => {
  const contest = { kind: 'CONTEST', checks: { skillIds: [ATHLETICS], abilityDefinitionIds: [] } }
  const landing = {
    id: testUuid(23),
    effectKind: 'FORCED_MOVEMENT',
    direction: 'ANY',
    actionEconomy: 'NONE',
    distanceMode: 'EXACT',
    amount: 5,
    unit: 'FEET'
  }
  /** A cling on `escaper` sourced by the holder, whose contested escape moves the holder by `movement`. */
  const clung = (movement?: Record<string, unknown>) =>
    findEncounterHolderContestEscape(
      activeEffect({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: other.id },
        createdOrdinal: 1,
        sourceActorId: holder.id,
        stateContributions: [
          {
            kind: 'ACTOR_RELATIONSHIP',
            relationshipOutcomeId: OUTCOME_ID,
            sealedReachFeet: 5,
            modules: [
              escapeModule({
                dc: contest,
                ...(movement ? { holderForcedMovement: movement } : {})
              })
            ],
            conditionIds: [],
            capabilitySuppressions: []
          }
        ]
      })
    )

  it('moves no one when the escape authors no movement', () => {
    expect(clung()).toMatchObject({ holderActorId: holder.id, holderMovement: null })
  })

  it('moves the holder an exact or up-to distance in any direction, its square still unpicked', () => {
    expect(clung(landing)?.holderMovement).toEqual({
      targetActorId: holder.id,
      direction: 'ANY',
      feet: 5,
      upTo: false,
      sourceReachFeet: null,
      position: null,
      ray: null,
      collision: null
    })
    expect(clung({ ...landing, distanceMode: 'UP_TO', amount: 10 })?.holderMovement).toMatchObject({
      direction: 'ANY',
      feet: 10,
      upTo: true
    })
    expect(clung({ ...landing, direction: 'AWAY_FROM_SOURCE' })?.holderMovement).toMatchObject({
      direction: 'AWAY_FROM_SOURCE'
    })
  })

  it('fails closed on a movement the escape cannot settle', () => {
    const { amount: _amount, unit: _unit, ...bySpeed } = landing
    for (const movement of [
      { ...bySpeed, distanceMode: 'UP_TO_SPEED' },
      { ...landing, unit: 'YARDS' },
      { ...landing, amount: 0 },
      { ...landing, amount: 2.5 },
      { ...landing, actionEconomy: 'REACTION' },
      { ...landing, direction: 'ASIDE' },
      { ...landing, direction: 'RANDOM' },
      {
        ...landing,
        collision: {
          id: testUuid(24),
          damageTypeId: testUuid(25),
          diceConfig: '1d6',
          savingThrow: { abilityDefinitionId: STRENGTH, dcMethod: 'FIXED_DC', baseDc: 10 },
          conditionId: testUuid(26)
        }
      }
    ])
      expect(() => clung(movement), JSON.stringify(movement)).toThrow('cannot settle')
  })
})
