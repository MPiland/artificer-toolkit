import { describe, expect, it } from 'vitest'
import type { BasicActionReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/basicActions'
import {
  reusableDefinitionDocumentDtoSchema,
  type ReusableDefinitionCurrentDto,
  type ReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_MEDICINE_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  encounterBasicActionAllyAdvantage,
  encounterBasicActionEffects,
  planEncounterBasicAction,
  requireEncounterBasicActionDefinition,
  suppressesEncounterOpportunityAttacks,
  withEncounterBasicActionDefense,
  withEncounterBasicActionEffects,
  withoutEncounterAllyAdvantage
} from '../encounterBasicActions.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import { labelEncounterRollModeReasons } from '../encounterRollModeReasons.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const HOMEBREW_SYSTEM_ID = '00000000-0000-0000-0000-0000000000aa'
const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111'
const DEXTERITY_ID = '00000000-0000-0000-0011-000200000000'
const ACTOR_ACTION_CAPABILITY_ID = '00000000-0000-4000-8000-0000000000d4'
const INCAPACITATED_ID = '00000000-0000-0000-0002-000700000000'
const RESTRAINED_ID = '00000000-0000-0000-0002-000d00000000'
const IDS = {
  dash: '00000000-0000-4000-8000-000000000b01',
  disengage: '00000000-0000-4000-8000-000000000b02',
  dodge: '00000000-0000-4000-8000-000000000b03',
  help: '00000000-0000-4000-8000-000000000b04',
  hide: '00000000-0000-4000-8000-000000000b05',
  firstAid: '00000000-0000-4000-8000-000000000b09'
}
const FIRST_AID_CHECK = { checkDefinitionId: SRD_MEDICINE_SKILL_ID, dc: 10 }

function actor(id: string, disposition: 'FRIENDLY' | 'HOSTILE' = 'FRIENDLY') {
  return encounterRunActorStateSchema.parse({
    id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: `Actor ${id.slice(-1)}`,
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition,
    initiative: null,
    manualOrder: null,
    conditions: [],
    healthDisplay: null,
    systemId: SYSTEM_ID,
    stableTieKey: id,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    defeated: false,
    resources: {},
    gmNotes: null,
    sideId: '22222222-2222-4222-8222-222222222222',
    snapshot: {},
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  })
}

const fighter = actor('33333333-3333-4333-8333-333333333331')
const rogue = actor('33333333-3333-4333-8333-333333333332')
const ogre = actor('33333333-3333-4333-8333-333333333333', 'HOSTILE')

const WISDOM_ID = '00000000-0000-0000-0011-000500000000'
const WALK_ID = '00000000-0000-0000-000c-000100000000'

function currentDefinition(
  document: ReusableDefinitionDocumentDto,
  definitionFamilyKey: string
): ReusableDefinitionCurrentDto {
  return {
    id: document.id,
    gameSystemId: SYSTEM_ID,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey,
    label: definitionFamilyKey,
    description: null,
    document: reusableDefinitionDocumentDtoSchema.parse(document),
    checksum: checksumRuleDocument(document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-09-26T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

/** The SRD actor-action capability and the Incapacitated condition that suppresses it. */
const definitions = {
  requireCurrent: async (id: string) => {
    if (id === ACTOR_ACTION_CAPABILITY_ID)
      return currentDefinition(
        { schemaVersion: 1, kind: 'RULE_CAPABILITY', id, gameSystemId: SYSTEM_ID, usage: null },
        'rule-capability'
      )
    if (id === INCAPACITATED_ID)
      return currentDefinition(
        {
          schemaVersion: 1,
          kind: 'CONDITION_RULE_STATE',
          id,
          gameSystemId: SYSTEM_ID,
          capabilitySuppressions: [
            {
              id,
              order: 0,
              kind: 'CAPABILITY_SUPPRESS',
              capabilityDefinitionIds: [ACTOR_ACTION_CAPABILITY_ID]
            }
          ],
          perceptionContributions: [],
          mechanics: []
        },
        'condition-rule-state'
      )
    return srdConditionDefinitionSource().requireCurrent(id)
  }
}

function target(
  actorState: ReturnType<typeof actor>,
  options: { conditions?: string[] } = {}
): MovementTarget {
  return {
    characterFacts: null,
    actor: actorState,
    activeEffects: [],
    state: { current: 10, temporary: 0, conditions: options.conditions ?? [], deathSaves: null },
    initialConditionRows: null,
    effectiveMaximumHitPoints: 10,
    baseScalarValues: {},
    effectiveScalarValues: {},
    baseRulePolicyOutput: null,
    effectiveRulePolicyOutput: null,
    targetDerivedFacts: {
      savingThrowDefinitions: [
        { abilityDefinitionId: DEXTERITY_ID, rollMode: 'NORMAL', contributors: [] },
        { abilityDefinitionId: WISDOM_ID, rollMode: 'NORMAL', contributors: [] }
      ]
    },
    defenses: [],
    qualifiedDefenses: [],
    conditionImmunityIds: [],
    characterCurrentness: null,
    basicActionAttackContributors: [],
    conditionDefinitions: [],
    conditionMechanics: []
  }
}
function turn(turnSequence: number, currentActorId: string) {
  return { turnSequence, currentActorId }
}

function document(
  id: string,
  mechanics: BasicActionReusableDefinitionDocumentDto['mechanics'],
  gameSystemId = SYSTEM_ID,
  check: BasicActionReusableDefinitionDocumentDto['check'] = null
): BasicActionReusableDefinitionDocumentDto {
  return {
    schemaVersion: 1,
    kind: 'BASIC_ACTION',
    id,
    gameSystemId,
    rulesText: 'Rules text.',
    actionCost: 'ACTION',
    mechanics,
    check,
    saveAbilityIds: mechanics.includes('SAVE_ADVANTAGE') ? [DEXTERITY_ID] : [],
    suspendedWhileUnableToActOrMove: mechanics.includes('SAVE_ADVANTAGE')
  }
}

function published(
  label: string,
  body: BasicActionReusableDefinitionDocumentDto
): ReusableDefinitionCurrentDto {
  return {
    id: body.id,
    gameSystemId: body.gameSystemId,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey: 'basic-action',
    label,
    description: null,
    document: body,
    checksum: checksumRuleDocument(body),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-09-26T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

describe('basic action mechanics (Q11)', () => {
  it('Dash adds a movement bonus and leaves no lasting effect', () => {
    const planned = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: null,
      document: document(IDS.dash, ['SPEED_MOVEMENT_BONUS'])
    })
    expect(planned.speedMovementBonus).toBe(true)
    expect(planned.effects).toEqual([])
    expect(planned.actor).toEqual(fighter)
  })

  it('Hide is logged only: no effect, no movement bonus', () => {
    const planned = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: null,
      document: document(IDS.hide, [])
    })
    expect(planned).toMatchObject({ effects: [], speedMovementBonus: false, warnings: [] })
  })

  it('Disengage suppresses opportunity attacks for the rest of its own turn only', () => {
    const state = turn(2, fighter.id)
    const { actor: disengaged } = planEncounterBasicAction({
      state,
      actor: fighter,
      target: null,
      document: document(IDS.disengage, ['NO_OPPORTUNITY_ATTACKS'])
    })
    expect(suppressesEncounterOpportunityAttacks(state, disengaged)).toBe(true)
    expect(suppressesEncounterOpportunityAttacks(state, fighter)).toBe(false)
    // Its turn ended: another actor is current, or the turn later returned to the actor (D45).
    expect(suppressesEncounterOpportunityAttacks(turn(3, ogre.id), disengaged)).toBe(false)
    expect(suppressesEncounterOpportunityAttacks(turn(4, fighter.id), disengaged)).toBe(false)
  })

  it('Dodge gives attacks against the actor disadvantage and its Dexterity saves advantage', async () => {
    const { actor: dodging } = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: null,
      document: document(IDS.dodge, ['DISADVANTAGE_ON_ATTACKS_AGAINST', 'SAVE_ADVANTAGE'])
    })
    const defended = await withEncounterBasicActionDefense({
      target: target(dodging),
      gameSystemId: SYSTEM_ID,
      definitions
    })
    const contributor = (influence: 'ADVANTAGE' | 'DISADVANTAGE') => ({
      sourceId: `basic-action:${IDS.dodge}`,
      grantId: null,
      domainKey: `basic-action:${fighter.id}`,
      influence
    })
    expect(defended.basicActionAttackContributors).toEqual([contributor('DISADVANTAGE')])
    expect(defended.targetDerivedFacts.savingThrowDefinitions).toEqual([
      {
        abilityDefinitionId: DEXTERITY_ID,
        rollMode: 'ADVANTAGE',
        contributors: [contributor('ADVANTAGE')]
      },
      { abilityDefinitionId: WISDOM_ID, rollMode: 'NORMAL', contributors: [] }
    ])
    const reasons = labelEncounterRollModeReasons(new Map([[`basic-action:${IDS.dodge}`, 'Dodge']]))
    expect(
      reasons({ rollMode: 'DISADVANTAGE', contributors: defended.basicActionAttackContributors })
    ).toEqual(['Dodge'])
    expect(
      await withEncounterBasicActionDefense({
        target: target(fighter),
        gameSystemId: SYSTEM_ID,
        definitions
      })
    ).toEqual(target(fighter))
  })

  it('Dodge applies nothing while the actor is incapacitated or its speed is 0', async () => {
    const { actor: dodging } = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: null,
      document: document(IDS.dodge, ['DISADVANTAGE_ON_ATTACKS_AGAINST', 'SAVE_ADVANTAGE'])
    })
    for (const suspended of [
      target(dodging, { conditions: [INCAPACITATED_ID] }),
      // Restrained sets a 30-foot walk to 0 through its authored condition mechanics (D94).
      await withEncounterConditionMechanics({
        target: target(
          encounterRunActorStateSchema.parse({
            ...dodging,
            snapshot: { payload: { speeds: [{ speedId: WALK_ID, amount: 30, unit: 'FEET' }] } }
          }),
          { conditions: [RESTRAINED_ID] }
        ),
        gameSystemId: SYSTEM_ID,
        definitions
      }),
      target(
        encounterRunActorStateSchema.parse({
          ...dodging,
          snapshot: { payload: { speeds: [{ speedId: WALK_ID, amount: 0, unit: 'FEET' }] } }
        })
      )
    ]) {
      const defended = await withEncounterBasicActionDefense({
        target: suspended,
        gameSystemId: SYSTEM_ID,
        definitions
      })
      expect(defended.basicActionAttackContributors).toEqual([])
      expect(defended.targetDerivedFacts).toEqual(suspended.targetDerivedFacts)
    }
  })
  it('Help grants one attack advantage to the named ally', () => {
    const { actor: helper, warnings } = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: rogue,
      document: document(IDS.help, ['ALLY_ADVANTAGE'])
    })
    expect(warnings).toEqual([])
    const actors = [helper, rogue, ogre]
    expect(encounterBasicActionAllyAdvantage({ actors, attackerId: ogre.id })).toBeNull()
    const use = encounterBasicActionAllyAdvantage({ actors, attackerId: rogue.id })
    expect(use).toMatchObject({
      helperActorId: fighter.id,
      contributor: { sourceId: `basic-action:${IDS.help}`, influence: 'ADVANTAGE' }
    })
    const spent = withoutEncounterAllyAdvantage(helper, use!.effect)
    expect(encounterBasicActionEffects(spent)).toEqual([])
    expect(
      encounterBasicActionAllyAdvantage({ actors: [spent, rogue, ogre], attackerId: rogue.id })
    ).toBeNull()
    expect(() => withoutEncounterAllyAdvantage(spent, use!.effect)).toThrow('already used')
  })

  it('Help needs exactly one ally, and helping an enemy is a soft warning', () => {
    const help = document(IDS.help, ['ALLY_ADVANTAGE'])
    const state = turn(2, fighter.id)
    expect(() =>
      planEncounterBasicAction({ state, actor: fighter, target: null, document: help })
    ).toThrow('Choose an ally')
    expect(() =>
      planEncounterBasicAction({ state, actor: fighter, target: fighter, document: help })
    ).toThrow()
    expect(() =>
      planEncounterBasicAction({
        state,
        actor: fighter,
        target: rogue,
        document: document(IDS.dash, ['SPEED_MOVEMENT_BONUS'])
      })
    ).toThrow('no target')
    expect(
      planEncounterBasicAction({ state, actor: fighter, target: ogre, document: help }).warnings
    ).toEqual([{ code: 'TARGET_DISPOSITION', message: 'This helps an enemy.' }])
  })

  it('First Aid needs exactly one other creature and leaves no lasting effect', () => {
    const firstAid = document(IDS.firstAid, ['STABILIZE_TARGET'], SYSTEM_ID, FIRST_AID_CHECK)
    const state = turn(2, fighter.id)
    expect(() =>
      planEncounterBasicAction({ state, actor: fighter, target: null, document: firstAid })
    ).toThrow('Choose a creature to stabilize')
    expect(() =>
      planEncounterBasicAction({ state, actor: fighter, target: fighter, document: firstAid })
    ).toThrow()
    const planned = planEncounterBasicAction({
      state,
      actor: fighter,
      target: rogue,
      document: firstAid
    })
    expect(planned).toMatchObject({ effects: [], speedMovementBonus: false, warnings: [] })
    expect(planned.actor).toEqual(fighter)
  })

  it('clearing an actor keeps no empty entry in its resources', () => {
    const { actor: dodging } = planEncounterBasicAction({
      state: turn(2, fighter.id),
      actor: fighter,
      target: null,
      document: document(IDS.dodge, ['DISADVANTAGE_ON_ATTACKS_AGAINST'])
    })
    expect(withEncounterBasicActionEffects(dodging, []).resources).toEqual({})
  })
})

