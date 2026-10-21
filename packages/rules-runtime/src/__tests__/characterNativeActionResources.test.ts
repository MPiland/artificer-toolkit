import { describe, expect, it } from 'vitest'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import {
  createCharacterResourceOwnerKey,
  type CharacterResourceUsage
} from '@artificer-toolkit/shared/character'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { SRD, evaluateSrdCharacter, itemAction, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

type PrepareInput = Parameters<typeof prepareNativeCharacterActionState>[0]
type CompiledEntry = Extract<PrepareInput['entry'], { schemaVersion: 4 }>
type Decision = CharacterRulePolicyOutput['actionDecisions'][number]

const CHARACTER_ID = '00000000-0000-4000-8000-00000000a101'
const OTHER_CHARACTER_ID = '00000000-0000-4000-8000-00000000a102'
const USAGE_ID = '00000000-0000-4000-8000-00000000a103'
const STREAM_VERSION = 5
const STALE = 'The committed Character action resource is unavailable or stale.'

// A Fighter wielding an equipped handaxe, compiled through the real SRD policy and entry compiler.
const fighter = evaluateSrdCharacter({
  abilities: { STRENGTH: 16 },
  classes: [{ label: 'Fighter', level: 1 }],
  items: [{ label: 'Handaxe', equipped: true }]
})
const { candidate, decision } = itemAction(fighter, 'Handaxe', {
  attackKind: 'MELEE',
  activation: 'ACTION'
})
const compiledEntry = compileCharacterActionEntryPoints({
  gameSystemId: SRD_SYSTEM_ID,
  candidates: fighter.facts.actionCandidates,
  descriptors: discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: fighter.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: fighter.entryPoints
  })
}).find(
  (entry): entry is CompiledEntry =>
    entry.kind === 'CHARACTER_ACTION' &&
    entry.schemaVersion === 4 &&
    entry.compilation.kind === 'COMPILED' &&
    entry.actionId === candidate.actionId
)
if (!compiledEntry) throw new Error('The SRD handaxe attack must compile to a v4 entry.')
const entry: CompiledEntry = compiledEntry

function withDecision(
  change: Partial<Decision>,
  output = fighter.output
): CharacterRulePolicyOutput {
  return {
    ...output,
    actionDecisions: output.actionDecisions.map((value) =>
      value.actionId === candidate.actionId ? { ...value, ...change } : value
    )
  }
}

const FIGHTER_LEVELS = { [srdByLabel(SRD.classes, 'Fighter').id]: 1 }

function prepare(overrides: Partial<PrepareInput> = {}) {
  return prepareNativeCharacterActionState({
    entry,
    candidate,
    policyOutput: fighter.output,
    resourceUsage: [],
    inventory: [],
    itemUsage: [],
    characterId: CHARACTER_ID,
    expectedStreamVersion: STREAM_VERSION,
    classLevels: fighter.facts.grantFoldFacts.base.classes,
    automationMode: 'ASSISTED',
    trackAmmunition: false,
    ammunition: null,
    overridable: false,
    ...overrides
  })
}

describe('native Character action state without a resource', () => {
  it('returns the policy mechanic and the Character’s class levels with no consumption or warnings', () => {
    expect(prepare()).toEqual({
      actionMechanic: { ...decision.mechanic, save: null, classLevels: FIGHTER_LEVELS },
      resourceConsumption: null,
      ammunition: null,
      itemConsumption: null,
      spellConsumption: null,
      ruleWarnings: []
    })
  })

  it('warns, when overridable, that the item the action uses is not equipped', () => {
    const unequipped = withDecision({ status: 'UNAVAILABLE', reasonCode: 'SOURCE_NOT_EQUIPPED' })
    expect(prepare({ policyOutput: unequipped, overridable: true }).ruleWarnings).toEqual([
      { code: 'SOURCE_NOT_EQUIPPED', message: "The item this action uses isn't equipped." }
    ])
    expect(() => prepare({ policyOutput: unequipped })).toThrow(STALE)
  })

  it.each([
    { name: 'a negative stream version', overrides: { expectedStreamVersion: -1 } },
    {
      name: 'an entry compiled for another action',
      overrides: { entry: { ...entry, actionId: `${entry.actionId}:other` } }
    },
    {
      name: 'a decision for another source',
      overrides: {
        candidate: { ...candidate, sourceId: `${candidate.sourceId}:other` }
      }
    },
    {
      name: 'an unavailable decision refused for another reason, even when overridable',
      overrides: {
        policyOutput: withDecision({ status: 'UNAVAILABLE', reasonCode: 'RESOURCE_MISSING' }),
        overridable: true
      }
    },
    {
      name: 'an authored resource the compiled entry does not bind',
      overrides: {
        candidate: { ...candidate, resourceUse: { chargeId: 'charge', cost: 1, poolId: null } }
      }
    }
  ])('refuses $name', ({ overrides }) => {
    expect(() => prepare(overrides)).toThrow(STALE)
  })
})

