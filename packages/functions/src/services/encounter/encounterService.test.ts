import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checksumCanonicalJson,
  srdBaselineContent,
  type DBLike,
  type EncounterRecord
} from '@artificer-toolkit/db'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/api/encounters'
import type { InitiativeDeclarationAdjudicationFieldDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  checksumRuleDocument,
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph
} from '@artificer-toolkit/shared/rules'
import { createCreature } from '../character/sheetTestFixtures.js'
import { createRuleExecutionCommandFingerprint } from '../rules/ruleExecutionOccurrenceService.js'
import {
  createEncounterInitiativeDeclarationPendingSnapshot,
  createEncounterInitiativePendingSnapshot
} from './encounterInitiativeOccurrence.js'
import { createEncounterActionStartIntent } from './encounterActionSceneContext.js'
import { createEncounterMovementPassageChoice } from './encounterMovementPassageChoice.js'
import { projectGm } from './encounterProjection.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  createDnd5eOptionalCombatContestGraph,
  dnd5eOptionalCombatContestCapabilityContribution,
  DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
  DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY
} from '../rules/systems/dnd5e/optionalCombatContestGraph.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  creature: '00000000-0000-4000-8000-000000000003',
  system: DND5E_SYSTEM_ID,
  template: '00000000-0000-4000-8000-000000000005',
  command: '00000000-0000-4000-8000-000000000006',
  updateCommand: '00000000-0000-4000-8000-000000000007',
  otherSystem: '00000000-0000-4000-8000-000000000008'
}

function stagedInitiativeRound(input: {
  round: number
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND'
  checksum: string
  active?: boolean
}) {
  return {
    round: {
      encounterId: ids.command,
      round: input.round,
      procedure: 'ACTOR_ROLL' as const,
      cadence: input.cadence,
      status: 'PREPARING' as const,
      policySnapshotChecksum: input.checksum,
      nextTurnOrderOrdinal: 0,
      version: 0
    },
    participants: [
      {
        encounterId: ids.command,
        round: input.round,
        actorId: ids.creature,
        sideId: ids.campaign,
        status: input.active ? ('ACTIVE' as const) : ('UNRESOLVED' as const),
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: null,
        version: 0
      }
    ],
    sides: []
  }
}

const mocks = vi.hoisted(() => ({
  db: {} as DBLike,
  entitlements: { lockTier: vi.fn() },
  authoredVersions: { findActiveByIds: vi.fn() },
  campaign: { lockCampaign: vi.fn() },
  campaignSettings: { find: vi.fn() },
  systemVocabulary: { findActive: vi.fn() },
  occurrences: {
    appendReceipt: vi.fn(),
    advancePending: vi.fn(),
    complete: vi.fn(),
    createCompleted: vi.fn(),
    createPending: vi.fn(),
    findReceipt: vi.fn(),
    findTerminalReceiptByOccurrence: vi.fn(),
    lockPendingEncounter: vi.fn(),
    lockOccurrence: vi.fn()
  },
  scene: {
    findEventByCommand: vi.fn(),
    findEncounterBinding: vi.fn(),
    listActorTokenBindings: vi.fn(),
    lockByEncounter: vi.fn(),
    lockLiveScene: vi.fn()
  },
  spatialRuleEffects: { lockScope: vi.fn() },
  spatialEvaluation: vi.fn(),
  commitSpatialMovement: vi.fn(),
  appendReactionActionEvidenceCommand: vi.fn(),
  appendReactionCommand: vi.fn(),
  completedReactionRemainder: vi.fn(),
  retainReactionActionEvidence: vi.fn(),
  retainLegendaryResistanceChoice: vi.fn(),
  resolveReactionChoice: vi.fn(),
  reactionRemainder: vi.fn(),
  prepareReactionAction: vi.fn(),
  preparePassageContest: vi.fn(),
  executePassageContest: vi.fn(),
  lockActiveEffectTargets: vi.fn(),
  refreshActiveEffectTargets: vi.fn(),
  executeReactionAction: vi.fn(),
  settleReactionAction: vi.fn(),
  discoverLegendaryResistance: vi.fn(),
  startLegendaryResistance: vi.fn(),
  resumeLegendaryResistance: vi.fn(),
  startReactionBoundary: vi.fn(),
  createReactionChoiceDefinition: vi.fn(),
  rulePacks: { getRevision: vi.fn() },
  lockedContext: vi.fn(),
  turnEffects: vi.fn(),
  restoreTurnEffects: vi.fn(),
  applyTurnEffects: vi.fn(),
  maintenanceCleanup: vi.fn(),
  parsedReplay: vi.fn(),
  sqlRows: vi.fn(),
  actorEvaluation: vi.fn(),
  stageActionEconomyRefreshes: vi.fn(),
  applyActionEconomyRefreshes: vi.fn(),
  activeRulePack: vi.fn(),
  initiativePolicy: vi.fn(),
  optionalCombat: vi.fn(),
  discoverRechargeCandidates: vi.fn(),
  executeRechargeCandidate: vi.fn(),
  discoverLegendaryActionWindows: vi.fn(),
  discoverLegendaryActionWindow: vi.fn(),
  prepareLegendaryAction: vi.fn(),
  executeLegendaryAction: vi.fn(),
  settleLegendaryAction: vi.fn(),
  startInitiativeCommand: vi.fn(),
  resumeInitiativeDeclaration: vi.fn(),
  resumeInitiativeCommand: vi.fn(),
  applyInitiativeAdvance: vi.fn(),
  applyStagedInitiative: vi.fn(),
  createStagedInitiative: vi.fn(),
  serializeStagedInitiative: vi.fn(),
  encounter: {
    countBlueprintsForOwner: vi.fn(),
    createBlueprint: vi.fn(),
    updateBlueprint: vi.fn(),
    lockBlueprint: vi.fn(),
    findBlueprintUpdateReceipt: vi.fn(),
    appendBlueprintUpdateReceipt: vi.fn(),
    find: vi.fn(),
    findEventByCommand: vi.fn(),
    findBlueprintByOwnerCommand: vi.fn(),
    findVersionMetadata: vi.fn(),
    requireCurrentProjection: vi.fn(),
    findEventByCampaignCommand: vi.fn(),
    removeActor: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    createSide: vi.fn(),
    setSideRelationship: vi.fn(),
    addActor: vi.fn(),
    updateActor: vi.fn(),
    lockSide: vi.fn(),
    replaceCreatureActorSnapshot: vi.fn(),
    replaceOptionalCombatSnapshot: vi.fn(),
    publishCurrentProjection: vi.fn(),
    appendEvent: vi.fn(),
    lockInitiativeRound: vi.fn()
  }
}))

vi.mock('kysely', () => ({
  sql: (strings: TemplateStringsArray) => ({
    execute: () => mocks.sqlRows(strings.join(''))
  })
}))

vi.mock('@artificer-toolkit/schema/shared/rulesExecution', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@artificer-toolkit/schema/shared/rulesExecution')>()
  return {
    ...actual,
    isServerKernelRuleExecutionPendingSnapshot: (snapshot: unknown) =>
      actual.isServerKernelRuleExecutionPendingSnapshot(
        snapshot as ServerKernelRuleExecutionPendingSnapshotDto
      ) ||
      (typeof snapshot === 'object' &&
        snapshot !== null &&
        (snapshot as { applicationContext?: { kind?: unknown } }).applicationContext?.kind ===
          'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK')
  }
})

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAccountEntitlementsRepository: () => mocks.entitlements,
    createAuthoredVersionRepository: () => mocks.authoredVersions,
    createCampaignRepository: () => mocks.campaign,
    createCampaignSettingsRepository: () => mocks.campaignSettings,
    createSystemVocabularySnapshotRepository: () => mocks.systemVocabulary,
    createRuleOccurrenceRepository: () => mocks.occurrences,
    createSpatialRuleEffectRepository: () => mocks.spatialRuleEffects,
    createVttSceneRepository: () => mocks.scene,
    createRulePackRepository: () => mocks.rulePacks,
    createEncounterRepository: () => mocks.encounter,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.db)
  }
})

vi.mock('../campaign/campaignService.js', () => ({
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: vi.fn(async () => ({
    campaign: { id: ids.campaign, status: 'ACTIVE' },
    membership: {
      role: 'OWNER',
      status: 'ACTIVE',
      accessStartedAt: '2026-08-01T00:00:00.000Z'
    }
  })),
  CampaignConflictError: class CampaignConflictError extends Error {
    constructor(message = '') {
      super(message)
      this.name = 'CampaignConflictError'
    }
  },
  CampaignAccessError: class CampaignAccessError extends Error {
    constructor() {
      super()
      this.name = 'CampaignAccessError'
    }
  },
  assertActiveCampaignMember: vi.fn()
}))

vi.mock('./vttSceneService.js', () => ({
  commitSpatialSceneMovement: mocks.commitSpatialMovement
}))

vi.mock('./encounterSpatialMovementRuleService.js', () => ({
  evaluateEncounterSpatialMovementRuleBatch: mocks.spatialEvaluation
}))

vi.mock('./encounterMovementReactionContinuation.js', () => ({
  appendEncounterMovementReactionActionEvidenceCommand: mocks.appendReactionActionEvidenceCommand,
  appendEncounterMovementReactionResolutionCommand: mocks.appendReactionCommand,
  movementReactionRemainderAfterCompletedAction: mocks.completedReactionRemainder,
  movementReactionRemainderAfterCurrentChoice: mocks.reactionRemainder,
  retainEncounterMovementReactionActionEvidence: mocks.retainReactionActionEvidence,
  retainEncounterLegendaryResistanceChoice: mocks.retainLegendaryResistanceChoice,
  resolveEncounterMovementReactionChoice: mocks.resolveReactionChoice,
  startEncounterMovementReactionAtBoundary: mocks.startReactionBoundary
}))

vi.mock('./encounterLegendaryResistanceDiscovery.js', () => ({
  discoverEncounterLegendaryResistanceCandidate: mocks.discoverLegendaryResistance
}))

vi.mock('./encounterLegendaryResistanceChoice.js', () => ({
  startEncounterLegendaryResistanceChoice: mocks.startLegendaryResistance,
  resumeEncounterLegendaryResistanceChoice: mocks.resumeLegendaryResistance
}))

vi.mock('./encounterMovementReactionActionCoordinator.js', () => ({
  prepareCurrentEncounterMovementReactionAction: mocks.prepareReactionAction
}))

vi.mock('./encounterMovementReactionActionExecution.js', () => ({
  executeEncounterMovementReactionAction: mocks.executeReactionAction
}))

vi.mock('./encounterMovementReactionActionSettlement.js', () => ({
  settleEncounterMovementReactionAction: mocks.settleReactionAction
}))

vi.mock('./encounterMovementPassageContestPreparation.js', () => ({
  prepareEncounterMovementPassageContest: mocks.preparePassageContest
}))

vi.mock('./encounterMovementPassageContest.js', () => ({
  executeEncounterMovementPassageContest: mocks.executePassageContest
}))

vi.mock('./encounterActiveEffectTargetState.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterActiveEffectTargetState.js')>()),
  lockEncounterActiveEffectTargets: async (input: { encounter: { name?: string } }) =>
    input.encounter.name === 'Passage proof'
      ? mocks.lockActiveEffectTargets(input)
      : (
          await importOriginal<typeof import('./encounterActiveEffectTargetState.js')>()
        ).lockEncounterActiveEffectTargets(input as never),
  refreshLockedEncounterActiveEffectTargets: mocks.refreshActiveEffectTargets
}))

vi.mock('../rules/movementReactionChoice.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../rules/movementReactionChoice.js')>()),
  createMovementReactionChoiceDefinition: mocks.createReactionChoiceDefinition
}))

vi.mock('./encounterActorRuleEvaluation.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterActorRuleEvaluation.js')>()),
  evaluateEncounterActorRuleSnapshot: mocks.actorEvaluation
}))

vi.mock('./encounterActionEconomyRefresh.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterActionEconomyRefresh.js')>()),
  stageEncounterActionEconomyRefreshes: mocks.stageActionEconomyRefreshes,
  applyStagedActionEconomyRefreshes: mocks.applyActionEconomyRefreshes
}))

vi.mock('./encounterRuleIdentity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterRuleIdentity.js')>()),
  resolveActiveRulePackForSystems: mocks.activeRulePack
}))

vi.mock('./encounterInitiativePolicy.js', () => ({
  resolveEncounterInitiativePolicySnapshot: mocks.initiativePolicy
}))

vi.mock('./encounterOptionalCombatPolicy.js', () => ({
  resolveEncounterOptionalCombatSnapshot: mocks.optionalCombat
}))

vi.mock('./encounterInitiativeCommandCoordinator.js', () => ({
  startEncounterInitiativeCommand: mocks.startInitiativeCommand,
  resumeEncounterInitiativeDeclarationCommand: mocks.resumeInitiativeDeclaration,
  resumeEncounterInitiativeCommand: mocks.resumeInitiativeCommand,
  applyEncounterInitiativeAdvanceCommand: mocks.applyInitiativeAdvance,
  applyStagedInitiativeState: mocks.applyStagedInitiative,
  createStagedInitiativeRoundState: mocks.createStagedInitiative,
  serializeStagedInitiativeRoundState: mocks.serializeStagedInitiative
}))

vi.mock('./encounterRechargeLifecycle.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterRechargeLifecycle.js')>()),
  discoverEncounterRechargeCandidates: mocks.discoverRechargeCandidates,
  executeEncounterRechargeCandidate: mocks.executeRechargeCandidate
}))

vi.mock('./encounterLegendaryActionExecution.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterLegendaryActionExecution.js')>()),
  discoverEncounterLegendaryActionWindows: mocks.discoverLegendaryActionWindows,
  discoverEncounterLegendaryActionWindow: mocks.discoverLegendaryActionWindow,
  prepareEncounterLegendaryAction: mocks.prepareLegendaryAction,
  executeEncounterLegendaryAction: mocks.executeLegendaryAction,
  settleEncounterLegendaryAction: mocks.settleLegendaryAction
}))

vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: mocks.lockedContext
}))

vi.mock('./encounterCharacterActiveRuleEffectService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterCharacterActiveRuleEffectService.js')>()),
  applyEvaluatedTurnEffectBatch: mocks.applyTurnEffects,
  executeEncounterTurnCharacterActiveEffects: mocks.turnEffects,
  restoreEvaluatedEncounterTurnEffectBatch: mocks.restoreTurnEffects,
  evaluateEncounterTurnCharacterActiveEffects: mocks.turnEffects
}))

vi.mock('./encounterActorMaintainedCleanup.js', () => ({
  cleanupRemovedEncounterActorMaintainedEffects: mocks.maintenanceCleanup
}))

vi.mock('./encounterProjectionReplay.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterProjectionReplay.js')>()),
  parseEncounterProjectionEvent: mocks.parsedReplay
}))

import {
  createEncounter,
  createEncounterBlueprint,
  executeEncounterCommandWithRuleSnapshot,
  getPendingEncounterRuleOccurrence,
  getEncounterProjection,
  updateEncounterBlueprint
} from './encounterService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createStagedInitiative.mockImplementation(({ encounter, round }) =>
    stagedInitiativeRound({
      round,
      cadence: encounter.initiativePolicySnapshot?.policy.document.cadence ?? 'ENCOUNTER_START',
      checksum: encounter.initiativePolicySnapshotChecksum ?? 'a'.repeat(64)
    })
  )
  mocks.serializeStagedInitiative.mockImplementation((state) =>
    stagedInitiativeRound({
      round: state?.round?.round ?? 1,
      cadence: state?.round?.cadence ?? 'ENCOUNTER_START',
      checksum: state?.round?.policySnapshotChecksum ?? 'a'.repeat(64)
    })
  )
  mocks.applyStagedInitiative.mockImplementation(async ({ stagedRoundState }) =>
    stagedInitiativeRound({
      round: stagedRoundState.round.round,
      cadence: stagedRoundState.round.cadence,
      checksum: stagedRoundState.round.policySnapshotChecksum ?? 'a'.repeat(64),
      active: true
    })
  )
  mocks.entitlements.lockTier.mockResolvedValue('FREE')
  mocks.encounter.countBlueprintsForOwner.mockResolvedValue(0)
  mocks.encounter.findBlueprintByOwnerCommand.mockResolvedValue(null)
  mocks.encounter.lockBlueprint.mockResolvedValue(null)
  mocks.encounter.findBlueprintUpdateReceipt.mockResolvedValue(null)
  mocks.encounter.appendBlueprintUpdateReceipt.mockResolvedValue(undefined)
  mocks.encounter.findVersionMetadata.mockResolvedValue({
    campaignId: ids.campaign,
    id: ids.command,
    sessionId: ids.template,
    status: 'ACTIVE',
    version: 7
  })
  mocks.encounter.requireCurrentProjection.mockResolvedValue({
    projection: { id: ids.command, version: 7 }
  })
  mocks.encounter.findEventByCampaignCommand.mockResolvedValue(null)
  mocks.encounter.removeActor.mockResolvedValue(true)
  mocks.encounter.createSide.mockResolvedValue(undefined)
  mocks.encounter.setSideRelationship.mockResolvedValue(undefined)
  mocks.encounter.addActor.mockResolvedValue(undefined)
  mocks.encounter.updateActor.mockResolvedValue(undefined)
  mocks.encounter.lockSide.mockResolvedValue(true)
  mocks.encounter.replaceCreatureActorSnapshot.mockResolvedValue(true)
  mocks.encounter.publishCurrentProjection.mockImplementation(async (projection) => projection)
  mocks.encounter.appendEvent.mockResolvedValue(undefined)
  mocks.campaign.lockCampaign.mockResolvedValue({
    id: ids.campaign,
    ownerUserId: ids.owner,
    status: 'ACTIVE'
  })
  mocks.campaignSettings.find.mockResolvedValue(null)
  const system = srdBaselineContent.vocabulary.systems.find(
    (candidate) => candidate.id === ids.system
  )
  if (!system) throw new Error('D&D System fixture is unavailable.')
  mocks.systemVocabulary.findActive.mockResolvedValue({
    snapshotId: ids.template,
    systemId: ids.system,
    snapshotVersion: 1,
    schemaVersion: 4,
    checksum: 'd'.repeat(64),
    document: { ...system, schemaVersion: 4 }
  })
  mocks.occurrences.createCompleted.mockResolvedValue(undefined)
  mocks.occurrences.createPending.mockImplementation(async (input) => ({
    id: input.occurrenceId,
    version: 0,
    pendingSnapshot: input.pendingSnapshot
  }))
  mocks.occurrences.appendReceipt.mockResolvedValue(undefined)
  mocks.occurrences.advancePending.mockImplementation(async (input) => ({
    id: input.occurrenceId,
    aggregateId: input.aggregateId,
    aggregateKind: input.aggregateKind,
    expectedAggregateVersion: input.nextAggregateVersion,
    version: input.expectedOccurrenceVersion + 1,
    state: 'PENDING',
    pendingSnapshot: input.pendingSnapshot
  }))
  mocks.occurrences.complete.mockResolvedValue(undefined)
  mocks.occurrences.findReceipt.mockResolvedValue(null)
  mocks.occurrences.findTerminalReceiptByOccurrence.mockResolvedValue(null)
  mocks.occurrences.lockPendingEncounter.mockResolvedValue(null)
  mocks.occurrences.lockOccurrence.mockReset()
  mocks.occurrences.lockOccurrence.mockResolvedValue(null)
  mocks.scene.findEventByCommand.mockResolvedValue(null)
  mocks.encounter.findEventByCommand.mockResolvedValue(null)
  mocks.scene.findEncounterBinding.mockResolvedValue(null)
  mocks.scene.listActorTokenBindings.mockResolvedValue([])
  mocks.scene.lockByEncounter.mockResolvedValue(null)
  mocks.scene.lockLiveScene.mockResolvedValue(null)
  mocks.spatialRuleEffects.lockScope.mockResolvedValue(null)
  mocks.spatialEvaluation.mockReset()
  mocks.commitSpatialMovement.mockReset()
  mocks.appendReactionActionEvidenceCommand.mockReset()
  mocks.appendReactionCommand.mockReset()
  mocks.completedReactionRemainder.mockReset()
  mocks.retainReactionActionEvidence.mockReset()
  mocks.retainLegendaryResistanceChoice.mockReset()
  mocks.resolveReactionChoice.mockReset()
  mocks.reactionRemainder.mockReset()
  mocks.prepareReactionAction.mockReset()
  mocks.refreshActiveEffectTargets.mockImplementation(async ({ targets }) => targets)
  mocks.executeReactionAction.mockReset()
  mocks.settleReactionAction.mockReset()
  mocks.discoverLegendaryResistance.mockReset()
  mocks.startLegendaryResistance.mockReset()
  mocks.resumeLegendaryResistance.mockReset()
  mocks.startReactionBoundary.mockReset()
  mocks.createReactionChoiceDefinition.mockReturnValue({ id: ids.template })
  mocks.turnEffects.mockResolvedValue({
    result: null,
    selectionChecksum: null
  })
  mocks.applyTurnEffects.mockReset()
  mocks.applyInitiativeAdvance.mockReset()
  mocks.discoverRechargeCandidates.mockResolvedValue([])
  mocks.executeRechargeCandidate.mockReset()
  mocks.discoverLegendaryActionWindows.mockResolvedValue({ windows: [] })
  mocks.discoverLegendaryActionWindow.mockResolvedValue(null)
  mocks.prepareLegendaryAction.mockReset()
  mocks.executeLegendaryAction.mockReset()
  mocks.settleLegendaryAction.mockReset()
  mocks.maintenanceCleanup.mockResolvedValue({
    result: null,
    changedCharacterActors: []
  })
  mocks.parsedReplay.mockReset()
  mocks.sqlRows.mockImplementation(async (query: string) => {
    if (query.includes('FROM public.campaign_sessions')) {
      return { rows: [{ id: ids.template, status: 'OPEN' }] }
    }
    if (query.includes('SELECT game_system_id FROM public.campaigns')) {
      return { rows: [{ game_system_id: ids.system }] }
    }
    if (query.includes('FROM public.campaign_session_attendance')) return { rows: [] }
    throw new Error(`Unexpected SQL in Encounter test: ${query}`)
  })
  mocks.activeRulePack.mockResolvedValue({ revision: { id: ids.template } })
  mocks.initiativePolicy.mockResolvedValue(null)
  mocks.optionalCombat.mockResolvedValue({
    snapshot: { schemaVersion: 1, gameSystemId: ids.system, definitions: [] },
    checksum: 'f'.repeat(64)
  })
  mocks.rulePacks.getRevision.mockResolvedValue({
    id: ids.template,
    checksum: 'a'.repeat(64),
    state: 'ACTIVE'
  })
  mocks.actorEvaluation.mockImplementation(async ({ encounter }) => ({
    snapshot: {
      encounterVersion: encounter.version,
      revisionId: encounter.rulePackRevisionId ?? ids.template,
      facts: { contractVersion: 1, actors: [] },
      output: { actors: [] }
    },
    reconciledEncounter: encounter,
    actorUpdates: [],
    zenEvaluationMs: 0
  }))
  mocks.stageActionEconomyRefreshes.mockResolvedValue({
    refreshes: [],
    refreshedActor: null
  })
  mocks.applyActionEconomyRefreshes.mockResolvedValue([])
  const creature = createCreature({
    id: ids.creature,
    systemId: ids.system,
    userId: ids.owner,
    status: 'ACTIVE',
    hitPoints: 8
  })
  mocks.authoredVersions.findActiveByIds.mockResolvedValue(
    new Map([
      [
        ids.creature,
        {
          authored: {
            document: creature,
            versionId: 'creature-version-1',
            version: 1,
            checksum: 'a'.repeat(64)
          }
        }
      ]
    ])
  )
  mocks.encounter.createBlueprint.mockImplementation(async (input) => ({
    id: ids.template,
    ownerUserId: ids.owner,
    gameSystemId: ids.system,
    name: input.name,
    version: 1,
    enemies: input.enemies,
    setupChecksum: 'a'.repeat(64),
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z'
  }))
})

