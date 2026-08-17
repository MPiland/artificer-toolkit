import {
  createCampaignRepository,
  createCampaignCollaborationRepository,
  createCharacterRepository,
  createEncounterRepository,
  createVttSceneRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  liveSessionJoinOptionsDtoSchema,
  type LiveSessionAggregateVersionDto,
  type LiveSessionCommandDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionJoinOptionsDto,
  type LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'

import {
  assertCampaignWritable,
  resolveCampaignAuthority,
  CampaignAccessError
} from '../campaign/campaignService.js'
import {
  claimLiveSessionCommandAuthority,
  releaseLiveSessionCommandAuthority,
  renewLiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import {
  executeCharacterSheetCommandWithRuleEvaluation,
  type CharacterSheetCommittedRuleSnapshot,
  type CharacterSheetCommandExecutionResult,
  type CharacterSheetCommandServiceTiming
} from '../character/sheetService.js'
import { loadCharacterRuleSnapshotForLiveSessionCampaign } from '../character/characterLiveSessionSnapshot.js'
import {
  executeEncounterCommandWithRuleSnapshot,
  type EncounterCommandServiceTiming
} from '../encounter/encounterService.js'
import {
  evaluateEncounterActorRuleSnapshot,
  type EncounterActorRuleSnapshot
} from '../encounter/encounterActorRuleEvaluation.js'
import {
  attachEncounterScene,
  executeEncounterSceneCommandWithState
} from '../encounter/vttSceneService.js'
import type { EncounterSceneState, SceneCharacterVision } from '@artificer-toolkit/shared/vtt'

export class LiveSessionAuthorityError extends Error {
  constructor() {
    super('Live-session authority is invalid.')
    this.name = 'LiveSessionAuthorityError'
  }
}

export type LiveSessionMembershipRole = 'OWNER' | 'PLAYER'

export interface LiveSessionAdmission {
  options: LiveSessionJoinOptionsDto
  role: LiveSessionMembershipRole
  campaign: {
    id: string
    attunementSlotOverride: number | null
  }
}

async function requireOpenSession(db: DBLike, options: LiveSessionJoinOptionsDto) {
  const session = (
    await createCampaignCollaborationRepository(db).listCampaignSessions(options.campaignId)
  ).find((candidate) => candidate.id === options.sessionId)
  if (!session || session.status !== 'OPEN') throw new CampaignAccessError()
  return session
}

export async function authorizeLiveSessionAdmission(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionAdmission> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  const authority = await resolveCampaignAuthority(db, options.campaignId, userId)
  assertCampaignWritable(authority)
  await requireOpenSession(db, options)
  return {
    options,
    role: authority.membership.role,
    campaign: {
      id: authority.campaign.id,
      attunementSlotOverride: authority.campaign.attunementSlotOverride
    }
  }
}

function liveSessionAuthority(options: LiveSessionJoinOptionsDto, authorityId: string) {
  const normalizedAuthorityId = authorityId.trim()
  if (!normalizedAuthorityId || normalizedAuthorityId.length > 128) {
    throw new LiveSessionAuthorityError()
  }
  return { sessionId: options.sessionId, authorityId: normalizedAuthorityId }
}

export async function claimLiveSessionRoomCommandAuthority(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const admission = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  await claimLiveSessionCommandAuthority(db, liveSessionAuthority(admission.options, authorityId))
}

export async function renewLiveSessionRoomCommandAuthority(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  authorityId: string
): Promise<Array<{ userId: string; role: LiveSessionMembershipRole }>> {
  const admission = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  await renewLiveSessionCommandAuthority(db, liveSessionAuthority(admission.options, authorityId))
  return (
    await createCampaignRepository(db).listActiveMemberships(admission.options.campaignId)
  ).map(({ role, userId }) => ({ role, userId }))
}

export async function releaseLiveSessionRoomCommandAuthority(
  db: DBLike,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  await releaseLiveSessionCommandAuthority(db, liveSessionAuthority(options, authorityId))
}

export async function loadLiveSessionAggregateVersions(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionAggregateVersionDto[]> {
  const { options } = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  return loadLiveSessionAggregateVersionsForOptions(db, options)
}

async function loadLiveSessionAggregateVersionsForOptions(
  db: DBLike,
  options: LiveSessionJoinOptionsDto
): Promise<LiveSessionAggregateVersionDto[]> {
  const attendance = await createCampaignCollaborationRepository(db).listSessionAttendance(
    options.sessionId
  )
  const presentCharacterIds = attendance
    .filter((entry) => entry.present)
    .map((entry) => entry.characterId)
    .sort()
  const characterVersions = await Promise.all(
    presentCharacterIds.map(async (characterId) => {
      const character = await createCharacterRepository(db).findById(characterId)
      if (!character) throw new CampaignAccessError()
      return {
        aggregateKind: 'CHARACTER' as const,
        aggregateId: characterId,
        version: character.stream_version
      }
    })
  )
  const encounterVersions = (
    await createEncounterRepository(db).listForCampaign(options.campaignId)
  )
    .filter((encounter) => encounter.sessionId === options.sessionId)
    .map((encounter) => ({
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: encounter.id,
      version: encounter.version
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
  const sceneVersions = (
    await Promise.all(
      encounterVersions.map(async ({ aggregateId: encounterId }) => {
        const scene = await createVttSceneRepository(db).findByEncounter(encounterId)
        return scene
          ? {
              aggregateKind: 'SCENE' as const,
              aggregateId: scene.state.id,
              version: scene.state.version
            }
          : null
      })
    )
  ).filter((scene): scene is NonNullable<typeof scene> => scene !== null)
  return [...characterVersions, ...encounterVersions, ...sceneVersions]
}

export interface LiveSessionRoomSnapshot {
  aggregateVersions: LiveSessionAggregateVersionDto[]
  characterRuleSnapshots: Array<{
    characterId: string
    snapshot: CharacterSheetCommittedRuleSnapshot
  }>
  characterVisions: SceneCharacterVision[]
  encounterRuleSnapshots: Array<{
    encounterId: string
    snapshot: EncounterActorRuleSnapshot
  }>
  encounterCharacterBindings: LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings']
  sceneStates: EncounterSceneState[]
}

function characterVisionRangeInFeet(amount: number, unit: string): number | null {
  switch (unit) {
    case 'FEET':
      return amount
    case 'INCHES':
      return amount / 12
    case 'MILES':
      return amount * 5_280
    case 'YARDS':
      return amount * 3
    default:
      return null
  }
}

export function deriveLiveSessionCharacterVision(
  characterId: string,
  snapshot: CharacterSheetCommittedRuleSnapshot
): SceneCharacterVision {
  const dimRange = snapshot.evaluation.output.senses.reduce<number | null>((maximum, sense) => {
    if (sense.senseCode.toUpperCase() !== 'DARKVISION' || !sense.range) return maximum
    const feet = characterVisionRangeInFeet(sense.range.amount, sense.range.unit)
    if (feet === null) return maximum
    return maximum === null ? feet : Math.max(maximum, feet)
  }, null)
  return {
    characterId,
    dimRange: dimRange !== null && dimRange > 0 ? { amount: dimRange, unit: 'FEET' } : null
  }
}

export async function loadLiveSessionEncounterCharacterBindings(
  db: DBLike,
  aggregateVersions: readonly LiveSessionAggregateVersionDto[]
): Promise<LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings']> {
  const encounters = (
    await Promise.all(
      aggregateVersions
        .filter((version) => version.aggregateKind === 'ENCOUNTER')
        .map(({ aggregateId }) => createEncounterRepository(db).find(aggregateId))
    )
  ).filter((encounter): encounter is NonNullable<typeof encounter> => encounter !== null)
  return encounters.flatMap((encounter) =>
    encounter.actors.flatMap((actor) =>
      actor.kind === 'CHARACTER' && actor.sourceId
        ? [
            {
              actorId: actor.id,
              characterId: actor.sourceId,
              encounterId: encounter.id
            }
          ]
        : []
    )
  )
}

interface LiveSessionCoordinatorState extends LiveSessionCoordinatorSnapshotDto {
  characterRuleSnapshots: LiveSessionRoomSnapshot['characterRuleSnapshots']
}

async function loadLiveSessionCoordinatorState(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionCoordinatorState> {
  const admission = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  const aggregateVersions = await loadLiveSessionAggregateVersionsForOptions(db, admission.options)
  const [encounterCharacterBindings, characterRuleSnapshots, sceneStates] = await Promise.all([
    loadLiveSessionEncounterCharacterBindings(db, aggregateVersions),
    Promise.all(
      aggregateVersions
        .filter((version) => version.aggregateKind === 'CHARACTER')
        .map(async ({ aggregateId }) => {
          const snapshot = await loadCharacterRuleSnapshotForLiveSessionCampaign(
            db,
            aggregateId,
            admission.campaign
          )
          if (!snapshot) throw new CampaignAccessError()
          return {
            characterId: aggregateId,
            snapshot
          }
        })
    ),
    Promise.all(
      aggregateVersions
        .filter((version) => version.aggregateKind === 'ENCOUNTER')
        .map(async ({ aggregateId }) => createVttSceneRepository(db).findByEncounter(aggregateId))
    ).then((scenes) => scenes.flatMap((scene) => (scene ? [scene.state] : [])))
  ])
  const versionByCharacterId = new Map(
    characterRuleSnapshots.map(({ characterId, snapshot }) => [characterId, snapshot.streamVersion])
  )
  return {
    aggregateVersions: aggregateVersions.map((aggregateVersion) =>
      aggregateVersion.aggregateKind === 'CHARACTER'
        ? {
            ...aggregateVersion,
            version:
              versionByCharacterId.get(aggregateVersion.aggregateId) ?? aggregateVersion.version
          }
        : aggregateVersion
    ),
    characterRuleSnapshots,
    characterVisions: characterRuleSnapshots.map(({ characterId, snapshot }) =>
      deriveLiveSessionCharacterVision(characterId, snapshot)
    ),
    encounterCharacterBindings,
    sceneStates
  }
}

export async function loadLiveSessionCoordinatorSnapshot(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionCoordinatorSnapshotDto> {
  const { characterRuleSnapshots: _characterRuleSnapshots, ...snapshot } =
    await loadLiveSessionCoordinatorState(db, userId, rawOptions)
  return snapshot
}

export async function loadLiveSessionRoomSnapshot(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionRoomSnapshot> {
  const coordinator = await loadLiveSessionCoordinatorState(db, userId, rawOptions)
  const encounterRuleSnapshots = (
    await Promise.all(
      coordinator.aggregateVersions
        .filter((version) => version.aggregateKind === 'ENCOUNTER')
        .map(async ({ aggregateId }) => {
          const encounter = await createEncounterRepository(db).find(aggregateId)
          if (!encounter || !encounter.rulePackRevisionId) return null
          const evaluated = await evaluateEncounterActorRuleSnapshot({
            db,
            encounter,
            revisionId: encounter.rulePackRevisionId
          })
          return { encounterId: aggregateId, snapshot: evaluated.snapshot }
        })
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  return {
    ...coordinator,
    encounterRuleSnapshots
  }
}

export type LiveSessionCommandExecution =
  | {
      aggregateKind: 'CHARACTER'
      aggregateId: string
      commandId: string
      replayed: boolean
      version: number
      response: CharacterSheetCommandExecutionResult['response']
      ruleSnapshot: CharacterSheetCommittedRuleSnapshot
    }
  | {
      aggregateKind: 'ENCOUNTER'
      aggregateId: string
      commandId: string
      replayed: boolean
      version: number
      response: Awaited<ReturnType<typeof executeEncounterCommandWithRuleSnapshot>>['response']
      ruleSnapshot?: EncounterActorRuleSnapshot
    }
  | {
      aggregateKind: 'SCENE'
      aggregateId: string
      commandId: string
      replayed: boolean
      response: Awaited<ReturnType<typeof executeEncounterSceneCommandWithState>>['result'] | null
      state: EncounterSceneState
      version: number
    }

export async function executeLiveSessionCommand(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  command: LiveSessionCommandDto,
  authorityId: string,
  sceneVisionContext: LiveSessionSceneVisionContextDto,
  committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot,
  onCharacterTiming?: (timing: CharacterSheetCommandServiceTiming) => void,
  committedEncounterRuleSnapshot?: EncounterActorRuleSnapshot,
  onEncounterTiming?: (timing: EncounterCommandServiceTiming) => void
): Promise<LiveSessionCommandExecution> {
  const { options } = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  const commandAuthority = liveSessionAuthority(options, authorityId)
  if (command.aggregateKind === 'CHARACTER') {
    const attendance = await createCampaignCollaborationRepository(db).listSessionAttendance(
      options.sessionId
    )
    if (!attendance.some((entry) => entry.characterId === command.characterId && entry.present)) {
      throw new CampaignAccessError()
    }
    const execution = await executeCharacterSheetCommandWithRuleEvaluation({
      db,
      characterId: command.characterId,
      command: command.command,
      userId,
      committedRuleSnapshot,
      onTiming: onCharacterTiming,
      liveSessionAuthority: commandAuthority
    })
    return {
      aggregateKind: 'CHARACTER',
      aggregateId: command.characterId,
      commandId: command.command.commandId,
      replayed: execution.replayed,
      version: execution.response.streamVersion,
      response: execution.response,
      ruleSnapshot: execution.ruleSnapshot
    }
  }

  const encounter = await createEncounterRepository(db).find(command.command.encounterId)
  if (
    !encounter ||
    encounter.campaignId !== options.campaignId ||
    encounter.sessionId !== options.sessionId
  ) {
    throw new CampaignAccessError()
  }
  if (command.aggregateKind === 'SCENE') {
    if (command.command.type === 'ATTACH_SCENE') {
      const execution = await attachEncounterScene(db, userId, command.command, {
        liveSessionAuthority: commandAuthority
      })
      return {
        aggregateKind: 'SCENE',
        aggregateId: execution.scene.id,
        commandId: command.command.commandId,
        replayed: execution.replayed,
        response: null,
        state: execution.scene,
        version: execution.scene.version
      }
    }
    const execution = await executeEncounterSceneCommandWithState(db, userId, command.command, {
      sceneVisionContext,
      liveSessionAuthority: commandAuthority
    })
    return {
      aggregateKind: 'SCENE',
      aggregateId: execution.state.id,
      commandId: execution.result.commandId,
      replayed: execution.result.replayed,
      response: execution.result,
      state: execution.state,
      version: execution.result.version
    }
  }

  const execution = await executeEncounterCommandWithRuleSnapshot(db, userId, command.command, {
    committedRuleSnapshot: committedEncounterRuleSnapshot,
    onTiming: onEncounterTiming,
    liveSessionAuthority: commandAuthority
  })
  return {
    aggregateKind: 'ENCOUNTER',
    aggregateId: command.command.encounterId,
    commandId: command.command.commandId,
    replayed: execution.replayed,
    version: execution.response.projection.version,
    response: execution.response,
    ...(execution.ruleSnapshot ? { ruleSnapshot: execution.ruleSnapshot } : {})
  }
}
