import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  discover: vi.fn(),
  evaluate: vi.fn(),
  organize: vi.fn(),
  resolveStates: vi.fn(),
  sealTimeline: vi.fn()
}))

vi.mock('./encounterMovementReactionContacts.js', () => ({
  collectEncounterMovementReactionContacts: mocks.collect
}))
vi.mock('./encounterMovementReactionDecision.js', () => ({
  organizeEncounterMovementReactionDecisions: mocks.organize,
  sealEncounterMovementReactionTimeline: mocks.sealTimeline
}))
vi.mock('./encounterMovementReactionEvaluation.js', () => ({
  evaluateEncounterMovementReactionContacts: mocks.evaluate
}))
vi.mock('./encounterMovementReactionRuleState.js', () => ({
  resolveEncounterMovementReactionRuleStates: mocks.resolveStates
}))
vi.mock('./encounterMovementReactionSources.js', () => ({
  discoverEncounterMovementReactionSources: mocks.discover
}))

const { discoverEncounterMovementReactionChoices } =
  await import('./encounterMovementReactionDiscovery.js')

function input(
  runtime: object | undefined,
  automationMode: 'AUTOMATIC' | 'ASSISTED' = 'AUTOMATIC'
) {
  return {
    encounter: {
      id: '00000000-0000-4000-8000-000000000001',
      gameSystemId: '00000000-0000-4000-8000-000000000002',
      actors: []
    },
    automationMode,
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    movementKind: 'VOLUNTARY',
    movingTokenId: 'mover',
    occurrenceId: '00000000-0000-4000-8000-000000000003',
    path: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ],
    actorIdByTokenId: new Map(),
    tokens: [],
    lockedCharacters: new Map(),
    encounterFeatureCapabilities: [],
    definitions: { requireCurrent: vi.fn() },
    runtime,
    lockRelationship: vi.fn(),
    resolvePerception: vi.fn()
  } as never
}

describe('fresh Encounter movement reaction discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.discover.mockReturnValue([{ id: 'source' }])
    mocks.collect.mockReturnValue([{ candidate: { pathDistance: 4 } }])
    mocks.resolveStates.mockResolvedValue(new Map())
    mocks.evaluate.mockResolvedValue([{ candidate: { pathDistance: 4 } }])
    mocks.organize.mockReturnValue({
      automatic: [],
      choiceGroups: [{ pathDistance: 4 }]
    })
    mocks.sealTimeline.mockReturnValue([
      { kind: 'CONTROLLER_CHOICE', group: { pathDistance: 4, options: [{}] } }
    ])
  })

  it('freezes the first eligible boundary only after locked state and System evaluation', async () => {
    const result = await discoverEncounterMovementReactionChoices(input({}))

    expect(result).toEqual({
      reactionTimeline: [{ kind: 'CONTROLLER_CHOICE', group: { pathDistance: 4, options: [{}] } }],
      firstBoundaryDistance: 4
    })
    expect(mocks.resolveStates).toHaveBeenCalledOnce()
    expect(mocks.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        contacts: [{ candidate: { pathDistance: 4 } }]
      })
    )
    expect(mocks.organize).toHaveBeenCalledWith([{ candidate: { pathDistance: 4 } }], 'AUTOMATIC')
    expect(mocks.sealTimeline).toHaveBeenCalledWith({
      automatic: [],
      choiceGroups: [{ pathDistance: 4 }]
    })
  })

  it('keeps an ordinary move runtime-free when no reaction contact exists', async () => {
    mocks.collect.mockReturnValueOnce([])

    await expect(discoverEncounterMovementReactionChoices(input(undefined))).resolves.toEqual({
      reactionTimeline: [],
      firstBoundaryDistance: null
    })
    expect(mocks.resolveStates).not.toHaveBeenCalled()
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })

  it('fails before rule-state evaluation when a contact has no runtime', async () => {
    await expect(discoverEncounterMovementReactionChoices(input(undefined))).rejects.toThrow(
      'requires the rules runtime'
    )
    expect(mocks.resolveStates).not.toHaveBeenCalled()
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })
})