describe('encounter Blueprint authority', () => {
  it('admits exactly the maximum number of Encounter actors before any insert guard is needed', async () => {
    let created: Record<string, unknown> | null = null
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Maximum run',
      version: 1,
      setupChecksum: 'a'.repeat(64),
      enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS }, (_, index) => ({
        kind: 'CUSTOM' as const,
        sourceId: null,
        sourceRevision: null,
        label: `Enemy ${index + 1}`,
        systemId: ids.system,
        maxHitPoints: 1,
        snapshot: { kind: 'CUSTOM', systemId: ids.system }
      })),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    mocks.encounter.create.mockImplementation(async (input) => {
      created = {
        ...input,
        status: 'PREPARED',
        version: 0,
        round: 0,
        currentActorId: null,
        actors: [],
        reminders: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      }
      return created
    })
    mocks.encounter.find.mockImplementation(async () => created)

    await expect(
      createEncounter({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        sessionId: ids.template,
        blueprintId: ids.template,
        commandId: ids.command
      })
    ).resolves.toMatchObject({ version: 0 })

    expect(mocks.encounter.addActor).toHaveBeenCalledTimes(MAX_ENCOUNTER_ACTORS)
  })

  it('rejects present attendance plus Blueprint enemies above the actor maximum before insertion', async () => {
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Overfull run',
      version: 1,
      setupChecksum: 'a'.repeat(64),
      enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS - 1 }, (_, index) => ({
        kind: 'CUSTOM' as const,
        sourceId: null,
        sourceRevision: null,
        label: `Enemy ${index + 1}`,
        systemId: ids.system,
        maxHitPoints: 1,
        snapshot: { kind: 'CUSTOM', systemId: ids.system }
      })),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    mocks.sqlRows.mockImplementation(async (query: string) => {
      if (query.includes('FROM public.campaign_sessions')) {
        return { rows: [{ id: ids.template, status: 'OPEN' }] }
      }
      if (query.includes('SELECT game_system_id FROM public.campaigns')) {
        return { rows: [{ game_system_id: ids.system }] }
      }
      if (query.includes('FROM public.campaign_session_attendance')) {
        return { rows: [{ character_id: ids.creature }, { character_id: ids.command }] }
      }
      throw new Error(`Unexpected SQL in Encounter test: ${query}`)
    })

    await expect(
      createEncounter({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        sessionId: ids.template,
        blueprintId: ids.template,
        commandId: ids.command
      })
    ).rejects.toMatchObject({
      name: 'EncounterValidationError',
      message: `Encounters support at most ${MAX_ENCOUNTER_ACTORS} actors.`
    })

    expect(mocks.encounter.create).not.toHaveBeenCalled()
    expect(mocks.encounter.addActor).not.toHaveBeenCalled()
  })

  it('rejects a locked archived Campaign before Session, receipt, Blueprint, or mutation work', async () => {
    mocks.campaign.lockCampaign.mockResolvedValue({
      id: ids.campaign,
      ownerUserId: ids.owner,
      status: 'ARCHIVED'
    })

    await expect(
      createEncounter({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        sessionId: ids.template,
        blueprintId: ids.template,
        commandId: ids.command
      })
    ).rejects.toMatchObject({
      name: 'CampaignConflictError',
      message: 'Archived Campaigns are read-only.'
    })

    expect(mocks.sqlRows).not.toHaveBeenCalled()
    expect(mocks.encounter.findEventByCampaignCommand).not.toHaveBeenCalled()
    expect(mocks.encounter.lockBlueprint).not.toHaveBeenCalled()
    expect(mocks.encounter.create).not.toHaveBeenCalled()
  })

  it('rejects a locked Campaign owned by another user before Session, receipt, Blueprint, or mutation work', async () => {
    mocks.campaign.lockCampaign.mockResolvedValue({
      id: ids.campaign,
      ownerUserId: ids.otherSystem,
      status: 'ACTIVE'
    })

    await expect(
      createEncounter({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        sessionId: ids.template,
        blueprintId: ids.template,
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'CampaignAccessError' })

    expect(mocks.sqlRows).not.toHaveBeenCalled()
    expect(mocks.encounter.findEventByCampaignCommand).not.toHaveBeenCalled()
    expect(mocks.encounter.lockBlueprint).not.toHaveBeenCalled()
    expect(mocks.encounter.create).not.toHaveBeenCalled()
  })

  it('publishes a repository-created Encounter at version zero', async () => {
    let created: Record<string, unknown> | null = null
    const reconciledActor = {
      id: ids.creature,
      resources: { featureCharges: { resource: 2 } }
    }
    mocks.encounter.create.mockImplementation(async (input) => {
      created = {
        ...input,
        status: 'PREPARED',
        version: 0,
        round: 0,
        currentActorId: null,
        actors: [],
        reminders: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      }
      return created
    })
    mocks.encounter.find.mockImplementation(async () => created)
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Fresh run',
      version: 1,
      setupChecksum: 'a'.repeat(64),
      enemies: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    mocks.actorEvaluation.mockImplementation(async ({ encounter }) => ({
      snapshot: {
        encounterVersion: encounter.version,
        revisionId: encounter.rulePackRevisionId,
        facts: { contractVersion: 1, actors: [] },
        output: { actors: [] }
      },
      reconciledEncounter: encounter,
      actorUpdates: [reconciledActor],
      zenEvaluationMs: 0
    }))

    await expect(
      createEncounter({} as DBLike, ids.owner, {
        campaignId: ids.campaign,
        sessionId: ids.template,
        blueprintId: ids.template,
        commandId: ids.command
      })
    ).resolves.toMatchObject({ version: 0 })

    expect(mocks.encounter.publishCurrentProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        streamVersion: 0,
        projection: expect.objectContaining({ version: 0 })
      })
    )
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 0,
        resultPayload: expect.objectContaining({
          currentProjection: expect.objectContaining({ streamVersion: 0 })
        })
      })
    )
    expect(mocks.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automationMode: 'ASSISTED',
        manualReminderMode: 'OFF',
        initiativePolicySnapshot: null,
        initiativePolicySnapshotChecksum: null
      })
    )
    expect(mocks.encounter.createSide).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        encounterId: created!.id,
        label: 'Party',
        sortOrder: 0
      })
    )
    expect(mocks.encounter.createSide).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        encounterId: created!.id,
        label: 'Opposition',
        sortOrder: 1
      })
    )
    expect(mocks.encounter.setSideRelationship).toHaveBeenCalledWith({
      encounterId: created!.id,
      firstSideId: mocks.encounter.createSide.mock.calls[0]![0].id,
      secondSideId: mocks.encounter.createSide.mock.calls[1]![0].id,
      relationshipKind: 'HOSTILE'
    })
    expect(mocks.encounter.updateActor).toHaveBeenCalledWith(reconciledActor)
    expect(mocks.encounter.updateActor.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.encounter.publishCurrentProjection.mock.invocationCallOrder[0]!
    )
    expect(mocks.encounter.updateActor.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.encounter.appendEvent.mock.invocationCallOrder[0]!
    )
  })

  it('copies current Campaign automation settings into a new Encounter', async () => {
    let created: Record<string, unknown> | null = null
    mocks.campaignSettings.find.mockResolvedValue({
      automationMode: 'MANUAL',
      manualReminderMode: 'SUBTLE'
    })
    mocks.encounter.create.mockImplementation(async (input) => {
      created = {
        ...input,
        status: 'PREPARED',
        version: 0,
        round: 0,
        currentActorId: null,
        actors: [],
        reminders: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      }
      return created
    })
    mocks.encounter.find.mockImplementation(async () => created)
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Fresh run',
      version: 1,
      setupChecksum: 'a'.repeat(64),
      enemies: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    await createEncounter({} as DBLike, ids.owner, {
      campaignId: ids.campaign,
      sessionId: ids.template,
      blueprintId: ids.template,
      commandId: ids.command
    })

    expect(mocks.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automationMode: 'MANUAL',
        manualReminderMode: 'SUBTLE'
      })
    )
  })

  it('pins Creature labels and stats from the active immutable version', async () => {
    await createEncounterBlueprint({} as DBLike, ids.owner, {
      gameSystemId: ids.system,
      name: 'Goblin ambush',
      enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
      commandId: ids.command
    })

    expect(mocks.authoredVersions.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'CREATURE',
      subjectIds: [ids.creature],
      userId: ids.owner,
      includeMaster: true
    })
    expect(mocks.encounter.createBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        enemies: [
          expect.objectContaining({
            kind: 'CREATURE',
            sourceId: ids.creature,
            sourceRevision: 1,
            label: 'Owl',
            systemId: ids.system,
            maxHitPoints: 8,
            snapshot: expect.objectContaining({
              sourceVersionId: 'creature-version-1',
              sourceChecksum: 'a'.repeat(64),
              payload: expect.objectContaining({
                label: 'Owl',
                hitPoints: 8,
                damageVulnerabilities: [],
                damageResistances: [],
                damageImmunities: [],
                conditionImmunities: []
              })
            })
          })
        ]
      })
    )
    const created = mocks.encounter.createBlueprint.mock.calls[0]?.[0]
    expect(created.setupChecksum).toBe(
      checksumCanonicalJson({ name: created.name, enemies: created.enemies })
    )
  })

  it('pins every loadout-bound base Equipment source into the immutable Creature snapshot', async () => {
    const club = srdBaselineContent.subjects.equipment.find(
      (candidate) => candidate.label === 'Club'
    )
    if (!club) throw new Error('Missing SRD Club fixture.')
    const loadoutEntryId = '00000000-0000-4000-8000-000000000010'
    const featureId = '00000000-0000-4000-8000-000000000011'
    const creature = {
      ...createCreature({
        id: ids.creature,
        systemId: ids.system,
        userId: ids.owner,
        status: 'ACTIVE',
        hitPoints: 8
      }),
      features: [
        {
          id: featureId,
          label: 'Club',
          description: '',
          order: 1,
          effects: club.effects
        }
      ],
      equipmentLoadout: [
        {
          id: loadoutEntryId,
          equipmentId: club.id,
          quantity: 1,
          useState: 'HELD' as const,
          attuned: false,
          actionFeatureIds: [featureId]
        }
      ]
    }
    const equipment = { ...club, systemId: ids.system, userId: ids.owner }
    const equipmentChecksum = checksumRuleDocument(equipment)
    mocks.authoredVersions.findActiveByIds.mockImplementation(async (input) =>
      input.subjectKind === 'CREATURE'
        ? new Map([
            [
              creature.id,
              {
                authored: {
                  document: creature,
                  versionId: ids.creature,
                  version: 2,
                  checksum: 'a'.repeat(64)
                }
              }
            ]
          ])
        : new Map([
            [
              equipment.id,
              {
                authored: {
                  document: equipment,
                  versionId: ids.template,
                  version: 3,
                  checksum: equipmentChecksum
                }
              }
            ]
          ])
    )

    await createEncounterBlueprint({} as DBLike, ids.owner, {
      gameSystemId: ids.system,
      name: 'Dryad grove',
      enemies: [{ kind: 'CREATURE', sourceId: creature.id }],
      commandId: ids.command
    })

    expect(mocks.authoredVersions.findActiveByIds).toHaveBeenNthCalledWith(2, {
      subjectKind: 'EQUIPMENT',
      subjectIds: [equipment.id],
      userId: ids.owner,
      includeMaster: true
    })
    const created = mocks.encounter.createBlueprint.mock.calls[0]?.[0]
    expect(created.enemies[0].snapshot).toMatchObject({
      equipmentSources: [
        {
          loadoutEntryId: creature.equipmentLoadout?.[0]?.id,
          equipmentId: equipment.id,
          sourceRevision: 3,
          sourceVersionId: ids.template,
          sourceChecksum: equipmentChecksum,
          payload: { id: equipment.id, systemId: ids.system }
        }
      ]
    })
  })

  it('rejects a loadout-bound Creature when its exact Equipment source is unavailable', async () => {
    const club = srdBaselineContent.subjects.equipment.find(
      (candidate) => candidate.label === 'Club'
    )
    if (!club) throw new Error('Missing SRD Club fixture.')
    const featureId = '00000000-0000-4000-8000-000000000031'
    const creature = {
      ...createCreature({
        id: ids.creature,
        systemId: ids.system,
        userId: ids.owner,
        status: 'ACTIVE',
        hitPoints: 8
      }),
      features: [
        {
          id: featureId,
          label: 'Club',
          description: '',
          order: 1,
          effects: club.effects
        }
      ],
      equipmentLoadout: [
        {
          id: '00000000-0000-4000-8000-000000000030',
          equipmentId: club.id,
          quantity: 1,
          useState: 'HELD' as const,
          attuned: false,
          actionFeatureIds: [featureId]
        }
      ]
    }
    mocks.authoredVersions.findActiveByIds.mockImplementation(async (input) =>
      input.subjectKind === 'CREATURE'
        ? new Map([
            [
              creature.id,
              {
                authored: {
                  document: creature,
                  versionId: ids.creature,
                  version: 2,
                  checksum: 'a'.repeat(64)
                }
              }
            ]
          ])
        : new Map()
    )

    await expect(
      createEncounterBlueprint({} as DBLike, ids.owner, {
        gameSystemId: ids.system,
        name: 'Incomplete grove',
        enemies: [{ kind: 'CREATURE', sourceId: creature.id }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError' })

    expect(mocks.encounter.createBlueprint).not.toHaveBeenCalled()
  })

  it('pins the Blueprint System into Custom actor snapshots', async () => {
    await createEncounterBlueprint({} as DBLike, ids.owner, {
      gameSystemId: ids.system,
      name: 'Custom ambush',
      enemies: [{ kind: 'CUSTOM', label: 'Clockwork scout', maxHitPoints: 7 }],
      commandId: ids.command
    })

    expect(mocks.encounter.createBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        enemies: [
          expect.objectContaining({
            kind: 'CUSTOM',
            systemId: ids.system,
            snapshot: expect.objectContaining({ systemId: ids.system })
          })
        ]
      })
    )
  })

  it('returns an identical Blueprint retry before consuming quota', async () => {
    const input = {
      gameSystemId: ids.system,
      name: 'Goblin ambush',
      enemies: [{ kind: 'CREATURE' as const, sourceId: ids.creature }],
      commandId: ids.command
    }
    const blueprint = await createEncounterBlueprint({} as DBLike, ids.owner, input)
    const created = mocks.encounter.createBlueprint.mock.calls[0]?.[0]
    mocks.encounter.findBlueprintByOwnerCommand.mockResolvedValue({
      blueprint,
      commandFingerprint: created.commandFingerprint
    })
    mocks.encounter.createBlueprint.mockClear()
    mocks.entitlements.lockTier.mockClear()
    mocks.authoredVersions.findActiveByIds.mockClear()

    await expect(createEncounterBlueprint({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      id: ids.template
    })
    expect(mocks.entitlements.lockTier).not.toHaveBeenCalled()
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.createBlueprint).not.toHaveBeenCalled()
  })

  it('rejects a Blueprint command reused with different input', async () => {
    mocks.encounter.findBlueprintByOwnerCommand.mockResolvedValue({
      blueprint: {
        id: ids.template,
        ownerUserId: ids.owner,
        gameSystemId: ids.system,
        setupChecksum: 'a'.repeat(64),
        name: 'Earlier Blueprint',
        version: 1,
        enemies: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      },
      commandFingerprint: 'different'
    })

    await expect(
      createEncounterBlueprint({} as DBLike, ids.owner, {
        gameSystemId: ids.system,
        name: 'Goblin ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterConflictError' })
    expect(mocks.entitlements.lockTier).not.toHaveBeenCalled()
    expect(mocks.encounter.createBlueprint).not.toHaveBeenCalled()
  })

  it('rejects a Creature from another System before persistence', async () => {
    await expect(
      createEncounterBlueprint({} as DBLike, ids.owner, {
        gameSystemId: ids.otherSystem,
        name: 'Mismatched ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError' })
    expect(mocks.encounter.createBlueprint).not.toHaveBeenCalled()
  })

  it('rejects a non-owner Blueprint as not found before update work', async () => {
    await expect(
      updateEncounterBlueprint({} as DBLike, ids.owner, {
        blueprintId: ids.template,
        expectedVersion: 1,
        name: 'Updated ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.updateCommand
      })
    ).rejects.toMatchObject({ name: 'EncounterNotFoundError' })
    expect(mocks.encounter.updateBlueprint).not.toHaveBeenCalled()
    expect(mocks.encounter.appendBlueprintUpdateReceipt).not.toHaveBeenCalled()
  })

  it('returns a matching update receipt before source or mutation work', async () => {
    const prior = {
      id: ids.template,
      gameSystemId: ids.system,
      name: 'Prior Blueprint',
      version: 2,
      enemies: [],
      setupChecksum: 'b'.repeat(64),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z'
    }
    mocks.encounter.lockBlueprint.mockResolvedValue({
      ...prior,
      ownerUserId: ids.owner
    })
    mocks.encounter.findBlueprintUpdateReceipt.mockResolvedValue({
      commandFingerprint: 'prior-fingerprint',
      resultPayload: prior
    })

    const input = {
      blueprintId: ids.template,
      expectedVersion: 1,
      name: 'Updated ambush',
      enemies: [{ kind: 'CREATURE' as const, sourceId: ids.creature }],
      commandId: ids.updateCommand
    }
    const { createHash } = await import('node:crypto')
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    mocks.encounter.findBlueprintUpdateReceipt.mockResolvedValue({
      commandFingerprint: fingerprint,
      resultPayload: prior
    })

    await expect(updateEncounterBlueprint({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      version: 2,
      setupChecksum: 'b'.repeat(64)
    })
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.updateBlueprint).not.toHaveBeenCalled()
    expect(mocks.encounter.appendBlueprintUpdateReceipt).not.toHaveBeenCalled()
  })

  it('rejects a mismatched update receipt before mutation', async () => {
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Prior Blueprint',
      version: 1,
      enemies: [],
      setupChecksum: 'a'.repeat(64),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    mocks.encounter.findBlueprintUpdateReceipt.mockResolvedValue({
      commandFingerprint: 'different',
      resultPayload: {}
    })

    await expect(
      updateEncounterBlueprint({} as DBLike, ids.owner, {
        blueprintId: ids.template,
        expectedVersion: 1,
        name: 'Updated ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.updateCommand
      })
    ).rejects.toMatchObject({ name: 'EncounterConflictError' })
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.updateBlueprint).not.toHaveBeenCalled()
    expect(mocks.encounter.appendBlueprintUpdateReceipt).not.toHaveBeenCalled()
  })

  it('rejects a stale Blueprint update before source resolution', async () => {
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Prior Blueprint',
      version: 2,
      enemies: [],
      setupChecksum: 'a'.repeat(64),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    await expect(
      updateEncounterBlueprint({} as DBLike, ids.owner, {
        blueprintId: ids.template,
        expectedVersion: 1,
        name: 'Updated ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.updateCommand
      })
    ).rejects.toMatchObject({ name: 'EncounterConflictError' })
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.updateBlueprint).not.toHaveBeenCalled()
  })

  it('persists and receipts a changed Blueprint version and checksum', async () => {
    mocks.encounter.lockBlueprint.mockResolvedValue({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: 'Prior Blueprint',
      version: 1,
      enemies: [],
      setupChecksum: 'a'.repeat(64),
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    mocks.encounter.updateBlueprint.mockImplementation(async (input) => ({
      id: ids.template,
      ownerUserId: ids.owner,
      gameSystemId: ids.system,
      name: input.name,
      version: 2,
      enemies: input.enemies,
      setupChecksum: input.setupChecksum,
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z'
    }))

    const result = await updateEncounterBlueprint({} as DBLike, ids.owner, {
      blueprintId: ids.template,
      expectedVersion: 1,
      name: 'Updated ambush',
      enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
      commandId: ids.updateCommand
    })

    expect(result.version).toBe(2)
    expect(result.setupChecksum).not.toBe('a'.repeat(64))
    expect(mocks.encounter.updateBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 1,
        setupChecksum: result.setupChecksum
      })
    )
    expect(mocks.encounter.appendBlueprintUpdateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        blueprintVersion: 2,
        resultPayload: expect.objectContaining({
          version: 2,
          setupChecksum: result.setupChecksum
        })
      })
    )
  })

  it('rejects oversized resolved creature snapshots before persistence', async () => {
    const creature = createCreature({
      id: ids.creature,
      systemId: ids.system,
      userId: ids.owner,
      status: 'ACTIVE',
      hitPoints: 8,
      description: 'x'.repeat(AUTHORED_LIMITS.mutationPayloadBytes)
    })
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          ids.creature,
          {
            authored: {
              document: creature,
              versionId: 'creature-version-1',
              version: 1,
              checksum: 'a'.repeat(64)
            }
          }
        ]
      ])
    )

    await expect(
      createEncounterBlueprint({} as DBLike, ids.owner, {
        gameSystemId: ids.system,
        name: 'Oversized ambush',
        enemies: [{ kind: 'CREATURE', sourceId: ids.creature }],
        commandId: ids.command
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError' })
    expect(mocks.encounter.createBlueprint).not.toHaveBeenCalled()
  })

  it('replays an action receipt after the Encounter later completes without Scene or runtime work', async () => {
    const actionId = '00000000-0000-4000-8000-000000000091'
    const actorId = '00000000-0000-4000-8000-000000000092'
    const targetActorId = '00000000-0000-4000-8000-000000000093'
    const occurrenceId = '00000000-0000-4000-8000-000000000094'
    const input = {
      type: 'RESOLVE_ACTION' as const,
      encounterId: ids.command,
      commandId: '00000000-0000-4000-8000-000000000095',
      expectedVersion: 7,
      actorId,
      actionId,
      targetActorId,
      sceneContext: null
    }
    const receipt = {
      occurrenceId,
      commandId: input.commandId,
      commandFingerprint: createRuleExecutionCommandFingerprint(
        { aggregateKind: 'ENCOUNTER', aggregateId: ids.command, actorUserId: ids.owner },
        { commandId: input.commandId, correlationId: null, expectedAggregateVersion: 7 },
        'RULE_EXECUTION_START',
        {
          intentChecksum: checksumRuleDocument(
            createEncounterActionStartIntent({
              actionId,
              actorId,
              sceneContext: null,
              targetActorId
            })
          )
        }
      ),
      aggregateVersion: 4,
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: { transition: 'ACTION' },
      resultPayload: {
        status: 'PAUSED',
        occurrenceId,
        occurrenceVersion: 1,
        request: {
          kind: 'INTEGER_RANGE',
          requestId: 'sealed-action-roll',
          nodeId: 'roll',
          ordinal: 0,
          min: 1,
          max: 20
        },
        pending: { kind: 'D20_EVIDENCE', rollMode: 'NORMAL' }
      }
    }
    const replayEncounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED' as const,
      manualReminderMode: 'OFF' as const,
      name: 'Replay proof',
      status: 'COMPLETED' as const,
      version: 7,
      round: 1,
      currentActorId: null,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      actors: [],
      reminders: []
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: replayEncounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        currentVersion: 7
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue(receipt)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(replayEncounter, { actors: [] })
    })

    const replay = await executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
      rulesRuntime: {} as never
    })

    expect(replay.replayed).toBe(true)
    expect(replay.response.occurrence).toEqual({
      occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING',
      outcome: null,
      pending: {
        kind: 'D20_EVIDENCE',
        occurrenceId,
        occurrenceVersion: 1,
        encounterVersion: 4,
        request: { requestId: 'sealed-action-roll', min: 1, max: 20, rollMode: 'NORMAL' },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot(
        {} as DBLike,
        ids.owner,
        {
          ...input,
          sceneContext: {
            sceneId: ids.template,
            expectedSceneVersion: 0,
            sourceTokenId: actorId,
            targetTokenId: targetActorId
          }
        },
        { rulesRuntime: {} as never }
      )
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(mocks.scene.lockByEncounter).not.toHaveBeenCalled()
    expect(mocks.occurrences.lockOccurrence).not.toHaveBeenCalled()
  })

  it('replays an intermediate D20 receipt before current occurrence routing', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000096'
    const input = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      commandId: '00000000-0000-4000-8000-000000000097',
      expectedVersion: 7,
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 1,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: 'sealed-action-roll',
        rawFaces: [18]
      }
    }
    const receipt = {
      occurrenceId,
      commandId: input.commandId,
      commandFingerprint: createRuleExecutionCommandFingerprint(
        { aggregateKind: 'ENCOUNTER', aggregateId: ids.command, actorUserId: ids.owner },
        { commandId: input.commandId, correlationId: null, expectedAggregateVersion: 7 },
        'RULE_EXECUTION_RESUME',
        {
          occurrenceId,
          expectedOccurrenceVersion: 1,
          resolutionIntentChecksum: checksumRuleDocument({
            kind: 'PHYSICAL',
            requestId: 'sealed-action-roll',
            rawFaces: [18]
          })
        }
      ),
      aggregateVersion: 5,
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: { transition: 'ACTION' },
      resultPayload: {
        status: 'PAUSED',
        occurrenceId,
        occurrenceVersion: 2,
        request: {
          kind: 'INTEGER_RANGE',
          requestId: 'next-concentration-roll',
          nodeId: 'roll',
          ordinal: 1,
          min: 1,
          max: 20
        },
        pending: { kind: 'D20_EVIDENCE', rollMode: 'ADVANTAGE' }
      }
    }
    const replayEncounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED' as const,
      manualReminderMode: 'OFF' as const,
      name: 'Replay proof',
      status: 'ACTIVE' as const,
      version: 7,
      round: 1,
      currentActorId: null,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      actors: [],
      reminders: []
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: replayEncounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        currentVersion: 7
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue(receipt)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(replayEncounter, { actors: [] })
    })

    const replay = await executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
      rulesRuntime: {} as never
    })

    expect(replay.replayed).toBe(true)
    expect(replay.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 2,
      status: 'PENDING',
      pending: {
        kind: 'D20_EVIDENCE',
        request: { requestId: 'next-concentration-roll', rollMode: 'ADVANTAGE' }
      }
    })
    expect(mocks.occurrences.lockOccurrence).toHaveBeenCalledWith(
      'ENCOUNTER',
      ids.command,
      occurrenceId
    )
  })

  it('replays the stored GM Legendary Resistance choice without the cleared pending context', async () => {
    const actionId = '00000000-0000-4000-8000-000000000098'
    const actorId = '00000000-0000-4000-8000-000000000099'
    const targetActorId = '00000000-0000-4000-8000-000000000100'
    const occurrenceId = '00000000-0000-4000-8000-000000000101'
    const input = {
      type: 'RESOLVE_ACTION' as const,
      encounterId: ids.command,
      commandId: '00000000-0000-4000-8000-000000000102',
      expectedVersion: 7,
      actorId,
      actionId,
      targetActorId,
      sceneContext: null
    }
    const receipt = {
      occurrenceId,
      commandId: input.commandId,
      commandFingerprint: createRuleExecutionCommandFingerprint(
        { aggregateKind: 'ENCOUNTER', aggregateId: ids.command, actorUserId: ids.owner },
        { commandId: input.commandId, correlationId: null, expectedAggregateVersion: 7 },
        'RULE_EXECUTION_START',
        {
          intentChecksum: checksumRuleDocument(
            createEncounterActionStartIntent({
              actionId,
              actorId,
              sceneContext: null,
              targetActorId
            })
          )
        }
      ),
      aggregateVersion: 6,
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: { transition: 'ACTION' },
      resultPayload: {
        status: 'PAUSED',
        occurrenceId,
        occurrenceVersion: 3,
        request: {
          kind: 'INTEGER_RANGE',
          requestId: 'legendary-choice',
          nodeId: 'choice',
          ordinal: 0,
          min: 0,
          max: 1
        },
        pending: {
          kind: 'LEGENDARY_RESISTANCE_CHOICE',
          targetActorId,
          useOptionId: 'a'.repeat(64)
        }
      }
    }
    const replayEncounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED' as const,
      manualReminderMode: 'OFF' as const,
      name: 'Legendary replay proof',
      status: 'ACTIVE' as const,
      version: 7,
      round: 1,
      currentActorId: null,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      actors: [],
      reminders: []
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: replayEncounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        currentVersion: 7
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue(receipt)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(replayEncounter, { actors: [] })
    })

    const replay = await executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
      rulesRuntime: {} as never
    })

    expect(replay.replayed).toBe(true)
    expect(replay.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 3,
      status: 'PENDING',
      pending: {
        kind: 'LEGENDARY_RESISTANCE_CHOICE',
        targetActorId,
        options: [{ optionId: 'a'.repeat(64) }],
        allowedResponses: ['DECLINE', 'OPTION']
      }
    })
    expect(mocks.occurrences.lockOccurrence).not.toHaveBeenCalled()
  })
})

describe('Encounter projection reads', () => {
  it('locates the current projection through its small relational envelope', async () => {
    await expect(getEncounterProjection({} as DBLike, ids.owner, ids.command)).resolves.toEqual({
      id: ids.command,
      version: 7
    })

    expect(mocks.encounter.findVersionMetadata).toHaveBeenCalledWith(ids.command)
    expect(mocks.encounter.requireCurrentProjection).toHaveBeenCalledWith({
      encounterId: ids.command,
      expectedStreamVersion: 7
    })
    expect(mocks.encounter.find).not.toHaveBeenCalled()
  })

  it('reads pending choices without claiming the live-session command lease', async () => {
    mocks.lockedContext.mockResolvedValue({
      encounter: {
        id: ids.command,
        campaignId: ids.campaign,
        version: 7,
        actors: []
      } as unknown as EncounterRecord,
      context: {
        campaignId: ids.campaign,
        encounterId: ids.command,
        role: 'OWNER',
        assignedCharacterId: null,
        currentVersion: 7
      }
    })

    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.owner, ids.command)
    ).resolves.toBeNull()

    expect(mocks.lockedContext).toHaveBeenCalledTimes(2)
    for (const [, input] of mocks.lockedContext.mock.calls) {
      expect(input).toMatchObject({ encounterId: ids.command, readOnly: true })
    }
  })
})

describe('Encounter actor prospective side correction', () => {
  const originalSideId = '00000000-0000-4000-8000-000000000030'
  const correctedSideId = '00000000-0000-4000-8000-000000000031'
  const actor = {
    id: ids.creature,
    encounterId: ids.command,
    sideId: originalSideId,
    kind: 'CUSTOM' as const,
    sourceId: null,
    sourceRevision: null,
    label: 'Corrected actor',
    systemId: ids.system,
    stableTieKey: 'corrected-actor',
    public: true,
    currentHitPoints: 8,
    maxHitPoints: 8,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: 0,
    snapshot: {},
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
  const currentRound = {
    round: {
      encounterId: ids.command,
      round: 1,
      procedure: 'SIDE_ROLL' as const,
      cadence: 'EACH_ROUND' as const,
      status: 'ORDERED' as const,
      policySnapshotChecksum: 'a'.repeat(64),
      nextTurnOrderOrdinal: 1,
      version: 2
    },
    participants: [
      {
        encounterId: ids.command,
        round: 1,
        actorId: ids.creature,
        sideId: originalSideId,
        status: 'ACTIVE' as const,
        initiativeScore: 14,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 0,
        version: 1
      }
    ],
    sides: [
      {
        encounterId: ids.command,
        round: 1,
        procedure: 'SIDE_ROLL' as const,
        sideId: originalSideId,
        status: 'ACTIVE' as const,
        initiativeScore: 14,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        sideOrderOrdinal: 0,
        version: 1
      }
    ]
  }
  const encounter = {
    id: ids.command,
    campaignId: ids.campaign,
    sessionId: ids.template,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: ids.template,
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot: null,
    optionalCombatSnapshotChecksum: null,
    automationMode: 'ASSISTED' as const,
    manualReminderMode: 'OFF' as const,
    name: 'Side correction',
    status: 'ACTIVE' as const,
    version: 3,
    round: 1,
    currentActorId: ids.creature,
    initiativeRoundState: currentRound,
    actors: [actor],
    reminders: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }

  function input(sideId = correctedSideId, commandId = ids.updateCommand) {
    return {
      type: 'UPDATE_ACTOR' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId,
      actorId: ids.creature,
      sideId
    }
  }

  beforeEach(() => {
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    mocks.encounter.find.mockResolvedValue({
      ...encounter,
      version: 4,
      actors: [{ ...actor, sideId: correctedSideId }],
      initiativeRoundState: currentRound
    })
    mocks.actorEvaluation.mockImplementation(
      async ({ encounter: evaluatedEncounter }: { encounter: EncounterRecord }) => ({
        snapshot: {
          encounterVersion: evaluatedEncounter.version,
          revisionId: evaluatedEncounter.rulePackRevisionId,
          facts: { contractVersion: 1, actors: [] },
          output: {
            actors: evaluatedEncounter.actors.map((candidate) => ({
              actorId: candidate.id,
              initiativeModifier: 0,
              targetProtection: { status: 'NOT_NORMALIZED' },
              featureResources: []
            }))
          }
        },
        reconciledEncounter: evaluatedEncounter,
        actorUpdates: [],
        zenEvaluationMs: 0
      })
    )
  })

  it('updates only the actor side and retains the current normalized round snapshot', async () => {
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input())
    ).resolves.toMatchObject({ replayed: false })

    expect(mocks.lockedContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authority: 'OWNER' })
    )
    expect(mocks.encounter.lockSide).toHaveBeenCalledWith(ids.command, correctedSideId)
    expect(mocks.encounter.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.creature, sideId: correctedSideId })
    )
    expect(mocks.encounter.lockInitiativeRound).not.toHaveBeenCalled()
    expect(mocks.encounter.find).toHaveBeenCalledWith(ids.command)
    expect(currentRound.participants[0]?.sideId).toBe(originalSideId)
    expect(currentRound.sides[0]?.sideId).toBe(originalSideId)
  })

  it('rejects a missing or foreign side before actor or aggregate mutation', async () => {
    mocks.encounter.lockSide.mockResolvedValue(false)

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input())
    ).rejects.toThrow('side was not found')

    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('replays an exact correction without revalidating or mutating its side', async () => {
    const command = input()
    const commandFingerprint = createHash('sha256').update(JSON.stringify(command)).digest('hex')
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'UPDATE_ACTOR',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: null
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, command)
    ).resolves.toMatchObject({ replayed: true })

    expect(mocks.encounter.lockSide).not.toHaveBeenCalled()
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
  })
})

