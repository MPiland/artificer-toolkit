import { describe, expect, it } from 'vitest'

import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CombatPerceptionEnvironment } from '@artificer-toolkit/shared/rules'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import { resolveEncounterCombatPerception } from '../encounterCombatPerception.js'
import {
  deriveCombatPerceptionContributionPartitions,
  deriveConditionCombatPerceptionContributions,
  type LockedCombatPerceptionEffect
} from '../encounterCombatPerceptionContributions.js'

const OBSERVER_ID = '00000000-0000-4000-8000-00000000e001'
const SENSE_ID = '00000000-0000-4000-8000-00000000e002'
const GAME_SYSTEM_ID = '00000000-0000-4000-8000-00000000e003'
const EFFECT_ID = '00000000-0000-4000-8000-00000000e004'
const CONDITION_ID = '00000000-0000-4000-8000-00000000e005'
const GRANT_ID = '00000000-0000-4000-8000-00000000e006'
const SUPPRESS_ID = '00000000-0000-4000-8000-00000000e007'

const square = {
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  cellSize: 100,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL'
} as const
const feetGrid: SceneGrid = { ...square, unit: 'FEET' }
const squaresGrid: SceneGrid = { ...square, distancePerCell: 1, unit: 'SQUARES' }

const senseDocument: PinnedSenseDefinition['document'] = {
  schemaVersion: 1,
  kind: 'SENSE',
  id: SENSE_ID,
  gameSystemId: GAME_SYSTEM_ID,
  capabilities: [
    {
      channel: 'AUDITORY',
      accessGrade: 'PRECISE',
      satisfies: ['DETECT', 'LOCATE', 'PRECISE'],
      illuminationAccess: 'IGNORE',
      obscurementAccess: 'IGNORE',
      perceivesInvisible: false,
      physicalConstraints: []
    }
  ]
}
const definitionChecksum = checksumRuleDocument(senseDocument)

const environment: CombatPerceptionEnvironment = {
  distance: 30,
  lineOfEffect: true,
  sharedSurface: true,
  illumination: 'BRIGHT',
  obscurement: 'NONE',
  invisibleChannels: [],
  suppressedChannels: []
}

const pinnedRange: PinnedSenseDefinition['range'] = {
  id: 'pinned-range',
  rangeKind: 'DISTANCE',
  amount: 60,
  unit: 'FEET',
  calculation: { base: 60, effective: 60, contributions: [], override: null }
}

const unlimitedPinnedRange: PinnedSenseDefinition['range'] = {
  id: 'pinned-range',
  rangeKind: 'UNLIMITED'
}

type GrantRange =
  | { rangeKind: 'DISTANCE'; amount: number; unit: 'FEET' }
  | { rangeKind: 'UNLIMITED' }
const ranged: GrantRange = { rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }
const unlimitedGrant: GrantRange = { rangeKind: 'UNLIMITED' }

function pinnedCapabilitiesOn(grid: SceneGrid, range: PinnedSenseDefinition['range']) {
  return resolveEncounterCombatPerception({
    requirement: 'DETECT',
    observerActorId: OBSERVER_ID,
    sceneGrid: grid,
    pinnedSenseDefinitions: [
      {
        senseDefinitionId: SENSE_ID,
        definitionVersion: 1,
        definitionContractVersion: 1,
        definitionChecksum,
        document: senseDocument,
        range
      }
    ],
    observerEffects: [],
    subjectEffects: [],
    localAreaEffects: [],
    environment
  }).finalCapabilities
}

function perceptionContributions(
  range: GrantRange
): NonNullable<LockedCombatPerceptionEffect['definition']['perceptionContributions']> {
  return [
    {
      id: GRANT_ID,
      order: 0,
      kind: 'SENSE_GRANT',
      senseDefinitionId: SENSE_ID,
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum,
      document: senseDocument,
      range
    },
    {
      id: SUPPRESS_ID,
      order: 1,
      kind: 'SENSE_SUPPRESS',
      senseDefinitionIds: [SENSE_ID],
      channels: []
    }
  ]
}

