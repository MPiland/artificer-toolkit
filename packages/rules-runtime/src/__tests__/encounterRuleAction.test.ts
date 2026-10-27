import { describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { SRD_SYSTEM_ID, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { encounterActiveEffectPlan } from '../encounterActionEffects.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import { buildMovementTarget, type CharacterMovementFacts } from '../encounterMovementTargets.js'
import { encounterMassiveDamageRule } from '../encounterMassiveDamage.js'
import { encounterRuleActionId, parseEncounterRuleActionId } from '../encounterRuleAction.js'
import { prepareFixtureSheet, readyFighterFixture } from '../testing/characterContextFixtures.js'
import {
  CAMPAIGN_ID,
  characterActor,
  srdCreatureActor,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdConditionId } from './encounterCreatureAction.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

/**
 * ATTACK-16.T1b: an optional combat rule raises an Effect as its own action. The Effect is read
 * from the Run's pinned rule, compiled like any authored action and run through the compiled graph
 * path for a Creature and a Character alike, at no cost to the actor.
 */

const RULE_ID = testUuid(0x16b0)
const SHOCK_EFFECT_ID = testUuid(0x16b1)
const STABILIZE_EFFECT_ID = testUuid(0x16b2)
const CREATURE_ID = testUuid(0x16b3)
const CHARACTER_ACTOR_ID = testUuid(0x16b4)
const EXPOSED_EFFECT_ID = testUuid(0x16b5)
const child = (index: number) => testUuid(0x16c0 + index)

/**
 * An Effect the rule raises on its subject. It is authored as the subject's own action, the shape
 * the action compiler reads; the rule source runs it at no cost.
 */
function selfEffect(input: {
  id: string
  order: number
  /** The first of the four child ids the Effect's range, path, result block and duration take. */
  firstChild: number
  timed: boolean
  outcomes: readonly Record<string, unknown>[]
}) {
  const ids = [0, 1, 2, 3].map((offset) => child(input.firstChild + offset))
  return {
    id: input.id,
    order: input.order,
    invocation: {
      kind: 'ACTION',
      triggerCode: 'ACTIVATED',
      activation: { code: 'ACTION', amount: 1 },
      range: { id: ids[0], rangeKind: 'SELF' },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: ids[1],
        order: 1,
        pathCode: 'ON_USE',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: ids[2],
          resultKind: 'SINGLE',
          ...(input.timed && {
            duration: { id: ids[3], durationKind: 'ROUND', amount: 1 },
            lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } }
          }),
          outcomes: input.outcomes
        }
      }
    ]
  }
}

/** Stunned until the end of the subject's next turn. */
const shockEffect = selfEffect({
  id: SHOCK_EFFECT_ID,
  order: 1,
  firstChild: 0,
  timed: true,
  outcomes: [{ id: child(4), effectKind: 'CONDITION', conditionId: srdConditionId('STUNNED') }]
})

/** Unable to react and easier to hit until the end of the subject's next turn. */
const exposedEffect = selfEffect({
  id: EXPOSED_EFFECT_ID,
  order: 2,
  firstChild: 12,
  timed: true,
  outcomes: [
    {
      id: child(5),
      effectKind: 'APPLY_GRANT',
      grants: {
        modifiers: [
          {
            id: child(6),
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'REACTION_COUNT',
            domain: {},
            modifierKind: 'SET_VALUE',
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            payload: { amount: 0 },
            order: 1
          },
          {
            id: child(7),
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'ATTACKS_AGAINST',
            domain: { attackDomain: 'MELEE', requiresHolderSeesAttacker: false },
            modifierKind: 'ROLL_INFLUENCE',
            payload: { influence: 'ADVANTAGE' },
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            order: 2
          }
        ]
      }
    }
  ]
})

/** Stabilizes the subject at 0 hit points. */
const stabilizeEffect = selfEffect({
  id: STABILIZE_EFFECT_ID,
  order: 3,
  firstChild: 8,
  timed: false,
  outcomes: [{ id: child(11), effectKind: 'STABILIZE', requiresZeroHitPoints: true }]
})

/** A homebrew copy of the SRD Massive Damage rule that raises the three Effects above. */
function homebrewRuleSnapshot() {
  const seed = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (entry) => entry.document.kind === 'MASSIVE_DAMAGE'
  )
  if (!seed) throw new Error('The SRD Massive Damage rule is missing.')
  const document = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
    ...seed.document,
    id: RULE_ID,
    raisedEffects: [shockEffect, exposedEffect, stabilizeEffect]
  })
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: [
      {
        definitionId: RULE_ID,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Homebrew system shock',
        document
      }
    ]
  })
  return { snapshot, checksum: checksumRuleDocument(snapshot) }
}