describe('optional combat Encounter override', () => {
  const optionalSnapshot = {
    schemaVersion: 1 as const,
    gameSystemId: ids.system,
    definitions: []
  }
  const optionalChecksum = 'f'.repeat(64)
  const baseEncounter = {
    id: ids.command,
    campaignId: ids.campaign,
    sessionId: ids.template,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: ids.template,
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot: null,
    optionalCombatSnapshotChecksum: null,
    automationMode: 'ASSISTED' as const,
    manualReminderMode: 'OFF' as const,
    name: 'Optional rules',
    status: 'PREPARED' as const,
    version: 3,
    round: 0,
    currentActorId: null,
    actors: [],
    reminders: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
  const input = {
    type: 'REPLACE_OPTIONAL_COMBAT_RULES' as const,
    encounterId: ids.command,
    commandId: ids.updateCommand,
    expectedVersion: 3,
    definitionIds: [ids.template]
  }

  beforeEach(() => {
    mocks.lockedContext.mockResolvedValue({
      encounter: baseEncounter,
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    mocks.optionalCombat.mockResolvedValue({
      snapshot: optionalSnapshot,
      checksum: optionalChecksum
    })
    mocks.encounter.find.mockResolvedValue({
      ...baseEncounter,
      version: 4,
      optionalCombatSnapshot: optionalSnapshot,
      optionalCombatSnapshotChecksum: optionalChecksum
    })
  })

  it('replaces the frozen snapshot and pins its checksum in the ordinary terminal receipt', async () => {
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: false })

    expect(mocks.encounter.replaceOptionalCombatSnapshot).toHaveBeenCalledWith({
      encounterId: ids.command,
      snapshot: optionalSnapshot,
      checksum: optionalChecksum
    })
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'REPLACE_OPTIONAL_COMBAT_RULES',
        resultPayload: expect.objectContaining({ optionalCombatSnapshotChecksum: optionalChecksum })
      })
    )
  })

  it('replays an exact matching command without resolving or mutating again', async () => {
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      commandType: input.type,
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: null
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })

    expect(mocks.optionalCombat).not.toHaveBeenCalled()
    expect(mocks.encounter.replaceOptionalCombatSnapshot).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('rejects stale versions and pending occurrences before resolving or mutating', async () => {
    mocks.lockedContext.mockResolvedValue({
      encounter: { ...baseEncounter, version: 4 },
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('stale')
    expect(mocks.optionalCombat).not.toHaveBeenCalled()
    expect(mocks.encounter.replaceOptionalCombatSnapshot).not.toHaveBeenCalled()

    mocks.lockedContext.mockResolvedValue({
      encounter: baseEncounter,
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue({ pendingSnapshot: null })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(mocks.optionalCombat).not.toHaveBeenCalled()
    expect(mocks.encounter.replaceOptionalCombatSnapshot).not.toHaveBeenCalled()
  })

  it('does not swallow a terminal event failure after the replacement has been staged', async () => {
    mocks.encounter.appendEvent.mockRejectedValueOnce(new Error('injected event failure'))

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('injected event failure')
    expect(mocks.encounter.replaceOptionalCombatSnapshot).toHaveBeenCalledOnce()
    expect(mocks.encounter.update).toHaveBeenCalledOnce()
  })
})

describe('Creature equipment replacement', () => {
  const loadoutEntryId = '00000000-0000-4000-8000-000000000040'
  const replacementEquipmentId = '00000000-0000-4000-8000-000000000041'

  function fixture(status: 'PREPARED' | 'ACTIVE' | 'COMPLETED' = 'PREPARED') {
    const club = srdBaselineContent.subjects.equipment.find(
      (candidate) => candidate.label === 'Club'
    )
    if (!club) throw new Error('Missing SRD Club fixture.')
    const originalEquipment = { ...club, systemId: ids.system, userId: ids.owner }
    const replacementEquipment = {
      ...originalEquipment,
      id: replacementEquipmentId,
      label: 'Replacement club'
    }
    const source = {
      loadoutEntryId,
      equipmentId: originalEquipment.id,
      sourceRevision: 2,
      sourceVersionId: ids.template,
      sourceChecksum: checksumRuleDocument(originalEquipment),
      payload: originalEquipment
    }
    const actor = {
      id: ids.creature,
      encounterId: ids.command,
      kind: 'CREATURE' as const,
      sourceId: ids.creature,
      sourceRevision: 1,
      label: 'Club wielder',
      systemId: ids.system,
      stableTieKey: 'club-wielder',
      public: true,
      currentHitPoints: 8,
      maxHitPoints: 8,
      tempHitPoints: 2,
      conditions: { poisoned: false },
      resources: { charges: 1 },
      gmNotes: 'unchanged',
      initiative: 11,
      manualOrder: 0,
      snapshot: {
        kind: 'CREATURE',
        id: ids.creature,
        systemId: ids.system,
        sourceRevision: 1,
        sourceVersionId: ids.creature,
        sourceChecksum: 'a'.repeat(64),
        payload: {
          id: ids.creature,
          systemId: ids.system,
          features: [
            {
              id: ids.otherSystem,
              label: 'Club',
              description: '',
              order: 0,
              effects: originalEquipment.effects
            }
          ],
          equipmentLoadout: [
            {
              id: loadoutEntryId,
              equipmentId: originalEquipment.id,
              quantity: 1,
              useState: 'HELD',
              attuned: false,
              actionFeatureIds: [ids.otherSystem]
            },
            {
              id: '00000000-0000-4000-8000-000000000042',
              equipmentId: originalEquipment.id,
              quantity: 2,
              useState: 'CARRIED',
              attuned: false,
              actionFeatureIds: []
            }
          ]
        },
        ruleFacts: { exact: 'unchanged' },
        equipmentSources: [
          source,
          { ...source, loadoutEntryId: '00000000-0000-4000-8000-000000000042' }
        ]
      },
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z'
    }
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      initiativePolicySnapshot: null,
      initiativePolicySnapshotChecksum: null,
      optionalCombatSnapshot: null,
      optionalCombatSnapshotChecksum: null,
      automationMode: 'ASSISTED' as const,
      manualReminderMode: 'OFF' as const,
      name: 'Equipment proof',
      status,
      version: 3,
      round: 1,
      currentActorId: null,
      actors: [actor],
      reminders: [],
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z'
    }
    const input = {
      type: 'REPLACE_CREATURE_EQUIPMENT' as const,
      encounterId: ids.command,
      commandId: ids.updateCommand,
      expectedVersion: 3,
      actorId: actor.id,
      loadoutEntryId,
      equipmentId: replacementEquipmentId
    }
    return { actor, encounter, input, replacementEquipment }
  }

  beforeEach(() => {
    const { encounter, replacementEquipment } = fixture()
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          replacementEquipment.id,
          {
            authored: {
              document: replacementEquipment,
              versionId: '00000000-0000-4000-8000-000000000043',
              version: 4,
              checksum: checksumRuleDocument(replacementEquipment)
            }
          }
        ]
      ])
    )
    mocks.encounter.find.mockResolvedValue({ ...encounter, version: 4 })
    mocks.actorEvaluation.mockImplementation(
      async ({ encounter: evaluatedEncounter }: { encounter: EncounterRecord }) => ({
        snapshot: {
          encounterVersion: evaluatedEncounter.version,
          revisionId: evaluatedEncounter.rulePackRevisionId,
          facts: { contractVersion: 1, actors: [] },
          output: {
            actors: evaluatedEncounter.actors.map((candidate) => ({
              actorId: candidate.id,
              initiativeModifier: 0,
              targetProtection: { status: 'NOT_NORMALIZED' },
              featureResources: []
            }))
          }
        },
        reconciledEncounter: evaluatedEncounter,
        actorUpdates: [],
        zenEvaluationMs: 0
      })
    )
  })

  it.each(['PREPARED', 'ACTIVE'] as const)(
    'replaces exactly one pinned entry for a %s Encounter and records private provenance',
    async (status) => {
      const { encounter, input, replacementEquipment } = fixture(status)
      mocks.lockedContext.mockResolvedValue({
        encounter,
        context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
      })
      mocks.encounter.find.mockResolvedValue({ ...encounter, version: 4 })

      await expect(
        executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
      ).resolves.toMatchObject({ replayed: false })

      expect(mocks.lockedContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ authority: 'OWNER' })
      )
      const snapshot = mocks.encounter.replaceCreatureActorSnapshot.mock.calls[0]?.[0]?.snapshot
      expect(snapshot).toMatchObject({
        payload: encounter.actors[0]!.snapshot.payload,
        ruleFacts: { exact: 'unchanged' },
        equipmentLoadoutOverride: [
          { id: loadoutEntryId, equipmentId: replacementEquipment.id },
          {
            id: '00000000-0000-4000-8000-000000000042',
            equipmentId: encounter.actors[0]!.snapshot.payload.equipmentLoadout[1].equipmentId
          }
        ]
      })
      expect(snapshot.equipmentSources[1]).toEqual(
        encounter.actors[0]!.snapshot.equipmentSources[1]
      )
      expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
      expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          resultPayload: expect.objectContaining({
            creatureEquipmentReplacement: {
              actorId: ids.creature,
              loadoutEntryId,
              equipmentId: replacementEquipment.id,
              sourceRevision: 4,
              sourceVersionId: '00000000-0000-4000-8000-000000000043',
              sourceChecksum: checksumRuleDocument(replacementEquipment)
            }
          })
        })
      )
    }
  )

  it('short-circuits completed, stale, pending, and replayed commands before source resolution', async () => {
    const { encounter, input } = fixture('COMPLETED')
    mocks.lockedContext.mockResolvedValue({ encounter, context: { role: 'OWNER' } })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('Completed')
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()

    mocks.lockedContext.mockResolvedValue({
      encounter: { ...fixture().encounter, version: 4 },
      context: { role: 'OWNER' }
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('stale')
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()

    mocks.lockedContext.mockResolvedValue({
      encounter: fixture().encounter,
      context: { role: 'OWNER' }
    })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue({ pendingSnapshot: null })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('Rule occurrence is unavailable')
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()

    mocks.occurrences.lockPendingEncounter.mockResolvedValue(null)
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      commandType: input.type,
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: null
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.authoredVersions.findActiveByIds).not.toHaveBeenCalled()
    expect(mocks.encounter.replaceCreatureActorSnapshot).not.toHaveBeenCalled()
  })

  it('rejects incompatible replacement composition or a stale snapshot row before appending an event', async () => {
    const { input, replacementEquipment } = fixture()
    const incompatible = { ...replacementEquipment, effects: [] }
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          incompatible.id,
          {
            authored: {
              document: incompatible,
              versionId: '00000000-0000-4000-8000-000000000043',
              version: 4,
              checksum: checksumRuleDocument(incompatible)
            }
          }
        ]
      ])
    )
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('incompatible')
    expect(mocks.encounter.replaceCreatureActorSnapshot).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()

    const valid = fixture()
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          valid.replacementEquipment.id,
          {
            authored: {
              document: valid.replacementEquipment,
              versionId: '00000000-0000-4000-8000-000000000043',
              version: 4,
              checksum: checksumRuleDocument(valid.replacementEquipment)
            }
          }
        ]
      ])
    )
    mocks.encounter.replaceCreatureActorSnapshot.mockResolvedValueOnce(false)
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, valid.input)
    ).rejects.toThrow('changed before replacement')
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('maps only the replacement source failure while preserving frozen-snapshot corruption', async () => {
    const { input } = fixture()
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(new Map())
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toMatchObject({
      name: 'EncounterValidationError',
      message: 'Creature Equipment source is unavailable.'
    })

    const corrupt = fixture()
    mocks.authoredVersions.findActiveByIds.mockResolvedValue(
      new Map([
        [
          corrupt.replacementEquipment.id,
          {
            authored: {
              document: corrupt.replacementEquipment,
              versionId: '00000000-0000-4000-8000-000000000043',
              version: 4,
              checksum: checksumRuleDocument(corrupt.replacementEquipment)
            }
          }
        ]
      ])
    )
    mocks.lockedContext.mockResolvedValue({
      encounter: {
        ...corrupt.encounter,
        actors: [
          {
            ...corrupt.actor,
            snapshot: { ...corrupt.actor.snapshot, equipmentSources: null }
          }
        ]
      },
      context: { role: 'OWNER', campaignId: ids.campaign, assignedCharacterId: null }
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, corrupt.input)
    ).rejects.toThrow(/snapshot/i)
    expect(mocks.encounter.replaceCreatureActorSnapshot).not.toHaveBeenCalled()
  })
})

