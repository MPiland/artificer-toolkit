import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareAttackTargetGrantTriggers } from '../encounterAttackAppliedEffects.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  srdCreatureActor,
  srdEncounterState,
  srdOptionalCombat,
  TIMESTAMP,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const ATTACKER_ID = testUuid(0x13b1)
const OTHER_ATTACKER_ID = testUuid(0x13b2)
const HOLDER_ID = testUuid(0x13b3)
const OTHER_HOLDER_ID = testUuid(0x13b4)
const COMMAND_ID = testUuid(0x13c1)
const MELEE = { melee: true }
const RANGED = { melee: false }

const goblin = srdByLabel(SRD.creatures, 'Goblin')
const actor = (id: string) => srdCreatureActor({ id, creature: goblin })

type Rules = ReturnType<typeof srdOptionalCombat>

/** The SRD Marking rule with its parameters changed, as a homebrew copy of it would author them. */
function homebrewMarking(
  change: (
    parameters: Extract<
      Rules['snapshot']['definitions'][number]['document']['parameters'],
      { kind: 'MARK' }
    >
  ) => object
): Rules {
  const { snapshot } = srdOptionalCombat(['MARK'])
  const definitions = snapshot.definitions.map((definition) => {
    if (definition.document.parameters.kind !== 'MARK') return definition
    const document = {
      ...definition.document,
      parameters: change(definition.document.parameters)
    } as typeof definition.document
    return { ...definition, document, definitionChecksum: checksumRuleDocument(document) }
  })
  const homebrew = encounterOptionalCombatSnapshotDtoSchema.parse({ ...snapshot, definitions })
  return { snapshot: homebrew, checksum: checksumRuleDocument(homebrew) }
}

function triggers(input: {
  rules?: Rules
  attackerId?: string
  holderId?: string
  occurrence?: number
  currentActorId?: string
  activeEffectsByActorId?: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}) {
  const attacker = actor(input.attackerId ?? ATTACKER_ID)
  const holder = actor(input.holderId ?? HOLDER_ID)
  const rules = input.rules ?? srdOptionalCombat(['MARK'])
  const encounter = {
    ...srdEncounterState({
      actors: [attacker, holder],
      currentActorId: input.currentActorId ?? attacker.id
    }),
    optionalCombatSnapshot: rules.snapshot,
    optionalCombatSnapshotChecksum: rules.checksum
  }
  const activeEffectsByActorId = input.activeEffectsByActorId ?? new Map()
  return prepareAttackTargetGrantTriggers({
    encounter,
    attacker,
    holder,
    held: activeEffectsByActorId.get(holder.id) ?? [],
    occurrenceId: testUuid(0x13d0 + (input.occurrence ?? 0)),
    commandId: COMMAND_ID,
    activeEffectsByActorId
  })
}

function attack(
  grantTriggers: ReturnType<typeof triggers>,
  attackKind: { melee: boolean } | null,
  held: readonly ActiveRuleEffectRecord[] = [],
  holderActorId = HOLDER_ID
) {
  return targetEndedEffects({
    holderActorId,
    held,
    attack: attackKind,
    testEvidence: [],
    turnActorId: ATTACKER_ID,
    applications: [],
    damagerActorId: ATTACKER_ID,
    dispositions: new Map(),
    grantTriggers
  })
}

/** The record a met grant becomes on its holder. */
function held(
  trigger: ReturnType<typeof triggers>[number],
  holder: EncounterRunActorState['id'] = HOLDER_ID
): ActiveRuleEffectRecord {
  return prepareActiveRuleEffectRecord({
    id: trigger.id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: holder },
    definition: trigger.effect.definition,
    lifecycle: trigger.effect.lifecycle,
    currentEffects: [],
    occurredAt: TIMESTAMP
  })
}

describe('the mark an attack gives its target (ATTACK-13.T1)', () => {
  it('marks the target of a melee attack, and not of a ranged attack or no attack', () => {
    const marks = triggers({})
    expect(marks).toHaveLength(1)
    expect(attack(marks, MELEE).grants.map(({ id }) => id)).toEqual([marks[0]!.id])
    expect(attack(marks, RANGED).grants).toEqual([])
    expect(attack(marks, null).grants).toEqual([])
  })

  it('marks nothing while Marking is off', () => {
    expect(triggers({ rules: srdOptionalCombat([]) })).toEqual([])
  })

  it('stores one mark per attacker, met only by the attacker', () => {
    const { definition } = triggers({})[0]!.effect
    expect(definition.exclusivity).toBe('PER_SOURCE')
    expect(definition.recurrence).toMatchObject({ fromSourceOnly: true })
  })

  it('lasts through the attacker’s next turn when made on the attacker’s turn', () => {
    const onAttackerTurn = triggers({})[0]!.effect.lifecycle.remainingTicks
    const onAnotherTurn = triggers({ currentActorId: HOLDER_ID })[0]!.effect.lifecycle
      .remainingTicks
    // The attacker's current turn ends one tick; the mark is gone only once its next turn ends.
    expect(onAttackerTurn).toBe(onAnotherTurn + 1)
  })

  it('moves the attacker’s one mark from its earlier target to the new one', () => {
    const earlier = held(triggers({ holderId: OTHER_HOLDER_ID })[0]!, OTHER_HOLDER_ID)
    const othersMark = held(
      triggers({ attackerId: OTHER_ATTACKER_ID, holderId: OTHER_HOLDER_ID })[0]!,
      OTHER_HOLDER_ID
    )
    const marks = triggers({
      occurrence: 1,
      activeEffectsByActorId: new Map([[OTHER_HOLDER_ID, [earlier, othersMark]]])
    })
    const result = attack(marks, MELEE)
    expect(result.grants.map(({ id }) => id)).toEqual([marks[0]!.id])
    expect(result.replacedEffects).toEqual([earlier])
  })

  it('replaces the attacker’s earlier mark on the same target, and keeps another attacker’s', () => {
    const earlier = held(triggers({})[0]!)
    const othersMark = held(triggers({ attackerId: OTHER_ATTACKER_ID })[0]!)
    const marks = triggers({
      occurrence: 1,
      activeEffectsByActorId: new Map([[HOLDER_ID, [earlier, othersMark]]])
    })
    const result = attack(marks, MELEE, [earlier, othersMark])
    expect(result.endedEffects).toEqual([earlier])
    expect(result.replacedEffects).toEqual([])
    expect(result.grants.map(({ id }) => id)).toEqual([marks[0]!.id])
  })

  // Parity: a homebrew copy authors a mark from any attack that the holder keeps through its own
  // turn, with no Marking-specific code on the path.
  it('applies a homebrew mark from any attack, anchored as its author chose', () => {
    const rules = homebrewMarking((parameters) => ({
      ...parameters,
      qualifyingAttackKind: 'ANY',
      effect: {
        ...parameters.effect,
        paths: parameters.effect.paths.map((path) => ({
          ...path,
          resultBlock: {
            ...path.resultBlock,
            lifecycle: {
              ...path.resultBlock.lifecycle,
              turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }
            }
          }
        }))
      }
    }))
    const marks = triggers({ rules })
    expect(attack(marks, RANGED).grants.map(({ id }) => id)).toEqual([marks[0]!.id])
    expect(marks[0]!.effect.definition.recurrence.expiration).toMatchObject({ anchor: 'HOLDER' })
  })
})
