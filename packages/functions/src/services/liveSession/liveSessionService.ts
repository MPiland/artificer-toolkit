import {
  createCampaignCollaborationRepository,
  createCharacterRepository,
  createEncounterRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  liveSessionJoinOptionsDtoSchema,
  type LiveSessionAggregateVersionDto,
  type LiveSessionCommandDto,
  type LiveSessionJoinOptionsDto
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
import { getCharacterSheetBundleForUser } from '../character/characterApplicationService.js'
import {
  executeEncounterCommandWithRuleSnapshot,
  type EncounterCommandServiceTiming
} from '../encounter/encounterService.js'
import {
  evaluateEncounterActorRuleSnapshot,
  type EncounterActorRuleSnapshot
} from '../encounter/encounterActorRuleEvaluation.js'
import { createSupabaseClient } from '../../clients/supabaseClient.js'

export class LiveSessionAuthenticationError extends Error {
  constructor() {
    super('Live-session authentication failed.')
    this.name = 'LiveSessionAuthenticationError'
  }
}

export async function authenticateLiveSessionToken(token: string): Promise<string> {
  if (!token.trim()) throw new LiveSessionAuthenticationError()
  const { data, error } = await createSupabaseClient().auth.getUser(token)
  if (error || !data.user) throw new LiveSessionAuthenticationError()
  return data.user.id
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
): Promise<LiveSessionJoinOptionsDto> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  const authority = await resolveCampaignAuthority(db, options.campaignId, userId)
  assertCampaignWritable(authority)
  await requireOpenSession(db, options)
  return options
}

function liveSessionAuthority(options: LiveSessionJoinOptionsDto, authorityId: string) {
  const normalizedAuthorityId = authorityId.trim()
  if (!normalizedAuthorityId || normalizedAuthorityId.length > 128) {
    throw new LiveSessionAuthenticationError()
  }
  return { sessionId: options.sessionId, authorityId: normalizedAuthorityId }
}

export async function claimLiveSessionRoomCommandAuthority(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const options = await authorizeLiveSessionAdmission(db, userId, rawOptions)
  await claimLiveSessionCommandAuthority(db, liveSessionAuthority(options, authorityId))
}

export async function renewLiveSessionRoomCommandAuthority(
  db: DBLike,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  await renewLiveSessionCommandAuthority(db, liveSessionAuthority(options, authorityId))
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
  const options = await authorizeLiveSessionAdmission(db, userId, rawOptions)
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
  return [...characterVersions, ...encounterVersions]
}

export interface LiveSessionRoomSnapshot {
  aggregateVersions: LiveSessionAggregateVersionDto[]
  characterRuleSnapshots: Array<{
    characterId: string
    snapshot: CharacterSheetCommittedRuleSnapshot
  }>
  encounterRuleSnapshots: Array<{
    encounterId: string
    snapshot: EncounterActorRuleSnapshot
  }>
}

export async function loadLiveSessionRoomSnapshot(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionRoomSnapshot> {
  const aggregateVersions = await loadLiveSessionAggregateVersions(db, userId, rawOptions)
  const characterRuleSnapshots = await Promise.all(
    aggregateVersions
      .filter((version) => version.aggregateKind === 'CHARACTER')
      .map(async ({ aggregateId }) => {
        const bundle = await getCharacterSheetBundleForUser(db, aggregateId, userId)
        if (!bundle) throw new CampaignAccessError()
        return {
          characterId: aggregateId,
          snapshot: bundle.ruleSnapshot
        }
      })
  )
  const encounterRuleSnapshots = (
    await Promise.all(
      aggregateVersions
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
    encounterRuleSnapshots
  }
}

export type LiveSessionCommandExecution =
  | {
      aggregateKind: 'CHARACTER'
      aggregateId: string
      commandId: string
      version: number
      response: CharacterSheetCommandExecutionResult['response']
      ruleSnapshot: CharacterSheetCommittedRuleSnapshot
    }
  | {
      aggregateKind: 'ENCOUNTER'
      aggregateId: string
      commandId: string
      version: number
      response: Awaited<ReturnType<typeof executeEncounterCommandWithRuleSnapshot>>['response']
      ruleSnapshot?: EncounterActorRuleSnapshot
    }

export async function executeLiveSessionCommand(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  command: LiveSessionCommandDto,
  authorityId: string,
  committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot,
  onCharacterTiming?: (timing: CharacterSheetCommandServiceTiming) => void,
  committedEncounterRuleSnapshot?: EncounterActorRuleSnapshot,
  onEncounterTiming?: (timing: EncounterCommandServiceTiming) => void
): Promise<LiveSessionCommandExecution> {
  const options = await authorizeLiveSessionAdmission(db, userId, rawOptions)
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
  const execution = await executeEncounterCommandWithRuleSnapshot(db, userId, command.command, {
    committedRuleSnapshot: committedEncounterRuleSnapshot,
    onTiming: onEncounterTiming,
    liveSessionAuthority: commandAuthority
  })
  return {
    aggregateKind: 'ENCOUNTER',
    aggregateId: command.command.encounterId,
    commandId: command.command.commandId,
    version: execution.response.projection.version,
    response: execution.response,
    ...(execution.ruleSnapshot ? { ruleSnapshot: execution.ruleSnapshot } : {})
  }
}
