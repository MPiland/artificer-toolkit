import { describe, expect, it } from 'vitest'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createNativeCleavingChoice,
  type NativeCleavingCandidate
} from '../encounterCleavingChoice.js'
import {
  buildEncounterCleavingCandidate,
  cleavingCarriesOn,
  cleavingDamageApplication,
  cleavingDamageEnvelope,
  cleavingTargetArmorClass,
  type CleavingContext
} from '../encounterCleavingFacts.js'
import { cleavingChildOccurrenceIdentity } from '../encounterCleavingIdentity.js'
import {
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdOptionalCombat
} from '../testing/dnd5eSrdEncounter.js'
import { shimmeringShieldEffect } from './antitoxinEffectFixture.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

const ancientRedDragon = srdByLabel(SRD.creatures, 'Ancient Red Dragon')
const goblin = srdByLabel(SRD.creatures, 'Goblin')
const wolf = srdByLabel(SRD.creatures, 'Wolf')

const ATTACKER_ID = '00000000-0000-4000-8000-00000000c001'
const FIRST_ID = '00000000-0000-4000-8000-00000000c002'
const SECOND_ID = '00000000-0000-4000-8000-00000000c003'
const THIRD_ID = '00000000-0000-4000-8000-00000000c004'
const PARENT_OCCURRENCE_ID = '00000000-0000-4000-8000-00000000c005'
const SLASHING_ID = '00000000-0000-4000-8000-00000000c006'
const SOURCE_TOKEN_ID = '00000000-0000-4000-8000-00000000c010'

/** A 20-slashing greataxe hit that dropped an undamaged 7-hit-point goblin. */
const initialHit = {
  sourceNodeId: 'damage',
  sourceOperationKey: 'damage',
  damageTypeId: SLASHING_ID,
  requestedAmount: 20,
  resolvedAmount: 20,
  appliedAmount: 7,
  beforeCurrentHitPoints: 7,
  afterCurrentHitPoints: 0,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 7,
  targetActorId: FIRST_ID,
  damageDisposition: 'NORMAL'
}