describe('basic action catalogue identity', () => {
  it("accepts only a published basic-action entry of the Run's System", () => {
    const dash = published('Dash', document(IDS.dash, ['SPEED_MOVEMENT_BONUS']))
    expect(
      requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, dash).document
    ).toEqual(dash.document)
    expect(() => requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, null)).toThrow()
    expect(() =>
      requireEncounterBasicActionDefinition(
        { gameSystemId: SYSTEM_ID },
        { ...dash, definitionFamilyKey: 'sense' }
      )
    ).toThrow()
  })

  it('a homebrew System overrides an entry with its own name, text and cost', () => {
    const sprint = published('Sprint', {
      ...document(IDS.dash, ['SPEED_MOVEMENT_BONUS'], HOMEBREW_SYSTEM_ID),
      rulesText: 'Run twice as far, as a bonus action.',
      actionCost: 'BONUS_ACTION'
    })
    const resolved = requireEncounterBasicActionDefinition(
      { gameSystemId: HOMEBREW_SYSTEM_ID },
      sprint
    )
    expect(resolved.definition.label).toBe('Sprint')
    expect(resolved.document).toMatchObject({
      actionCost: 'BONUS_ACTION',
      mechanics: ['SPEED_MOVEMENT_BONUS']
    })
    // An SRD Encounter never uses the homebrew System's entry.
    expect(() =>
      requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, sprint)
    ).toThrow()
  })
})
