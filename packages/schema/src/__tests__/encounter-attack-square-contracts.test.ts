import { describe, expect, it } from 'vitest'

import {
  resolveEncounterActionTargetDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from '../api/encounterRuleCommands.js'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { encounterAttackActionTransitionDtoSchema } from '../projections/encounterAttackAction.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

const id = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const checksum = 'a'.repeat(64)

describe('an attack aimed at a square (ATTACK-17.T4)', () => {
  const target = {
    kind: 'SQUARE',
    sceneId: id(1),
    expectedSceneVersion: 2,
    point: { x: 350, y: 150 }
  }

  it('is a RESOLVE_ACTION target with a Scene and a point, and nothing else', () => {
    expect(resolveEncounterActionTargetDtoSchema.safeParse(target).success).toBe(true)
    expect(
      resolveEncounterActionTargetDtoSchema.safeParse({ ...target, point: null }).success
    ).toBe(false)
    expect(
      resolveEncounterActionTargetDtoSchema.safeParse({ ...target, actorId: id(3) }).success
    ).toBe(false)
  })

  describe('the GM ruling', () => {
    const ruling = (resolution: unknown) =>
      resolveRuleOccurrenceInputDtoSchema.safeParse({
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: id(9),
        encounterId: id(8),
        expectedVersion: 4,
        occurrenceId: id(7),
        expectedOccurrenceVersion: 0,
        resolution
      }).success

    it('names the creature that stands on the square', () => {
      expect(ruling({ kind: 'ATTACK_SQUARE_OCCUPANT', actorId: id(5) })).toBe(true)
      expect(ruling({ kind: 'ATTACK_SQUARE_OCCUPANT' })).toBe(false)
      expect(ruling({ kind: 'ATTACK_SQUARE_OCCUPANT', actorId: id(5), extra: 1 })).toBe(false)
    })

    it('rules the square empty, with nothing else', () => {
      expect(ruling({ kind: 'ATTACK_SQUARE_EMPTY' })).toBe(true)
      expect(ruling({ kind: 'ATTACK_SQUARE_EMPTY', actorId: id(5) })).toBe(false)
    })
  })

  describe('the pending decision the GM sees', () => {
    const pending = (candidateActorIds: string[]) =>
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        kind: 'ATTACK_SQUARE_RESOLUTION',
        occurrenceId: id(7),
        occurrenceVersion: 0,
        encounterVersion: 4,
        attackerActorId: id(1),
        candidateActorIds,
        allowedResponses: ['ATTACK_SQUARE_OCCUPANT', 'ATTACK_SQUARE_EMPTY']
      }).success

    it('lists none to a full Encounter of candidates', () => {
      expect(pending([id(2)])).toBe(true)
      expect(pending([])).toBe(true)
      expect(
        pending(Array.from({ length: MAX_ENCOUNTER_ACTORS + 1 }, (_, index) => id(index + 2)))
      ).toBe(false)
    })
  })

  describe('the sealed snapshot', () => {
    const snapshot = (candidates: { actorId: string; tokenId: string }[]) =>
      serverRuleExecutionPendingSnapshotDtoSchema.safeParse({
        snapshotKind: 'AGGREGATE_CHOICE',
        schemaVersion: 1,
        occurrenceId: id(7),
        optionalCombatSnapshotChecksum: null,
        applicationContext: {
          kind: 'ENCOUNTER_ATTACK_SQUARE',
          schemaVersion: 1,
          commandJson: '{}',
          commandFingerprint: checksum,
          initiatorUserId: id(6),
          attackerActorId: id(1),
          scene: { sceneId: id(10), sceneVersion: 2 },
          sourceTokenId: id(11),
          candidates
        }
      }).success

    it('keeps the creatures found on the square, none when the square is empty', () => {
      expect(snapshot([{ actorId: id(2), tokenId: id(12) }])).toBe(true)
      expect(snapshot([])).toBe(true)
    })
  })
})

describe('the Attack action an empty-square attack opens (ATTACK-17.4)', () => {
  it('records an attack with no creature as its target', () => {
    const transition = (targetIds: string[]) =>
      encounterAttackActionTransitionDtoSchema.safeParse({
        before: null,
        after: {
          kind: 'ATTACK_ACTION',
          turnSequence: 1,
          total: 1,
          attacks: [{ actionId: 'bite', targetIds }]
        }
      }).success
    expect(transition([])).toBe(true)
    expect(transition([id(2)])).toBe(true)
  })
})
