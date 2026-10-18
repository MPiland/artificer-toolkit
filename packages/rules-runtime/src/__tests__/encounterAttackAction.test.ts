import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  encounterAttackActionState,
  withEncounterAttackActionState,
  withEncounterRuleUsageUsed
} from '../encounterActorState.js'
import {
  applyEncounterAttackActionTransition,
  encounterAttackActionTransition,
  evaluateEncounterAttackAction,
  revertEncounterAttackActionTransition
} from '../encounterAttackAction.js'
import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'
import { evaluateSrdCharacter, srdFeature } from '../testing/dnd5eSrdCharacter.js'
import { copperSlowingEffect } from './antitoxinEffectFixture.js'
import { creatureActor, creatureEncounter, srdConditionId } from './encounterCreatureAction.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000b0001'
const WOLF_ID = '00000000-0000-4000-8000-0000000b0002'
const ACTION_ID = '00000000-0000-4000-8000-0000000b0010'
const ACTION = { code: 'ACTION', amount: 1 }
const MELEE = 'MELEE_WEAPON_ATTACK'

const srdDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const seed = SRD_RULE_STATE_DEFINITIONS.find((definition) => definition.id === definitionId)
    if (!seed) throw new Error(`SRD rule-state definition ${definitionId} is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      ...seed,
      gameSystemId: SRD_SYSTEM_ID,
      contentSourceId: '00000000-0000-4000-8000-0000000b0003',
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-09-26T00:00:00.000Z',
      publishedBy: SRD_USER_ID
    })
  }
}

/** A Fighter 5 with Extra Attack: two attacks per Attack action. */
const fighterOutput = evaluateSrdCharacter({
  classes: [{ label: 'Fighter', level: 5 }],
  features: [
    srdFeature({ owner: 'CLASS', classLabel: 'Fighter', featureLabel: 'Extra Attack', level: 5 })
  ]
}).output

const attack = () => ({ actionId: ACTION_ID, targetIds: [WOLF_ID] })
const openState = (attacks: number, turnSequence = 1) => ({
  kind: 'ATTACK_ACTION' as const,
  turnSequence,
  total: 2,
  attacks: Array.from({ length: attacks }, attack)
})

/** An actor on turn sequence 1 with `attacks` made in its Attack action (none open when omitted). */
function actorWith(input: {
  attacks?: number
  turnSequence?: number
  actionUsed?: number
  conditionIds?: string[]
}) {
  const base = creatureActor({
    id: ACTOR_ID,
    label: 'Fighter',
    features: [],
    conditionIds: input.conditionIds
  })
  const usage = withEncounterRuleUsageUsed(
    base,
    SRD_ACTION_ALLOWANCE_DEFINITION_ID,
    input.actionUsed ?? 0
  )
  const actor = encounterRunActorStateSchema.parse({ ...base, resources: usage })
  return input.attacks === undefined
    ? actor
    : encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterAttackActionState(
          actor,
          openState(input.attacks, input.turnSequence)
        )
      })
}

function evaluate(input: {
  actor: EncounterRunActorState
  triggerCode?: string
  activation?: { code: string; amount: number }
  automationMode?: 'ASSISTED' | 'MANUAL'
  /** `false` evaluates the actor as a Creature, which has no Character policy output. */
  character?: boolean
  activeEffects?: ActiveRuleEffectRecord[]
  replacesAttack?: boolean
}) {
  const { state, movementTargets } = creatureEncounter([input.actor], input.automationMode)
  const creatureTarget = movementTargets.get(input.actor.id)
  const withPolicy =
    creatureTarget && (input.character ?? true)
      ? { ...creatureTarget, effectiveRulePolicyOutput: fighterOutput }
      : creatureTarget
  const target =
    withPolicy && input.activeEffects
      ? { ...withPolicy, activeEffects: input.activeEffects }
      : withPolicy
  return evaluateEncounterAttackAction({
    actor: input.actor,
    state,
    activation: input.activation ?? ACTION,
    triggerCode: input.triggerCode ?? MELEE,
    replacesAttack: input.replacesAttack,
    target,
    loadTarget: async () => target,
    definitions: srdDefinitions
  })
}

describe('an attack in the Attack action', () => {
  it('opens the Attack action with the Action and the Character attacks per Attack action', async () => {
    const result = await evaluate({ actor: actorWith({}) })
    expect(result.economy).toMatchObject({ available: true, consumption: { afterUsed: 1 } })
    expect(result.attackAction).toEqual({
      before: null,
      turnSequence: 1,
      total: 2,
      attacksMade: []
    })
    expect(result.slot).toEqual({ number: 1, total: 2 })
  })

  it('gives a Creature one attack per Attack action', async () => {
    const result = await evaluate({ actor: actorWith({}), character: false })
    expect(result.attackAction).toMatchObject({ total: 1 })
    expect(result.slot).toEqual({ number: 1, total: 1 })
  })

  it('fills the open Attack action without spending an Action', async () => {
    const result = await evaluate({ actor: actorWith({ attacks: 1, actionUsed: 1 }) })
    expect(result.economy).toBeNull()
    expect(result.attackAction).toMatchObject({ total: 2, attacksMade: [attack()] })
    expect(result.slot).toEqual({ number: 2, total: 2 })
  })

  it('spends another Action once the Attack action is full, warning when none is left', async () => {
    const result = await evaluate({ actor: actorWith({ attacks: 2, actionUsed: 1 }) })
    expect(result.economy).toMatchObject({
      available: false,
      consumption: { beforeUsed: 1, afterUsed: 2 }
    })
    expect(result.attackAction).toMatchObject({ before: openState(2), attacksMade: [] })
    expect(result.slot).toBeNull()
  })

  it('does not fill an Attack action opened on an earlier turn', async () => {
    const result = await evaluate({ actor: actorWith({ attacks: 1, turnSequence: 0 }) })
    expect(result.economy).toMatchObject({ available: true })
    expect(result.attackAction).toMatchObject({
      before: openState(1, 0),
      turnSequence: 1,
      attacksMade: []
    })
  })

  it('leaves spell attacks and other actions to the plain Action rule', async () => {
    const open = actorWith({ attacks: 1, actionUsed: 1 })
    for (const triggerCode of ['RANGED_SPELL_ATTACK', 'ACTIVATED']) {
      const result = await evaluate({ actor: open, triggerCode })
      expect(result.attackAction).toBeNull()
      expect(result.slot).toBeNull()
      expect(result.economy).toMatchObject({ available: false })
    }
    const bonus = await evaluate({ actor: open, activation: { code: 'BONUS_ACTION', amount: 1 } })
    expect(bonus.attackAction).toBeNull()
    expect(bonus.economy).toMatchObject({ available: true })
  })

  it('tracks nothing in Manual mode', async () => {
    const result = await evaluate({ actor: actorWith({}), automationMode: 'MANUAL' })
    expect(result.attackAction).toBeNull()
    expect(result.slot).toBeNull()
  })
})

describe('an action that takes the place of one attack (D152)', () => {
  it('opens the Attack action with the Action when none is open', async () => {
    const result = await evaluate({
      actor: actorWith({}),
      triggerCode: 'ACTIVATED',
      replacesAttack: true
    })
    expect(result.economy).toMatchObject({ available: true, consumption: { afterUsed: 1 } })
    expect(result.attackAction).toMatchObject({ before: null, total: 2, attacksMade: [] })
    expect(result.slot).toEqual({ number: 1, total: 2 })
  })

  it('fills the open Attack action without spending another Action', async () => {
    const result = await evaluate({
      actor: actorWith({ attacks: 1, actionUsed: 1 }),
      triggerCode: 'ACTIVATED',
      replacesAttack: true
    })
    expect(result.economy).toBeNull()
    expect(result.slot).toEqual({ number: 2, total: 2 })
  })

  it('takes no attack slot with a bonus action', async () => {
    const result = await evaluate({
      actor: actorWith({ attacks: 1, actionUsed: 1 }),
      triggerCode: 'ACTIVATED',
      activation: { code: 'BONUS_ACTION', amount: 1 },
      replacesAttack: true
    })
    expect(result.attackAction).toBeNull()
    expect(result.slot).toBeNull()
  })
})

describe('an attack under a cap on attacks per Attack action (Slowing Breath)', () => {
  const slowed = () => [copperSlowingEffect({ id: WOLF_ID, holderActorId: ACTOR_ID })]

  it('lowers the Extra Attack total to the cap', async () => {
    const result = await evaluate({ actor: actorWith({}), activeEffects: slowed() })
    expect(result.attackAction).toMatchObject({ total: 1 })
    expect(result.slot).toEqual({ number: 1, total: 1 })
  })

  it('treats an Attack action opened for more attacks as full once the cap is reached', async () => {
    const result = await evaluate({
      actor: actorWith({ attacks: 1, actionUsed: 1 }),
      activeEffects: slowed()
    })
    expect(result.economy).toMatchObject({ available: false, consumption: { beforeUsed: 1 } })
    expect(result.slot).toBeNull()
  })

  it('never raises a Creature that has fewer attacks than the cap', async () => {
    const result = await evaluate({
      actor: actorWith({}),
      character: false,
      activeEffects: slowed()
    })
    expect(result.attackAction).toMatchObject({ total: 1 })
  })
})

describe('an attack by an actor that cannot act', () => {
  const incapacitated = () => [srdConditionId('INCAPACITATED')]

  it('is flagged even when it fills the open Attack action, without spending an Action', async () => {
    const result = await evaluate({
      actor: actorWith({ attacks: 1, actionUsed: 1, conditionIds: incapacitated() })
    })
    expect(result.slot).toBeNull()
    expect(result.suppressed).toBe(true)
    expect(result.economy).toBeNull()
    expect(result.attackAction).toMatchObject({ total: 2, attacksMade: [attack()] })
  })

  it('does not flag a filler whose Action is merely spent', async () => {
    const result = await evaluate({ actor: actorWith({ attacks: 1, actionUsed: 1 }) })
    expect(result.suppressed).toBe(false)
    expect(result.slot).toEqual({ number: 2, total: 2 })
  })

  it('leaves the warning of an attack that spends an Action to the Action evaluation', async () => {
    const result = await evaluate({ actor: actorWith({ conditionIds: incapacitated() }) })
    expect(result.suppressed).toBe(false)
    expect(result.economy).toMatchObject({ available: false, consumption: { beforeUsed: 0 } })
    expect(result.slot).toBeNull()
  })
})

describe('an attack change to the Attack action', () => {
  const planned = {
    before: openState(1),
    turnSequence: 1,
    total: 2,
    attacksMade: openState(1).attacks
  }

  it('adds the attack, and undoes it only while the Attack action is unchanged', () => {
    const transition = encounterAttackActionTransition(planned, attack())
    expect(transition).toEqual({ before: openState(1), after: openState(2) })

    const applied = applyEncounterAttackActionTransition(actorWith({ attacks: 1 }), transition)
    expect(encounterAttackActionState(applied)).toEqual(openState(2))
    const reverted = revertEncounterAttackActionTransition(applied, transition)
    expect(reverted && encounterAttackActionState(reverted)).toEqual(openState(1))

    // A later attack opened another Attack action: this one cannot be undone alone.
    const later = applyEncounterAttackActionTransition(
      applied,
      encounterAttackActionTransition(
        { before: openState(2), turnSequence: 1, total: 2, attacksMade: [] },
        attack()
      )
    )
    expect(revertEncounterAttackActionTransition(later, transition)).toBeNull()
  })

  it('restores an actor that held no Attack action', () => {
    const transition = encounterAttackActionTransition(
      { before: null, turnSequence: 1, total: 2, attacksMade: [] },
      attack()
    )
    const applied = applyEncounterAttackActionTransition(actorWith({}), transition)
    const reverted = revertEncounterAttackActionTransition(applied, transition)
    expect(reverted && encounterAttackActionState(reverted)).toBeNull()
  })

  it('records the item an attack was made with and its property codes', () => {
    const item = {
      itemInstanceId: '00000000-0000-4000-8000-0000000b0020',
      properties: ['LIGHT', 'MELEE']
    }
    const transition = encounterAttackActionTransition(planned, { ...attack(), item })
    const applied = applyEncounterAttackActionTransition(actorWith({ attacks: 1 }), transition)
    expect(encounterAttackActionState(applied)?.attacks[1]).toEqual({ ...attack(), item })
  })

  it('refuses to apply to an Attack action other than the one it was planned on', () => {
    const transition = encounterAttackActionTransition(planned, attack())
    expect(() => applyEncounterAttackActionTransition(actorWith({}), transition)).toThrow(
      'Attack action changed'
    )
  })
})