describe('native Character action state with a bound resource', () => {
  const owner = { kind: 'AUTHORED_GRANT' as const, resourceGrantId: 'battle-focus' }
  const poolId = createCharacterResourceOwnerKey(owner)
  const binding = { poolId, chargeId: 'battle-focus-charge', cost: 1 }
  const boundEntry: CompiledEntry = {
    ...entry,
    compilation: { ...entry.compilation, resourceBinding: binding }
  }
  const boundCandidate = { ...candidate, resourceUse: { ...binding } }

  /** A two-use short-rest pool with `rawUsed` spent, as the policy resolves it. */
  function policy(rawUsed: number, change: Partial<Decision> = {}) {
    const resource: CharacterRulePolicyOutput['resources'][number] = {
      ownerKind: 'AUTHORED_GRANT',
      resourceGrantId: 'battle-focus',
      availableAtLevel: 1,
      activeSourceLevel: 1,
      sequence: 0,
      poolId,
      resourceDefinitionId: 'battle-focus',
      chargeId: 'battle-focus-charge',
      chargeCalculationId: poolId,
      state: 'RESOLVED',
      maximum: 2,
      rawUsed,
      effectiveUsed: rawUsed,
      remaining: Math.max(0, 2 - rawUsed),
      reasonCode: 'CALCULATED',
      baseContribution: { sourceId: 'battle-focus', value: 2 },
      bonusContributions: [],
      resetKind: 'SHORT_REST',
      resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null }
    }
    return withDecision(
      { resourcePoolId: poolId, resourceCost: 1, ...change },
      { ...fighter.output, resources: [resource] }
    )
  }

  function usage(used: number, characterId = CHARACTER_ID): CharacterResourceUsage {
    return {
      id: USAGE_ID,
      characterId,
      owner,
      used,
      createdBy: CHARACTER_ID,
      updatedBy: CHARACTER_ID,
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    }
  }

  function prepareBound(overrides: Partial<PrepareInput> = {}) {
    return prepare({ entry: boundEntry, candidate: boundCandidate, ...overrides })
  }

  it('spends one use from the pool the entry binds, reusing the existing usage row', () => {
    expect(prepareBound({ policyOutput: policy(1), resourceUsage: [usage(1)] })).toEqual({
      actionMechanic: { ...decision.mechanic, save: null, classLevels: FIGHTER_LEVELS },
      ruleWarnings: [],
      ammunition: null,
      itemConsumption: null,
      spellConsumption: null,
      resourceConsumption: {
        poolId,
        chargeId: 'battle-focus-charge',
        cost: 1,
        owner,
        usageId: USAGE_ID,
        beforeUsed: 1,
        afterUsed: 2,
        beforeRemaining: 1,
        afterRemaining: 0,
        characterId: CHARACTER_ID,
        expectedStreamVersion: STREAM_VERSION
      }
    })
  })

  it('starts a new usage row when the pool has never been used', () => {
    const prepared = prepareBound({ policyOutput: policy(0) })
    expect(prepared.resourceConsumption).toEqual({
      poolId,
      chargeId: 'battle-focus-charge',
      cost: 1,
      owner,
      usageId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      ),
      beforeUsed: 0,
      afterUsed: 1,
      beforeRemaining: 2,
      afterRemaining: 1,
      characterId: CHARACTER_ID,
      expectedStreamVersion: STREAM_VERSION
    })
  })

  it('checks the resource but spends nothing under Manual automation', () => {
    expect(
      prepareBound({ policyOutput: policy(1), resourceUsage: [usage(1)], automationMode: 'MANUAL' })
    ).toEqual({
      actionMechanic: { ...decision.mechanic, save: null, classLevels: FIGHTER_LEVELS },
      ammunition: null,
      itemConsumption: null,
      spellConsumption: null,
      resourceConsumption: null,
      ruleWarnings: []
    })
  })

  it('lets an overridable action run on an empty pool, spending nothing and warning', () => {
    const exhausted = policy(2, { status: 'UNAVAILABLE', reasonCode: 'INSUFFICIENT_RESOURCE' })
    expect(
      prepareBound({ policyOutput: exhausted, resourceUsage: [usage(2)], overridable: true })
    ).toEqual({
      actionMechanic: { ...decision.mechanic, save: null, classLevels: FIGHTER_LEVELS },
      ammunition: null,
      itemConsumption: null,
      spellConsumption: null,
      resourceConsumption: null,
      ruleWarnings: [
        { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough uses left: needs 1, has 0.' }
      ]
    })
    expect(() => prepareBound({ policyOutput: exhausted, resourceUsage: [usage(2)] })).toThrow(
      STALE
    )
  })

  it('spends only what remains of a larger cost and records the shortfall', () => {
    const costly = { ...binding, cost: 2 }
    const prepared = prepareBound({
      entry: { ...entry, compilation: { ...entry.compilation, resourceBinding: costly } },
      candidate: { ...candidate, resourceUse: { ...costly } },
      policyOutput: policy(1, {
        status: 'UNAVAILABLE',
        reasonCode: 'INSUFFICIENT_RESOURCE',
        resourceCost: 2
      }),
      resourceUsage: [usage(1)],
      overridable: true
    })
    expect(prepared.ruleWarnings).toEqual([
      { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough uses left: needs 2, has 1.' }
    ])
    expect(prepared.resourceConsumption).toMatchObject({
      cost: 1,
      beforeUsed: 1,
      afterUsed: 2,
      beforeRemaining: 1,
      afterRemaining: 0
    })
  })

  it('keeps the binding when the source is unequipped, since the policy reports no pool', () => {
    const prepared = prepareBound({
      policyOutput: policy(0, {
        status: 'UNAVAILABLE',
        reasonCode: 'SOURCE_NOT_EQUIPPED',
        resourcePoolId: null,
        resourceCost: null
      }),
      overridable: true
    })
    expect(prepared.ruleWarnings).toEqual([
      { code: 'SOURCE_NOT_EQUIPPED', message: "The item this action uses isn't equipped." }
    ])
    expect(prepared.resourceConsumption).toMatchObject({ cost: 1, afterUsed: 1, afterRemaining: 1 })
  })

  it.each([
    {
      name: 'stored usage that differs from the policy raw usage',
      overrides: { policyOutput: policy(0), resourceUsage: [usage(1)] }
    },
    {
      name: 'usage stored for another Character',
      overrides: { policyOutput: policy(1), resourceUsage: [usage(1, OTHER_CHARACTER_ID)] }
    },
    {
      name: 'two usage rows for one pool',
      overrides: {
        policyOutput: policy(1),
        resourceUsage: [usage(1), { ...usage(1), id: '00000000-0000-4000-8000-00000000a104' }]
      }
    },
    {
      name: 'a decision bound to a different cost',
      overrides: { policyOutput: policy(0, { resourceCost: 2 }) }
    },
    { name: 'a pool the policy did not resolve', overrides: { policyOutput: fighter.output } }
  ])('refuses $name', ({ overrides }) => {
    expect(() => prepareBound(overrides)).toThrow(STALE)
  })
})