describe('Cleaving damage carry-over', () => {
  it('carries only the excess of the killing blow', () => {
    const damage = cleavingDamageEnvelope(initialHit)
    expect(damage).toEqual({
      sourceNodeId: 'damage',
      sourceOperationKey: 'damage',
      damageTypeId: SLASHING_ID,
      resolvedAmount: 20,
      appliedAmount: 7,
      remainingAmount: 13,
      envelopeChecksum: damage.envelopeChecksum
    })
    expect(damage.envelopeChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(
      cleavingDamageEnvelope({ ...initialHit, targetActorId: SECOND_ID }).envelopeChecksum
    ).not.toBe(damage.envelopeChecksum)
  })

  it('applies the carried damage to the next target and chains while it drops undamaged targets', () => {
    const second = cleavingDamageApplication({
      damage: cleavingDamageEnvelope(initialHit),
      targetActorId: SECOND_ID,
      before: { current: 7, temporary: 0, maximum: 7 }
    })
    expect(second).toEqual({
      kind: 'DAMAGE',
      targetActorId: SECOND_ID,
      sourceNodeId: 'damage',
      sourceOperationKey: 'damage',
      damageTypeId: SLASHING_ID,
      requestedAmount: 13,
      resolvedAmount: 13,
      appliedAmount: 7,
      beforeCurrentHitPoints: 7,
      afterCurrentHitPoints: 0,
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 0,
      maximumHitPoints: 7,
      damageDisposition: 'NORMAL',
      incomingHalved: false,
      critical: false,
      authoredPath: null,
      resolvedPath: null
    })
    expect(cleavingCarriesOn(second)).toBe(true)

    const onward = cleavingDamageEnvelope({ ...second, targetActorId: SECOND_ID })
    expect(onward).toMatchObject({ resolvedAmount: 13, appliedAmount: 7, remainingAmount: 6 })
    const third = cleavingDamageApplication({
      damage: onward,
      targetActorId: THIRD_ID,
      before: { current: 7, temporary: 0, maximum: 7 }
    })
    expect(third).toMatchObject({ requestedAmount: 6, appliedAmount: 6, afterCurrentHitPoints: 1 })
    // The third goblin survives, so the chain stops with no damage left over.
    expect(cleavingCarriesOn(third)).toBe(false)
  })

  it('stops at an already-injured target even when it drops with damage to spare', () => {
    const injured = cleavingDamageApplication({
      damage: cleavingDamageEnvelope(initialHit),
      targetActorId: SECOND_ID,
      before: { current: 5, temporary: 0, maximum: 7 }
    })
    expect(injured).toMatchObject({
      requestedAmount: 13,
      appliedAmount: 5,
      afterCurrentHitPoints: 0
    })
    expect(cleavingCarriesOn(injured)).toBe(false)
  })

  it('carries on from an undamaged target that also had temporary hit points', () => {
    const shielded = cleavingDamageApplication({
      damage: cleavingDamageEnvelope(initialHit),
      targetActorId: SECOND_ID,
      before: { current: 7, temporary: 3, maximum: 7 }
    })
    expect(shielded).toMatchObject({ requestedAmount: 13, appliedAmount: 10 })
    expect(cleavingCarriesOn(shielded)).toBe(true)
  })

  it('stops when the carried damage is exactly lethal', () => {
    const exact = cleavingDamageApplication({
      damage: cleavingDamageEnvelope({ ...initialHit, requestedAmount: 14, resolvedAmount: 14 }),
      targetActorId: SECOND_ID,
      before: { current: 7, temporary: 0, maximum: 7 }
    })
    expect(exact).toMatchObject({ requestedAmount: 7, appliedAmount: 7, afterCurrentHitPoints: 0 })
    expect(cleavingCarriesOn(exact)).toBe(false)
  })

  it('spends temporary hit points before current hit points', () => {
    expect(
      cleavingDamageApplication({
        damage: cleavingDamageEnvelope(initialHit),
        targetActorId: SECOND_ID,
        before: { current: 7, temporary: 3, maximum: 7 }
      })
    ).toMatchObject({
      requestedAmount: 13,
      resolvedAmount: 13,
      appliedAmount: 10,
      beforeCurrentHitPoints: 7,
      afterCurrentHitPoints: 0,
      beforeTemporaryHitPoints: 3,
      afterTemporaryHitPoints: 0
    })
    expect(
      cleavingDamageApplication({
        damage: cleavingDamageEnvelope({ ...initialHit, requestedAmount: 12, resolvedAmount: 12 }),
        targetActorId: SECOND_ID,
        before: { current: 7, temporary: 3, maximum: 7 }
      })
    ).toMatchObject({
      requestedAmount: 5,
      appliedAmount: 5,
      afterCurrentHitPoints: 5,
      afterTemporaryHitPoints: 0
    })
  })
})

const grid = {
  kind: 'SQUARE' as const,
  origin: { x: 0, y: 0 },
  cellSize: 100,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL' as const,
  unit: 'FEET' as const
}
const scene = {
  sceneId: '00000000-0000-4000-8000-00000000c011',
  sceneVersion: 3,
  effectiveGridChecksum: checksumRuleDocument(grid),
  sourceTokenId: SOURCE_TOKEN_ID
}
const greataxe: CleavingContext['action'] = {
  actionId: 'greataxe',
  publishedDefinitionId: '00000000-0000-4000-8000-00000000c012',
  publishedDefinitionChecksum: 'c'.repeat(64),
  attackKind: 'MELEE',
  range: { id: 'greataxe-reach', rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
}
const sourceToken = { position: { x: 50, y: 50 }, width: 100, height: 100, rotationDegrees: 0 }

function tokenAt(actorId: string, cellX: number) {
  return {
    actorId,
    tokenId: `${actorId.slice(0, -4)}d${actorId.slice(-3)}`,
    position: { x: 50 + cellX * 100, y: 50 },
    width: 100,
    height: 100,
    rotationDegrees: 0
  }
}

function candidate(input: {
  actor: EncounterRunActorState
  cellX: number
  originalAttack: { total: number; naturalRoll: number }
  action?: CleavingContext['action']
  activeEffects?: Parameters<typeof srdCreatureTarget>[1]
}) {
  const targetToken = tokenAt(input.actor.id, input.cellX)
  return buildEncounterCleavingCandidate({
    target: srdCreatureTarget(input.actor, input.activeEffects),
    targetTokenId: targetToken.tokenId,
    action: input.action ?? greataxe,
    scene,
    originalAttack: input.originalAttack,
    geometry: { grid, sourceToken, targetToken }
  })
}

describe('Cleaving target facts', () => {
  const goblinActor = srdCreatureActor({ id: SECOND_ID, creature: goblin })

  it('captures an adjacent hittable target exactly', () => {
    const targetToken = tokenAt(SECOND_ID, 1)
    const { actorId: _actorId, ...footprint } = targetToken
    expect(
      candidate({ actor: goblinActor, cellX: 1, originalAttack: { total: 15, naturalRoll: 11 } })
    ).toEqual({
      actorId: SECOND_ID,
      targetTokenId: targetToken.tokenId,
      targetActorVersion: 1,
      targetStateChecksum: checksumRuleDocument(goblinActor),
      armorClass: 15,
      footprintChecksum: checksumRuleDocument(footprint),
      withinAttackerReach: true,
      originalAttackCanHit: true
    })
  })

  it('reads the armor class a held ARMOR_CLASS grant raises (Shimmering Shield)', () => {
    const shield = shimmeringShieldEffect({ id: SOURCE_TOKEN_ID, holderActorId: SECOND_ID })
    const next = candidate({
      actor: goblinActor,
      cellX: 1,
      originalAttack: { total: 15, naturalRoll: 11 },
      activeEffects: [shield]
    })
    expect(next).toMatchObject({ armorClass: 17, originalAttackCanHit: false })
  })

  it('gives the worker and the candidate the same effective armor class for a Creature', () => {
    const shield = shimmeringShieldEffect({ id: SOURCE_TOKEN_ID, holderActorId: SECOND_ID })
    expect(cleavingTargetArmorClass(srdCreatureTarget(goblinActor))).toBe(15)
    expect(cleavingTargetArmorClass(srdCreatureTarget(goblinActor, [shield]))).toBe(17)
  })

  it('judges the next target against the original attack roll, with natural 1 and 20', () => {
    const canHit = (originalAttack: { total: number; naturalRoll: number }) =>
      candidate({ actor: goblinActor, cellX: 1, originalAttack })?.originalAttackCanHit
    expect(canHit({ total: 15, naturalRoll: 11 })).toBe(true)
    expect(canHit({ total: 14, naturalRoll: 10 })).toBe(false)
    expect(canHit({ total: 10, naturalRoll: 20 })).toBe(true)
    expect(canHit({ total: 30, naturalRoll: 1 })).toBe(false)
  })

  it('counts grid squares for 5-foot reach: adjacent is in reach, two squares away is not', () => {
    const inReach = (cellX: number) =>
      candidate({ actor: goblinActor, cellX, originalAttack: { total: 15, naturalRoll: 11 } })
        ?.withinAttackerReach
    expect(inReach(1)).toBe(true)
    expect(inReach(2)).toBe(false)
  })

  it('places a target three squares away out of 5-foot reach', () => {
    expect(
      candidate({ actor: goblinActor, cellX: 4, originalAttack: { total: 15, naturalRoll: 11 } })
        ?.withinAttackerReach
    ).toBe(false)
  })

  it('offers no target for a custom actor or an action without a distance reach', () => {
    const custom = encounterRunActorStateSchema.parse({ ...goblinActor, kind: 'CUSTOM' })
    expect(
      candidate({ actor: custom, cellX: 1, originalAttack: { total: 15, naturalRoll: 11 } })
    ).toBeNull()
    expect(
      candidate({
        actor: goblinActor,
        cellX: 1,
        originalAttack: { total: 15, naturalRoll: 11 },
        action: { ...greataxe, range: { id: 'special', rangeKind: 'SPECIAL' } }
      })
    ).toBeNull()
  })

  it('never carries excess damage into a defeated creature (D63)', () => {
    const deadGoblin = srdCreatureActor({
      id: SECOND_ID,
      creature: goblin,
      currentHitPoints: 0,
      defeated: true
    })
    expect(
      candidate({ actor: deadGoblin, cellX: 1, originalAttack: { total: 15, naturalRoll: 11 } })
    ).toBeNull()
  })

  it('refuses a Scene whose grid changed since the attack', () => {
    expect(() =>
      buildEncounterCleavingCandidate({
        target: srdCreatureTarget(goblinActor),
        targetTokenId: tokenAt(SECOND_ID, 1).tokenId,
        action: greataxe,
        scene: { ...scene, effectiveGridChecksum: 'e'.repeat(64) },
        originalAttack: { total: 15, naturalRoll: 11 },
        geometry: { grid, sourceToken, targetToken: tokenAt(SECOND_ID, 1) }
      })
    ).toThrow('Cleaving Scene is stale.')
  })

  it('measures a 5-foot reach as one square on a SQUARES Scene', () => {
    const squaresGrid = { ...grid, distancePerCell: 1 as const, unit: 'SQUARES' as const }
    const inReach = (cellX: number) => {
      const targetToken = tokenAt(SECOND_ID, cellX)
      return buildEncounterCleavingCandidate({
        target: srdCreatureTarget(goblinActor),
        targetTokenId: targetToken.tokenId,
        action: greataxe,
        scene: { ...scene, effectiveGridChecksum: checksumRuleDocument(squaresGrid) },
        originalAttack: { total: 15, naturalRoll: 11 },
        geometry: { grid: squaresGrid, sourceToken, targetToken }
      })
    }
    expect(inReach(1)).toMatchObject({
      actorId: SECOND_ID,
      armorClass: 15,
      withinAttackerReach: true,
      originalAttackCanHit: true
    })
    expect(inReach(2)).toMatchObject({ actorId: SECOND_ID, withinAttackerReach: false })
  })
})

describe('Cleaving choice', () => {
  const cleavingRules = srdOptionalCombat(['CLEAVING'])
  const sourceCurrentness: CleavingContext['sourceCurrentness'] = {
    kind: 'ENCOUNTER_ACTOR',
    actorId: ATTACKER_ID,
    sourceRevision: 1,
    sourceVersionId: '00000000-0000-4000-8000-00000000c013',
    sourceChecksum: 'a'.repeat(64),
    stateChecksum: 'b'.repeat(64)
  }
  const originalAttack = { total: 16, naturalRoll: 12 }
  // Goblin (AC 15) adjacent and hittable, dragon (AC 22) adjacent but too hard to hit, wolf (AC 13)
  // hittable but out of reach.
  const goblinNext = candidate({
    actor: srdCreatureActor({ id: SECOND_ID, creature: goblin }),
    cellX: 1,
    originalAttack
  })
  const dragonNext = candidate({
    actor: srdCreatureActor({ id: THIRD_ID, creature: ancientRedDragon }),
    cellX: -1,
    originalAttack
  })
  const farWolf = candidate({
    actor: srdCreatureActor({ id: '00000000-0000-4000-8000-00000000c007', creature: wolf }),
    cellX: 4,
    originalAttack
  })

  function choose(input: {
    candidates: readonly (NativeCleavingCandidate | null)[]
    automationMode?: AutomationModeDto
    rules?: ReturnType<typeof srdOptionalCombat>
    chainStep?: number
    visitedTargetActorIds?: readonly string[]
    damage?: CleavingContext['damage']
    action?: CleavingContext['action']
    optionalCombatSnapshotChecksum?: string | null
    gameSystemId?: string
  }) {
    const rules = input.rules ?? cleavingRules
    return createNativeCleavingChoice({
      automationMode: input.automationMode ?? 'ASSISTED',
      gameSystemId: input.gameSystemId ?? SRD_SYSTEM_ID,
      optionalCombatSnapshot: rules.snapshot,
      optionalCombatSnapshotChecksum:
        input.optionalCombatSnapshotChecksum === undefined
          ? rules.checksum
          : input.optionalCombatSnapshotChecksum,
      parentOccurrenceId: PARENT_OCCURRENCE_ID,
      parentResultChecksum: 'd'.repeat(64),
      sourceActorId: ATTACKER_ID,
      sourceControllerCharacterId: null,
      sourceCurrentness,
      action: input.action ?? greataxe,
      scene,
      initialTargetActorId: FIRST_ID,
      chainStep: input.chainStep ?? 0,
      visitedTargetActorIds: input.visitedTargetActorIds ?? [FIRST_ID],
      originalAttack,
      damage: input.damage ?? cleavingDamageEnvelope(initialHit),
      candidates: input.candidates.flatMap((entry) => (entry ? [entry] : []))
    })
  }

  it('offers only in-reach targets the original attack roll hits, as a sealed child step', () => {
    const snapshot = choose({ candidates: [goblinNext, dragonNext, farWolf] })
    if (!snapshot || !goblinNext) throw new Error('Expected a Cleaving choice for the goblin.')
    const cleaving = cleavingRules.snapshot.definitions[0]!
    const option = {
      targetActorId: SECOND_ID,
      targetTokenId: goblinNext.targetTokenId,
      targetActorVersion: 1,
      targetStateChecksum: goblinNext.targetStateChecksum,
      armorClass: 15,
      footprintChecksum: goblinNext.footprintChecksum
    }
    // The option identity binds the offered target facts to the exact pinned Cleaving policy.
    const optionId = checksumRuleDocument({
      ...option,
      pin: {
        definitionId: cleaving.definitionId,
        definitionVersion: 1,
        definitionChecksum: cleaving.definitionChecksum,
        moduleKey: cleaving.document.module.policyModuleKey,
        moduleContractVersion: cleaving.document.module.contractVersion
      }
    })
    expect(snapshot).toEqual({
      snapshotKind: 'AGGREGATE_CHOICE',
      schemaVersion: 1,
      occurrenceId: cleavingChildOccurrenceIdentity(PARENT_OCCURRENCE_ID, 1),
      optionalCombatSnapshotChecksum: cleavingRules.checksum,
      applicationContext: {
        kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
        schemaVersion: 1,
        parentOccurrenceId: PARENT_OCCURRENCE_ID,
        parentResultChecksum: 'd'.repeat(64),
        sourceActorId: ATTACKER_ID,
        sourceControllerCharacterId: null,
        action: greataxe,
        sourceCurrentness,
        initialTargetActorId: FIRST_ID,
        chainStep: 1,
        optionalCombat: {
          definitionId: cleaving.definitionId,
          definitionVersion: 1,
          definitionChecksum: cleaving.definitionChecksum
        },
        scene,
        originalAttack,
        damage: cleavingDamageEnvelope(initialHit),
        visitedTargetActorIds: [FIRST_ID],
        options: [{ ...option, optionId }]
      }
    })
  })

  it('never picks for the player: every hittable in-reach target is an option in stable order', () => {
    const wolfNext = candidate({
      actor: srdCreatureActor({ id: THIRD_ID, creature: wolf }),
      cellX: -1,
      originalAttack
    })
    const snapshot = choose({ candidates: [wolfNext, goblinNext] })
    if (snapshot?.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
      throw new Error('Expected a Cleaving choice.')
    const options = snapshot.applicationContext.options
    expect(options.map((option) => option.targetActorId).sort()).toEqual([SECOND_ID, THIRD_ID])
    expect(options.map((option) => option.optionId)).toEqual(
      options.map((option) => option.optionId).sort()
    )
    expect(choose({ candidates: [goblinNext, wolfNext] })).toEqual(snapshot)
  })

  it('creates no child when the original roll misses every candidate or none is in reach', () => {
    expect(choose({ candidates: [dragonNext, farWolf] })).toBeNull()
    expect(choose({ candidates: [] })).toBeNull()
  })

  it('creates no child without the Cleaving rule, in a Manual Encounter, or for a non-melee attack', () => {
    expect(choose({ candidates: [goblinNext], rules: srdOptionalCombat([]) })).toBeNull()
    expect(choose({ candidates: [goblinNext], automationMode: 'MANUAL' })).toBeNull()
    expect(
      choose({ candidates: [goblinNext], action: { ...greataxe, attackKind: 'RANGED' } })
    ).toBeNull()
  })

  it('creates no child for a System that provides no optional combat policy', () => {
    expect(
      choose({ candidates: [goblinNext], gameSystemId: '00000000-0000-4000-8000-0000000000ff' })
    ).toBeNull()
  })

  it('fails loudly instead of sealing a choice for a Run without a pinned optional-combat policy', () => {
    expect(() =>
      choose({ candidates: [goblinNext], optionalCombatSnapshotChecksum: null })
    ).toThrow(/pinned optional-combat policy/)
  })

  it('creates no child when no damage is left to carry', () => {
    expect(
      choose({
        candidates: [goblinNext],
        damage: cleavingDamageEnvelope({ ...initialHit, requestedAmount: 7, resolvedAmount: 7 })
      })
    ).toBeNull()
  })

  it('never revisits a target and advances the chain step with the visited list', () => {
    const secondStep = choose({
      candidates: [goblinNext],
      chainStep: 1,
      visitedTargetActorIds: [FIRST_ID, SECOND_ID]
    })
    expect(secondStep).toBeNull()
    const wolfNext = candidate({
      actor: srdCreatureActor({ id: THIRD_ID, creature: wolf }),
      cellX: -1,
      originalAttack
    })
    const next = choose({
      candidates: [goblinNext, wolfNext],
      chainStep: 1,
      visitedTargetActorIds: [FIRST_ID, SECOND_ID]
    })
    if (next?.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
      throw new Error('Expected the wolf as the next Cleaving target.')
    expect(next.occurrenceId).toBe(cleavingChildOccurrenceIdentity(PARENT_OCCURRENCE_ID, 2))
    expect(next.applicationContext.chainStep).toBe(2)
    expect(next.applicationContext.options.map((option) => option.targetActorId)).toEqual([
      THIRD_ID
    ])
  })

  it('bounds the chain: a step that disagrees with its visited list or exceeds the actor limit offers nothing', () => {
    expect(
      choose({
        candidates: [goblinNext],
        chainStep: 0,
        visitedTargetActorIds: [FIRST_ID, THIRD_ID]
      })
    ).toBeNull()
    // The attacker and the initial target use two of the Encounter's actors; every other actor
    // can be visited once, so the chain holds at most MAX_ENCOUNTER_ACTORS - 1 visited targets.
    const visited = (count: number) => [
      FIRST_ID,
      ...Array.from(
        { length: count - 1 },
        (_, index) => `00000000-0000-4000-8000-${(0xf00000000000 + index).toString(16)}`
      )
    ]
    const atLimit = visited(MAX_ENCOUNTER_ACTORS - 1)
    expect(
      choose({
        candidates: [goblinNext],
        chainStep: atLimit.length - 1,
        visitedTargetActorIds: atLimit
      })?.applicationContext
    ).toMatchObject({ chainStep: MAX_ENCOUNTER_ACTORS - 1 })
    const overLimit = visited(MAX_ENCOUNTER_ACTORS)
    expect(
      choose({
        candidates: [goblinNext],
        chainStep: overLimit.length - 1,
        visitedTargetActorIds: overLimit
      })
    ).toBeNull()
  })
})

describe('Cleaving authored definition', () => {
  const { snapshot } = srdOptionalCombat(['CLEAVING'])
  const [authored] = snapshot.definitions

  it('is authored as typed SRD data: melee, undamaged initial target', () => {
    expect(snapshot.definitions).toHaveLength(1)
    expect(authored?.document).toMatchObject({
      kind: 'CLEAVING',
      id: DND5E_CLEAVING_DEFINITION_ID,
      module: { policyModuleKey: DND5E_CLEAVING_OPERATION_KEY },
      parameters: {
        kind: 'CLEAVING',
        qualifyingAttackKind: 'MELEE',
        requiresUndamagedInitialTarget: true
      }
    })
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse(authored?.document)
    ).toEqual(authored?.document)
  })

  it.each([
    ['a non-MELEE attack kind', { qualifyingAttackKind: 'RANGED' }],
    ['an undamaged requirement of false', { requiresUndamagedInitialTarget: false }],
    ['an unknown extra parameter', { reach: 10 }]
  ])('refuses parameters with %s', (_label, override) => {
    const parameters = { ...authored?.document.parameters, ...override }
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...authored?.document,
        parameters
      }).success
    ).toBe(false)
  })
})
