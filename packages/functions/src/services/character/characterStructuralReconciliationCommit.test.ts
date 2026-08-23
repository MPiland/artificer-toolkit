import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findDraft: vi.fn(),
  saveDraft: vi.fn(),
  upsert: vi.fn(),
  findUpdatedAt: vi.fn(),
  deleteBase: vi.fn(),
  deleteOverlay: vi.fn(),
  publishBase: vi.fn(),
  requireCurrent: vi.fn(),
  loadSources: vi.fn(),
  removeSourceLoss: vi.fn(),
  createContext: vi.fn(),
  createExtras: vi.fn(),
  retainSources: vi.fn(),
  compile: vi.fn(),
  resolveBuilder: vi.fn(),
  reconcile: vi.fn(),
  evaluate: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCharacterBuilderDraftRepository: () => ({
    findByCharacter: mocks.findDraft,
    save: mocks.saveDraft
  }),
  createCharacterRepository: () => ({
    upsertAuthored: mocks.upsert,
    findUpdatedAtById: mocks.findUpdatedAt
  }),
  createCampaignCharacterMechanicsProjectionRepository: () => ({
    deleteForDraft: mocks.deleteOverlay
  }),
  createCharacterMechanicsProjectionRepository: () => ({
    deleteForDraft: mocks.deleteBase,
    publish: mocks.publishBase,
    requireCurrent: mocks.requireCurrent
  }),
  createCharacterSheetAdjustmentRepository: () => ({ listByCharacter: vi.fn(async () => []) }),
  createCharacterSheetPlayStateRepository: () => ({ listResourceUsage: vi.fn(async () => []) })
}))
vi.mock('./builderService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./builderService.js')>()),
  resolveCharacterBuilder: mocks.resolveBuilder
}))
vi.mock('./builderReconciliation.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./builderReconciliation.js')>()),
  reconcileCharacterBuilderCharacter: mocks.reconcile
}))
vi.mock('./characterRuleEvaluation.js', () => ({ evaluateCharacterRulePolicy: mocks.evaluate }))
vi.mock('./characterCommittedSheetSources.js', () => ({
  createCharacterCommittedSheetReconciliationContext: mocks.createContext,
  createCharacterCommittedSheetExtras: mocks.createExtras,
  loadCharacterCommittedSheetSources: mocks.loadSources,
  removeCharacterCommittedSheetSourceLoss: mocks.removeSourceLoss,
  retainCharacterCommittedSheetRuleSources: mocks.retainSources
}))
vi.mock('./characterMechanicsCompiler.js', () => ({
  compileCharacterMechanicsProjection: mocks.compile
}))

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const { commitCharacterDraftOnlySourceLoss, commitCharacterStructuralReconciliation } =
  await import('./characterStructuralReconciliationCommit.js')

const ids = {
  character: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-4000-8000-000000000003',
  race: '00000000-0000-4000-8000-000000000004'
}

const oldPin = {
  subjectKind: 'RACE' as const,
  subjectId: ids.race,
  versionId: '00000000-0000-4000-8000-000000000005',
  version: 1,
  checksum: 'a'.repeat(64)
}
const exactSources = {
  mechanics: { authoredVersionVector: [oldPin], characterId: ids.character },
  recordsByRoot: new Map(),
  vocabularySnapshot: { snapshotId: 'vocabulary', snapshotVersion: 1, checksum: 'b'.repeat(64) }
}

function snapshot() {
  const value = createEmptyCharacterAuthored({
    id: ids.character,
    userId: ids.user,
    systemId: ids.system
  })
  value.status = 'ACTIVE'
  value.intent.race.raceId = ids.race
  value.state.hitpoints.current = 8
  return value
}