describe('Encounter turn rule-receipt replay', () => {
  const turnActor = {
    id: ids.creature,
    encounterId: ids.command,
    kind: 'CHARACTER' as const,
    sourceId: ids.creature,
    sourceRevision: 1,
    label: 'Hero',
    systemId: ids.system,
    stableTieKey: 'hero',
    public: true,
    currentHitPoints: 8,
    maxHitPoints: 8,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: 10,
    manualOrder: 0,
    snapshot: {},
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z'
  }
  const turnEncounter = {
    id: ids.command,
    campaignId: ids.campaign,
    sessionId: ids.template,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: ids.template,
    automationMode: 'AUTOMATIC' as const,
    manualReminderMode: 'OFF' as const,
    name: 'Turn proof',
    status: 'PREPARED' as const,
    version: 3,
    round: 0,
    currentActorId: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    actors: [turnActor],
    reminders: []
  }

  function turnInput(commandId = ids.command) {
    return {
      type: 'START' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId
    }
  }

  function turnBatchResult(occurrenceId: string) {
    const before = {
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: [],
      scalarValues: {}
    }
    const after = { ...before, conditionIds: [ids.updateCommand] }
    return {
      status: 'BATCH_COMPLETE' as const,
      batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' as const,
      schemaVersion: 1 as const,
      occurrenceId,
      occurrenceVersion: 0,
      encounterId: ids.command,
      commandType: 'START' as const,
      initiative: null,
      initiativeAdvance: null,
      executions: [
        {
          ordinal: 0,
          boundaryOrdinal: 0,
          stage: 'START_OF_TURN' as const,
          targetActorId: ids.creature,
          owner: { kind: 'CHARACTER' as const, characterId: ids.creature },
          activeEffectId: ids.campaign,
          createdOrdinal: 1,
          beforeVersion: 1,
          definition: {
            authoredEffectId: ids.template,
            compiledEntryId: ids.otherSystem,
            frozenGraphNodeId: 'effect-node',
            frozenSourceChecksum: 'a'.repeat(64),
            capabilityContractVersion: 1,
            definitionChecksum: 'b'.repeat(64)
          },
          execution: {
            status: 'COMPLETE' as const,
            outputs: {},
            evidence: {
              source: {
                definitionId: ids.template,
                gameSystemId: ids.system,
                definitionFamilyKey: 'effect',
                checksum: 'a'.repeat(64)
              },
              capabilityContractVersion: 1,
              facts: {},
              sourceEntryBindings: [{ sourceEntryId: ids.otherSystem, nodeId: 'effect-node' }],
              trace: [
                {
                  nodeId: 'effect-node',
                  operation: { key: 'effect.apply', contractVersion: 1 },
                  inputs: {},
                  outputs: {
                    targetActorId: ids.creature,
                    conditionId: ids.updateCommand,
                    resolvedPath: 'START_OF_TURN',
                    applicationCandidate: true,
                    authorized: true,
                    targetStateChecksum: 'c'.repeat(64)
                  }
                }
              ],
              outputs: {}
            }
          },
          d20: null,
          targetTransition: { checksum: 'c'.repeat(64), before, after },
          applications: [
            {
              ordinal: 0,
              kind: 'CONDITION_APPLY' as const,
              conditionId: ids.updateCommand,
              beforePresent: false,
              afterPresent: true as const,
              applied: true,
              sourceNodeId: 'effect-node',
              sourceOperationKey: 'effect.apply',
              authoredPath: null,
              resolvedPath: 'START_OF_TURN'
            }
          ],
          lifecycle: {
            kind: 'EXPIRE' as const,
            expectedVersion: 1,
            beforeRemainingTicks: 1,
            afterRemainingTicks: 0 as const,
            beforeLifecycleChecksum: 'd'.repeat(64)
          }
        }
      ],
      encounterActorTransitions: [],
      characterTransitions: [
        {
          characterId: ids.creature,
          targetActorId: ids.creature,
          beforeStreamVersion: 4,
          afterStreamVersion: 5,
          before,
          after
        }
      ]
    }
  }

  function legendaryChoice(ownerActorId = ids.creature) {
    return {
      ownerActorId,
      options: [
        {
          optionId: 'f'.repeat(64),
          ownerActorId,
          ownerFeatureId: ids.template,
          actionId: 'legendary-strike',
          targetActorId: ownerActorId,
          actionSourceChecksum: 'a'.repeat(64),
          chargeId: ids.updateCommand,
          featureCost: 1,
          poolBefore: 3,
          poolRemaining: 2,
          lifecycle: {
            definitionId: ids.otherSystem,
            definitionVersion: 1,
            definitionChecksum: 'b'.repeat(64),
            eligibilityGraphDefinitionId: ids.campaign,
            eligibilityGraphDefinitionVersion: 1,
            eligibilityGraphDefinitionChecksum: 'c'.repeat(64),
            eligibleOutput: 'eligible'
          },
          eligibilityEvidenceChecksum: 'd'.repeat(64)
        }
      ]
    }
  }

  function legendaryTurnFixture(automationMode: 'AUTOMATIC' | 'ASSISTED') {
    const nextActorId = ids.updateCommand
    const encounter = {
      ...turnEncounter,
      automationMode,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      actors: [turnActor, { ...turnActor, id: nextActorId, label: 'Next actor', manualOrder: 1 }]
    }
    const now = '2026-08-28T00:00:00.000Z'
    return {
      encounter,
      nextActorId,
      initiative: {
        round: {
          encounterId: ids.command,
          round: 1,
          procedure: 'ACTOR_ROLL' as const,
          cadence: 'ENCOUNTER_START' as const,
          status: 'ACTIVE' as const,
          policySnapshotChecksum: null,
          nextTurnOrderOrdinal: 2,
          version: 1,
          createdAt: now,
          updatedAt: now
        },
        participants: [
          {
            encounterId: ids.command,
            round: 1,
            actorId: ids.creature,
            sideId: ids.system,
            status: 'ACTIVE' as const,
            initiativeScore: 17,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            declaration: null,
            declarationChecksum: null,
            turnOrderOrdinal: 0,
            version: 1,
            createdAt: now,
            updatedAt: now
          },
          {
            encounterId: ids.command,
            round: 1,
            actorId: nextActorId,
            sideId: ids.system,
            status: 'READY' as const,
            initiativeScore: 12,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            declaration: null,
            declarationChecksum: null,
            turnOrderOrdinal: 1,
            version: 1,
            createdAt: now,
            updatedAt: now
          }
        ],
        sides: []
      }
    }
  }

  function initiativePendingState(occurrenceId: string) {
    return {
      phase: 'PRIMARY_SCORE' as const,
      scoreBatch: {
        kind: 'PENDING' as const,
        completed: [],
        current: {
          kind: 'ACTOR' as const,
          id: ids.creature,
          binding: { automatic: true, facts: { 'initiative.value': 10 } }
        },
        remaining: [],
        continuation: {
          schemaVersion: 1 as const,
          occurrenceId,
          graph: {
            schemaVersion: 1 as const,
            source: {
              definitionId: ids.template,
              gameSystemId: ids.system,
              definitionFamilyKey: 'initiative-score',
              checksum: 'f'.repeat(64)
            },
            capabilityContractVersion: 1,
            factContracts: [],
            nodes: [
              {
                id: 'resolve',
                operation: { key: 'initiative.resolve', contractVersion: 1 },
                inputs: {}
              }
            ],
            outputs: {
              score: {
                kind: 'NODE_OUTPUT' as const,
                nodeId: 'resolve',
                port: 'score'
              }
            }
          },
          facts: {},
          nextNodeIndex: 0,
          nodeOutputs: {},
          trace: [],
          request: {
            requestId: 'initiative-score',
            kind: 'INTEGER_RANGE' as const,
            nodeId: 'resolve',
            ordinal: 0,
            min: 1,
            max: 20
          },
          authority: 'APPLICATION_SERVICE' as const,
          redaction: 'SERVER_ONLY' as const,
          seal: 'b'.repeat(64)
        }
      }
    }
  }

  beforeEach(() => {
    mocks.lockedContext.mockResolvedValue({
      encounter: turnEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER' }
    })
    mocks.startInitiativeCommand.mockResolvedValue({
      kind: 'COMPLETE',
      state: {
        round: {
          round: 1,
          cadence: 'ENCOUNTER_START',
          procedure: 'MANUAL',
          policySnapshotChecksum: null
        }
      },
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
    })
  })

  it('replays a valid linked Batch receipt before turn-effect work', async () => {
    const input = turnInput()
    const { createHash } = await import('node:crypto')
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const occurrenceId = '00000000-0000-4000-8000-000000000099'
    const result = { status: 'BATCH_COMPLETE', occurrenceId }
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'START',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum: checksumCanonicalJson(result)
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      occurrenceId,
      commandFingerprint,
      commandType: 'START',
      aggregateId: ids.command,
      aggregateVersion: 4,
      commandMetadata: { transition: 'TURN_EFFECTS' },
      resultPayload: result
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.occurrences.createCompleted).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('replays a linked composite each-round receipt before turn-effect work', async () => {
    const input = {
      type: 'ADVANCE_TURN' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000079'
    }
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const occurrenceId = '00000000-0000-4000-8000-000000000078'
    const result = { status: 'TURN_LIFECYCLE_COMPLETE', occurrenceId }
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'ADVANCE_TURN',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum: checksumCanonicalJson(result)
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      occurrenceId,
      commandFingerprint,
      commandType: 'ADVANCE_TURN',
      aggregateId: ids.command,
      aggregateVersion: 4,
      commandMetadata: { transition: 'TURN_EFFECTS' },
      resultPayload: result
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.occurrences.createCompleted).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('links a successful START root event to its exact completed Batch receipt', async () => {
    const input = turnInput('00000000-0000-4000-8000-000000000098')
    const occurrenceId = '00000000-0000-4000-8000-000000000099'
    const batch = turnBatchResult(occurrenceId)
    const updated = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      version: 4,
      round: 1,
      currentActorId: ids.creature
    }
    mocks.encounter.find.mockResolvedValue(updated)
    mocks.turnEffects.mockResolvedValue({
      result: batch,
      selectionChecksum: 'a'.repeat(64)
    })
    mocks.actorEvaluation.mockImplementation(async ({ encounter }) => ({
      snapshot: {
        encounterVersion: encounter.version,
        revisionId: encounter.rulePackRevisionId,
        facts: { contractVersion: 1, actors: [] },
        output: { actors: [] }
      },
      reconciledEncounter: encounter,
      actorUpdates: [],
      zenEvaluationMs: 0
    }))

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never,
        createRuleOccurrenceId: () => occurrenceId
      })
    ).resolves.toMatchObject({ replayed: false })
    expect(mocks.turnEffects).toHaveBeenCalledWith(
      expect.objectContaining({ commandType: 'START', occurrenceId })
    )
    expect(mocks.occurrences.createCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: ids.command,
        occurrenceId,
        aggregateVersion: 4
      })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          ...batch,
          initiative: expect.objectContaining({
            orderedActorIds: [ids.creature]
          })
        }),
        commandType: 'START',
        aggregateVersion: 4
      })
    )
    const terminalResult = mocks.occurrences.appendReceipt.mock.calls[0]![0].resultPayload
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          ruleReceipt: {
            occurrenceId,
            resultChecksum: checksumCanonicalJson(terminalResult)
          }
        })
      })
    )
    expect(mocks.occurrences.appendReceipt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.encounter.appendEvent.mock.invocationCallOrder[0]!
    )
  })

  it('records and applies same-round initiative advancement when no active effect executes', async () => {
    const nextActorId = ids.updateCommand
    const occurrenceId = '00000000-0000-4000-8000-000000000089'
    const input = {
      type: 'ADVANCE_TURN' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000088'
    }
    const activeEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      actors: [turnActor, { ...turnActor, id: nextActorId, label: 'Next actor', manualOrder: 1 }]
    }
    const now = '2026-08-28T00:00:00.000Z'
    const initiativeState = {
      round: {
        encounterId: ids.command,
        round: 1,
        procedure: 'ACTOR_ROLL' as const,
        cadence: 'ENCOUNTER_START' as const,
        status: 'ACTIVE' as const,
        policySnapshotChecksum: null,
        nextTurnOrderOrdinal: 2,
        version: 1,
        createdAt: now,
        updatedAt: now
      },
      participants: [
        {
          encounterId: ids.command,
          round: 1,
          actorId: ids.creature,
          sideId: ids.system,
          status: 'ACTIVE' as const,
          initiativeScore: 17,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          declaration: null,
          declarationChecksum: null,
          turnOrderOrdinal: 0,
          version: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          encounterId: ids.command,
          round: 1,
          actorId: nextActorId,
          sideId: ids.system,
          status: 'READY' as const,
          initiativeScore: 12,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          declaration: null,
          declarationChecksum: null,
          turnOrderOrdinal: 1,
          version: 1,
          createdAt: now,
          updatedAt: now
        }
      ],
      sides: []
    }
    const updated = {
      ...activeEncounter,
      version: 4,
      currentActorId: nextActorId
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: activeEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER' }
    })
    mocks.encounter.lockInitiativeRound.mockResolvedValue(initiativeState)
    mocks.applyInitiativeAdvance.mockImplementation(async ({ plan }) => ({
      round: plan.round,
      currentActorId: plan.nextActorId
    }))
    mocks.encounter.find.mockResolvedValue(updated)

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never,
        createRuleOccurrenceId: () => occurrenceId
      })
    ).resolves.toMatchObject({ replayed: false })

    expect(mocks.turnEffects).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        commandType: 'ADVANCE_TURN',
        boundaries: [{ ordinal: 0, stage: 'END_OF_TURN', actorId: ids.creature }]
      })
    )
    expect(mocks.turnEffects).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        commandType: 'ADVANCE_TURN',
        boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: nextActorId }],
        coordinatorRoot: expect.objectContaining({ outgoingTurn: { kind: 'NONE' } })
      })
    )
    expect(mocks.applyInitiativeAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: ids.command,
        plan: expect.objectContaining({
          kind: 'SAME_ROUND',
          currentActorId: ids.creature,
          nextActorId
        })
      })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        resultPayload: expect.objectContaining({
          status: 'TURN_LIFECYCLE_COMPLETE',
          initiative: null,
          initiativeAdvance: expect.objectContaining({
            kind: 'SAME_ROUND',
            nextActorId
          }),
          outgoingTurn: { kind: 'NONE', selectionChecksum: null },
          incomingTurn: { kind: 'NONE', selectionChecksum: null }
        }),
        commandMetadata: expect.objectContaining({
          initiativeChecksum: null,
          initiativeAdvanceChecksum: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      })
    )
    expect(mocks.encounter.update).toHaveBeenCalledWith({
      encounterId: ids.command,
      status: 'ACTIVE',
      version: 4,
      round: 1,
      currentActorId: nextActorId
    })
  })

  it('queues ordered Legendary Action owner choices and resumes the turn only after each decline', async () => {
    const nextActorId = ids.updateCommand
    const occurrenceId = '00000000-0000-4000-8000-000000000085'
    const rootCommandId = '00000000-0000-4000-8000-000000000084'
    const activeEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      actors: [turnActor, { ...turnActor, id: nextActorId, label: 'Next actor', manualOrder: 1 }]
    }
    const now = '2026-08-28T00:00:00.000Z'
    mocks.lockedContext.mockResolvedValue({
      encounter: activeEncounter,
      context: {
        campaignId: ids.campaign,
        attunementSlotOverride: null,
        role: 'OWNER'
      }
    })
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(activeEncounter, { actors: [] })
    })
    mocks.encounter.lockInitiativeRound.mockResolvedValue({
      round: {
        encounterId: ids.command,
        round: 1,
        procedure: 'ACTOR_ROLL',
        cadence: 'ENCOUNTER_START',
        status: 'ACTIVE',
        policySnapshotChecksum: null,
        nextTurnOrderOrdinal: 2,
        version: 1,
        createdAt: now,
        updatedAt: now
      },
      participants: [
        {
          encounterId: ids.command,
          round: 1,
          actorId: ids.creature,
          sideId: ids.system,
          status: 'ACTIVE',
          initiativeScore: 17,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          declaration: null,
          declarationChecksum: null,
          turnOrderOrdinal: 0,
          version: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          encounterId: ids.command,
          round: 1,
          actorId: nextActorId,
          sideId: ids.system,
          status: 'READY',
          initiativeScore: 12,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          declaration: null,
          declarationChecksum: null,
          turnOrderOrdinal: 1,
          version: 1,
          createdAt: now,
          updatedAt: now
        }
      ],
      sides: []
    })
    const choice = legendaryChoice()
    const secondChoice = legendaryChoice(nextActorId)
    mocks.discoverLegendaryActionWindows.mockResolvedValue({
      windows: [{ choice }, { choice: secondChoice }]
    })
    mocks.occurrences.createPending.mockImplementationOnce(async (input) => ({
      id: input.occurrenceId,
      aggregateKind: input.aggregateKind,
      aggregateId: input.aggregateId,
      expectedAggregateVersion: input.expectedAggregateVersion,
      version: 0,
      state: 'PENDING',
      pendingSnapshot: input.pendingSnapshot
    }))

    await expect(
      executeEncounterCommandWithRuleSnapshot(
        {} as DBLike,
        ids.owner,
        {
          type: 'ADVANCE_TURN',
          encounterId: ids.command,
          expectedVersion: 3,
          commandId: rootCommandId
        },
        { rulesRuntime: {} as never, createRuleOccurrenceId: () => occurrenceId }
      )
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          status: 'PENDING',
          pending: {
            kind: 'LEGENDARY_ACTION_CHOICE',
            ownerActorId: ids.creature,
            allowedResponses: ['DECLINE', 'OPTION']
          }
        }
      }
    })
    const pendingSnapshot = mocks.occurrences.createPending.mock.calls.at(-1)![0].pendingSnapshot
    expect(pendingSnapshot).toMatchObject({
      snapshotKind: 'AGGREGATE_CHOICE',
      applicationContext: {
        kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
        choice,
        root: {
          outgoingTurn: { kind: 'NONE' },
          legendaryActionQueue: {
            ownerActorIds: [ids.creature, nextActorId],
            nextOwnerIndex: 0
          }
        }
      }
    })
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    expect(mocks.discoverRechargeCandidates).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()

    const resolutionCommandId = '00000000-0000-4000-8000-000000000083'
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING',
      pendingSnapshot
    })
    mocks.discoverLegendaryActionWindow.mockResolvedValue({ choice: secondChoice })
    const firstResult = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: ids.command,
        expectedVersion: 3,
        commandId: resolutionCommandId,
        correlationId: null,
        occurrenceId,
        expectedOccurrenceVersion: 0,
        resolution: { kind: 'DECLINE' }
      },
      { rulesRuntime: {} as never }
    )

    expect(firstResult).toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          status: 'PENDING',
          pending: { kind: 'LEGENDARY_ACTION_CHOICE', ownerActorId: nextActorId }
        }
      }
    })
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    const secondPendingSnapshot =
      mocks.occurrences.advancePending.mock.calls.at(-1)![0].pendingSnapshot
    expect(secondPendingSnapshot).toMatchObject({
      applicationContext: {
        choice: secondChoice,
        root: {
          completedLegendaryActions: [
            expect.objectContaining({ resolution: { kind: 'DECLINED' } })
          ],
          legendaryActionQueue: {
            ownerActorIds: [ids.creature, nextActorId],
            nextOwnerIndex: 1
          }
        }
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 1,
      state: 'PENDING',
      pendingSnapshot: secondPendingSnapshot
    })
    mocks.applyInitiativeAdvance.mockResolvedValue({ round: 1, currentActorId: nextActorId })
    mocks.encounter.find.mockResolvedValue({
      ...activeEncounter,
      version: 4,
      currentActorId: nextActorId
    })
    const result = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: ids.command,
        expectedVersion: 3,
        commandId: '00000000-0000-4000-8000-000000000082',
        correlationId: null,
        occurrenceId,
        expectedOccurrenceVersion: 1,
        resolution: { kind: 'DECLINE' }
      },
      { rulesRuntime: {} as never }
    )
    expect(result).toMatchObject({
      replayed: false,
      response: { occurrence: { status: 'COMPLETE' } }
    })
    expect(mocks.occurrences.appendReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          status: 'TURN_LIFECYCLE_COMPLETE',
          legendaryActions: [
            expect.objectContaining({ choice, resolution: { kind: 'DECLINED' } }),
            expect.objectContaining({ choice: secondChoice, resolution: { kind: 'DECLINED' } })
          ],
          incomingTurn: { kind: 'NONE', selectionChecksum: null }
        }),
        commandMetadata: expect.objectContaining({
          resolutionCommands: [
            expect.objectContaining({ kind: 'LEGENDARY_DECLINE' }),
            expect.objectContaining({ kind: 'LEGENDARY_DECLINE' })
          ]
        })
      })
    )
    expect(mocks.applyInitiativeAdvance).toHaveBeenCalledTimes(1)
    expect(mocks.discoverRechargeCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: nextActorId })
    )
    expect(mocks.encounter.update).toHaveBeenCalledWith({
      encounterId: ids.command,
      status: 'ACTIVE',
      version: 4,
      round: 1,
      currentActorId: nextActorId
    })
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: rootCommandId,
        commandType: 'ADVANCE_TURN',
        version: 4,
        resultPayload: expect.objectContaining({
          ruleReceipt: expect.objectContaining({ occurrenceId })
        })
      })
    )
  })

  it('retains an Assisted Legendary Action selection through exact d20 evidence and settles once', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000082'
    const rootCommandId = '00000000-0000-4000-8000-000000000081'
    const { encounter, initiative, nextActorId } = legendaryTurnFixture('ASSISTED')
    const choice = legendaryChoice()
    const option = choice.options[0]!
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        campaignId: ids.campaign,
        attunementSlotOverride: null,
        role: 'OWNER'
      }
    })
    mocks.encounter.lockInitiativeRound.mockResolvedValue(initiative)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(encounter, { actors: [] })
    })
    mocks.discoverLegendaryActionWindows.mockResolvedValue({
      windows: [{ choice }]
    })
    mocks.occurrences.createPending.mockImplementationOnce(async (input) => ({
      id: input.occurrenceId,
      aggregateKind: input.aggregateKind,
      aggregateId: input.aggregateId,
      expectedAggregateVersion: input.expectedAggregateVersion,
      version: 0,
      state: 'PENDING',
      pendingSnapshot: input.pendingSnapshot
    }))

    await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      {
        type: 'ADVANCE_TURN',
        encounterId: ids.command,
        expectedVersion: 3,
        commandId: rootCommandId
      },
      { rulesRuntime: {} as never, createRuleOccurrenceId: () => occurrenceId }
    )
    const choiceSnapshot = mocks.occurrences.createPending.mock.calls.at(-1)![0].pendingSnapshot
    mocks.discoverLegendaryActionWindow.mockResolvedValue({ choice })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING',
      pendingSnapshot: choiceSnapshot
    })
    const prepared = { choice, option }
    mocks.prepareLegendaryAction.mockResolvedValue(prepared)
    const continuation = initiativePendingState(occurrenceId).scoreBatch.continuation
    const d20Policy = {
      requestNodeId: continuation.request.nodeId,
      rollMode: 'NORMAL' as const,
      contributors: [],
      contributorChecksum: 'e'.repeat(64),
      modifier: 3,
      dc: 15
    }
    mocks.executeLegendaryAction.mockResolvedValueOnce({
      kind: 'PENDING',
      continuation,
      d20Policy
    })
    const optionCommandId = '00000000-0000-4000-8000-000000000080'
    const optionResult = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: ids.command,
        expectedVersion: 3,
        commandId: optionCommandId,
        correlationId: null,
        occurrenceId,
        expectedOccurrenceVersion: 0,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      },
      { rulesRuntime: {} as never }
    )
    expect(optionResult).toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          status: 'PENDING',
          pending: {
            kind: 'D20_EVIDENCE',
            request: { requestId: continuation.request.requestId, rollMode: 'NORMAL' },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
          }
        }
      }
    })
    expect(mocks.settleLegendaryAction).not.toHaveBeenCalled()
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    const evidenceSnapshot = mocks.occurrences.advancePending.mock.calls.at(-1)![0].pendingSnapshot
    const optionReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)![0]
    expect(evidenceSnapshot).toMatchObject({
      snapshotKind: 'KERNEL_EVIDENCE',
      applicationContext: {
        kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
        choice,
        selectedOption: option,
        d20Policy
      }
    })

    const beforeOptionReplay = {
      execute: mocks.executeLegendaryAction.mock.calls.length,
      settle: mocks.settleLegendaryAction.mock.calls.length,
      advancePending: mocks.occurrences.advancePending.mock.calls.length
    }
    mocks.occurrences.findReceipt.mockResolvedValueOnce(optionReceipt)
    await expect(
      executeEncounterCommandWithRuleSnapshot(
        {} as DBLike,
        ids.owner,
        {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: ids.command,
          expectedVersion: 3,
          commandId: optionCommandId,
          correlationId: null,
          occurrenceId,
          expectedOccurrenceVersion: 0,
          resolution: { kind: 'OPTION', optionId: option.optionId }
        },
        { rulesRuntime: {} as never }
      )
    ).resolves.toMatchObject({ replayed: true })
    expect({
      execute: mocks.executeLegendaryAction.mock.calls.length,
      settle: mocks.settleLegendaryAction.mock.calls.length,
      advancePending: mocks.occurrences.advancePending.mock.calls.length
    }).toEqual(beforeOptionReplay)

    mocks.occurrences.lockPendingEncounter.mockResolvedValueOnce({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      rootCommandId,
      version: 1,
      state: 'PENDING',
      pendingSnapshot: evidenceSnapshot
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot(
        {} as DBLike,
        ids.owner,
        {
          type: 'ADVANCE_TURN',
          encounterId: ids.command,
          expectedVersion: 3,
          commandId: rootCommandId
        },
        { rulesRuntime: {} as never }
      )
    ).resolves.toMatchObject({
      replayed: true,
      response: { occurrence: { status: 'PENDING', pending: { kind: 'D20_EVIDENCE' } } }
    })

    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 1,
      state: 'PENDING',
      pendingSnapshot: evidenceSnapshot
    })
    mocks.executeLegendaryAction.mockResolvedValueOnce({ kind: 'COMPLETE' })
    const targetState = {
      currentHitPoints: 8,
      temporaryHitPoints: 0,
      maximumHitPoints: 8,
      conditionIds: [],
      scalarValues: {}
    }
    const application = {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' as const,
      schemaVersion: 1 as const,
      occurrenceId,
      sourceActorId: ids.creature,
      targetActorId: ids.creature,
      sourceCharacterStreamVersion: null,
      resourceConsumption: null,
      featureResourceConsumption: {
        ownerActorId: ids.creature,
        ownerFeatureId: option.ownerFeatureId,
        chargeId: option.chargeId,
        cost: option.featureCost,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: option.poolBefore,
        afterRemaining: option.poolRemaining
      },
      targetFeatureResourceConsumption: null,
      d20: null,
      nestedD20: null,
      legendaryResistance: null,
      spellCastConsumption: null,
      activeEffectTransitions: [],
      stateEffectTransitions: [],
      targetTransition: {
        checksum: 'f'.repeat(64),
        before: targetState,
        after: targetState
      },
      applications: []
    }
    const terminalEvidence = {
      choice,
      selectionChecksum: checksumRuleDocument(choice),
      resolution: {
        kind: 'EXECUTED' as const,
        selectedOptionId: option.optionId,
        execution: turnBatchResult(occurrenceId).executions[0]!.execution,
        application,
        characterTransitions: []
      }
    }
    mocks.settleLegendaryAction.mockResolvedValue({
      application,
      sourceActorId: ids.creature,
      evidence: terminalEvidence
    })
    mocks.applyInitiativeAdvance.mockResolvedValue({ round: 1, currentActorId: nextActorId })
    mocks.encounter.find.mockResolvedValue({
      ...encounter,
      version: 4,
      currentActorId: nextActorId
    })
    const evidenceCommandId = '00000000-0000-4000-8000-000000000079'
    const evidenceCommand = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: evidenceCommandId,
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 1,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: continuation.request.requestId,
        rawFaces: [14]
      }
    }
    const terminal = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      evidenceCommand,
      { rulesRuntime: {} as never }
    )

    expect(terminal).toMatchObject({
      replayed: false,
      response: { occurrence: { status: 'COMPLETE' } }
    })
    expect(mocks.executeLegendaryAction).toHaveBeenCalledTimes(2)
    expect(mocks.settleLegendaryAction).toHaveBeenCalledTimes(1)
    expect(mocks.occurrences.appendReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          status: 'TURN_LIFECYCLE_COMPLETE',
          legendaryActions: [expect.objectContaining(terminalEvidence)]
        })
      })
    )
    const terminalReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)![0]
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 2,
      state: 'COMPLETED',
      pendingSnapshot: null
    })
    mocks.occurrences.findTerminalReceiptByOccurrence.mockResolvedValue(terminalReceipt)
    const beforeReplay = {
      execute: mocks.executeLegendaryAction.mock.calls.length,
      settle: mocks.settleLegendaryAction.mock.calls.length,
      advance: mocks.applyInitiativeAdvance.mock.calls.length,
      update: mocks.encounter.update.mock.calls.length,
      complete: mocks.occurrences.complete.mock.calls.length
    }
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, evidenceCommand, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({ replayed: true })
    expect({
      execute: mocks.executeLegendaryAction.mock.calls.length,
      settle: mocks.settleLegendaryAction.mock.calls.length,
      advance: mocks.applyInitiativeAdvance.mock.calls.length,
      update: mocks.encounter.update.mock.calls.length,
      complete: mocks.occurrences.complete.mock.calls.length
    }).toEqual(beforeReplay)
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: rootCommandId,
        commandType: 'ADVANCE_TURN',
        version: 4,
        resultPayload: expect.objectContaining({
          ruleReceipt: expect.objectContaining({ occurrenceId })
        })
      })
    )
  })

  it('reruns each-round initiative between outgoing and incoming turn boundaries', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000087'
    const input = {
      type: 'ADVANCE_TURN' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000086'
    }
    const activeEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    const now = '2026-08-28T00:00:00.000Z'
    mocks.lockedContext.mockResolvedValue({
      encounter: activeEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER' }
    })
    mocks.encounter.lockInitiativeRound.mockResolvedValue({
      round: {
        encounterId: ids.command,
        round: 1,
        procedure: 'ACTOR_ROLL',
        cadence: 'EACH_ROUND',
        status: 'ACTIVE',
        policySnapshotChecksum: 'e'.repeat(64),
        nextTurnOrderOrdinal: 1,
        version: 1,
        createdAt: now,
        updatedAt: now
      },
      participants: [
        {
          encounterId: ids.command,
          round: 1,
          actorId: ids.creature,
          sideId: ids.system,
          status: 'ACTIVE',
          initiativeScore: 17,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          declaration: null,
          declarationChecksum: null,
          turnOrderOrdinal: 0,
          version: 1,
          createdAt: now,
          updatedAt: now
        }
      ],
      sides: []
    })
    mocks.applyInitiativeAdvance.mockResolvedValue({
      round: 2,
      currentActorId: null,
      state: {}
    })
    mocks.startInitiativeCommand.mockResolvedValue({
      kind: 'COMPLETE',
      state: {
        round: {
          round: 2,
          cadence: 'EACH_ROUND',
          procedure: 'ACTOR_ROLL',
          policySnapshotChecksum: 'e'.repeat(64)
        },
        participants: stagedInitiativeRound({
          round: 1,
          cadence: 'ENCOUNTER_START',
          checksum: 'e'.repeat(64)
        }).participants
      },
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR', id: ids.creature },
            result: { kind: 'FACTS_UNAVAILABLE' }
          }
        ],
        tieAttempts: [],
        orderChoices: []
      }
    })
    const updated = { ...activeEncounter, version: 4, round: 2 }
    mocks.encounter.find.mockResolvedValueOnce(activeEncounter).mockResolvedValueOnce(updated)

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never,
        createRuleOccurrenceId: () => occurrenceId
      })
    ).resolves.toMatchObject({ replayed: false })

    expect(mocks.turnEffects).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        boundaries: [{ ordinal: 0, stage: 'END_OF_TURN', actorId: ids.creature }]
      })
    )
    expect(mocks.startInitiativeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ round: 2, occurrenceId })
    )
    expect(mocks.discoverRechargeCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ids.creature })
    )
    expect(mocks.turnEffects).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: ids.creature }]
      })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          status: 'TURN_LIFECYCLE_COMPLETE',
          initiativeAdvance: expect.objectContaining({
            kind: 'ROUND_WRAP',
            cadence: 'EACH_ROUND'
          }),
          initiative: expect.objectContaining({ round: 2 }),
          rechargeExecutions: [],
          outgoingTurn: { kind: 'NONE', selectionChecksum: null },
          incomingTurn: { kind: 'NONE', selectionChecksum: null }
        })
      })
    )
    expect(mocks.encounter.update).toHaveBeenCalledWith({
      encounterId: ids.command,
      status: 'ACTIVE',
      version: 4,
      round: 2,
      currentActorId: ids.creature
    })
  })

  it('freezes an unpinned Assisted START source and stages reconciliation until terminal settlement', async () => {
    const input = turnInput('00000000-0000-4000-8000-000000000097')
    const unpinned = {
      ...turnEncounter,
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED' as const
    }
    const reconciledActor = {
      ...turnActor,
      resources: { featureCharges: { recharge: 0 } }
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: unpinned,
      context: { attunementSlotOverride: null, role: 'OWNER' }
    })
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(unpinned, { actors: [] })
    })
    mocks.actorEvaluation.mockResolvedValue({
      snapshot: {
        encounterVersion: unpinned.version,
        revisionId: ids.template,
        facts: { contractVersion: 1, actors: [] },
        output: { actors: [] }
      },
      reconciledEncounter: { ...unpinned, actors: [reconciledActor] },
      actorUpdates: [reconciledActor],
      zenEvaluationMs: 0
    })
    mocks.turnEffects.mockImplementation(async (request) => ({
      kind: 'PENDING',
      pendingSnapshot: {
        snapshotKind: 'KERNEL_EVIDENCE',
        request: { requestId: 'turn-roll' },
        applicationContext: {
          kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
          currentCandidate: { d20Policy: { rollMode: 'NORMAL' } },
          root: request.coordinatorRoot
        }
      }
    }))

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never,
        createRuleOccurrenceId: () => '00000000-0000-4000-8000-000000000099'
      })
    ).resolves.toMatchObject({
      response: { occurrence: { status: 'PENDING' } }
    })

    expect(mocks.occurrences.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingSnapshot: expect.objectContaining({
          applicationContext: expect.objectContaining({
            root: expect.objectContaining({
              frozenActorRuleRevisionId: ids.template,
              frozenActorRuleRevisionChecksum: 'a'.repeat(64)
            })
          })
        })
      })
    )
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.publishCurrentProjection).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('projects a sealed initiative declaration only to the current Character controller', async () => {
    const formerController = '00000000-0000-4000-8000-000000000097'
    const currentController = '00000000-0000-4000-8000-000000000098'
    const unrelatedPlayer = '00000000-0000-4000-8000-000000000099'
    const occurrenceId = '00000000-0000-4000-8000-000000000096'
    const policyChecksum = 'e'.repeat(64)
    const pendingSnapshot = createEncounterInitiativeDeclarationPendingSnapshot({
      occurrenceId,
      root: {
        rootCommandId: ids.command,
        commandFingerprint: policyChecksum,
        commandType: 'START',
        initiatorUserId: ids.owner,
        correlationId: null,
        expectedEncounterVersion: turnEncounter.version,
        round: 1,
        policySnapshotChecksum: policyChecksum,
        initiativeBeforePin: { kind: 'INITIAL_START', actorIds: [turnActor.id] },
        stagedInitiativeRoundState: stagedInitiativeRound({
          round: 1,
          cadence: 'ENCOUNTER_START',
          checksum: policyChecksum
        }),
        startSystemId: null,
        resolutionCommands: []
      },
      request: {
        requestId: 'speed-factor-declaration',
        kind: 'INITIATIVE_DECLARATION',
        encounterId: turnEncounter.id,
        round: 1,
        actorId: turnActor.id,
        participantExpectedVersion: 0,
        primaryOptions: [
          {
            kind: 'CHARACTER_ACTION',
            optionId: 'action:longsword',
            label: 'Longsword',
            selectionContract: policyChecksum
          }
        ],
        bonusOptions: [],
        adjudicationFields: [],
        controllerUserId: formerController,
        sourceOptionsChecksum: policyChecksum
      }
    })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: turnEncounter.id,
      rootCommandId: ids.command,
      rootCommandFingerprint: policyChecksum,
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: turnEncounter.version,
      version: 0,
      state: 'PENDING',
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    })
    mocks.sqlRows.mockResolvedValue({ rows: [{ user_id: currentController }] })
    const lockAs = (userId: string, role: 'OWNER' | 'PLAYER', assignedCharacterId: string | null) =>
      mocks.lockedContext.mockResolvedValue({
        encounter: turnEncounter,
        context: {
          campaignId: ids.campaign,
          role,
          assignedCharacterId,
          attunementSlotOverride: null
        }
      })

    lockAs(ids.owner, 'OWNER', null)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.owner, turnEncounter.id)
    ).resolves.toMatchObject({ kind: 'INITIATIVE_DECLARATION', actorId: turnActor.id })

    lockAs(currentController, 'PLAYER', turnActor.sourceId)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, currentController, turnEncounter.id)
    ).resolves.toMatchObject({
      kind: 'INITIATIVE_DECLARATION',
      primaryOptions: [{ optionId: 'action:longsword', label: 'Longsword' }]
    })

    lockAs(formerController, 'PLAYER', turnActor.sourceId)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, formerController, turnEncounter.id)
    ).resolves.toBeNull()

    lockAs(unrelatedPlayer, 'PLAYER', ids.updateCommand)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, unrelatedPlayer, turnEncounter.id)
    ).resolves.toBeNull()
  })

  it('projects an optional-contest roll only to the current participant controller or GM', async () => {
    const initiatorController = '00000000-0000-4000-8000-000000000097'
    const defenderController = '00000000-0000-4000-8000-000000000098'
    const unrelatedPlayer = '00000000-0000-4000-8000-000000000099'
    const initiatorCharacter = turnActor.sourceId
    const defenderCharacter = '00000000-0000-4000-8000-000000000096'
    const occurrenceId = '00000000-0000-4000-8000-000000000095'
    const checksum = 'e'.repeat(64)
    const context: ServerOptionalCombatContestPendingApplicationContextDto = {
      kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST',
      schemaVersion: 1,
      actionKind: 'SHOVE_ASIDE',
      actionId: ids.template,
      sourceActorId: turnActor.id,
      targetActorId: ids.updateCommand,
      initiatorControllerCharacterId: initiatorCharacter,
      sceneContext: {
        sceneId: ids.template,
        sceneVersion: 1,
        sourceTokenId: ids.creature,
        targetTokenId: ids.updateCommand
      },
      positionalDependencyChecksum: checksum,
      optionalCombat: {
        snapshotChecksum: checksum,
        definitionId: ids.template,
        definitionVersion: 1,
        definitionChecksum: checksum,
        moduleKey: 'd20.action.shove-aside',
        moduleContractVersion: 1
      },
      contestGraph: { definitionId: ids.otherSystem, checksum, identityChecksum: checksum },
      optionId: checksum,
      selectionContractChecksum: checksum,
      resolvedSelectionChecksum: checksum,
      source: {
        kind: 'OPTIONAL_COMBAT_DEFINITION',
        definitionId: ids.template,
        definitionVersion: 1,
        definitionChecksum: checksum,
        moduleKey: 'd20.action.shove-aside',
        moduleContractVersion: 1
      },
      target: { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: checksum },
      initiator: {
        actorId: turnActor.id,
        requestNodeId: 'initiator_d20',
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 3
      },
      defender: {
        actorId: ids.updateCommand,
        requestNodeId: 'target_d20',
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 2,
        checkDefinitionId: ids.otherSystem
      },
      rollEvidence: { initiator: null, defender: null },
      selection: {
        kind: 'SHOVE_ASIDE',
        defenderCheckDefinitionId: ids.otherSystem,
        destination: { x: 10, y: 5 },
        displacement: { amount: 5, unit: 'FEET', sceneUnits: 5 },
        sceneId: ids.template,
        sceneVersion: 1,
        targetTokenId: ids.updateCommand,
        stateChecksum: checksum
      },
      actionEconomy: null
    }
    const snapshot = (requestNodeId: 'initiator_d20' | 'target_d20') =>
      ({
        schemaVersion: 1,
        occurrenceId,
        graph: {
          schemaVersion: 1,
          source: {
            definitionId: ids.template,
            gameSystemId: ids.system,
            definitionFamilyKey: 'optional-combat',
            checksum
          },
          capabilityContractVersion: 1,
          factContracts: [],
          nodes: [],
          outputs: {}
        },
        facts: {},
        nextNodeIndex: 0,
        nodeOutputs: {},
        trace: [],
        request: {
          requestId: requestNodeId,
          kind: 'INTEGER_RANGE',
          nodeId: requestNodeId,
          ordinal: 0,
          min: 1,
          max: 20
        },
        authority: 'APPLICATION_SERVICE',
        redaction: 'SERVER_ONLY',
        seal: checksum,
        snapshotKind: 'KERNEL_EVIDENCE',
        optionalCombatSnapshotChecksum: checksum,
        applicationContext: context
      }) as ServerKernelRuleExecutionPendingSnapshotDto
    const occurrence = (pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto) => ({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: turnEncounter.id,
      rootCommandId: ids.command,
      rootCommandFingerprint: checksum,
      commandType: 'RESOLVE_ACTION',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: turnEncounter.version,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
      completedAt: null
    })
    const defenderActor = {
      ...turnActor,
      id: context.targetActorId,
      sourceId: defenderCharacter,
      label: 'Defender'
    }
    const encounterWithDefender = {
      ...turnEncounter,
      actors: [...turnEncounter.actors, defenderActor]
    }
    const lockAs = (role: 'OWNER' | 'PLAYER', assignedCharacterId: string | null) =>
      mocks.lockedContext.mockResolvedValue({
        encounter: encounterWithDefender,
        context: {
          campaignId: ids.campaign,
          role,
          assignedCharacterId,
          attunementSlotOverride: null
        }
      })

    mocks.sqlRows.mockResolvedValue({ rows: [] })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(occurrence(snapshot('initiator_d20')))
    lockAs('OWNER', null)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.owner, turnEncounter.id)
    ).resolves.toMatchObject({ kind: 'D20_EVIDENCE', request: { requestId: 'initiator_d20' } })

    lockAs('PLAYER', initiatorCharacter)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, initiatorController, turnEncounter.id)
    ).resolves.toMatchObject({ kind: 'D20_EVIDENCE', request: { requestId: 'initiator_d20' } })

    lockAs('PLAYER', defenderCharacter)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, defenderController, turnEncounter.id)
    ).resolves.toBeNull()

    lockAs('PLAYER', unrelatedPlayer)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, unrelatedPlayer, turnEncounter.id)
    ).resolves.toBeNull()

    lockAs('PLAYER', ids.otherSystem)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, initiatorController, turnEncounter.id)
    ).resolves.toBeNull()

    mocks.occurrences.lockPendingEncounter.mockResolvedValue(occurrence(snapshot('target_d20')))
    lockAs('PLAYER', defenderCharacter)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, defenderController, turnEncounter.id)
    ).resolves.toMatchObject({ kind: 'D20_EVIDENCE', request: { requestId: 'target_d20' } })
  })

  it('reconnects kernel-phase declarations only to the current Character controller', async () => {
    const formerController = '00000000-0000-4000-8000-000000000097'
    const currentController = '00000000-0000-4000-8000-000000000098'
    const unrelatedPlayer = '00000000-0000-4000-8000-000000000099'
    const occurrenceId = '00000000-0000-4000-8000-000000000096'
    const policyChecksum = 'e'.repeat(64)
    const primaryOptions = [
      {
        kind: 'CHARACTER_ACTION' as const,
        optionId: 'action:longsword',
        label: 'Longsword',
        selectionContract: policyChecksum
      }
    ]
    const adjudicationFields: InitiativeDeclarationAdjudicationFieldDto[] = [
      {
        kind: 'SELECT' as const,
        key: 'actorSize',
        required: true,
        label: 'Actor size',
        options: [{ value: 'MEDIUM', label: 'Medium' }]
      }
    ]
    const pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto = {
      schemaVersion: 1,
      occurrenceId,
      graph: {
        schemaVersion: 1,
        source: {
          definitionId: ids.template,
          gameSystemId: ids.system,
          definitionFamilyKey: 'initiative-score',
          checksum: policyChecksum
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [
          {
            id: 'resolve',
            operation: { key: 'initiative.resolve', contractVersion: 1 },
            inputs: {}
          }
        ],
        outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'resolve', port: 'result' } }
      },
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: 'kernel-declaration',
        kind: 'INTEGER_RANGE',
        nodeId: 'resolve',
        ordinal: 0,
        min: 0,
        max: 1
      },
      authority: 'APPLICATION_SERVICE',
      redaction: 'SERVER_ONLY',
      seal: 'b'.repeat(64),
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: null,
      applicationContext: {
        kind: 'ENCOUNTER_INITIATIVE',
        schemaVersion: 1,
        root: {
          rootCommandId: ids.command,
          commandFingerprint: policyChecksum,
          commandType: 'START',
          initiatorUserId: ids.owner,
          correlationId: null,
          expectedEncounterVersion: turnEncounter.version,
          round: 1,
          policySnapshotChecksum: policyChecksum,
          initiativeBeforePin: { kind: 'INITIAL_START', actorIds: [turnActor.id] },
          stagedInitiativeRoundState: stagedInitiativeRound({
            round: 1,
            cadence: 'ENCOUNTER_START',
            checksum: policyChecksum
          }),
          startSystemId: null,
          resolutionCommands: []
        },
        phase: {
          kind: 'INITIATIVE_DECLARATION',
          actorId: turnActor.id,
          participantVersion: 0,
          requestId: 'kernel-declaration',
          primaryOptions,
          bonusOptions: [],
          adjudicationFields
        }
      }
    }
    mocks.occurrences.lockPendingEncounter.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: turnEncounter.id,
      rootCommandId: ids.command,
      rootCommandFingerprint: policyChecksum,
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: turnEncounter.version,
      version: 0,
      state: 'PENDING',
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    })
    mocks.sqlRows.mockResolvedValue({ rows: [{ user_id: currentController }] })
    const lockAs = (userId: string, role: 'OWNER' | 'PLAYER', assignedCharacterId: string | null) =>
      mocks.lockedContext.mockResolvedValue({
        encounter: turnEncounter,
        context: {
          campaignId: ids.campaign,
          role,
          assignedCharacterId,
          attunementSlotOverride: null
        }
      })

    lockAs(ids.owner, 'OWNER', null)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.owner, turnEncounter.id)
    ).resolves.toMatchObject({
      kind: 'INITIATIVE_DECLARATION',
      primaryOptions,
      adjudicationFields
    })

    lockAs(currentController, 'PLAYER', turnActor.sourceId)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, currentController, turnEncounter.id)
    ).resolves.toMatchObject({
      kind: 'INITIATIVE_DECLARATION',
      primaryOptions,
      adjudicationFields
    })

    lockAs(formerController, 'PLAYER', turnActor.sourceId)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, formerController, turnEncounter.id)
    ).resolves.toBeNull()

    lockAs(unrelatedPlayer, 'PLAYER', ids.updateCommand)
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, unrelatedPlayer, turnEncounter.id)
    ).resolves.toBeNull()
  })

  it('hides the next declaration from the prior controller after a declaration transition', async () => {
    const controllerA = '00000000-0000-4000-8000-000000000097'
    const controllerB = '00000000-0000-4000-8000-000000000098'
    const occurrenceId = '00000000-0000-4000-8000-000000000096'
    const policyChecksum = 'e'.repeat(64)
    const actorB = {
      ...turnActor,
      id: ids.updateCommand,
      sourceId: ids.updateCommand,
      label: 'Second Hero',
      manualOrder: 1
    }
    const encounter = { ...turnEncounter, actors: [turnActor, actorB] }
    const transitionRoundState = {
      ...stagedInitiativeRound({ round: 1, cadence: 'ENCOUNTER_START', checksum: policyChecksum }),
      round: {
        ...stagedInitiativeRound({ round: 1, cadence: 'ENCOUNTER_START', checksum: policyChecksum })
          .round,
        procedure: 'DECLARED_ACTION_ROLL' as const
      },
      participants: [
        ...stagedInitiativeRound({ round: 1, cadence: 'ENCOUNTER_START', checksum: policyChecksum })
          .participants,
        {
          ...stagedInitiativeRound({
            round: 1,
            cadence: 'ENCOUNTER_START',
            checksum: policyChecksum
          }).participants[0]!,
          actorId: actorB.id,
          version: 1
        }
      ]
    }
    const pendingSnapshot = createEncounterInitiativeDeclarationPendingSnapshot({
      occurrenceId,
      root: {
        rootCommandId: ids.command,
        commandFingerprint: policyChecksum,
        commandType: 'START',
        initiatorUserId: ids.owner,
        correlationId: null,
        expectedEncounterVersion: encounter.version,
        round: 1,
        policySnapshotChecksum: policyChecksum,
        initiativeBeforePin: { kind: 'INITIAL_START', actorIds: [turnActor.id, actorB.id] },
        stagedInitiativeRoundState: transitionRoundState,
        startSystemId: null,
        resolutionCommands: []
      },
      request: {
        requestId: 'declaration-a',
        kind: 'INITIATIVE_DECLARATION',
        encounterId: encounter.id,
        round: 1,
        actorId: turnActor.id,
        participantExpectedVersion: 0,
        primaryOptions: [
          {
            kind: 'CHARACTER_ACTION',
            optionId: 'action:longsword',
            label: 'Longsword',
            selectionContract: policyChecksum
          }
        ],
        bonusOptions: [],
        adjudicationFields: [],
        controllerUserId: controllerA,
        sourceOptionsChecksum: policyChecksum
      }
    })
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: encounter.id,
      rootCommandId: ids.command,
      rootCommandFingerprint: policyChecksum,
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: encounter.version,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    }
    const nextSource = {
      kind: 'CHARACTER' as const,
      actor: actorB,
      characterId: actorB.sourceId,
      systemId: ids.system,
      streamVersion: 1,
      mechanics: {
        rulePolicyInput: {
          actionCandidates: [
            {
              actionId: 'action:shield',
              label: 'Shield',
              mechanicFacts: { invocation: { activation: { code: 'ACTION' } } }
            }
          ],
          spellCastCandidates: []
        },
        rulePolicyOutput: { spellCastMechanics: [] },
        compiledActionEntryPoints: [
          {
            actionId: 'action:shield',
            schemaVersion: 4,
            compilation: {
              kind: 'COMPILED',
              executionPlan: {
                kind: 'SINGLE_GRAPH',
                published: { checksum: policyChecksum }
              }
            }
          }
        ]
      }
    }
    const nextState = {
      round: transitionRoundState.round,
      participants: transitionRoundState.participants.map((participant) =>
        participant.actorId === turnActor.id
          ? {
              ...participant,
              declaration: {
                actorSize: 'MEDIUM',
                primary: {
                  kind: 'GM_ADJUDICATED',
                  optionId: 'GM_ADJUDICATED',
                  actorId: turnActor.id,
                  actionFactors: [],
                  spellLevel: null
                },
                bonus: null
              },
              declarationChecksum: policyChecksum,
              version: 1
            }
          : participant
      ),
      sides: []
    }
    const pauseHolder: { value: typeof occurrence | null } = { value: null }
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        campaignId: ids.campaign,
        role: 'PLAYER',
        assignedCharacterId: turnActor.sourceId,
        attunementSlotOverride: null
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.occurrences.findReceipt.mockResolvedValue(null)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(encounter, { actors: [] })
    })
    mocks.sqlRows
      .mockResolvedValueOnce({ rows: [{ user_id: controllerA }] })
      .mockResolvedValueOnce({ rows: [{ user_id: controllerB }] })
      .mockResolvedValueOnce({ rows: [{ user_id: controllerB }] })
    mocks.resumeInitiativeDeclaration.mockResolvedValue({
      kind: 'DECLARATION_PENDING',
      state: nextState,
      actorId: actorB.id,
      source: nextSource
    })
    mocks.serializeStagedInitiative.mockImplementation(() => nextState)
    mocks.occurrences.advancePending.mockImplementation(async (input) => {
      pauseHolder.value = { ...occurrence, version: 1, pendingSnapshot: input.pendingSnapshot }
      return pauseHolder.value
    })

    const result = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      controllerA,
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: encounter.id,
        expectedVersion: encounter.version,
        commandId: '00000000-0000-4000-8000-000000000095',
        correlationId: null,
        occurrenceId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'declaration-a',
          primary: { kind: 'CHARACTER_ACTION', optionId: 'action:longsword' },
          bonus: null
        }
      },
      { rulesRuntime: {} as never }
    )

    const settledOccurrence = result.response.occurrence
    if (!settledOccurrence) throw new Error('Expected settled occurrence.')
    expect(settledOccurrence.pending).toBeNull()
    const paused = pauseHolder.value
    if (!paused) throw new Error('Expected paused occurrence.')
    expect(paused.pendingSnapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_INITIATIVE_DECLARATION',
      request: { actorId: actorB.id }
    })

    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        campaignId: ids.campaign,
        role: 'PLAYER',
        assignedCharacterId: actorB.sourceId,
        attunementSlotOverride: null
      }
    })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(paused)
    mocks.sqlRows.mockResolvedValue({ rows: [{ user_id: controllerB }] })
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, controllerB, encounter.id)
    ).resolves.toMatchObject({
      kind: 'INITIATIVE_DECLARATION',
      actorId: actorB.id,
      primaryOptions: [{ optionId: 'action:shield', label: 'Shield' }]
    })
  })

  it('keeps START prepared and version-stable while initiative evidence is pending', async () => {
    const input = turnInput('00000000-0000-4000-8000-000000000096')
    const occurrenceId = '00000000-0000-4000-8000-000000000095'
    const pendingEncounter = {
      ...turnEncounter,
      automationMode: 'ASSISTED' as const,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: pendingEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER' }
    })
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(pendingEncounter, { actors: [] }),
      ruleSnapshot: null
    })
    mocks.startInitiativeCommand.mockResolvedValue({
      kind: 'PENDING',
      pending: initiativePendingState(occurrenceId)
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never,
        createRuleOccurrenceId: () => occurrenceId
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          occurrenceId,
          occurrenceVersion: 0,
          status: 'PENDING',
          pending: { kind: 'INITIATIVE_EVIDENCE', encounterVersion: 3 }
        }
      }
    })

    expect(mocks.occurrences.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        expectedAggregateVersion: 3,
        pendingSnapshot: expect.objectContaining({
          applicationContext: expect.objectContaining({
            kind: 'ENCOUNTER_INITIATIVE',
            root: expect.objectContaining({ rootCommandId: input.commandId })
          })
        })
      })
    )
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('settles pending initiative and START_OF_TURN in the same occurrence', async () => {
    const rootInput = turnInput('00000000-0000-4000-8000-000000000094')
    const occurrenceId = '00000000-0000-4000-8000-000000000093'
    const pendingEncounter = {
      ...turnEncounter,
      automationMode: 'ASSISTED' as const,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    const pending = initiativePendingState(occurrenceId)
    const pendingSnapshot = createEncounterInitiativePendingSnapshot({
      root: {
        rootCommandId: rootInput.commandId,
        commandFingerprint: createHash('sha256').update(JSON.stringify(rootInput)).digest('hex'),
        commandType: 'START',
        initiatorUserId: ids.owner,
        correlationId: null,
        expectedEncounterVersion: 3,
        round: 1,
        policySnapshotChecksum: 'e'.repeat(64),
        initiativeBeforePin: { kind: 'INITIAL_START', actorIds: [ids.creature] },
        stagedInitiativeRoundState: stagedInitiativeRound({
          round: 1,
          cadence: 'ENCOUNTER_START',
          checksum: 'e'.repeat(64)
        }),
        startSystemId: null,
        resolutionCommands: []
      },
      pending
    })
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: rootInput.commandId,
      rootCommandFingerprint:
        pendingSnapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE'
          ? pendingSnapshot.applicationContext.root.commandFingerprint
          : '',
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    }
    const updated = {
      ...pendingEncounter,
      status: 'ACTIVE' as const,
      version: 4,
      round: 1,
      currentActorId: ids.creature
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: pendingEncounter,
      context: {
        attunementSlotOverride: null,
        role: 'OWNER',
        assignedCharacterId: null
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.encounter.lockInitiativeRound.mockResolvedValue({ participants: [] })
    mocks.resumeInitiativeCommand.mockResolvedValue({
      kind: 'SETTLED',
      state: {
        round: {
          round: 1,
          cadence: 'ENCOUNTER_START',
          procedure: 'ACTOR_ROLL',
          policySnapshotChecksum: 'e'.repeat(64)
        },
        participants: stagedInitiativeRound({
          round: 1,
          cadence: 'ENCOUNTER_START',
          checksum: 'e'.repeat(64)
        }).participants
      },
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR', id: ids.creature },
            result: {
              kind: 'GRAPH_COMPLETE',
              execution: {
                automatic: true,
                score: 17,
                sortDirection: 'DESCENDING',
                execution: {
                  status: 'COMPLETE',
                  outputs: { score: 17, automatic: true },
                  evidence: {
                    source: {
                      definitionId: ids.template,
                      gameSystemId: ids.system,
                      definitionFamilyKey: 'initiative-score',
                      checksum: 'f'.repeat(64)
                    },
                    capabilityContractVersion: 1,
                    facts: { 'initiative.value': 10 },
                    trace: [],
                    outputs: { score: 17, automatic: true }
                  }
                }
              }
            }
          }
        ],
        tieAttempts: [],
        orderChoices: []
      }
    })
    mocks.encounter.find.mockResolvedValue(updated)
    const resolutionInput = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000092',
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 0,
      resolution: {
        kind: 'ENTER_INTEGER' as const,
        requestId: 'initiative-score',
        value: 17
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, resolutionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          occurrenceId,
          occurrenceVersion: 1,
          status: 'COMPLETE'
        }
      }
    })

    expect(mocks.resumeInitiativeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingSnapshot,
        requestId: 'initiative-score',
        value: 17
      })
    )
    expect(mocks.turnEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.creature }]
      })
    )
    expect(mocks.occurrences.complete).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId, nextAggregateVersion: 4 })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: rootInput.commandId,
        occurrenceId,
        resultPayload: expect.objectContaining({
          status: 'INITIATIVE_COMPLETE',
          occurrenceVersion: 1
        }),
        commandMetadata: expect.objectContaining({
          terminalOccurrenceVersion: 1,
          resolutionCommands: [
            expect.objectContaining({
              commandId: resolutionInput.commandId,
              kind: 'ENTER_INTEGER'
            })
          ]
        })
      })
    )
    expect(mocks.encounter.update).toHaveBeenCalledWith({
      encounterId: ids.command,
      status: 'ACTIVE',
      version: 4,
      round: 1,
      currentActorId: ids.creature
    })
  })

  it('resumes each-round initiative with retained outgoing turn evidence', async () => {
    const rootInput = {
      type: 'ADVANCE_TURN' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000085'
    }
    const occurrenceId = '00000000-0000-4000-8000-000000000084'
    const pendingEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      automationMode: 'ASSISTED' as const,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    const advance = {
      kind: 'ROUND_WRAP' as const,
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND' as const,
      stateChecksum: 'd'.repeat(64),
      currentActorId: ids.creature,
      firstActorId: null,
      orderedActorIds: [ids.creature],
      orderedSideIds: []
    }
    const pendingSnapshot = createEncounterInitiativePendingSnapshot({
      root: {
        rootCommandId: rootInput.commandId,
        commandFingerprint: createHash('sha256').update(JSON.stringify(rootInput)).digest('hex'),
        commandType: 'ADVANCE_TURN',
        initiatorUserId: ids.owner,
        correlationId: null,
        expectedEncounterVersion: 3,
        round: 2,
        policySnapshotChecksum: 'e'.repeat(64),
        initiativeBeforePin: {
          kind: 'EACH_ROUND',
          round: 1,
          version: 1,
          checksum: 'd'.repeat(64),
          actorIds: [ids.creature]
        },
        stagedInitiativeRoundState: stagedInitiativeRound({
          round: 2,
          cadence: 'EACH_ROUND',
          checksum: 'e'.repeat(64)
        }),
        startSystemId: null,
        initiativeAdvance: advance,
        outgoingTurn: { kind: 'NONE' },
        resolutionCommands: []
      },
      pending: initiativePendingState(occurrenceId)
    })
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: rootInput.commandId,
      rootCommandFingerprint:
        pendingSnapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE'
          ? pendingSnapshot.applicationContext.root.commandFingerprint
          : '',
      commandType: 'ADVANCE_TURN',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    }
    const updated = {
      ...pendingEncounter,
      version: 4,
      round: 2,
      currentActorId: ids.creature
    }
    const refreshedActor = {
      ...pendingEncounter.actors[0]!,
      resources: { ruleUsage: { [ids.updateCommand]: 0 } }
    }
    mocks.stageActionEconomyRefreshes.mockResolvedValue({
      refreshes: [
        {
          ordinal: 0,
          actorId: ids.creature,
          capabilityDefinitionId: ids.updateCommand,
          definitionVersion: 1,
          definitionChecksum: 'f'.repeat(64),
          beforeUsed: 1,
          afterUsed: 0
        }
      ],
      refreshedActor
    })
    mocks.lockedContext.mockResolvedValue({
      encounter: pendingEncounter,
      context: {
        attunementSlotOverride: null,
        role: 'OWNER',
        assignedCharacterId: null
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.encounter.lockInitiativeRound.mockResolvedValue({ participants: [] })
    mocks.resumeInitiativeCommand.mockResolvedValue({
      kind: 'SETTLED',
      state: {
        round: {
          round: 2,
          cadence: 'EACH_ROUND',
          procedure: 'ACTOR_ROLL',
          policySnapshotChecksum: 'e'.repeat(64)
        },
        participants: stagedInitiativeRound({
          round: 2,
          cadence: 'EACH_ROUND',
          checksum: 'e'.repeat(64)
        }).participants
      },
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR', id: ids.creature },
            result: { kind: 'FACTS_UNAVAILABLE' }
          }
        ],
        tieAttempts: [],
        orderChoices: []
      }
    })
    mocks.encounter.find.mockResolvedValue(updated)
    const resolutionInput = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000083',
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 0,
      resolution: {
        kind: 'ENTER_INTEGER' as const,
        requestId: 'initiative-score',
        value: 17
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, resolutionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: { occurrenceId, occurrenceVersion: 1, status: 'COMPLETE' }
      }
    })

    expect(mocks.turnEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'ADVANCE_TURN',
        boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: ids.creature }],
        coordinatorRoot: expect.objectContaining({
          initiativeAdvance: advance,
          outgoingTurn: { kind: 'NONE' }
        })
      })
    )
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    expect(mocks.encounter.updateActor).toHaveBeenCalledWith(refreshedActor)
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          status: 'TURN_LIFECYCLE_COMPLETE',
          initiativeAdvance: advance,
          initiative: expect.objectContaining({ round: 2 }),
          outgoingTurn: { kind: 'NONE', selectionChecksum: null },
          incomingTurn: { kind: 'NONE', selectionChecksum: null }
        }),
        commandMetadata: expect.objectContaining({
          initiativeAdvanceChecksum: checksumCanonicalJson(advance)
        })
      })
    )
    expect(mocks.encounter.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'ADVANCE_TURN',
        commandPayload: {
          type: 'ADVANCE_TURN',
          encounterId: ids.command,
          commandId: rootInput.commandId,
          expectedVersion: 3
        }
      })
    )
  })

  it('restores staged outgoing effects and each-round initiative before settling a resumed incoming effect', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000078'
    const rootCommandId = '00000000-0000-4000-8000-000000000077'
    const resolutionCommandId = '00000000-0000-4000-8000-000000000076'
    const activeEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      automationMode: 'ASSISTED' as const,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    const initiativeAdvance = {
      kind: 'ROUND_WRAP' as const,
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND' as const,
      stateChecksum: 'd'.repeat(64),
      currentActorId: ids.creature,
      firstActorId: null,
      orderedActorIds: [ids.creature],
      orderedSideIds: []
    }
    const initiative = {
      round: 2,
      cadence: 'EACH_ROUND' as const,
      procedure: 'ACTOR_ROLL' as const,
      policySnapshotChecksum: 'e'.repeat(64),
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR' as const, id: ids.creature },
            result: { kind: 'FACTS_UNAVAILABLE' as const }
          }
        ],
        tieAttempts: [],
        orderChoices: []
      }
    }
    const outgoingResult = {
      ...turnBatchResult(occurrenceId),
      occurrenceVersion: 3,
      commandType: 'ADVANCE_TURN' as const,
      executions: turnBatchResult(occurrenceId).executions.map((execution) => ({
        ...execution,
        boundaryOrdinal: 0,
        stage: 'END_OF_TURN' as const,
        execution: {
          ...execution.execution,
          evidence: {
            ...execution.execution.evidence,
            trace: execution.execution.evidence.trace.map((entry) => ({
              ...entry,
              outputs: { ...entry.outputs, resolvedPath: 'END_OF_TURN' }
            }))
          }
        },
        applications: execution.applications.map((application) => ({
          ...application,
          resolvedPath: 'END_OF_TURN'
        }))
      }))
    }
    const incomingResult = {
      ...turnBatchResult(occurrenceId),
      occurrenceVersion: 3,
      commandType: 'ADVANCE_TURN' as const,
      executions: turnBatchResult(occurrenceId).executions.map((execution) => ({
        ...execution,
        boundaryOrdinal: 1,
        stage: 'START_OF_TURN' as const
      }))
    }
    const actorSnapshotChecksum = checksumCanonicalJson({
      revisionId: ids.template,
      facts: { contractVersion: 1, actors: [] },
      output: { actors: [] }
    })
    const pendingSnapshot = {
      snapshotKind: 'KERNEL_EVIDENCE' as const,
      request: {
        requestId: 'incoming-effect-roll',
        kind: 'INTEGER_RANGE' as const,
        nodeId: 'effect-node',
        ordinal: 0,
        min: 1,
        max: 20
      },
      applicationContext: {
        kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' as const,
        root: {
          rootCommandId,
          commandFingerprint: 'a'.repeat(64),
          commandType: 'ADVANCE_TURN' as const,
          initiatorUserId: ids.owner,
          correlationId: null,
          expectedEncounterVersion: 3,
          startSystemId: null,
          frozenActorRuleRevisionId: ids.template,
          frozenActorRuleRevisionChecksum: 'a'.repeat(64),
          frozenActorRuleSnapshotChecksum: actorSnapshotChecksum,
          initiative,
          initiativeAdvance,
          stagedInitiative: {
            beforePin: {
              kind: 'EACH_ROUND' as const,
              round: 1,
              version: 3,
              checksum: initiativeAdvance.stateChecksum,
              actorIds: [ids.creature]
            },
            stagedRoundState: stagedInitiativeRound({
              round: 2,
              cadence: 'EACH_ROUND',
              checksum: 'e'.repeat(64)
            })
          },
          outgoingTurn: {
            kind: 'STAGED' as const,
            plan: {
              selectionChecksum: 'b'.repeat(64),
              executions: outgoingResult.executions
            }
          },
          completedLegendaryAction: {
            choice: legendaryChoice(),
            selectionChecksum: checksumRuleDocument(legendaryChoice()),
            resolution: { kind: 'DECLINED' as const }
          },
          proposedTerminalTransition: {
            status: 'ACTIVE' as const,
            round: 2,
            currentActorId: ids.creature
          },
          resolutionCommands: []
        },
        selectionChecksum: 'c'.repeat(64),
        completedExecutions: [],
        currentCandidate: {
          ordinal: 0,
          boundaryOrdinal: 1,
          stage: 'START_OF_TURN' as const,
          targetActorId: ids.creature,
          owner: { kind: 'CHARACTER' as const, characterId: ids.creature },
          activeEffectId: ids.campaign,
          createdOrdinal: 1,
          beforeVersion: 1,
          d20Policy: { rollMode: 'NORMAL' as const }
        },
        remainingCandidates: []
      }
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: activeEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER', assignedCharacterId: null }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      rootCommandId,
      rootCommandFingerprint: pendingSnapshot.applicationContext.root.commandFingerprint,
      commandType: 'ADVANCE_TURN',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 2,
      state: 'PENDING',
      pendingSnapshot
    })
    mocks.turnEffects.mockResolvedValue({
      kind: 'READY',
      batch: { selectionChecksum: 'c'.repeat(64), executions: incomingResult.executions }
    })
    mocks.restoreTurnEffects.mockResolvedValue({
      selectionChecksum: 'b'.repeat(64),
      executions: outgoingResult.executions
    })
    mocks.applyTurnEffects
      .mockResolvedValueOnce(outgoingResult)
      .mockResolvedValueOnce(incomingResult)
    mocks.encounter.find.mockResolvedValue({ ...activeEncounter, version: 4, round: 2 })

    await expect(
      executeEncounterCommandWithRuleSnapshot(
        {} as DBLike,
        ids.owner,
        {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: ids.command,
          expectedVersion: 3,
          commandId: resolutionCommandId,
          correlationId: null,
          occurrenceId,
          expectedOccurrenceVersion: 2,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: 'incoming-effect-roll',
            rawFaces: [14]
          }
        },
        { rulesRuntime: {} as never }
      )
    ).resolves.toMatchObject({ replayed: false, response: { occurrence: { status: 'COMPLETE' } } })

    expect(mocks.restoreTurnEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        stagedPlan: pendingSnapshot.applicationContext.root.outgoingTurn.plan
      })
    )
    expect(mocks.applyTurnEffects).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        batch: expect.objectContaining({ executions: outgoingResult.executions })
      })
    )
    expect(mocks.applyTurnEffects).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        batch: expect.objectContaining({ executions: incomingResult.executions })
      })
    )
    expect(mocks.applyStagedInitiative).toHaveBeenCalledTimes(1)
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({
          outgoingTurn: expect.objectContaining({
            kind: 'EXECUTED',
            executions: outgoingResult.executions
          }),
          incomingTurn: expect.objectContaining({
            kind: 'EXECUTED',
            executions: incomingResult.executions
          })
        })
      })
    )
  })

  it('resumes a paused outgoing turn effect into pending each-round initiative', async () => {
    const rootInput = {
      type: 'ADVANCE_TURN' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000082'
    }
    const occurrenceId = '00000000-0000-4000-8000-000000000081'
    const activeEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature,
      automationMode: 'ASSISTED' as const,
      initiativePolicySnapshotChecksum: 'e'.repeat(64)
    }
    const initiativeAdvance = {
      kind: 'ROUND_WRAP' as const,
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND' as const,
      stateChecksum: 'd'.repeat(64),
      currentActorId: ids.creature,
      firstActorId: null,
      orderedActorIds: [ids.creature],
      orderedSideIds: []
    }
    const frozenSnapshotChecksum = checksumCanonicalJson({
      revisionId: ids.template,
      facts: { contractVersion: 1, actors: [] },
      output: { actors: [] }
    })
    const pendingSnapshot = {
      snapshotKind: 'KERNEL_EVIDENCE' as const,
      request: {
        requestId: 'outgoing-effect-roll',
        kind: 'INTEGER_RANGE' as const,
        nodeId: 'effect-node',
        ordinal: 0,
        min: 1,
        max: 20
      },
      applicationContext: {
        kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' as const,
        root: {
          rootCommandId: rootInput.commandId,
          commandFingerprint: createHash('sha256').update(JSON.stringify(rootInput)).digest('hex'),
          commandType: 'ADVANCE_TURN' as const,
          initiatorUserId: ids.owner,
          correlationId: null,
          expectedEncounterVersion: 3,
          startSystemId: null,
          frozenActorRuleRevisionId: ids.template,
          frozenActorRuleRevisionChecksum: 'a'.repeat(64),
          frozenActorRuleSnapshotChecksum: frozenSnapshotChecksum,
          initiative: null,
          initiativeAdvance,
          resolutionCommands: [],
          proposedTerminalTransition: {
            status: 'ACTIVE' as const,
            round: 2,
            currentActorId: null
          }
        },
        selectionChecksum: 'b'.repeat(64),
        completedExecutions: [],
        currentCandidate: {
          ordinal: 0,
          boundaryOrdinal: 0,
          stage: 'END_OF_TURN' as const,
          targetActorId: ids.creature,
          owner: { kind: 'CHARACTER' as const, characterId: ids.creature },
          activeEffectId: ids.campaign,
          createdOrdinal: 1,
          beforeVersion: 1,
          d20Policy: { rollMode: 'NORMAL' as const }
        },
        remainingCandidates: []
      }
    }
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: rootInput.commandId,
      rootCommandFingerprint: pendingSnapshot.applicationContext.root.commandFingerprint,
      commandType: 'ADVANCE_TURN',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    }
    const afterOutgoing = { ...activeEncounter, round: 2, currentActorId: null }
    const outgoingResult = {
      ...turnBatchResult(occurrenceId),
      occurrenceVersion: 1,
      commandType: 'ADVANCE_TURN' as const,
      executions: turnBatchResult(occurrenceId).executions.map((execution) => ({
        ...execution,
        boundaryOrdinal: 0,
        stage: 'END_OF_TURN' as const,
        execution: {
          ...execution.execution,
          evidence: {
            ...execution.execution.evidence,
            trace: execution.execution.evidence.trace.map((entry) => ({
              ...entry,
              outputs: { ...entry.outputs, resolvedPath: 'END_OF_TURN' }
            }))
          }
        },
        applications: execution.applications.map((application) => ({
          ...application,
          resolvedPath: 'END_OF_TURN'
        }))
      }))
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: activeEncounter,
      context: { attunementSlotOverride: null, role: 'OWNER', assignedCharacterId: null }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.turnEffects.mockResolvedValue({
      kind: 'READY',
      batch: {
        selectionChecksum: 'b'.repeat(64),
        executions: outgoingResult.executions,
        executionStates: new Map()
      }
    })
    mocks.applyTurnEffects.mockResolvedValue(outgoingResult)
    mocks.applyInitiativeAdvance.mockResolvedValue({ round: 2, currentActorId: null, state: {} })
    mocks.encounter.find.mockResolvedValue(afterOutgoing)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(activeEncounter, { actors: [] })
    })
    mocks.startInitiativeCommand.mockResolvedValue({
      kind: 'PENDING',
      pending: initiativePendingState(occurrenceId)
    })
    const resolutionInput = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000080',
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 0,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: 'outgoing-effect-roll',
        rawFaces: [12]
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, resolutionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: { occurrenceId, occurrenceVersion: 1, status: 'PENDING' }
      }
    })

    expect(mocks.applyTurnEffects).not.toHaveBeenCalled()
    expect(mocks.applyInitiativeAdvance).not.toHaveBeenCalled()
    expect(mocks.startInitiativeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId, round: 2 })
    )
    expect(mocks.occurrences.advancePending).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        expectedOccurrenceVersion: 0,
        expectedAggregateVersion: 3,
        nextAggregateVersion: 3,
        pendingSnapshot: expect.objectContaining({
          applicationContext: expect.objectContaining({
            kind: 'ENCOUNTER_INITIATIVE',
            root: expect.objectContaining({
              initiativeAdvance,
              outgoingTurn: {
                kind: 'STAGED',
                plan: expect.objectContaining({
                  selectionChecksum: 'b'.repeat(64),
                  executions: outgoingResult.executions
                })
              },
              resolutionCommands: [
                expect.objectContaining({
                  commandId: resolutionInput.commandId,
                  kind: 'ENTER_DICE'
                })
              ]
            })
          })
        })
      })
    )
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).not.toHaveBeenCalled()
  })

  it('replays a completed initiative child command without resolver or mutation work', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000091'
    const resolutionInput = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId: '00000000-0000-4000-8000-000000000090',
      correlationId: null,
      occurrenceId,
      expectedOccurrenceVersion: 0,
      resolution: {
        kind: 'ENTER_INTEGER' as const,
        requestId: 'initiative-score',
        value: 17
      }
    }
    const resolutionFingerprint = createHash('sha256')
      .update(JSON.stringify(resolutionInput))
      .digest('hex')
    const completedEncounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      version: 4,
      round: 1,
      currentActorId: ids.creature
    }
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: ids.updateCommand,
      rootCommandFingerprint: 'f'.repeat(64),
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 1,
      state: 'COMPLETED' as const,
      pendingSnapshot: null,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: '2026-08-28T00:00:01.000Z'
    }
    const initiative = {
      round: 1,
      cadence: 'ENCOUNTER_START' as const,
      procedure: 'MANUAL' as const,
      policySnapshotChecksum: null,
      orderedActorIds: [ids.creature],
      orderedSideIds: [],
      evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
    }
    const receipt = {
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      commandId: ids.updateCommand,
      commandFingerprint: occurrence.rootCommandFingerprint,
      occurrenceId,
      aggregateVersion: 4,
      commandType: 'START',
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS' as const,
        commandType: 'START' as const,
        expectedAggregateVersion: 3,
        selectionChecksum: null,
        initiativeChecksum: checksumCanonicalJson(initiative),
        initiativeAdvanceChecksum: null,
        terminalOccurrenceVersion: 1,
        resolutionCommands: [
          {
            commandId: resolutionInput.commandId,
            commandFingerprint: resolutionFingerprint,
            actorUserId: ids.owner,
            correlationId: null,
            expectedOccurrenceVersion: 0,
            requestId: 'initiative-score',
            kind: 'ENTER_INTEGER' as const
          }
        ]
      },
      resultPayload: {
        status: 'INITIATIVE_COMPLETE' as const,
        schemaVersion: 1,
        occurrenceId,
        occurrenceVersion: 1,
        encounterId: ids.command,
        commandType: 'START' as const,
        initiative,
        initiativeAdvance: null
      }
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: completedEncounter,
      context: { role: 'OWNER', attunementSlotOverride: null }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.occurrences.findTerminalReceiptByOccurrence.mockResolvedValue(receipt)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(completedEncounter, { actors: [] }),
      ruleSnapshot: null
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, resolutionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: true,
      response: {
        occurrence: {
          occurrenceId,
          occurrenceVersion: 1,
          status: 'COMPLETE'
        }
      }
    })

    expect(mocks.resumeInitiativeCommand).not.toHaveBeenCalled()
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('replays a null-link no-effect event only when no receipt exists', async () => {
    const input = turnInput()
    const { createHash } = await import('node:crypto')
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      commandType: 'START',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: null
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.turnEffects).not.toHaveBeenCalled()
  })

  it('replays a valid linked Manual receipt before turn-effect work', async () => {
    const input = turnInput()
    const { createHash } = await import('node:crypto')
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const occurrenceId = '00000000-0000-4000-8000-000000000099'
    const result = { status: 'MANUAL', occurrenceId }
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'START',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum: checksumCanonicalJson(result)
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      occurrenceId,
      commandFingerprint,
      commandType: 'START',
      aggregateId: ids.command,
      aggregateVersion: 4,
      commandMetadata: { transition: 'TURN_EFFECTS' },
      resultPayload: result
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('does not write a terminal receipt or event when turn-effect work fails', async () => {
    const input = turnInput()
    mocks.turnEffects.mockRejectedValueOnce(new Error('late active-effect failure'))
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('late active-effect failure')
    expect(mocks.occurrences.createCompleted).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  function removalInput(commandId = ids.command) {
    return {
      type: 'REMOVE_ACTOR' as const,
      encounterId: ids.command,
      expectedVersion: 3,
      commandId,
      actorId: ids.creature
    }
  }

  function maintenanceReceipt(input = removalInput()) {
    const occurrenceId = '00000000-0000-4000-8000-000000000099'
    const result = {
      status: 'MAINTENANCE_COMPLETE' as const,
      occurrenceId,
      occurrenceVersion: 0,
      encounterId: ids.command,
      removedActorId: input.actorId
    }
    return { occurrenceId, result }
  }

  function pendingConcentrationOccurrence(targetActorId = ids.creature) {
    return {
      id: '00000000-0000-4000-8000-000000000098',
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: '00000000-0000-4000-8000-000000000097',
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot: {
        snapshotKind: 'KERNEL_EVIDENCE' as const,
        applicationContext: {
          kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' as const,
          application: { targetActorId },
          maintainedState: { id: ids.template }
        }
      }
    }
  }

  function concentrationRemovalCleanup() {
    return {
      result: {
        terminatedStates: [
          {
            id: ids.template,
            ownerActorId: ids.creature,
            maintenanceDefinitionId: ids.updateCommand,
            expectedVersion: 0,
            descriptorChecksum: 'a'.repeat(64)
          }
        ],
        removedEffects: [],
        characterOwnerTransitions: []
      },
      changedCharacterActors: []
    }
  }

  it('allows only removal of the exact pending concentration subject and terminally records cleanup', async () => {
    const input = removalInput('00000000-0000-4000-8000-000000000096')
    const encounter = {
      ...turnEncounter,
      status: 'ACTIVE' as const,
      round: 1,
      currentActorId: ids.creature
    }
    mocks.encounter.find.mockResolvedValue({
      ...encounter,
      actors: [],
      currentActorId: null,
      version: 4
    })
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(pendingConcentrationOccurrence())
    mocks.maintenanceCleanup.mockResolvedValue(concentrationRemovalCleanup())
    mocks.encounter.removeActor.mockResolvedValue(true)

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: false })

    expect(mocks.maintenanceCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ removedActorId: ids.creature })
    )
    expect(mocks.encounter.removeActor).toHaveBeenCalledWith(ids.command, ids.creature)
    expect(mocks.occurrences.complete).toHaveBeenCalledWith({
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      occurrenceId: '00000000-0000-4000-8000-000000000098',
      expectedOccurrenceVersion: 0,
      expectedAggregateVersion: 3,
      nextAggregateVersion: 4
    })
    expect(mocks.occurrences.createCompleted).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: '00000000-0000-4000-8000-000000000098',
        aggregateVersion: 4,
        commandMetadata: expect.objectContaining({ expectedOccurrenceVersion: 0 }),
        commandType: 'REMOVE_ACTOR'
      })
    )
    expect(mocks.encounter.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('keeps the pending-occurrence gate closed when removal targets another actor', async () => {
    const input = removalInput('00000000-0000-4000-8000-000000000096')
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(
      pendingConcentrationOccurrence(ids.template)
    )

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('awaiting resolution')

    expect(mocks.maintenanceCleanup).not.toHaveBeenCalled()
    expect(mocks.encounter.removeActor).not.toHaveBeenCalled()
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('rolls back exact concentration removal before actor mutation when cleanup is incomplete', async () => {
    const input = removalInput('00000000-0000-4000-8000-000000000096')
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(pendingConcentrationOccurrence())

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('did not terminate')

    expect(mocks.encounter.removeActor).not.toHaveBeenCalled()
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    expect(mocks.occurrences.appendReceipt).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('replays an exact actor-removal maintenance receipt before cleanup or mutation', async () => {
    const input = removalInput()
    const { createHash } = await import('node:crypto')
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const { occurrenceId, result } = maintenanceReceipt(input)
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'REMOVE_ACTOR',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum: checksumCanonicalJson(result)
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      occurrenceId,
      commandFingerprint,
      commandType: 'REMOVE_ACTOR',
      aggregateId: ids.command,
      aggregateVersion: 4,
      commandMetadata: {
        transition: 'MAINTENANCE_CLEANUP',
        commandType: 'REMOVE_ACTOR',
        removedActorId: ids.creature
      },
      resultPayload: result
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.maintenanceCleanup).not.toHaveBeenCalled()
    expect(mocks.encounter.removeActor).not.toHaveBeenCalled()
    expect(mocks.occurrences.createCompleted).not.toHaveBeenCalled()
    expect(mocks.encounter.publishCurrentProjection).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it.each([
    [
      'wrong removed actor',
      {
        commandMetadata: {
          transition: 'MAINTENANCE_CLEANUP',
          commandType: 'REMOVE_ACTOR',
          removedActorId: ids.template
        }
      }
    ],
    [
      'wrong transition',
      {
        commandMetadata: {
          transition: 'TURN_EFFECTS',
          commandType: 'REMOVE_ACTOR',
          removedActorId: ids.creature
        }
      }
    ],
    ['wrong status', { resultPayload: { status: 'BATCH_COMPLETE' } }],
    ['tampered checksum', { resultChecksum: 'z'.repeat(64) }]
  ])('rejects %s maintenance replay before cleanup', async (_label, mutation) => {
    const input = removalInput()
    const { createHash } = await import('node:crypto')
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const { occurrenceId, result } = maintenanceReceipt(input)
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'REMOVE_ACTOR',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum:
          'resultChecksum' in mutation ? mutation.resultChecksum : checksumCanonicalJson(result)
      }
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      occurrenceId,
      commandFingerprint,
      commandType: 'REMOVE_ACTOR',
      aggregateId: ids.command,
      aggregateVersion: 4,
      commandMetadata: {
        transition: 'MAINTENANCE_CLEANUP',
        commandType: 'REMOVE_ACTOR',
        removedActorId: ids.creature
      },
      resultPayload: result,
      ...mutation
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('replay')
    expect(mocks.maintenanceCleanup).not.toHaveBeenCalled()
    expect(mocks.encounter.removeActor).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['missing receipt', null],
    ['wrong occurrence', { occurrenceId: ids.template }],
    ['wrong aggregate', { aggregateId: ids.template }],
    ['wrong fingerprint', { commandFingerprint: 'wrong' }],
    ['wrong command', { commandType: 'ADVANCE_TURN' }],
    ['wrong version', { aggregateVersion: 3 }],
    ['wrong checksum', { resultChecksum: 'b'.repeat(64) }]
  ])('rejects %s linked replay before mechanics', async (_label, mutation) => {
    const input = turnInput()
    const { createHash } = await import('node:crypto')
    const commandFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const occurrenceId = '00000000-0000-4000-8000-000000000099'
    const result = { status: 'MANUAL', occurrenceId }
    mocks.encounter.findEventByCampaignCommand.mockResolvedValue({
      encounterId: ids.command,
      commandFingerprint,
      commandType: 'START',
      version: 4,
      resultPayload: {}
    })
    mocks.parsedReplay.mockReturnValue({
      command: { projection: { id: ids.command, version: 4 } },
      currentProjection: { ruleSnapshot: null },
      ruleReceipt: {
        occurrenceId,
        resultChecksum:
          mutation && 'resultChecksum' in mutation
            ? mutation.resultChecksum
            : checksumCanonicalJson(result)
      }
    })
    if (mutation !== null) {
      mocks.occurrences.findReceipt.mockResolvedValue({
        occurrenceId,
        commandFingerprint,
        commandType: 'START',
        aggregateId: ids.command,
        aggregateVersion: 4,
        commandMetadata: { transition: 'TURN_EFFECTS' },
        resultPayload: result,
        ...mutation
      })
    } else {
      mocks.occurrences.findReceipt.mockResolvedValue(null)
    }
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('replay rule receipt')
    expect(mocks.turnEffects).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
  })
})

describe('Encounter rule-occurrence dispatch authority', () => {
  const occurrenceInput = {
    commandId: '00000000-0000-4000-8000-000000000096',
    correlationId: null,
    encounterId: ids.command,
    expectedOccurrenceVersion: 0,
    expectedVersion: 3,
    occurrenceId: '00000000-0000-4000-8000-000000000095',
    resolution: {
      kind: 'ENTER_DICE' as const,
      rawFaces: [10],
      requestId: 'request'
    },
    type: 'RESOLVE_RULE_OCCURRENCE' as const
  }

  it('authorizes the canonical Encounter context before reading an occurrence', async () => {
    mocks.lockedContext.mockRejectedValueOnce(new Error('not an active member'))

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, occurrenceInput, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('not an active member')

    expect(mocks.occurrences.lockOccurrence).not.toHaveBeenCalled()
  })

  it('locks an occurrence only after the canonical Encounter context', async () => {
    mocks.lockedContext.mockResolvedValueOnce({
      encounter: { id: ids.command },
      context: { role: 'OWNER' }
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, occurrenceInput, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('Rule occurrence is unavailable.')

    expect(mocks.lockedContext).toHaveBeenCalledBefore(mocks.occurrences.lockOccurrence)
  })

  it('dispatches a pending Recharge occurrence to Recharge authority before runtime checks', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000097'
    const input = {
      ...occurrenceInput,
      occurrenceId,
      resolution: {
        kind: 'ENTER_INTEGER' as const,
        requestId: 'recharge-d6',
        value: 4
      }
    }
    mocks.lockedContext.mockResolvedValueOnce({
      encounter: {
        id: ids.command,
        version: 3,
        status: 'ACTIVE',
        actors: []
      },
      context: { role: 'OWNER' }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValueOnce({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING',
      pendingSnapshot: {
        snapshotKind: 'KERNEL_EVIDENCE',
        request: { requestId: 'recharge-d6' },
        applicationContext: {
          kind: 'ENCOUNTER_TURN_RECHARGE',
          root: { resolutionCommands: [] },
          currentCandidate: {},
          completedExecutions: [],
          remainingCandidates: []
        }
      }
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('frozen Encounter actor-rule source is unavailable')
    expect(mocks.executeRechargeCandidate).not.toHaveBeenCalled()
    expect(mocks.occurrences.advancePending).not.toHaveBeenCalled()
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
    expect(mocks.encounter.appendEvent).not.toHaveBeenCalled()
  })

  it('replays a pending Recharge control receipt before runtime or request validation', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000097'
    const commandId = '00000000-0000-4000-8000-000000000098'
    const input = {
      ...occurrenceInput,
      commandId,
      occurrenceId,
      expectedOccurrenceVersion: 99,
      resolution: { kind: 'ENTER_INTEGER' as const, requestId: 'different-request', value: 4 }
    }
    const root = {
      rootCommandId: '00000000-0000-4000-8000-000000000099',
      commandFingerprint: 'a'.repeat(64),
      initiatorUserId: ids.owner,
      correlationId: null,
      expectedEncounterVersion: 3
    }
    const pending = {
      kind: 'RECHARGE_EVIDENCE' as const,
      occurrenceId,
      occurrenceVersion: 1,
      encounterVersion: 3,
      request: { requestId: 'recharge-d6', min: 1 as const, max: 6 as const },
      allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL'] as const
    }
    mocks.lockedContext.mockResolvedValueOnce({
      encounter: { id: ids.command, version: 3, status: 'ACTIVE', actors: [] },
      context: { role: 'OWNER' }
    })
    mocks.encounter.requireCurrentProjection.mockResolvedValueOnce({
      projection: projectGm(
        {
          id: ids.command,
          campaignId: ids.campaign,
          sessionId: ids.template,
          gameSystemId: ids.system,
          blueprintId: ids.template,
          blueprintVersion: 1,
          blueprintChecksum: 'a'.repeat(64),
          rulePackRevisionId: ids.template,
          automationMode: 'AUTOMATIC',
          manualReminderMode: 'OFF',
          name: 'Recharge replay',
          status: 'ACTIVE',
          version: 3,
          round: 1,
          currentActorId: null,
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z',
          actors: [],
          reminders: []
        },
        { actors: [] }
      )
    })
    mocks.occurrences.lockOccurrence.mockResolvedValueOnce({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 1,
      state: 'PENDING',
      pendingSnapshot: { applicationContext: { kind: 'ENCOUNTER_TURN_RECHARGE', root } }
    })
    const commandFingerprint = createRuleExecutionCommandFingerprint(
      { aggregateKind: 'ENCOUNTER', aggregateId: ids.command, actorUserId: ids.owner },
      {
        commandId: input.commandId,
        correlationId: input.correlationId,
        expectedAggregateVersion: input.expectedVersion
      },
      'RULE_EXECUTION_RESUME',
      {
        occurrenceId: input.occurrenceId,
        expectedOccurrenceVersion: input.expectedOccurrenceVersion,
        resolutionIntentChecksum: checksumRuleDocument({
          kind: 'INTEGER',
          requestId: input.resolution.requestId,
          value: input.resolution.value
        })
      }
    )
    mocks.occurrences.findReceipt.mockResolvedValueOnce({
      aggregateId: ids.command,
      occurrenceId,
      commandId,
      commandFingerprint,
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS_PENDING',
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        rootCommandId: root.rootCommandId,
        rootCommandFingerprint: root.commandFingerprint,
        rootInitiatorUserId: root.initiatorUserId,
        rootCorrelationId: null,
        expectedAggregateVersion: root.expectedEncounterVersion,
        occurrenceVersion: 1,
        resolutionCommand: {
          commandId,
          commandFingerprint,
          actorUserId: ids.owner,
          correlationId: null,
          expectedOccurrenceVersion: 0,
          requestId: 'recharge-d6',
          kind: 'ENTER_INTEGER'
        }
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        occurrence: {
          occurrenceId,
          occurrenceVersion: 1,
          status: 'PENDING',
          outcome: null,
          pending
        }
      }
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).resolves.toMatchObject({ replayed: true, response: { occurrence: { pending } } })
    expect(mocks.executeRechargeCandidate).not.toHaveBeenCalled()
    expect(mocks.occurrences.advancePending).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
  })

  it('rejects a mismatched pending Recharge control receipt before runtime work', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000097'
    const commandId = '00000000-0000-4000-8000-000000000098'
    const input = {
      ...occurrenceInput,
      commandId,
      occurrenceId,
      expectedOccurrenceVersion: 1,
      resolution: { kind: 'ENTER_INTEGER' as const, requestId: 'recharge-d6', value: 4 }
    }
    const root = {
      rootCommandId: '00000000-0000-4000-8000-000000000099',
      commandFingerprint: 'a'.repeat(64),
      initiatorUserId: ids.owner,
      correlationId: null,
      expectedEncounterVersion: 3
    }
    mocks.lockedContext.mockResolvedValueOnce({
      encounter: { id: ids.command, version: 3, status: 'ACTIVE', actors: [] },
      context: { role: 'OWNER' }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValueOnce({
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.command,
      expectedAggregateVersion: 3,
      version: 1,
      state: 'PENDING',
      pendingSnapshot: { applicationContext: { kind: 'ENCOUNTER_TURN_RECHARGE', root } }
    })
    mocks.occurrences.findReceipt.mockResolvedValueOnce({
      aggregateId: ids.command,
      occurrenceId,
      commandId,
      commandFingerprint: 'b'.repeat(64),
      actorUserId: ids.owner,
      correlationId: null,
      commandMetadata: { transition: 'TURN_EFFECTS_PENDING' },
      resultPayload: { status: 'ENCOUNTER_OCCURRENCE_PENDING' }
    })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input)
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(mocks.executeRechargeCandidate).not.toHaveBeenCalled()
    expect(mocks.occurrences.advancePending).not.toHaveBeenCalled()
    expect(mocks.encounter.update).not.toHaveBeenCalled()
  })

  it('settles movement reaction choices on the same occurrence without premature action consumption', async () => {
    const occurrenceId = '00000000-0000-4000-8000-000000000095'
    const sceneId = '00000000-0000-4000-8000-000000000094'
    const moverActorId = '00000000-0000-4000-8000-000000000093'
    const reactorActorId = '00000000-0000-4000-8000-000000000092'
    const choiceDefinitionId = '00000000-0000-4000-8000-000000000091'
    const movingTokenId = '00000000-0000-4000-8000-000000000087'
    const reactorTokenId = '00000000-0000-4000-8000-000000000086'
    const option = (suffix: string, pathDistance: number) => ({
      optionId: suffix.repeat(64),
      contactSourceId: 'b'.repeat(64),
      actionId: `reaction-${suffix}`,
      actionSourceKind: 'CHARACTER_ACTION' as const,
      actionSourceCurrentnessChecksum: 'c'.repeat(64),
      candidate: {
        contact: { x: pathDistance, y: 0 },
        movingActorId: moverActorId,
        pathDistance,
        reactorActorId,
        reactorTokenId,
        sourceId: 'b'.repeat(64),
        stage: 'BEFORE_LEAVE_REACH' as const
      },
      binding: {
        kind: 'MOVEMENT' as const,
        stage: 'BEFORE_LEAVE_REACH' as const,
        perceptionRequirement: null,
        eligibilityDefinitionId: '00000000-0000-4000-8000-000000000090',
        movementInterruption: null
      },
      policy: {
        eligible: true,
        allowanceDefinitionId: '00000000-0000-4000-8000-000000000089',
        allowanceMaximum: 1,
        allowanceRefreshBoundary: 'START_OF_TURN' as const,
        selectionPolicy: 'CHOICE' as const,
        choiceDefinitionId,
        targetPolicy: 'MOVER' as const
      },
      eligibilityEvidenceChecksum: 'd'.repeat(64),
      authority: { kind: 'GM' as const },
      visibility: 'GM_ONLY' as const
    })
    const choices = [
      {
        pathDistance: 1,
        reactorActorId,
        reactorTokenId,
        options: [option('a', 1)]
      },
      {
        pathDistance: 2,
        reactorActorId,
        reactorTokenId,
        options: [option('e', 2)]
      }
    ]
    const root = {
      commandId: '00000000-0000-4000-8000-000000000088',
      commandFingerprint: 'f'.repeat(64),
      initiatorUserId: ids.owner,
      correlationId: null,
      encounterId: ids.command,
      sceneId,
      tokenId: movingTokenId,
      expectedEncounterVersion: 3,
      expectedSceneVersion: 0,
      movementKind: 'VOLUNTARY' as const,
      originalPath: [
        { x: 0, y: 0 },
        { x: 3, y: 0 }
      ],
      pathChecksum: '1'.repeat(64),
      pathStartDistance: 1,
      currentPosition: { x: 1, y: 0 },
      currentSceneVersion: 1,
      resolutionCommands: []
    }
    const pendingSnapshot = {
      snapshotKind: 'KERNEL_EVIDENCE' as const,
      request: {
        requestId: 'reaction-choice-1',
        kind: 'CHOICE' as const,
        nodeId: 'choice',
        ordinal: 0,
        options: [0, 1]
      },
      applicationContext: {
        kind: 'ENCOUNTER_MOVEMENT_REACTION' as const,
        schemaVersion: 1 as const,
        root,
        spatialSelectionChecksum: '2'.repeat(64),
        spatialCurrentnessChecksum: '3'.repeat(64),
        reactionSelectionChecksum: '4'.repeat(64),
        completedSpatialExecutions: [],
        appliedSpatialPrefix: null,
        completedReactionExecutions: [],
        phase: { kind: 'CHOICE' as const },
        remainingSpatialCandidates: [],
        reactionTimeline: choices.map((group) => ({ kind: 'CONTROLLER_CHOICE' as const, group }))
      }
    }
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: root.commandId,
      rootCommandFingerprint: root.commandFingerprint,
      commandType: 'MOVE_SCENE_TOKEN',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      completedAt: null
    }
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: '5'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED' as const,
      manualReminderMode: 'OFF' as const,
      name: 'Reaction proof',
      status: 'ACTIVE' as const,
      version: 3,
      round: 1,
      currentActorId: null,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      actors: [],
      reminders: []
    }
    const sceneState = {
      id: sceneId,
      version: 1,
      tokens: [
        {
          id: movingTokenId,
          actorId: moverActorId,
          position: { x: 1, y: 0 }
        }
      ]
    }
    const declineInput = {
      ...occurrenceInput,
      resolution: { kind: 'DECLINE' as const }
    }
    const resolutionCommand = {
      commandId: declineInput.commandId,
      commandFingerprint: createHash('sha256').update(JSON.stringify(declineInput)).digest('hex'),
      actorUserId: ids.owner,
      correlationId: null,
      expectedOccurrenceVersion: 0,
      kind: 'DECLINE' as const
    }
    const nextPendingSnapshot = {
      ...pendingSnapshot,
      request: { ...pendingSnapshot.request, requestId: 'reaction-choice-2' },
      applicationContext: {
        ...pendingSnapshot.applicationContext,
        root: {
          ...root,
          currentSceneVersion: 2,
          pathStartDistance: 2,
          resolutionCommands: [resolutionCommand]
        },
        reactionTimeline: choices
          .slice(1)
          .map((group) => ({ kind: 'CONTROLLER_CHOICE' as const, group }))
      }
    }
    const frozenRemainder = {
      root: { ...root, resolutionCommands: [resolutionCommand] },
      spatialSelectionChecksum: '2'.repeat(64),
      spatialCurrentnessChecksum: '3'.repeat(64),
      completedSpatialExecutions: [],
      appliedSpatialPrefix: null,
      completedReactionExecutions: [],
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [],
      reactionTimeline: choices
        .slice(1)
        .map((group) => ({ kind: 'CONTROLLER_CHOICE' as const, group }))
    }
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.scene.findEncounterBinding.mockResolvedValue({
      commandFingerprint: '1'.repeat(64),
      commandId: ids.command,
      sceneId
    })
    mocks.scene.listActorTokenBindings.mockResolvedValue([
      { actorId: moverActorId, tokenId: movingTokenId }
    ])
    mocks.scene.lockLiveScene.mockResolvedValue({
      definitionSnapshot: {},
      state: sceneState
    })
    mocks.spatialRuleEffects.lockScope.mockResolvedValue({})
    mocks.appendReactionCommand.mockReturnValue([resolutionCommand])
    mocks.resolveReactionChoice.mockResolvedValue({
      kind: 'DECLINED',
      context: pendingSnapshot.applicationContext
    })
    mocks.reactionRemainder.mockReturnValue(frozenRemainder)
    mocks.spatialEvaluation.mockResolvedValue({
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 2,
      boundaryPosition: { x: 2, y: 0 },
      movementIntent: {
        tokenId: movingTokenId,
        position: { x: 2, y: 0 }
      },
      completedExecutions: [],
      appliedPrefix: null,
      completedReactionExecutions: [],
      remainingCandidates: [],
      resolutionCommands: [resolutionCommand],
      selectionChecksum: '2'.repeat(64),
      currentnessChecksum: '3'.repeat(64)
    })
    mocks.commitSpatialMovement.mockResolvedValue({
      state: { ...sceneState, version: 1 },
      version: 1,
      delta: null
    })
    mocks.startReactionBoundary.mockResolvedValue(nextPendingSnapshot)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(encounter, { actors: [] })
    })

    const result = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      declineInput,
      { rulesRuntime: {} as never }
    )

    expect(result.replayed).toBe(false)
    expect(result.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING',
      pending: { kind: 'MOVEMENT_REACTION' }
    })
    expect(mocks.reactionRemainder).toHaveBeenCalledWith({
      context: pendingSnapshot.applicationContext,
      resolutionCommands: [resolutionCommand]
    })
    expect(mocks.spatialEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        frozenReactionRemainder: frozenRemainder,
        interruptAfterPathDistance: 2
      })
    )
    expect(mocks.commitSpatialMovement).toHaveBeenCalledWith(
      expect.objectContaining({ startDistance: 1, endDistance: 2 })
    )
    expect(mocks.occurrences.advancePending).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: ids.command,
        occurrenceId,
        expectedOccurrenceVersion: 0,
        pendingSnapshot: nextPendingSnapshot
      })
    )
    expect(mocks.occurrences.complete).not.toHaveBeenCalled()
    const declineReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)?.[0]
    expect(declineReceipt).toMatchObject({
      commandId: declineInput.commandId,
      aggregateVersion: 3,
      commandMetadata: {
        transition: 'SPATIAL_MOVEMENT',
        encounterVersionTransition: 'UNCHANGED',
        occurrenceVersion: 1
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        occurrence: {
          occurrenceVersion: 1,
          pending: { kind: 'MOVEMENT_REACTION' }
        }
      }
    })

    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      version: 1,
      pendingSnapshot: nextPendingSnapshot
    })
    mocks.occurrences.findReceipt.mockResolvedValue({
      ...declineReceipt,
      commandMetadata: {
        ...declineReceipt.commandMetadata,
        sceneVersionTransition: 'ADVANCED'
      }
    })
    mocks.scene.findEventByCommand.mockResolvedValue({
      commandFingerprint: '0'.repeat(64),
      commandType: declineInput.type,
      createdAt: '2026-08-28T00:00:00.000Z',
      event: {
        actorUserId: ids.owner,
        commandId: declineInput.commandId,
        delta: {
          kind: 'TOKEN_MOVED',
          tokenId: movingTokenId,
          position: { x: 2, y: 0 }
        },
        sceneId,
        version: 2
      },
      id: declineInput.commandId
    })
    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, declineInput, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('unavailable')
    mocks.occurrences.findReceipt.mockResolvedValue(declineReceipt)
    mocks.scene.findEventByCommand.mockResolvedValue(null)
    mocks.spatialEvaluation.mockClear()
    mocks.commitSpatialMovement.mockClear()

    const replay = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      declineInput,
      { rulesRuntime: {} as never }
    )

    expect(replay.replayed).toBe(true)
    expect(replay.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING',
      pending: { kind: 'MOVEMENT_REACTION' }
    })
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()
    mocks.occurrences.findReceipt.mockResolvedValue(null)

    const selectedInput = {
      ...occurrenceInput,
      commandId: '00000000-0000-4000-8000-000000000084',
      resolution: {
        kind: 'OPTION' as const,
        optionId: choices[0]!.options[0]!.optionId
      }
    }
    const selectedResolutionCommand = {
      commandId: selectedInput.commandId,
      commandFingerprint: createHash('sha256').update(JSON.stringify(selectedInput)).digest('hex'),
      actorUserId: ids.owner,
      correlationId: null,
      expectedOccurrenceVersion: 0,
      kind: 'OPTION' as const,
      optionId: choices[0]!.options[0]!.optionId
    }
    const d20Policy = {
      requestNodeId: 'roll',
      rollMode: 'NORMAL' as const,
      contributors: [],
      contributorChecksum: '7'.repeat(64),
      modifier: 3,
      dc: 14
    }
    const actionPendingSnapshot = {
      ...pendingSnapshot,
      request: {
        kind: 'INTEGER_RANGE' as const,
        requestId: 'reaction-action-roll',
        nodeId: 'roll',
        ordinal: 0,
        min: 1,
        max: 20
      },
      applicationContext: {
        ...pendingSnapshot.applicationContext,
        root: {
          ...root,
          resolutionCommands: [selectedResolutionCommand]
        },
        phase: {
          kind: 'ACTION_EVIDENCE' as const,
          selectedOptionId: choices[0]!.options[0]!.optionId,
          d20Policy
        }
      }
    }
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.appendReactionCommand.mockReturnValue([selectedResolutionCommand])
    mocks.resolveReactionChoice.mockResolvedValue({
      kind: 'SELECTED',
      context: pendingSnapshot.applicationContext,
      option: choices[0]!.options[0]
    })
    mocks.prepareReactionAction.mockResolvedValue({ action: {} })
    mocks.executeReactionAction.mockResolvedValue({
      kind: 'PENDING',
      continuation: { occurrenceId },
      d20Policy
    })
    mocks.retainReactionActionEvidence.mockReturnValue(actionPendingSnapshot)
    mocks.spatialEvaluation.mockClear()
    mocks.commitSpatialMovement.mockClear()

    const pendingAction = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      selectedInput,
      { rulesRuntime: {} as never }
    )

    expect(pendingAction.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING',
      pending: {
        kind: 'D20_EVIDENCE',
        request: { requestId: 'reaction-action-roll' }
      }
    })
    expect(mocks.prepareReactionAction).toHaveBeenCalledTimes(1)
    expect(mocks.executeReactionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        automationMode: 'ASSISTED',
        occurrenceId
      })
    )
    expect(mocks.retainReactionActionEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedOptionId: choices[0]!.options[0]!.optionId,
        d20Policy
      })
    )
    expect(mocks.settleReactionAction).not.toHaveBeenCalled()
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()
    const selectedReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)?.[0]
    expect(selectedReceipt).toMatchObject({
      commandId: selectedInput.commandId,
      aggregateVersion: 3,
      commandMetadata: {
        encounterVersionTransition: 'UNCHANGED',
        occurrenceVersion: 1
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        occurrence: {
          occurrenceVersion: 1,
          pending: {
            kind: 'D20_EVIDENCE',
            request: { requestId: 'reaction-action-roll' }
          }
        }
      }
    })

    const actionEvidenceInput = {
      ...occurrenceInput,
      commandId: '00000000-0000-4000-8000-000000000085',
      expectedOccurrenceVersion: 1,
      resolution: {
        kind: 'ENTER_DICE' as const,
        rawFaces: [12],
        requestId: 'reaction-action-roll'
      }
    }
    const actionEvidenceResolutionCommand = {
      commandId: actionEvidenceInput.commandId,
      commandFingerprint: createHash('sha256')
        .update(JSON.stringify(actionEvidenceInput))
        .digest('hex'),
      actorUserId: ids.owner,
      correlationId: null,
      expectedOccurrenceVersion: 1,
      requestId: 'reaction-action-roll',
      kind: 'ENTER_DICE' as const
    }
    const actionResolutionCommands = [selectedResolutionCommand, actionEvidenceResolutionCommand]
    const reactionExecution = {
      ordinal: 0,
      sourceCommandId: actionEvidenceInput.commandId,
      option: choices[0]!.options[0]!,
      allowance: {
        definitionId: choices[0]!.options[0]!.policy.allowanceDefinitionId,
        maximum: choices[0]!.options[0]!.policy.allowanceMaximum,
        beforeUsed: 0,
        afterUsed: 1
      },
      execution: {
        status: 'COMPLETE' as const,
        outputs: {},
        evidence: {
          source: {
            definitionId: ids.template,
            gameSystemId: ids.system,
            definitionFamilyKey: 'reaction',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: {}
        }
      },
      application: { kind: 'NONE' as const },
      characterTransitions: [
        {
          characterId: '00000000-0000-4000-8000-000000000081',
          beforeStreamVersion: 0,
          afterStreamVersion: 1
        }
      ]
    }
    const frozenAfterAction = {
      ...frozenRemainder,
      completedReactionExecutions: [reactionExecution],
      root: {
        ...root,
        resolutionCommands: actionResolutionCommands
      },
      reactionChoices: choices.slice(1)
    }
    const nextAfterActionPendingSnapshot = {
      ...nextPendingSnapshot,
      applicationContext: {
        ...nextPendingSnapshot.applicationContext,
        root: {
          ...nextPendingSnapshot.applicationContext.root,
          resolutionCommands: actionResolutionCommands
        }
      }
    }
    const currentEncounter = { ...encounter, version: 4 }
    const advanceVersion = vi.fn().mockResolvedValue(4)

    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        advanceVersion
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      version: 1,
      pendingSnapshot: actionPendingSnapshot
    })
    mocks.occurrences.findReceipt.mockResolvedValue(null)
    mocks.appendReactionActionEvidenceCommand.mockReturnValue(actionResolutionCommands)
    mocks.prepareReactionAction.mockResolvedValue({
      action: {},
      targetActor: { kind: 'CHARACTER' },
      targets: { encounterActorRules: null }
    })
    mocks.executeReactionAction.mockResolvedValue({
      kind: 'COMPLETE',
      execution: {
        ...reactionExecution.execution,
        outputs: { resultPath: 'ON_SAVE_FAIL' }
      },
      applications: [],
      d20: {
        requestId: 'reaction-action-roll',
        rollMode: 'NORMAL',
        rawFaces: [12],
        selectedNatural: 12,
        contributors: [],
        contributorChecksum: '7'.repeat(64),
        modifier: 3,
        total: 15,
        defenseOrDc: 16,
        resultPath: 'ON_SAVE_FAIL'
      }
    })
    mocks.settleReactionAction.mockResolvedValue({ reactionExecution })
    mocks.completedReactionRemainder.mockReturnValue(frozenAfterAction)
    mocks.spatialEvaluation.mockResolvedValue({
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 2,
      boundaryPosition: { x: 2, y: 0 },
      movementIntent: {
        tokenId: movingTokenId,
        position: { x: 2, y: 0 }
      },
      completedExecutions: [],
      completedReactionExecutions: [reactionExecution],
      appliedPrefix: null,
      remainingCandidates: [],
      resolutionCommands: actionResolutionCommands,
      selectionChecksum: '2'.repeat(64),
      currentnessChecksum: '3'.repeat(64)
    })
    mocks.commitSpatialMovement.mockResolvedValue({
      state: { ...sceneState, version: 1 },
      version: 1,
      delta: null
    })
    mocks.startReactionBoundary.mockResolvedValue(nextAfterActionPendingSnapshot)
    mocks.encounter.find.mockResolvedValue(currentEncounter)
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(currentEncounter, { actors: [] })
    })

    const settledAction = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      actionEvidenceInput,
      { rulesRuntime: {} as never }
    )

    expect(settledAction.replayed).toBe(false)
    expect(settledAction.spatialChangedAggregates).toEqual([
      {
        aggregateId: '00000000-0000-4000-8000-000000000081',
        aggregateKind: 'CHARACTER',
        beforeVersion: 0,
        version: 1
      },
      {
        aggregateId: ids.command,
        aggregateKind: 'ENCOUNTER',
        beforeVersion: 3,
        version: 4
      }
    ])
    expect(settledAction.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 2,
      status: 'PENDING',
      pending: { kind: 'MOVEMENT_REACTION', encounterVersion: 4 }
    })
    expect(mocks.appendReactionActionEvidenceCommand).toHaveBeenCalledWith({
      history: [selectedResolutionCommand],
      command: expect.objectContaining({
        commandId: actionEvidenceInput.commandId,
        expectedOccurrenceVersion: 1,
        kind: 'ENTER_DICE',
        requestId: 'reaction-action-roll'
      }),
      actorUserId: ids.owner,
      proposedOccurrenceVersion: 2
    })
    expect(mocks.executeReactionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        continuation: expect.objectContaining({
          request: expect.objectContaining({
            requestId: 'reaction-action-roll'
          })
        }),
        expectedD20Policy: d20Policy,
        resolution: {
          kind: 'ENTER_DICE',
          rawFaces: [12],
          requestId: 'reaction-action-roll'
        }
      })
    )
    expect(mocks.settleReactionAction).toHaveBeenCalledTimes(1)
    expect(mocks.refreshActiveEffectTargets).toHaveBeenCalledTimes(1)
    expect(mocks.refreshActiveEffectTargets).toHaveBeenCalledWith(
      expect.objectContaining({ encounter: currentEncounter })
    )
    expect(mocks.discoverLegendaryResistance).not.toHaveBeenCalled()
    expect(mocks.completedReactionRemainder).toHaveBeenCalledWith({
      context: {
        ...actionPendingSnapshot.applicationContext,
        root: {
          ...actionPendingSnapshot.applicationContext.root,
          resolutionCommands: actionResolutionCommands
        }
      },
      selectedOptionId: choices[0]!.options[0]!.optionId,
      resolutionCommands: actionResolutionCommands,
      execution: reactionExecution
    })
    expect(mocks.spatialEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        frozenReactionRemainder: frozenAfterAction,
        interruptAfterPathDistance: 2
      })
    )
    expect(advanceVersion).toHaveBeenCalledWith(3)
    expect(mocks.occurrences.advancePending).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: ids.command,
        occurrenceId,
        expectedAggregateVersion: 3,
        expectedOccurrenceVersion: 1,
        nextAggregateVersion: 4,
        pendingSnapshot: nextAfterActionPendingSnapshot
      })
    )
    const actionEvidenceReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)?.[0]
    expect(actionEvidenceReceipt).toMatchObject({
      commandId: actionEvidenceInput.commandId,
      aggregateVersion: 4,
      commandMetadata: {
        expectedEncounterVersion: 3,
        encounterVersionTransition: 'ADVANCED',
        occurrenceVersion: 2,
        changedAggregates: [
          {
            aggregateId: '00000000-0000-4000-8000-000000000081',
            aggregateKind: 'CHARACTER',
            beforeVersion: 0,
            version: 1
          },
          {
            aggregateId: ids.command,
            aggregateKind: 'ENCOUNTER',
            beforeVersion: 3,
            version: 4
          }
        ]
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        encounterVersion: 4,
        occurrence: {
          occurrenceVersion: 2,
          pending: { kind: 'MOVEMENT_REACTION' }
        }
      }
    })

    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      expectedAggregateVersion: 4,
      version: 2,
      state: 'COMPLETED',
      pendingSnapshot: null,
      completedAt: '2026-08-28T00:00:01.000Z'
    })
    mocks.prepareReactionAction.mockClear()
    mocks.executeReactionAction.mockClear()
    mocks.settleReactionAction.mockClear()
    mocks.spatialEvaluation.mockClear()
    mocks.commitSpatialMovement.mockClear()

    mocks.occurrences.findReceipt.mockResolvedValue(selectedReceipt)
    const selectedReplayAfterCompletion = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      selectedInput,
      { rulesRuntime: {} as never }
    )

    expect(selectedReplayAfterCompletion.replayed).toBe(true)
    expect(selectedReplayAfterCompletion.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 2,
      status: 'COMPLETE',
      pending: null
    })
    expect(mocks.prepareReactionAction).not.toHaveBeenCalled()
    expect(mocks.executeReactionAction).not.toHaveBeenCalled()
    expect(mocks.settleReactionAction).not.toHaveBeenCalled()
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()

    mocks.occurrences.findReceipt.mockResolvedValue(actionEvidenceReceipt)
    const actionReplay = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      actionEvidenceInput,
      { rulesRuntime: {} as never }
    )

    expect(actionReplay.replayed).toBe(true)
    expect(actionReplay.spatialChangedAggregates).toEqual(settledAction.spatialChangedAggregates)
    expect(actionReplay.response.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 2,
      status: 'COMPLETE',
      pending: null
    })
    expect(mocks.prepareReactionAction).not.toHaveBeenCalled()
    expect(mocks.executeReactionAction).not.toHaveBeenCalled()
    expect(mocks.settleReactionAction).not.toHaveBeenCalled()
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()

    const terminalInput = {
      ...occurrenceInput,
      commandId: '00000000-0000-4000-8000-000000000083',
      expectedOccurrenceVersion: 2,
      expectedVersion: 4,
      resolution: { kind: 'DECLINE' as const }
    }
    const terminalResolutionCommand = {
      commandId: terminalInput.commandId,
      commandFingerprint: createHash('sha256').update(JSON.stringify(terminalInput)).digest('hex'),
      actorUserId: ids.owner,
      correlationId: null,
      expectedOccurrenceVersion: 2,
      kind: 'DECLINE' as const
    }
    const terminalResolutionCommands = [...actionResolutionCommands, terminalResolutionCommand]
    const terminalPendingSnapshot = {
      ...nextAfterActionPendingSnapshot,
      applicationContext: {
        ...nextAfterActionPendingSnapshot.applicationContext,
        root: {
          ...nextAfterActionPendingSnapshot.applicationContext.root,
          currentPosition: { x: 3, y: 0 },
          currentSceneVersion: 2,
          pathStartDistance: 3,
          resolutionCommands: actionResolutionCommands
        }
      }
    }
    const terminalRemainder = {
      ...frozenAfterAction,
      root: {
        ...terminalPendingSnapshot.applicationContext.root,
        resolutionCommands: terminalResolutionCommands
      },
      reactionChoices: []
    }
    const terminalScene = {
      ...sceneState,
      version: 2,
      tokens: [
        {
          id: movingTokenId,
          actorId: moverActorId,
          position: { x: 3, y: 0 }
        }
      ]
    }
    const terminalEncounter = { ...encounter, version: 5 }
    advanceVersion.mockResolvedValueOnce(5)
    mocks.lockedContext.mockResolvedValue({
      encounter: currentEncounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        advanceVersion
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      expectedAggregateVersion: 4,
      version: 2,
      pendingSnapshot: terminalPendingSnapshot
    })
    mocks.occurrences.findReceipt.mockResolvedValue(null)
    mocks.scene.findEncounterBinding.mockResolvedValue({
      commandFingerprint: '1'.repeat(64),
      commandId: ids.command,
      sceneId
    })
    mocks.scene.listActorTokenBindings.mockResolvedValue([
      { actorId: moverActorId, tokenId: movingTokenId }
    ])
    mocks.scene.lockLiveScene.mockResolvedValue({
      definitionSnapshot: {},
      state: terminalScene
    })
    mocks.appendReactionCommand.mockReturnValue(terminalResolutionCommands)
    mocks.resolveReactionChoice.mockResolvedValue({
      kind: 'DECLINED',
      context: terminalPendingSnapshot.applicationContext
    })
    mocks.reactionRemainder.mockReturnValue(terminalRemainder)
    mocks.spatialEvaluation.mockResolvedValue({
      kind: 'TERMINAL',
      movementIntent: null,
      resolutionCommands: terminalResolutionCommands,
      selectionChecksum: '2'.repeat(64),
      currentnessChecksum: '3'.repeat(64),
      result: {
        status: 'MOVEMENT_COMPLETE',
        schemaVersion: 1,
        occurrenceId,
        occurrenceVersion: 3,
        encounterId: ids.command,
        encounterVersion: 5,
        sceneId,
        sceneVersion: 2,
        tokenId: movingTokenId,
        movementKind: 'VOLUNTARY',
        reactionExecutions: [reactionExecution],
        terminalPosition: { x: 3, y: 0 }
      }
    })
    mocks.commitSpatialMovement.mockResolvedValue({
      state: terminalScene,
      version: 2,
      delta: null
    })
    mocks.encounter.find.mockResolvedValue(terminalEncounter)
    mocks.occurrences.complete.mockResolvedValue({
      ...occurrence,
      expectedAggregateVersion: 5,
      version: 3,
      state: 'COMPLETED',
      pendingSnapshot: null,
      completedAt: '2026-08-28T00:00:02.000Z'
    })

    const terminal = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      terminalInput,
      { rulesRuntime: {} as never }
    )

    expect(terminal.replayed).toBe(false)
    expect(terminal.spatialChangedAggregates).toEqual([
      {
        aggregateId: ids.command,
        aggregateKind: 'ENCOUNTER',
        beforeVersion: 4,
        version: 5
      }
    ])
    const terminalReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)?.[0]
    const terminalEvent = mocks.encounter.appendEvent.mock.calls.at(-1)?.[0]
    mocks.lockedContext.mockResolvedValue({
      encounter: terminalEncounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        advanceVersion
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      expectedAggregateVersion: 5,
      version: 3,
      state: 'COMPLETED',
      pendingSnapshot: null,
      completedAt: '2026-08-28T00:00:02.000Z'
    })
    mocks.occurrences.findReceipt.mockResolvedValue(terminalReceipt)
    mocks.encounter.findEventByCommand.mockResolvedValue(terminalEvent)
    mocks.parsedReplay.mockReturnValue(terminalEvent.resultPayload)
    mocks.spatialEvaluation.mockClear()
    mocks.commitSpatialMovement.mockClear()

    const terminalReplay = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      terminalInput,
      { rulesRuntime: {} as never }
    )

    expect(terminalReplay.replayed).toBe(true)
    expect(terminalReplay.spatialChangedAggregates).toEqual(terminal.spatialChangedAggregates)
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()

    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        advanceVersion
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...occurrence,
      version: 1,
      pendingSnapshot: actionPendingSnapshot
    })
    mocks.occurrences.findReceipt.mockResolvedValue(null)
    mocks.scene.findEventByCommand.mockResolvedValue(null)
    mocks.scene.findEncounterBinding.mockResolvedValue({
      commandFingerprint: '1'.repeat(64),
      commandId: ids.command,
      sceneId
    })
    mocks.scene.listActorTokenBindings.mockResolvedValue([
      { actorId: moverActorId, tokenId: movingTokenId }
    ])
    mocks.scene.lockLiveScene.mockResolvedValue({ definitionSnapshot: {}, state: sceneState })
    mocks.spatialRuleEffects.lockScope.mockResolvedValue({})
    mocks.appendReactionActionEvidenceCommand.mockReturnValue(actionResolutionCommands)
    mocks.prepareReactionAction.mockResolvedValue({
      action: { target: { actorId: moverActorId } },
      targetActor: { id: moverActorId, kind: 'CREATURE' },
      targets: { encounterActorRules: { actors: [] } }
    })
    mocks.executeReactionAction.mockResolvedValue({
      kind: 'COMPLETE',
      execution: {
        ...reactionExecution.execution,
        outputs: { resultPath: 'ON_SAVE_FAIL' }
      },
      applications: [],
      d20: {
        requestId: 'reaction-action-roll',
        rollMode: 'NORMAL',
        rawFaces: [12],
        selectedNatural: 12,
        contributors: [],
        contributorChecksum: '7'.repeat(64),
        modifier: 3,
        total: 15,
        defenseOrDc: 16,
        resultPath: 'ON_SAVE_FAIL'
      }
    })
    mocks.discoverLegendaryResistance.mockResolvedValue({ targetActorId: moverActorId })
    mocks.startLegendaryResistance.mockResolvedValue({ occurrenceId })
    mocks.retainLegendaryResistanceChoice.mockImplementation(() => {
      throw new Error('captured Legendary Resistance continuation')
    })
    mocks.settleReactionAction.mockClear()

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, actionEvidenceInput, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('captured Legendary Resistance continuation')
    expect(mocks.retainLegendaryResistanceChoice).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          root: expect.objectContaining({ resolutionCommands: actionResolutionCommands })
        })
      })
    )
    expect(mocks.settleReactionAction).not.toHaveBeenCalled()
  })

  function passageFixture(
    automationMode: 'AUTOMATIC' | 'ASSISTED' = 'AUTOMATIC',
    withPriorReaction = false,
    withLaterBlocker = false,
    blockerCharacterId: string | null = null
  ) {
    const occurrenceId = '00000000-0000-4000-8000-0000000000b1'
    const sceneId = '00000000-0000-4000-8000-0000000000b2'
    const moverActorId = '00000000-0000-4000-8000-0000000000b3'
    const blockerActorId = '00000000-0000-4000-8000-0000000000b4'
    const moverTokenId = '00000000-0000-4000-8000-0000000000b5'
    const blockerTokenId = '00000000-0000-4000-8000-0000000000b6'
    const laterBlockerActorId = '00000000-0000-4000-8000-0000000000c1'
    const laterBlockerTokenId = '00000000-0000-4000-8000-0000000000c2'
    const allowanceDefinitionId = '00000000-0000-4000-8000-0000000000b7'
    const createdAt = '2026-09-01T00:00:00.000Z'
    const actor = (id: string, label: string) => ({
      id,
      encounterId: ids.command,
      kind: 'CUSTOM' as const,
      sourceId: null,
      sourceRevision: null,
      label,
      systemId: ids.system,
      stableTieKey: label.toLowerCase(),
      public: true,
      currentHitPoints: 10,
      maxHitPoints: 10,
      tempHitPoints: 0,
      conditions: [],
      resources: {},
      gmNotes: null,
      initiative: 10,
      manualOrder: 0,
      snapshot: { kind: 'CUSTOM', systemId: ids.system },
      createdAt,
      updatedAt: createdAt
    })
    const mover = actor(moverActorId, 'Mover')
    const blocker = blockerCharacterId
      ? {
          ...actor(blockerActorId, 'Blocker'),
          kind: 'CHARACTER' as const,
          sourceId: blockerCharacterId,
          snapshot: { kind: 'CHARACTER' as const, characterId: blockerCharacterId }
        }
      : actor(blockerActorId, 'Blocker')
    const laterBlocker = actor(laterBlockerActorId, 'Later blocker')
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.template,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: '1'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode,
      manualReminderMode: 'OFF' as const,
      name: 'Passage proof',
      status: 'ACTIVE' as const,
      version: 3,
      round: 1,
      currentActorId: moverActorId,
      optionalCombatSnapshot: null,
      optionalCombatSnapshotChecksum: '2'.repeat(64),
      initiativePolicySnapshot: null,
      initiativePolicySnapshotChecksum: null,
      actors: [mover, blocker, ...(withLaterBlocker ? [laterBlocker] : [])],
      reminders: [],
      createdAt,
      updatedAt: createdAt
    }
    const movingToken = {
      id: moverTokenId,
      actorId: moverActorId,
      position: { x: 1, y: 0 },
      width: 1,
      height: 1
    }
    const blockerToken = {
      id: blockerTokenId,
      actorId: blockerActorId,
      position: { x: 2, y: 0 },
      width: 1,
      height: 1
    }
    const laterBlockerToken = {
      id: laterBlockerTokenId,
      actorId: laterBlockerActorId,
      position: { x: 3.5, y: 0 },
      width: 1,
      height: 1
    }
    const priorReactionExecution = {
      ordinal: 0,
      sourceCommandId: '00000000-0000-4000-8000-0000000000b8',
      option: {
        optionId: 'a'.repeat(64),
        contactSourceId: 'b'.repeat(64),
        actionId: 'prior-passage-reaction',
        actionSourceKind: 'ENCOUNTER_FEATURE' as const,
        actionSourceCurrentnessChecksum: 'c'.repeat(64),
        candidate: {
          contact: { x: 0.5, y: 0 },
          movingActorId: moverActorId,
          pathDistance: 0.5,
          reactorActorId: blockerActorId,
          reactorTokenId: blockerTokenId,
          sourceId: 'b'.repeat(64),
          stage: 'BEFORE_LEAVE_REACH' as const
        },
        binding: {
          kind: 'MOVEMENT' as const,
          stage: 'BEFORE_LEAVE_REACH' as const,
          perceptionRequirement: null,
          eligibilityDefinitionId: ids.template,
          movementInterruption: null
        },
        policy: {
          eligible: true,
          allowanceDefinitionId: allowanceDefinitionId,
          allowanceMaximum: 1,
          allowanceRefreshBoundary: 'START_OF_TURN' as const,
          selectionPolicy: 'AUTOMATIC' as const,
          choiceDefinitionId: null,
          targetPolicy: 'MOVER' as const
        },
        eligibilityEvidenceChecksum: 'd'.repeat(64),
        authority: { kind: 'GM' as const },
        visibility: 'GM_ONLY' as const
      },
      allowance: {
        definitionId: allowanceDefinitionId,
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      },
      execution: {
        status: 'COMPLETE' as const,
        outputs: {},
        evidence: {
          source: {
            definitionId: ids.template,
            gameSystemId: ids.system,
            definitionFamilyKey: 'reaction',
            checksum: 'e'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: {}
        }
      },
      application: { kind: 'NONE' as const },
      legendaryResistance: null,
      characterTransitions: []
    }
    const movement = {
      root: {
        commandId: '00000000-0000-4000-8000-0000000000b8',
        commandFingerprint: '3'.repeat(64),
        initiatorUserId: ids.owner,
        correlationId: null,
        encounterId: ids.command,
        sceneId,
        tokenId: moverTokenId,
        expectedEncounterVersion: 3,
        expectedSceneVersion: 0,
        movementKind: 'VOLUNTARY' as const,
        originalPath: [
          { x: 0, y: 0 },
          { x: 3, y: 0 }
        ],
        pathChecksum: checksumRuleDocument([
          { x: 0, y: 0 },
          { x: 3, y: 0 }
        ]),
        pathStartDistance: 1,
        currentPosition: { x: 1, y: 0 },
        currentSceneVersion: 1,
        resolutionCommands: []
      },
      blockerActorId,
      blockerTokenId,
      contact: { x: 1, y: 0 },
      contactPathDistance: 1,
      blockerCurrentnessChecksum: checksumRuleDocument({
        actorId: blockerActorId,
        tokenId: blockerTokenId,
        footprint: blockerToken
      }),
      ...(withLaterBlocker
        ? {
            nextPassageStop: {
              blockerActorId: laterBlockerActorId,
              blockerTokenId: laterBlockerTokenId,
              contact: { x: 2.5, y: 0 },
              pathDistance: 2.5,
              blockerCurrentnessChecksum: checksumRuleDocument({
                actorId: laterBlockerActorId,
                tokenId: laterBlockerTokenId,
                footprint: laterBlockerToken
              })
            }
          }
        : {}),
      spatialSelectionChecksum: '4'.repeat(64),
      spatialCurrentnessChecksum: '5'.repeat(64),
      completedSpatialExecutions: [],
      appliedSpatialPrefix: null,
      completedReactionExecutions: withPriorReaction ? [priorReactionExecution] : [],
      remainingSpatialCandidates: [],
      reactionTimeline: []
    }
    const choice = createEncounterMovementPassageChoice({
      movement,
      sourceActorId: moverActorId,
      sourceControllerCharacterId: null,
      options: [
        {
          ruleKind: 'OVERRUN',
          economy: 'ACTION',
          definitionId: '00000000-0000-4000-8000-0000000000b9',
          definitionVersion: 1,
          definitionChecksum: '6'.repeat(64),
          moduleKey: 'optional-combat.overrun',
          moduleContractVersion: 1
        }
      ]
    })
    const pendingPassageContest = (
      actionEconomy: NonNullable<
        ServerOptionalCombatContestPendingApplicationContextDto['actionEconomy']
      >
    ): ServerOptionalCombatContestPendingApplicationContextDto => ({
      kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST',
      schemaVersion: 1,
      actionKind: 'OVERRUN',
      actionId: choice.options[0]!.optionId,
      sourceActorId: moverActorId,
      targetActorId: blockerActorId,
      initiatorControllerCharacterId: null,
      sceneContext: {
        sceneId,
        sceneVersion: 1,
        sourceTokenId: moverTokenId,
        targetTokenId: blockerTokenId
      },
      positionalDependencyChecksum: checksumRuleDocument(movement),
      optionalCombat: {
        snapshotChecksum: encounter.optionalCombatSnapshotChecksum!,
        definitionId: choice.options[0]!.definitionId,
        definitionVersion: choice.options[0]!.definitionVersion,
        definitionChecksum: choice.options[0]!.definitionChecksum,
        moduleKey: choice.options[0]!.moduleKey,
        moduleContractVersion: choice.options[0]!.moduleContractVersion
      },
      contestGraph: {
        definitionId: ids.template,
        checksum: '8'.repeat(64),
        identityChecksum: '9'.repeat(64)
      },
      optionId: choice.options[0]!.optionId,
      selectionContractChecksum: checksumRuleDocument(choice.options[0]),
      resolvedSelectionChecksum: checksumRuleDocument({ optionId: choice.options[0]!.optionId }),
      source: {
        kind: 'OPTIONAL_COMBAT_DEFINITION',
        definitionId: choice.options[0]!.definitionId,
        definitionVersion: choice.options[0]!.definitionVersion,
        definitionChecksum: choice.options[0]!.definitionChecksum,
        moduleKey: choice.options[0]!.moduleKey,
        moduleContractVersion: choice.options[0]!.moduleContractVersion
      },
      target: {
        kind: 'ENCOUNTER_ACTOR',
        currentnessChecksum: movement.blockerCurrentnessChecksum
      },
      initiator: {
        actorId: moverActorId,
        requestNodeId: 'initiator_d20',
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 0
      },
      defender: {
        actorId: blockerActorId,
        requestNodeId: 'target_d20',
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 0,
        checkDefinitionId: ids.otherSystem
      },
      rollEvidence: { initiator: null, defender: null },
      selection: {
        kind: 'OVERRUN',
        economy: choice.options[0]!.economy,
        defenderCheckDefinitionId: ids.otherSystem
      },
      actionEconomy,
      movementContinuation: movement
    })
    const contestGraph = createDnd5eOptionalCombatContestGraph({
      definitionId: choice.options[0]!.definitionId,
      definitionVersion: choice.options[0]!.definitionVersion,
      definitionChecksum: choice.options[0]!.definitionChecksum,
      moduleKey: choice.options[0]!.moduleKey,
      moduleContractVersion: choice.options[0]!.moduleContractVersion
    })
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiledContest = compileRuleGraph({
      definition: contestGraph.published.definition,
      sourceChecksum: contestGraph.published.checksum,
      capability: {
        gameSystemId: DND5E_SYSTEM_ID,
        contractVersion: 1,
        authoredRootKinds: [],
        ...dnd5eOptionalCombatContestCapabilityContribution
      },
      operations
    })
    if (!compiledContest.ok) throw new Error('Expected passage contest graph to compile.')
    const initiatorPending = executeRuleGraph({
      graph: compiledContest.value,
      occurrenceId,
      facts: {
        [DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY]: 0,
        [DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY]: 0
      },
      operations
    })
    if (initiatorPending.status !== 'PAUSED')
      throw new Error('Expected an initiator passage request.')
    const defenderPending = resumeRuleGraph({
      continuation: initiatorPending.continuation,
      response: { requestId: initiatorPending.continuation.request.requestId, value: 15 },
      operations
    })
    if (defenderPending.status !== 'PAUSED') throw new Error('Expected a defender passage request.')
    const pendingSnapshot = {
      snapshotKind: 'AGGREGATE_CHOICE' as const,
      schemaVersion: 1 as const,
      occurrenceId,
      optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum,
      applicationContext: choice
    }
    const occurrence = {
      id: occurrenceId,
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: ids.command,
      rootCommandId: movement.root.commandId,
      rootCommandFingerprint: movement.root.commandFingerprint,
      commandType: 'MOVE_SCENE_TOKEN',
      actorUserId: ids.owner,
      correlationId: null,
      expectedAggregateVersion: 3,
      version: 0,
      state: 'PENDING' as const,
      pendingSnapshot,
      createdAt,
      updatedAt: createdAt,
      completedAt: null
    }
    const sceneState = {
      id: sceneId,
      version: 1,
      tokens: [movingToken, blockerToken, ...(withLaterBlocker ? [laterBlockerToken] : [])]
    }
    const actorRules = {
      actors: [mover, blocker, ...(withLaterBlocker ? [laterBlocker] : [])].map((candidate) => ({
        actorId: candidate.id,
        initiativeModifier: 0,
        targetProtection: { status: 'NOT_NORMALIZED' as const },
        featureResources: []
      }))
    }
    const updatedEncounter = { ...encounter, version: 4 }
    const advanceVersion = vi.fn().mockResolvedValue(4)
    mocks.lockedContext.mockResolvedValue({
      encounter,
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        currentVersion: 3,
        advanceVersion
      }
    })
    mocks.occurrences.lockOccurrence.mockResolvedValue(occurrence)
    mocks.scene.findEncounterBinding.mockResolvedValue({ sceneId })
    mocks.scene.listActorTokenBindings.mockResolvedValue([
      { actorId: moverActorId, tokenId: moverTokenId },
      { actorId: blockerActorId, tokenId: blockerTokenId },
      ...(withLaterBlocker ? [{ actorId: laterBlockerActorId, tokenId: laterBlockerTokenId }] : [])
    ])
    mocks.scene.lockLiveScene.mockResolvedValue({ definitionSnapshot: {}, state: sceneState })
    mocks.spatialRuleEffects.lockScope.mockResolvedValue({})
    mocks.lockActiveEffectTargets.mockResolvedValue({
      characterIds: [],
      encounterActorIds: [
        moverActorId,
        blockerActorId,
        ...(withLaterBlocker ? [laterBlockerActorId] : [])
      ],
      lockedCharacters: new Map(),
      encounterActors: new Map([
        [moverActorId, mover],
        [blockerActorId, blocker],
        ...(withLaterBlocker ? ([[laterBlockerActorId, laterBlocker]] as const) : [])
      ]),
      activeEffectsByActorId: new Map(),
      baseScalarValuesByActorId: new Map(),
      effectiveScalarValuesByActorId: new Map(),
      encounterActorRules: actorRules
    })
    mocks.encounter.find.mockResolvedValue(updatedEncounter)
    mocks.actorEvaluation.mockResolvedValue({
      snapshot: {
        encounterVersion: 4,
        revisionId: ids.template,
        facts: { contractVersion: 1, actors: [] },
        output: actorRules
      },
      reconciledEncounter: updatedEncounter,
      actorUpdates: [],
      zenEvaluationMs: 0
    })
    mocks.encounter.requireCurrentProjection.mockResolvedValue({
      projection: projectGm(updatedEncounter, actorRules)
    })
    mocks.occurrences.complete.mockResolvedValue({
      ...occurrence,
      version: 1,
      state: 'COMPLETED',
      pendingSnapshot: null,
      completedAt: createdAt
    })
    return {
      advanceVersion,
      allowanceDefinitionId,
      actorRules,
      blocker,
      laterBlocker,
      laterBlockerToken,
      choice,
      encounter,
      mover,
      movement,
      occurrence,
      pendingPassageContest,
      passageContinuations: {
        initiator: { ...initiatorPending.continuation, seal: 'a'.repeat(64) },
        defender: { ...defenderPending.continuation, seal: 'b'.repeat(64) }
      },
      priorReactionExecution,
      sceneState,
      updatedEncounter
    }
  }

  it('declines a sealed movement passage without rolling, consuming economy, or advancing the token', async () => {
    const fixture = passageFixture()
    mocks.commitSpatialMovement.mockResolvedValue({
      state: fixture.sceneState,
      version: fixture.sceneState.version,
      delta: null
    })
    const input = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      resolution: { kind: 'PASSAGE_DECLINE' as const }
    }

    const result = await executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
      rulesRuntime: {} as never
    })

    expect(result).toMatchObject({
      replayed: false,
      response: { occurrence: { occurrenceId: fixture.occurrence.id, status: 'COMPLETE' } }
    })
    expect(mocks.preparePassageContest).not.toHaveBeenCalled()
    expect(mocks.executePassageContest).not.toHaveBeenCalled()
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).toHaveBeenCalledWith(
      expect.objectContaining({ startDistance: 1, endDistance: 1 })
    )
    expect(mocks.occurrences.complete).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId: fixture.occurrence.id })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: input.commandId,
        commandMetadata: expect.objectContaining({
          resolutionCommands: [expect.objectContaining({ kind: 'PASSAGE_DECLINE' })]
        })
      })
    )
  })

  it('reconnects a passage choice only to its controller with compact public options', async () => {
    const fixture = passageFixture('ASSISTED')
    const controllerCharacterId = '00000000-0000-4000-8000-0000000000c0'
    const pendingOccurrence = {
      ...fixture.occurrence,
      pendingSnapshot: {
        ...fixture.occurrence.pendingSnapshot,
        applicationContext: {
          ...fixture.choice,
          sourceControllerCharacterId: controllerCharacterId
        }
      }
    }
    mocks.occurrences.lockPendingEncounter.mockResolvedValue(pendingOccurrence)
    mocks.lockedContext.mockResolvedValue({
      encounter: fixture.encounter,
      context: {
        role: 'PLAYER',
        campaignId: fixture.encounter.campaignId,
        assignedCharacterId: controllerCharacterId,
        attunementSlotOverride: null
      }
    })

    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.owner, fixture.encounter.id)
    ).resolves.toEqual({
      kind: 'MOVEMENT_PASSAGE_CHOICE',
      occurrenceId: fixture.occurrence.id,
      occurrenceVersion: fixture.occurrence.version,
      encounterVersion: fixture.encounter.version,
      sourceActorId: fixture.choice.sourceActorId,
      options: fixture.choice.options.map(({ economy, optionId, ruleKind }) => ({
        economy,
        optionId,
        ruleKind
      })),
      allowedResponses: ['DECLINE', 'OPTION']
    })

    mocks.lockedContext.mockResolvedValue({
      encounter: fixture.encounter,
      context: {
        role: 'PLAYER',
        campaignId: fixture.encounter.campaignId,
        assignedCharacterId: ids.otherSystem,
        attunementSlotOverride: null
      }
    })
    await expect(
      getPendingEncounterRuleOccurrence({} as DBLike, ids.otherSystem, fixture.encounter.id)
    ).resolves.toBeNull()
  })

  it.each([['SUCCESS', true] as const, ['TIE_OR_FAILURE', false] as const])(
    'settles automatic Overrun %s on the same occurrence and consumes its allowance once',
    async (outcome, continues) => {
      const fixture = passageFixture('AUTOMATIC', !continues)
      const actionEconomy = {
        definitionId: fixture.allowanceDefinitionId,
        definitionVersion: 1,
        definitionChecksum: '7'.repeat(64),
        maximum: 1,
        beforeUsed: 0
      }
      mocks.preparePassageContest.mockResolvedValue(fixture.pendingPassageContest(actionEconomy))
      mocks.executePassageContest.mockResolvedValue({
        kind: 'COMPLETE',
        outcome,
        evidence: {
          initiatorRawFaces: [15],
          defenderRawFaces: [continues ? 10 : 15],
          initiatorTotal: 15,
          defenderTotal: continues ? 10 : 15
        }
      })
      mocks.commitSpatialMovement.mockResolvedValue({
        state: {
          ...fixture.sceneState,
          version: continues ? 2 : 1,
          tokens: fixture.sceneState.tokens.map((token) =>
            token.id === fixture.movement.root.tokenId && continues
              ? { ...token, position: { x: 3, y: 0 } }
              : token
          )
        },
        version: continues ? 2 : 1,
        delta: continues ? { kind: 'TOKEN_MOVED', tokenId: fixture.movement.root.tokenId } : null
      })
      if (continues) {
        mocks.spatialEvaluation.mockImplementation(async ({ frozenReactionRemainder }) => ({
          kind: 'TERMINAL',
          result: {
            status: 'MOVEMENT_COMPLETE',
            schemaVersion: 1,
            occurrenceId: fixture.occurrence.id,
            occurrenceVersion: 1,
            encounterId: ids.command,
            encounterVersion: 4,
            sceneId: fixture.sceneState.id,
            sceneVersion: 2,
            tokenId: fixture.movement.root.tokenId,
            movementKind: 'VOLUNTARY',
            reactionExecutions: [],
            terminalPosition: { x: 3, y: 0 }
          },
          movementIntent: { tokenId: fixture.movement.root.tokenId, position: { x: 3, y: 0 } },
          resolutionCommands: [...frozenReactionRemainder.root.resolutionCommands],
          selectionChecksum: fixture.movement.spatialSelectionChecksum,
          currentnessChecksum: fixture.movement.spatialCurrentnessChecksum
        }))
      }
      const input = {
        ...occurrenceInput,
        occurrenceId: fixture.occurrence.id,
        resolution: {
          kind: 'PASSAGE_OPTION' as const,
          optionId: fixture.choice.options[0]!.optionId
        }
      }

      await expect(
        executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
          rulesRuntime: {} as never
        })
      ).resolves.toMatchObject({
        replayed: false,
        response: { occurrence: { occurrenceId: fixture.occurrence.id, status: 'COMPLETE' } }
      })

      expect(mocks.preparePassageContest).toHaveBeenCalledWith(
        expect.objectContaining({ optionId: fixture.choice.options[0]!.optionId })
      )
      expect(mocks.executePassageContest).toHaveBeenCalledTimes(1)
      expect(mocks.encounter.updateActor).toHaveBeenCalledTimes(1)
      expect(mocks.encounter.updateActor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: fixture.mover.id,
          resources: { ruleUsage: { [fixture.allowanceDefinitionId]: 1 } }
        })
      )
      expect(mocks.occurrences.appendReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          commandId: input.commandId,
          commandMetadata: expect.objectContaining({
            resolutionCommands: [
              expect.objectContaining({
                kind: 'PASSAGE_OPTION',
                optionId: fixture.choice.options[0]!.optionId,
                passageContest: expect.objectContaining({
                  actionKind: 'OVERRUN',
                  outcome,
                  actionEconomy: expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }),
                  audit: expect.objectContaining({
                    optionalCombat: {
                      definitionId: fixture.choice.options[0]!.definitionId,
                      definitionVersion: fixture.choice.options[0]!.definitionVersion,
                      definitionChecksum: fixture.choice.options[0]!.definitionChecksum,
                      moduleKey: fixture.choice.options[0]!.moduleKey,
                      moduleContractVersion: fixture.choice.options[0]!.moduleContractVersion
                    },
                    sourceActorId: fixture.mover.id,
                    sourceTokenId: fixture.movement.root.tokenId,
                    blockerActorId: fixture.blocker.id,
                    blockerTokenId: fixture.movement.blockerTokenId,
                    contact: fixture.movement.contact,
                    contactPathDistance: fixture.movement.contactPathDistance,
                    blockerCurrentnessChecksum: fixture.movement.blockerCurrentnessChecksum,
                    spatialSelectionChecksum: fixture.movement.spatialSelectionChecksum,
                    spatialCurrentnessChecksum: fixture.movement.spatialCurrentnessChecksum
                  })
                })
              })
            ]
          })
        })
      )
      const storedPassageCommand = mocks.occurrences.appendReceipt.mock.calls
        .at(-1)![0]
        .commandMetadata.resolutionCommands.at(-1)
      expect(movementRuleResolutionCommandDtoSchema.parse(storedPassageCommand)).toMatchObject({
        passageContest: {
          audit: expect.objectContaining({
            sourceActorId: fixture.mover.id,
            sourceTokenId: fixture.movement.root.tokenId,
            blockerActorId: fixture.blocker.id,
            blockerTokenId: fixture.movement.blockerTokenId,
            contact: fixture.movement.contact,
            contactPathDistance: fixture.movement.contactPathDistance,
            blockerCurrentnessChecksum: fixture.movement.blockerCurrentnessChecksum,
            spatialSelectionChecksum: fixture.movement.spatialSelectionChecksum,
            spatialCurrentnessChecksum: fixture.movement.spatialCurrentnessChecksum
          })
        }
      })
      if (continues) {
        expect(mocks.spatialEvaluation).toHaveBeenCalledWith(
          expect.objectContaining({
            frozenReactionRemainder: expect.objectContaining({
              root: expect.objectContaining({ pathStartDistance: 1 }),
              remainingSpatialCandidates: fixture.movement.remainingSpatialCandidates,
              reactionTimeline: fixture.movement.reactionTimeline
            })
          })
        )
        expect(mocks.commitSpatialMovement).toHaveBeenCalledWith(
          expect.objectContaining({ startDistance: 1, endDistance: 3 })
        )
      } else {
        expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
        expect(mocks.commitSpatialMovement).toHaveBeenCalledWith(
          expect.objectContaining({ startDistance: 1, endDistance: 1 })
        )
        expect(mocks.occurrences.appendReceipt).toHaveBeenLastCalledWith(
          expect.objectContaining({
            resultPayload: expect.objectContaining({
              reactionExecutions: [fixture.priorReactionExecution]
            })
          })
        )
      }
    }
  )

  it('stops at the next hostile blocker after one successful passage attempt', async () => {
    const fixture = passageFixture('AUTOMATIC', false, true)
    const actionEconomy = {
      definitionId: fixture.allowanceDefinitionId,
      definitionVersion: 1,
      definitionChecksum: '7'.repeat(64),
      maximum: 1,
      beforeUsed: 0
    }
    mocks.preparePassageContest.mockResolvedValue(fixture.pendingPassageContest(actionEconomy))
    mocks.executePassageContest.mockResolvedValue({
      kind: 'COMPLETE',
      outcome: 'SUCCESS',
      evidence: {
        initiatorRawFaces: [15],
        defenderRawFaces: [10],
        initiatorTotal: 15,
        defenderTotal: 10
      }
    })
    mocks.spatialEvaluation.mockImplementation(async ({ frozenReactionRemainder }) => ({
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 2.5,
      boundaryPosition: { x: 2.5, y: 0 },
      movementIntent: { tokenId: fixture.movement.root.tokenId, position: { x: 2.5, y: 0 } },
      completedExecutions: [],
      appliedPrefix: null,
      completedReactionExecutions: [],
      remainingCandidates: [],
      resolutionCommands: [...frozenReactionRemainder.root.resolutionCommands],
      selectionChecksum: fixture.movement.spatialSelectionChecksum,
      currentnessChecksum: fixture.movement.spatialCurrentnessChecksum
    }))
    mocks.commitSpatialMovement.mockResolvedValue({
      state: {
        ...fixture.sceneState,
        version: 2,
        tokens: fixture.sceneState.tokens.map((token) =>
          token.id === fixture.movement.root.tokenId
            ? { ...token, position: { x: 2.5, y: 0 } }
            : token
        )
      },
      version: 2,
      delta: { kind: 'TOKEN_MOVED', tokenId: fixture.movement.root.tokenId }
    })

    const result = await executeEncounterCommandWithRuleSnapshot(
      {} as DBLike,
      ids.owner,
      {
        ...occurrenceInput,
        occurrenceId: fixture.occurrence.id,
        resolution: {
          kind: 'PASSAGE_OPTION',
          optionId: fixture.choice.options[0]!.optionId
        }
      },
      { rulesRuntime: {} as never }
    )
    expect(result).toMatchObject({
      replayed: false,
      response: { occurrence: { status: 'COMPLETE', pending: null } }
    })

    expect(mocks.spatialEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ interruptAfterPathDistance: 2.5 })
    )
    expect(mocks.spatialEvaluation).toHaveBeenCalledTimes(1)
    expect(mocks.startReactionBoundary).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).toHaveBeenCalledWith(
      expect.objectContaining({ startDistance: 1, endDistance: 2.5 })
    )
    expect(mocks.occurrences.appendReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resultPayload: expect.objectContaining({ terminalPosition: { x: 2.5, y: 0 } })
      })
    )
    expect(mocks.occurrences.complete).toHaveBeenCalledTimes(1)
    const terminalCommand = mocks.occurrences.appendReceipt.mock.calls
      .at(-1)![0]
      .commandMetadata.resolutionCommands.at(-1)
    expect(movementRuleResolutionCommandDtoSchema.parse(terminalCommand)).toMatchObject({
      kind: 'PASSAGE_OPTION',
      passageContest: {
        outcome: 'SUCCESS',
        audit: {
          terminalPassageStop: {
            blockerActorId: fixture.movement.nextPassageStop!.blockerActorId,
            blockerTokenId: fixture.movement.nextPassageStop!.blockerTokenId,
            contact: fixture.movement.nextPassageStop!.contact,
            contactPathDistance: fixture.movement.nextPassageStop!.pathDistance,
            blockerCurrentnessChecksum: fixture.movement.nextPassageStop!.blockerCurrentnessChecksum
          }
        }
      }
    })
  })

  it('keeps an Assisted Overrun on one occurrence, replays its option safely, and resumes the frozen suffix after both rolls', async () => {
    const defenderCharacterId = '00000000-0000-4000-8000-0000000000d1'
    const defenderControllerId = '00000000-0000-4000-8000-0000000000d2'
    const fixture = passageFixture('ASSISTED', false, false, defenderCharacterId)
    const actionEconomy = {
      definitionId: fixture.allowanceDefinitionId,
      definitionVersion: 1,
      definitionChecksum: '7'.repeat(64),
      maximum: 1,
      beforeUsed: 0
    }
    const pending = fixture.pendingPassageContest(actionEconomy)
    mocks.preparePassageContest.mockImplementation(async ({ choice }) => ({
      ...pending,
      movementContinuation: choice.movement
    }))
    mocks.executePassageContest.mockResolvedValueOnce({
      kind: 'PENDING',
      continuation: fixture.passageContinuations.initiator,
      submittedEvidence: null
    })
    const optionInput = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      commandId: '00000000-0000-4000-8000-0000000000c1',
      resolution: {
        kind: 'PASSAGE_OPTION' as const,
        optionId: fixture.choice.options[0]!.optionId
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, optionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: {
        occurrence: {
          occurrenceId: fixture.occurrence.id,
          occurrenceVersion: 1,
          status: 'PENDING'
        }
      }
    })
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.spatialEvaluation).not.toHaveBeenCalled()
    const optionAdvance = mocks.occurrences.advancePending.mock.calls.at(-1)![0]
    expect(optionAdvance.pendingSnapshot).toMatchObject({
      snapshotKind: 'KERNEL_EVIDENCE',
      request: { requestId: fixture.passageContinuations.initiator.request.requestId },
      applicationContext: {
        kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST',
        movementContinuation: {
          root: {
            resolutionCommands: [
              expect.objectContaining({
                kind: 'PASSAGE_OPTION',
                optionId: fixture.choice.options[0]!.optionId
              })
            ]
          }
        }
      }
    })

    const optionReceipt = mocks.occurrences.appendReceipt.mock.calls.at(-1)![0]
    const pausedAfterOption = {
      ...fixture.occurrence,
      version: 1,
      pendingSnapshot: optionAdvance.pendingSnapshot
    }
    mocks.occurrences.lockOccurrence.mockResolvedValue(pausedAfterOption)
    mocks.occurrences.findReceipt.mockResolvedValueOnce(optionReceipt)
    const prepareCallsBeforeReplay = mocks.preparePassageContest.mock.calls.length
    const executeCallsBeforeReplay = mocks.executePassageContest.mock.calls.length

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, optionInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({ replayed: true })
    expect(mocks.preparePassageContest).toHaveBeenCalledTimes(prepareCallsBeforeReplay)
    expect(mocks.executePassageContest).toHaveBeenCalledTimes(executeCallsBeforeReplay)
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()

    mocks.occurrences.findReceipt.mockResolvedValue(null)
    mocks.executePassageContest.mockResolvedValueOnce({
      kind: 'PENDING',
      continuation: fixture.passageContinuations.defender,
      submittedEvidence: {
        participant: 'INITIATOR',
        requestId: fixture.passageContinuations.initiator.request.requestId,
        rawFaces: [15]
      }
    })
    const initiatorInput = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      commandId: '00000000-0000-4000-8000-0000000000c2',
      expectedOccurrenceVersion: 1,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: fixture.passageContinuations.initiator.request.requestId,
        rawFaces: [15]
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, initiatorInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: { occurrence: { occurrenceVersion: 2, status: 'PENDING' } }
    })
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    const initiatorAdvance = mocks.occurrences.advancePending.mock.calls.at(-1)![0]
    expect(initiatorAdvance.pendingSnapshot).toMatchObject({
      request: { requestId: fixture.passageContinuations.defender.request.requestId },
      applicationContext: {
        rollEvidence: {
          initiator: {
            requestId: fixture.passageContinuations.initiator.request.requestId,
            rawFaces: [15]
          },
          defender: null
        }
      }
    })

    mocks.occurrences.lockOccurrence.mockResolvedValue({
      ...fixture.occurrence,
      version: 2,
      pendingSnapshot: initiatorAdvance.pendingSnapshot
    })
    mocks.occurrences.complete.mockResolvedValue({
      ...fixture.occurrence,
      version: 3,
      state: 'COMPLETED',
      pendingSnapshot: null,
      completedAt: fixture.occurrence.createdAt
    })
    mocks.executePassageContest.mockResolvedValueOnce({
      kind: 'COMPLETE',
      outcome: 'SUCCESS',
      evidence: {
        initiatorRawFaces: [15],
        defenderRawFaces: [10],
        initiatorTotal: 15,
        defenderTotal: 10
      }
    })
    mocks.commitSpatialMovement.mockResolvedValue({
      state: {
        ...fixture.sceneState,
        version: 2,
        tokens: fixture.sceneState.tokens.map((token) =>
          token.id === fixture.movement.root.tokenId
            ? { ...token, position: { x: 3, y: 0 } }
            : token
        )
      },
      version: 2,
      delta: { kind: 'TOKEN_MOVED', tokenId: fixture.movement.root.tokenId }
    })
    mocks.spatialEvaluation.mockImplementation(async ({ frozenReactionRemainder }) => ({
      kind: 'TERMINAL',
      result: {
        status: 'MOVEMENT_COMPLETE',
        schemaVersion: 1,
        occurrenceId: fixture.occurrence.id,
        occurrenceVersion: 3,
        encounterId: ids.command,
        encounterVersion: 4,
        sceneId: fixture.sceneState.id,
        sceneVersion: 2,
        tokenId: fixture.movement.root.tokenId,
        movementKind: 'VOLUNTARY',
        reactionExecutions: [],
        terminalPosition: { x: 3, y: 0 }
      },
      movementIntent: { tokenId: fixture.movement.root.tokenId, position: { x: 3, y: 0 } },
      resolutionCommands: [...frozenReactionRemainder.root.resolutionCommands],
      selectionChecksum: fixture.movement.spatialSelectionChecksum,
      currentnessChecksum: fixture.movement.spatialCurrentnessChecksum
    }))
    const defenderInput = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      commandId: '00000000-0000-4000-8000-0000000000c3',
      expectedOccurrenceVersion: 2,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: fixture.passageContinuations.defender.request.requestId,
        rawFaces: [10]
      }
    }
    mocks.lockedContext.mockResolvedValue({
      encounter: fixture.encounter,
      context: {
        role: 'PLAYER',
        campaignId: fixture.encounter.campaignId,
        assignedCharacterId: defenderCharacterId,
        attunementSlotOverride: null,
        currentVersion: fixture.encounter.version,
        advanceVersion: fixture.advanceVersion
      }
    })
    mocks.sqlRows.mockResolvedValue({ rows: [{ user_id: defenderControllerId }] })

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, defenderControllerId, defenderInput, {
        rulesRuntime: {} as never
      })
    ).resolves.toMatchObject({
      replayed: false,
      response: { occurrence: { occurrenceVersion: 3, status: 'COMPLETE' } }
    })
    expect(mocks.encounter.updateActor).toHaveBeenCalledTimes(1)
    expect(mocks.sqlRows).toHaveBeenCalled()
    expect(mocks.spatialEvaluation).toHaveBeenCalledTimes(1)
    expect(mocks.occurrences.appendReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        commandId: defenderInput.commandId,
        commandMetadata: expect.objectContaining({
          resolutionCommands: [
            expect.objectContaining({ kind: 'PASSAGE_OPTION' }),
            expect.objectContaining({
              kind: 'ENTER_DICE',
              requestId: initiatorInput.resolution.requestId
            }),
            expect.objectContaining({
              kind: 'ENTER_DICE',
              requestId: defenderInput.resolution.requestId,
              passageContest: expect.objectContaining({
                outcome: 'SUCCESS',
                initiator: expect.objectContaining({ rawFaces: [15], total: 15 }),
                defender: expect.objectContaining({ rawFaces: [10], total: 10 }),
                actionEconomy: expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
              })
            })
          ]
        })
      })
    )
  })

  it('rejects a private passage choice before contest preparation or mutation', async () => {
    const fixture = passageFixture('ASSISTED')
    mocks.lockedContext.mockResolvedValue({
      encounter: fixture.encounter,
      context: {
        role: 'PLAYER',
        campaignId: ids.campaign,
        assignedCharacterId: ids.creature,
        attunementSlotOverride: null,
        currentVersion: 3,
        advanceVersion: fixture.advanceVersion
      }
    })
    const input = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      commandId: '00000000-0000-4000-8000-0000000000c4',
      resolution: {
        kind: 'PASSAGE_OPTION' as const,
        optionId: fixture.choice.options[0]!.optionId
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('Movement passage authority is unavailable.')
    expect(mocks.preparePassageContest).not.toHaveBeenCalled()
    expect(mocks.executePassageContest).not.toHaveBeenCalled()
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()
  })

  it('rejects a passage choice after its optional-combat snapshot changes', async () => {
    const fixture = passageFixture('ASSISTED')
    mocks.lockedContext.mockResolvedValue({
      encounter: { ...fixture.encounter, optionalCombatSnapshotChecksum: 'f'.repeat(64) },
      context: {
        role: 'OWNER',
        campaignId: ids.campaign,
        assignedCharacterId: null,
        attunementSlotOverride: null,
        currentVersion: 3,
        advanceVersion: fixture.advanceVersion
      }
    })
    const input = {
      ...occurrenceInput,
      occurrenceId: fixture.occurrence.id,
      commandId: '00000000-0000-4000-8000-0000000000c5',
      resolution: {
        kind: 'PASSAGE_OPTION' as const,
        optionId: fixture.choice.options[0]!.optionId
      }
    }

    await expect(
      executeEncounterCommandWithRuleSnapshot({} as DBLike, ids.owner, input, {
        rulesRuntime: {} as never
      })
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(mocks.preparePassageContest).not.toHaveBeenCalled()
    expect(mocks.executePassageContest).not.toHaveBeenCalled()
    expect(mocks.encounter.updateActor).not.toHaveBeenCalled()
    expect(mocks.commitSpatialMovement).not.toHaveBeenCalled()
  })
})
