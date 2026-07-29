import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import type { EngineCharacterOutput } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  deleteDraft: vi.fn(),
  ensureRouteIdentity: vi.fn(),
  findBuilderDraft: vi.fn(),
  findCharacter: vi.fn(),
  findUpdatedAtForUpdate: vi.fn(),
  listAdjustments: vi.fn(),
  loadBuilderContext: vi.fn(),
  reconcileCharacter: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveEngine: vi.fn(),
  upsertCharacter: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredRouteIdRepository: () => ({
      ensure: mocks.ensureRouteIdentity
    }),
    createCharacterBuilderDraftRepository: () => ({
      delete: mocks.deleteDraft,
      findByCharacter: mocks.findBuilderDraft
    }),
    createCharacterRepository: () => ({
      findAuthoredById: mocks.findCharacter,
      findUpdatedAtByIdForUpdate: mocks.findUpdatedAtForUpdate,
      upsertAuthored: mocks.upsertCharacter
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      listByCharacter: mocks.listAdjustments
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    createCharacterBuilderChangePreview: () => ({
      predictedStatus: 'ACTIVE',
      downgradesStatus: false,
      removedAncestrySelections: [],
      removedFeatureAcquisitions: [],
      removedSpellSelections: [],
      removedResourceGrants: [],
      clearedStartingEquipmentSources: [],
      summaryLines: [],
      destructive: false
    }),
    loadCharacterBuilderContext: mocks.loadBuilderContext,
    reconcileCharacterBuilderCharacter: mocks.reconcileCharacter,
    resolveCharacterBuilder: mocks.resolveBuilder
  }
})

vi.mock('./sheetService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetService.js')>()
  return {
    ...actual,
    resolveCharacterSheetEngine: mocks.resolveEngine
  }
})

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const { upsertCharacterBuilderForUser } = await import('./characterApplicationService.js')

const resolution: CharacterBuilderResolution = {
  mode: 'edit',
  catalog: {
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    feats: [],
    spells: []
  },
  registry: {
    system: null,
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    features: []
  },
  summary: {
    totalLevel: 0,
    abilities: {},
    classes: []
  },
  grants: {
    features: [],
    resources: [],
    spellcasting: []
  },
  chosenGrantChoices: [],
  outstandingChoices: [],
  validations: [],
  readiness: {
    ready: true,
    blockingIssues: [],
    outstandingRequiredChoices: []
  },
  recommendedSectionId: 'REVIEW'
}

function createActiveCharacter(currentHitPoints: number): CharacterAuthored {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.label = 'Aria'
  character.status = 'ACTIVE'
  character.state.hitpoints.current = currentHitPoints
  character.state.hitpoints.temp = 3
  return character
}

async function finalizeWithMaximum(
  currentHitPoints: number,
  effectiveMaxHitPoints: number
): Promise<CharacterAuthored> {
  const existing = createActiveCharacter(currentHitPoints)
  let persisted: CharacterAuthored | null = null
  const upsertCallIndex = mocks.upsertCharacter.mock.calls.length

  mocks.findCharacter.mockResolvedValueOnce(existing).mockImplementation(async () => persisted)
  mocks.upsertCharacter.mockImplementation(async (character: CharacterAuthored) => {
    persisted = structuredClone(character)
  })
  mocks.resolveEngine.mockReturnValue({
    derivedStats: { maxHitPoints: effectiveMaxHitPoints }
  } as unknown as EngineCharacterOutput)

  await upsertCharacterBuilderForUser(
    {} as DBLike,
    {
      character: structuredClone(existing),
      mode: 'edit',
      targetStatus: 'ACTIVE'
    },
    'user-1'
  )

  expect(mocks.upsertCharacter).toHaveBeenCalledTimes(upsertCallIndex + 1)
  return mocks.upsertCharacter.mock.calls[upsertCallIndex]![0] as CharacterAuthored
}

describe('Builder hit point reconciliation', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()

    mocks.deleteDraft.mockResolvedValue(undefined)
    mocks.ensureRouteIdentity.mockResolvedValue({ publicId: 'aria' })
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.findUpdatedAtForUpdate.mockResolvedValue('2026-07-28T00:00:00.000Z')
    mocks.listAdjustments.mockResolvedValue([])
    mocks.loadBuilderContext.mockResolvedValue({})
    mocks.reconcileCharacter.mockImplementation(async (_db: DBLike, character: CharacterAuthored) =>
      structuredClone(character)
    )
    mocks.resolveBuilder.mockResolvedValue(resolution)
  })

  it('clamps live current hit points when a Builder change lowers the effective maximum', async () => {
    const persisted = await finalizeWithMaximum(9, 5)

    expect(persisted.state.hitpoints.current).toBe(5)
    expect(persisted.state.hitpoints.temp).toBe(3)
  })

  it('preserves live current hit points when the effective maximum is unchanged or higher', async () => {
    await expect(finalizeWithMaximum(9, 9)).resolves.toMatchObject({
      state: { hitpoints: { current: 9 } }
    })
    await expect(finalizeWithMaximum(9, 14)).resolves.toMatchObject({
      state: { hitpoints: { current: 9 } }
    })
  })

  it('floors a negative effective maximum at zero before clamping current hit points', async () => {
    const persisted = await finalizeWithMaximum(9, -4)

    expect(persisted.state.hitpoints.current).toBe(0)
  })
})