describe('native Character action state with a single-use item', () => {
  const itemInstanceId = candidate.equipment?.itemInstanceId
  if (!candidate.equipment || !itemInstanceId)
    throw new Error('The handaxe is an equipment action.')
  const singleUse = { ...candidate, equipment: { ...candidate.equipment, consumedOnUse: true } }
  const carried = (quantity: number) => [{ id: itemInstanceId, quantity }]

  it('uses one up, from the effective quantity and the usage already recorded', () => {
    expect(
      prepare({
        candidate: singleUse,
        inventory: carried(2),
        itemUsage: [{ itemInstanceId, used: 3 }]
      }).itemConsumption
    ).toEqual({
      characterId: CHARACTER_ID,
      itemInstanceId,
      beforeUsed: 3,
      afterUsed: 4,
      beforeQuantity: 2,
      afterQuantity: 1,
      expectedStreamVersion: STREAM_VERSION
    })
  })

  it('uses the item up even when the action carries an overridable warning', () => {
    const unequipped = withDecision({ status: 'UNAVAILABLE', reasonCode: 'SOURCE_NOT_EQUIPPED' })
    expect(
      prepare({
        candidate: singleUse,
        policyOutput: unequipped,
        overridable: true,
        inventory: carried(1)
      })
    ).toMatchObject({
      itemConsumption: { afterQuantity: 0 },
      ruleWarnings: [{ code: 'SOURCE_NOT_EQUIPPED' }]
    })
  })

  it('leaves the count for the table in Manual play', () => {
    expect(
      prepare({ candidate: singleUse, automationMode: 'MANUAL', inventory: carried(1) })
        .itemConsumption
    ).toBeNull()
  })

  it('refuses an item no longer carried', () => {
    expect(() => prepare({ candidate: singleUse, inventory: [] })).toThrow(STALE)
  })

  it('consumes nothing for an item that is not single-use', () => {
    expect(prepare({ inventory: carried(1) }).itemConsumption).toBeNull()
  })
})