describe('Character structural reconciliation commit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findDraft.mockResolvedValue(null)
    mocks.findUpdatedAt.mockResolvedValue('2026-08-22T00:00:00.000Z')
    mocks.requireCurrent.mockResolvedValue({ authoredVersionVector: [oldPin] })
    mocks.loadSources.mockResolvedValue(exactSources)
    mocks.removeSourceLoss.mockReturnValue({ kind: 'EXACT', sources: exactSources })
    mocks.createContext.mockResolvedValue({})
    mocks.createExtras.mockReturnValue({ creaturesById: new Map(), vehiclesById: new Map() })
    mocks.retainSources.mockReturnValue(exactSources)
    mocks.compile.mockReturnValue({ projectionChecksum: 'compiled' })
    mocks.upsert.mockResolvedValue(5)
    mocks.publishBase.mockResolvedValue({ projectionChecksum: 'compiled' })
    mocks.evaluate.mockResolvedValue({
      binding: { revisionId: 'revision-1' },
      output: { derivedStats: { maxHitPoints: { effective: 8 } } },
      registry: {},
      facts: {},
      snapshot: {}
    })
  })

  it('persists pruned canonical DRAFT state and deletes both mechanics lanes', async () => {
    mocks.resolveBuilder.mockResolvedValue({ readiness: { ready: false } })
    const source = snapshot()
    mocks.reconcile.mockResolvedValue({
      ...source,
      intent: { ...source.intent, race: { raceId: '' } }
    })

    const result = await commitCharacterStructuralReconciliation({
      db: {} as DBLike,
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 4,
      snapshot: source,
      sourceLossTargets: [{ subjectKind: 'RACE', subjectId: ids.race }]
    })

    expect(result).toMatchObject({ kind: 'DRAFT', streamVersion: 5 })
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DRAFT',
        intent: expect.objectContaining({ race: { raceId: '' } })
      }),
      {
        expectedStreamVersion: 4,
        incrementStreamVersion: true,
        rulePackRevisionId: 'revision-1'
      }
    )
    expect(mocks.deleteBase).toHaveBeenCalledWith({
      characterId: ids.character,
      expectedCharacterStreamVersion: 5
    })
    expect(mocks.deleteOverlay).toHaveBeenCalledWith({
      characterId: ids.character,
      expectedCharacterStreamVersion: 5
    })
    expect(mocks.saveDraft).toHaveBeenCalledOnce()
  })

  it('republishes from the remaining exact pins when the pruned Character remains ready', async () => {
    mocks.resolveBuilder.mockResolvedValue({ readiness: { ready: true } })
    const source = snapshot()
    mocks.reconcile.mockResolvedValue(source)

    const result = await commitCharacterStructuralReconciliation({
      db: {} as DBLike,
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 4,
      snapshot: source,
      sourceLossTargets: [{ subjectKind: 'SPELL', subjectId: ids.race }]
    })

    expect(result).toMatchObject({ kind: 'ACTIVE', streamVersion: 5 })
    expect(mocks.retainSources).toHaveBeenCalledWith(
      expect.objectContaining({ sources: exactSources, rulePolicyOutput: expect.any(Object) })
    )
    expect(mocks.compile).toHaveBeenCalledWith(
      expect.objectContaining({ authoredVersionVector: [oldPin] })
    )
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
      expect.objectContaining({ expectedStreamVersion: 4, incrementStreamVersion: true })
    )
    expect(mocks.publishBase).toHaveBeenCalledOnce()
    expect(mocks.deleteBase).not.toHaveBeenCalled()
  })

  it('demotes when a removed source is a required transitive exact dependency', async () => {
    const source = snapshot()
    mocks.removeSourceLoss.mockReturnValue({
      kind: 'TRANSITIVE_DEPENDENCY_LOST',
      dependency: oldPin,
      requiredBy: { ...oldPin, subjectKind: 'CLASS', subjectId: 'class-1' }
    })

    const result = await commitCharacterStructuralReconciliation({
      db: {} as DBLike,
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 4,
      snapshot: source,
      sourceLossTargets: [{ subjectKind: 'RACE', subjectId: ids.race }]
    })

    expect(result).toMatchObject({ kind: 'DRAFT', streamVersion: 5 })
    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.evaluate).not.toHaveBeenCalled()
    expect(mocks.publishBase).not.toHaveBeenCalled()
    expect(mocks.deleteBase).toHaveBeenCalledOnce()
    expect(mocks.deleteOverlay).toHaveBeenCalledOnce()
  })

  it('prunes and preserves an existing unsaved draft without changing canonical state', async () => {
    const draftCharacter = snapshot()
    draftCharacter.label = 'Unsaved changes'
    mocks.findDraft.mockResolvedValue({
      id: 'draft-1',
      characterId: ids.character,
      userId: ids.user,
      systemId: ids.system,
      label: draftCharacter.label,
      status: 'DRAFT',
      mode: 'edit',
      payload: { character: draftCharacter },
      draftState: 'ACTIVE_WITH_DRAFT',
      baseActiveUpdatedAt: '2026-08-21T00:00:00.000Z',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    })

    await commitCharacterDraftOnlySourceLoss({
      db: {} as DBLike,
      characterId: ids.character,
      userId: ids.user,
      sourceLossTargets: [{ subjectKind: 'RACE', subjectId: ids.race }]
    })

    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Unsaved changes',
        payload: expect.objectContaining({
          character: expect.objectContaining({
            label: 'Unsaved changes',
            intent: expect.objectContaining({ race: { raceId: '' } })
          })
        }),
        baseActiveUpdatedAt: '2026-08-21T00:00:00.000Z'
      })
    )
  })
})