function ruleRun(actor: EncounterRunActorState, rule: 'ON' | 'OFF' | 'MANUAL' = 'ON') {
  const state = srdEncounterState({
    actors: [actor],
    currentActorId: actor.id,
    ...(rule === 'MANUAL' ? { automationMode: 'MANUAL' as const } : {})
  })
  if (rule === 'OFF') return state
  const { snapshot, checksum } = homebrewRuleSnapshot()
  return { ...state, optionalCombatSnapshot: snapshot, optionalCombatSnapshotChecksum: checksum }
}

/** A Fighter whose sheet the real fact builders produced. */
async function fighterFacts() {
  const { character, documents } = readyFighterFixture()
  const sheet = await prepareFixtureSheet({ character, documents })
  const facts: CharacterMovementFacts = {
    active: { id: character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
    character: sheet.prepared.character,
    campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
    prepared: sheet.prepared,
    ruleEvaluation: sheet.ruleEvaluation
  }
  return { ...facts, sheetState: sheet.sheetState }
}

type FighterFacts = Awaited<ReturnType<typeof fighterFacts>>

/** Prepares the rule's Effect as the actor's own action, as the room prepares a rule-raised root. */
async function prepareRuleAction(input: {
  actor: EncounterRunActorState
  characterFacts: FighterFacts | null
  effectId: string
  rule?: 'ON' | 'OFF' | 'MANUAL'
}) {
  const state = ruleRun(input.actor, input.rule)
  const target = await withEncounterConditionMechanics({
    target: buildMovementTarget({
      actor: input.actor,
      activeEffects: [],
      characterFacts: input.characterFacts,
      campaignId: CAMPAIGN_ID,
      gameSystemId: SRD_SYSTEM_ID
    }),
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdConditionDefinitionSource()
  })
  return prepareEncounterActionMechanics({
    state,
    actor: input.actor,
    target: input.actor,
    actors: [input.actor],
    actionId: encounterRuleActionId(input.actor.id, RULE_ID, input.effectId),
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false,
    movementTargets: new Map([[input.actor.id, target]]),
    loadTurnUses: async () => [],
    loadSource: async (source) =>
      resolveEncounterActionSource({
        spells: new Map(),
        ...source,
        system: srdSystemRecord,
        rules: state
      }),
    loadRelationshipFacts: async () => []
  })
}

async function execute(prepared: Awaited<ReturnType<typeof prepareRuleAction>>) {
  const execution = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: testUuid(0x16d0),
    binding: prepared.binding,
    afterTest: async () => undefined,
    random: () => {
      throw new Error('A rule-raised Effect with no roll rolls nothing.')
    }
  })
  return {
    kinds: execution.applications.map((application) => application.kind),
    activeEffectPlan: encounterActiveEffectPlan(
      prepared,
      execution.published,
      execution.execution.outputs
    )
  }
}

/** The shock and the exposure each last until the end of their holder's next turn. */
async function expectTimedOutcomes(
  actor: EncounterRunActorState,
  characterFacts: FighterFacts | null
) {
  const shock = await prepareRuleAction({ actor, characterFacts, effectId: SHOCK_EFFECT_ID })
  const shockRun = await execute(shock)
  expect(shockRun.kinds).toEqual(['CONDITION_APPLY'])
  expect(shockRun.activeEffectPlan).toMatchObject({
    authoredEffectId: SHOCK_EFFECT_ID,
    initialRemaining: 1,
    conditionContributions: [{ conditionId: srdConditionId('STUNNED') }]
  })
  const exposed = await prepareRuleAction({ actor, characterFacts, effectId: EXPOSED_EFFECT_ID })
  const exposedRun = await execute(exposed)
  expect(exposedRun.activeEffectPlan).toMatchObject({
    authoredEffectId: EXPOSED_EFFECT_ID,
    initialRemaining: 1,
    modifierGrantContribution: {
      applyGrantOutcomeId: child(5),
      modifiers: [
        expect.objectContaining({ valueDomainCode: 'REACTION_COUNT' }),
        expect.objectContaining({ valueDomainCode: 'ATTACKS_AGAINST' })
      ]
    }
  })
  return shock
}

function ruleCapability(prepared: Awaited<ReturnType<typeof prepareRuleAction>>) {
  if (prepared.source.kind !== 'RULE')
    throw new Error(`Expected a RULE source, got ${prepared.source.kind}.`)
  return prepared.source.capability
}