function observerContributionsOn(grid: SceneGrid, range: GrantRange) {
  const effects: readonly LockedCombatPerceptionEffect[] = [
    {
      id: EFFECT_ID,
      version: 1,
      createdOrdinal: 1,
      definitionChecksum: 'a'.repeat(64),
      definition: { perceptionContributions: perceptionContributions(range) }
    }
  ]
  return deriveCombatPerceptionContributionPartitions({
    sceneGrid: grid,
    observerEffects: effects,
    subjectEffects: [],
    localAreaEffects: []
  }).observerContributions
}

function conditionContributionsOn(grid: SceneGrid, range: GrantRange) {
  const conditionDefinitions = [
    {
      conditionDefinitionId: CONDITION_ID,
      definitionVersion: 1,
      definitionChecksum: 'b'.repeat(64),
      document: { perceptionContributions: perceptionContributions(range) }
    }
  ] as unknown as readonly PinnedConditionRuleStateDefinitionDto[]
  return deriveConditionCombatPerceptionContributions({
    conditionDefinitions,
    relation: 'OBSERVER',
    sceneGrid: grid
  })
}

const kinds = (sources: readonly { contribution: { kind: string } }[]) =>
  sources.map(({ contribution }) => contribution.kind)

describe('Combat perception on a SQUARES Scene', () => {
  it('keeps a ranged pinned sense at its range on a calibrated Scene', () => {
    expect(pinnedCapabilitiesOn(feetGrid, pinnedRange).map(({ range }) => range)).toEqual([
      { rangeKind: 'DISTANCE', amount: 60 }
    ])
  })

  it('measures a 60-foot pinned sense as 12 squares, never unlimited', () => {
    expect(pinnedCapabilitiesOn(squaresGrid, pinnedRange).map(({ range }) => range)).toEqual([
      { rangeKind: 'DISTANCE', amount: 12 }
    ])
  })

  it('keeps an unlimited pinned sense unlimited', () => {
    expect(
      pinnedCapabilitiesOn(squaresGrid, unlimitedPinnedRange).map(({ range }) => range)
    ).toEqual([{ rangeKind: 'UNLIMITED' }])
  })

  it('measures a 60-foot SENSE_GRANT effect contribution as 12 squares', () => {
    expect(kinds(observerContributionsOn(feetGrid, ranged))).toEqual([
      'SENSE_GRANT',
      'SENSE_SUPPRESS'
    ])
    const measured = observerContributionsOn(squaresGrid, ranged)
    expect(kinds(measured)).toEqual(['SENSE_GRANT', 'SENSE_SUPPRESS'])
    expect(measured[0]?.contribution).toMatchObject({
      range: { rangeKind: 'DISTANCE', amount: 12 }
    })
    const unlimited = observerContributionsOn(squaresGrid, unlimitedGrant)
    expect(kinds(unlimited)).toEqual(['SENSE_GRANT', 'SENSE_SUPPRESS'])
    expect(unlimited[0]?.contribution).toMatchObject({ range: { rangeKind: 'UNLIMITED' } })
  })

  it('measures a 60-foot SENSE_GRANT condition contribution as 12 squares', () => {
    expect(kinds(conditionContributionsOn(feetGrid, ranged))).toEqual([
      'SENSE_GRANT',
      'SENSE_SUPPRESS'
    ])
    const measured = conditionContributionsOn(squaresGrid, ranged)
    expect(kinds(measured)).toEqual(['SENSE_GRANT', 'SENSE_SUPPRESS'])
    expect(measured[0]?.contribution).toMatchObject({
      range: { rangeKind: 'DISTANCE', amount: 12 }
    })
    const unlimited = conditionContributionsOn(squaresGrid, unlimitedGrant)
    expect(kinds(unlimited)).toEqual(['SENSE_GRANT', 'SENSE_SUPPRESS'])
    expect(unlimited[0]?.contribution).toMatchObject({ range: { rangeKind: 'UNLIMITED' } })
  })
})