describe('a rule-owned action source (ATTACK-16.T1b)', () => {
  const ogre = srdCreatureActor({ id: CREATURE_ID, creature: srdByLabel(SRD.creatures, 'Ogre') })

  it('names the rule and its raised Effect for one actor, and reads no other id as a rule action', () => {
    const actionId = encounterRuleActionId(CREATURE_ID, RULE_ID, SHOCK_EFFECT_ID)
    expect(parseEncounterRuleActionId(CREATURE_ID, actionId)).toEqual({
      definitionId: RULE_ID,
      effectId: SHOCK_EFFECT_ID
    })
    expect(parseEncounterRuleActionId(CHARACTER_ACTOR_ID, actionId)).toBeNull()
    expect(parseEncounterRuleActionId(CREATURE_ID, `${actionId}:extra`)).toBeNull()
    expect(parseEncounterRuleActionId(CREATURE_ID, `${CREATURE_ID}:basic:ATTACK`)).toBeNull()
  })

  it('runs a Creature’s timed condition and grant through the compiled graph, at no cost', async () => {
    const prepared = await expectTimedOutcomes(ogre, null)
    expect(ruleCapability(prepared)).toMatchObject({
      kind: 'RULE',
      sourceId: RULE_ID,
      definitionId: RULE_ID,
      label: 'Homebrew system shock',
      mechanicFacts: { invocation: { activation: { code: 'FREE', amount: 1 } } }
    })
  })

  it('runs a Character’s timed condition and grant, and its stabilize, through the same path', async () => {
    const characterFacts = await fighterFacts()
    const actor = characterActor({ id: CHARACTER_ACTOR_ID, characterId: characterFacts.active.id })
    const shock = await expectTimedOutcomes(actor, characterFacts)
    expect(ruleCapability(shock)).toMatchObject({ kind: 'RULE', sourceId: RULE_ID })
    const stabilize = await prepareRuleAction({
      actor,
      characterFacts,
      effectId: STABILIZE_EFFECT_ID
    })
    expect((await execute(stabilize)).kinds).toEqual(['STABILIZE'])
  })

  it('is stale when the rule is off, the Run is MANUAL or the rule raises no such Effect', async () => {
    for (const rule of ['OFF', 'MANUAL'] as const)
      await expect(
        prepareRuleAction({ actor: ogre, characterFacts: null, effectId: SHOCK_EFFECT_ID, rule })
      ).rejects.toThrow('The selected rule action is stale.')
    await expect(
      prepareRuleAction({ actor: ogre, characterFacts: null, effectId: testUuid(0x16bf) })
    ).rejects.toThrow('The selected rule action is stale.')
  })
})

describe('a rule’s failed-save action (ATTACK-16.T1c2b)', () => {
  const seed = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (entry) => entry.document.kind === 'MASSIVE_DAMAGE'
  )!
  const authored = (failedSaveEffectId: string) =>
    dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
      ...seed.document,
      raisedEffects: [shockEffect],
      parameters: { ...seed.document.parameters, failedSaveEffectId }
    })

  it('names one of the rule’s raised Effects, which the pinned rule reads', () => {
    const parsed = authored(SHOCK_EFFECT_ID)
    expect(parsed.success).toBe(true)
    expect(authored(STABILIZE_EFFECT_ID).error?.issues).toMatchObject([
      {
        path: ['parameters', 'failedSaveEffectId'],
        message: 'A failed save must raise one of the rule’s raised effects.'
      }
    ])
    const document = parsed.data!
    const state = srdEncounterState({ actors: [], currentActorId: null })
    const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
      schemaVersion: 1,
      gameSystemId: SRD_SYSTEM_ID,
      definitions: [
        {
          definitionId: seed.id,
          contentSourceId: SRD_CONTENT_SOURCE.id,
          definitionVersion: 1,
          definitionChecksum: checksumRuleDocument(document),
          contractVersion: 1,
          label: seed.label,
          document
        }
      ]
    })
    const policy = (optionalCombatSnapshot: typeof snapshot) => ({
      ...state,
      optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: checksumRuleDocument(optionalCombatSnapshot)
    })
    expect(encounterMassiveDamageRule(policy(snapshot))?.failedSaveEffectId).toBe(SHOCK_EFFECT_ID)
    expect(
      encounterMassiveDamageRule(policy(homebrewRuleSnapshot().snapshot))?.failedSaveEffectId
    ).toBeNull()
  })
})
