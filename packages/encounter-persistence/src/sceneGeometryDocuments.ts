import {
  sceneStoredGeometrySaveSchema,
  type SceneStoredGeometrySave
} from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { sceneStoredGeometryCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  sliceMovementPath,
  terminalMovementPathEnd
} from '@artificer-toolkit/rules-runtime/encounterMovementPath'
import {
  resolveRuleOccurrenceInputDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  serverRuleExecutionPendingOccurrenceId,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import {
  sceneSpatialPreparationSchema,
  type SceneSpatialPreparation
} from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { geometryTarget, normalizeGeometryInput } from './sceneGeometryValues.js'
import { deriveOnce } from './transactionReads.js'
import { readRunState } from './documents.js'
import type { EncounterReadContext } from './store.js'

/** A binding installed after staging still refuses a standalone move at publication. */
export async function assertStandaloneMovement(
  ctx: EncounterReadContext,
  campaignId: string,
  input: SceneStoredGeometrySave['input']
) {
  if (input.type !== 'MOVE_SCENE_TOKEN' || input.expectedEncounterVersion !== null) return
  const bindings = ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_sceneId_tokenId', (q) =>
      q.eq('sceneId', input.sceneId).eq('tokenId', input.tokenId)
    )
  for await (const binding of bindings) {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', binding.encounterId))
      .unique()
    if (!row) throw new Error('Scene token binding Run is unavailable.')
    const run = readRunState(row)
    if (run.campaignId !== campaignId)
      throw new Error('Scene token binding Campaign is inconsistent.')
    if (run.status === 'ACTIVE')
      throw new Error('Bound Scene token movement requires an Encounter version.')
  }
}

export function assertGeometryReceiving(
  save: SceneStoredGeometrySave,
  version: number,
  userId: string
) {
  if (save.status !== 'RECEIVING' || save.expiresAt <= Date.now() || save.actorUserId !== userId)
    throw new Error('Scene geometry save is unavailable or expired.')
  if (save.snapshotVersion !== version)
    throw new Error('Scene changed before geometry publication.')
}

type MovementResolution = {
  command: ResolveRuleOccurrenceInputDto
  snapshot: ServerRuleExecutionPendingSnapshotDto
  context: ReturnType<typeof readEncounterMovementPendingContext>['context']
  root: ReturnType<typeof readEncounterMovementPendingContext>['root']
}

/** Private response evidence is bound to the exact Scene segment; it never becomes client input. */
export function readMovementResolution(save: SceneStoredGeometrySave): MovementResolution | null {
  return deriveOnce(save, parseMovementResolution, movementResolutionIdentity)
}

/**
 * A save's content identity without the fields a derivation never reads, so the stored evidence it
 * verified is reused when the transaction re-reads the save after writing only those fields.
 */
function saveIdentity(save: SceneStoredGeometrySave, unread: ReadonlySet<string>) {
  return JSON.stringify(
    Object.entries(save)
      .filter(([key, value]) => value !== undefined && !unread.has(key))
      .sort(([left], [right]) => (left < right ? -1 : 1))
  )
}

const preparationUnread = new Set(['id', 'status', 'expiresAt', 'fogSaves', 'characterRevisions'])
const movementResolutionUnread = new Set([
  ...preparationUnread,
  'actorUserId',
  'inputChecksum',
  'sessionVision',
  'spatialPreparationJson',
  'spatialPreparationChecksum'
])
const movementResolutionIdentity = (save: SceneStoredGeometrySave) =>
  saveIdentity(save, movementResolutionUnread)
const spatialPreparationIdentity = (save: SceneStoredGeometrySave) =>
  saveIdentity(save, preparationUnread)

function parseMovementResolution(save: SceneStoredGeometrySave): MovementResolution | null {
  const retained = save.movementResolution
  if (!retained) return null
  const command = resolveRuleOccurrenceInputDtoSchema.parse(JSON.parse(retained.commandJson))
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(retained.pendingSnapshotJson)
  )
  const { context, root } = readEncounterMovementPendingContext(snapshot)
  const input = save.input
  if (
    retained.commandChecksum !== checksumCanonicalJson(command) ||
    retained.pendingSnapshotChecksum !== checksumCanonicalJson(snapshot) ||
    input.type !== 'MOVE_SCENE_TOKEN' ||
    command.commandId !== save.commandId ||
    command.encounterId !== root.encounterId ||
    command.occurrenceId !== serverRuleExecutionPendingOccurrenceId(snapshot) ||
    command.expectedOccurrenceVersion !== root.resolutionCommands.length ||
    command.expectedVersion !== input.expectedEncounterVersion ||
    command.correlationId !== input.correlationId ||
    root.sceneId !== save.sceneId ||
    root.tokenId !== input.tokenId ||
    root.movementKind !== input.movementKind ||
    root.currentSceneVersion !== save.snapshotVersion ||
    input.expectedSceneVersion !== save.snapshotVersion ||
    checksumCanonicalJson(input.path) !== checksumCanonicalJson(root.originalPath)
  )
    throw new Error('Stored movement response identity is inconsistent.')
  return { command, snapshot, context, root }
}

export function readSpatialPreparation(
  save: SceneStoredGeometrySave
): SceneSpatialPreparation | null {
  return deriveOnce(save, parseSpatialPreparation, spatialPreparationIdentity)
}

function parseSpatialPreparation(save: SceneStoredGeometrySave): SceneSpatialPreparation | null {
  if (save.spatialPreparationJson === undefined && save.spatialPreparationChecksum === undefined)
    return null
  if (save.spatialPreparationJson === undefined || save.spatialPreparationChecksum === undefined)
    throw new Error('Stored spatial preparation is incomplete.')
  const value = sceneSpatialPreparationSchema.parse(JSON.parse(save.spatialPreparationJson))
  if (checksumCanonicalJson(value) !== save.spatialPreparationChecksum)
    throw new Error('Stored spatial preparation checksum is inconsistent.')
  assertPreparationIdentity(save, value)
  return value
}

function assertPreparationIdentity(save: SceneStoredGeometrySave, value: SceneSpatialPreparation) {
  const input = save.input
  const resolution = readMovementResolution(save)
  if (
    input.type !== 'MOVE_SCENE_TOKEN' ||
    input.expectedEncounterVersion === null ||
    input.expectedEncounterVersion !== value.expectedEncounterVersion ||
    (resolution &&
      (value.encounterId !== resolution.command.encounterId ||
        value.occurrenceId !== resolution.command.occurrenceId ||
        value.outcome.kind === 'UNINTERRUPTED')) ||
    !save.sessionVision
  )
    throw new Error('Spatial preparation requires the exact Encounter movement and Session.')
  if (value.outcome.kind === 'TERMINAL') {
    const result = value.outcome.result
    const terminalDistance = value.outcome.terminalPathDistance
    if (terminalDistance !== undefined) {
      const length = input.path
        .slice(1)
        .reduce(
          (total, point, index) =>
            total + Math.hypot(point.x - input.path[index]!.x, point.y - input.path[index]!.y),
          0
        )
      const segment = sliceMovementPath(
        input.path,
        resolution?.root.pathStartDistance ?? 0,
        terminalDistance
      )
      const end = segment.at(-1)!
      const pathEnd = terminalMovementPathEnd(value.outcome)
      if (
        terminalDistance > length + 1e-8 ||
        Math.abs(end.x - pathEnd.x) > 1e-8 ||
        Math.abs(end.y - pathEnd.y) > 1e-8
      )
        throw new Error('Spatial terminal path distance is inconsistent.')
    }
    const commands = value.outcome.resolutionCommands
    if (
      commands &&
      (!resolution ||
        commands.length !== resolution.command.expectedOccurrenceVersion + 1 ||
        checksumCanonicalJson(commands.slice(0, -1)) !==
          checksumCanonicalJson(resolution.root.resolutionCommands) ||
        commands.at(-1)!.commandId !== resolution.command.commandId ||
        commands.at(-1)!.commandFingerprint !== checksumCanonicalJson(resolution.command))
    )
      throw new Error('Spatial terminal response history is inconsistent.')
    if (
      result.occurrenceId !== value.occurrenceId ||
      result.encounterId !== value.encounterId ||
      result.encounterVersion !== value.expectedEncounterVersion + 1 ||
      result.sceneId !== save.sceneId ||
      result.sceneVersion < save.snapshotVersion ||
      result.sceneVersion > save.snapshotVersion + 1 ||
      result.tokenId !== input.tokenId ||
      result.movementKind !== input.movementKind ||
      result.occurrenceVersion !==
        (resolution ? resolution.command.expectedOccurrenceVersion + 1 : 0)
    )
      throw new Error('Spatial terminal preparation identity is inconsistent.')
  } else if (value.outcome.kind === 'PENDING') {
    const snapshot = value.outcome.pendingSnapshot
    const { root } = readEncounterMovementPendingContext(snapshot)
    const original = resolution?.root
    if (
      serverRuleExecutionPendingOccurrenceId(snapshot) !== value.occurrenceId ||
      root.encounterId !== value.encounterId ||
      root.sceneId !== save.sceneId ||
      root.tokenId !== input.tokenId ||
      root.commandId !== (original?.commandId ?? save.commandId) ||
      root.commandFingerprint !== (original?.commandFingerprint ?? save.inputChecksum) ||
      root.initiatorUserId !== (original?.initiatorUserId ?? save.actorUserId) ||
      root.correlationId !== (original ? original.correlationId : input.correlationId) ||
      root.expectedEncounterVersion !==
        (original?.expectedEncounterVersion ?? value.expectedEncounterVersion) ||
      root.expectedSceneVersion !==
        (original?.expectedSceneVersion ?? input.expectedSceneVersion) ||
      root.movementKind !== input.movementKind ||
      checksumCanonicalJson(root.originalPath) !==
        checksumCanonicalJson(original?.originalPath ?? input.path) ||
      (resolution &&
        (serverRuleExecutionPendingOccurrenceId(snapshot) !== resolution.command.occurrenceId ||
          root.resolutionCommands.length !== resolution.command.expectedOccurrenceVersion + 1)) ||
      root.currentSceneVersion < save.snapshotVersion ||
      root.currentSceneVersion > save.snapshotVersion + 1 ||
      (value.outcome.movementIntent !== null &&
        (value.outcome.movementIntent.tokenId !== input.tokenId ||
          checksumCanonicalJson(value.outcome.movementIntent.position) !==
            checksumCanonicalJson(root.currentPosition)))
    )
      throw new Error('Spatial pending preparation identity is inconsistent.')
  }
}

function stored(row: Record<string, unknown>) {
  const { _id, _creationTime, ...value } = row
  return value
}

/** A served row's save is parsed once, with the stored movement evidence it verifies. */
export function parseGeometrySave(row: Record<string, unknown>) {
  return deriveOnce(row, parseStoredGeometrySave)
}

function parseStoredGeometrySave(row: Record<string, unknown>) {
  const save = sceneStoredGeometrySaveSchema.parse(stored(row))
  if (
    save.sceneId !== save.input.sceneId ||
    save.commandId !== save.input.commandId ||
    save.inputChecksum !== checksumCanonicalJson(save.input) ||
    save.inputChecksum !== checksumCanonicalJson(normalizeGeometryInput(save.input)) ||
    save.input.expectedSceneVersion > save.snapshotVersion ||
    (save.characterRevisions !== undefined && save.sessionVision === undefined) ||
    (save.sessionVision !== undefined &&
      (save.sessionVision.sceneId !== save.sceneId ||
        save.sessionVision.expectedSceneVersion !== save.snapshotVersion)) ||
    new Set(save.fogSaves.map((entry) => entry.saveId)).size !== save.fogSaves.length ||
    new Set(save.fogSaves.map((entry) => entry.ownerUserId)).size !== save.fogSaves.length
  )
    throw new Error('Stored Scene geometry save is inconsistent.')
  readMovementResolution(save)
  readSpatialPreparation(save)
  return save
}

export function parseGeometryCommand(row: Record<string, unknown>, version: number) {
  if (row.encoding !== 'GEOMETRY') throw new Error('Scene command is not a geometry command.')
  const command = sceneStoredGeometryCommandSchema.parse(stored(row))
  const bound =
    command.input.type === 'MOVE_SCENE_TOKEN' && command.input.expectedEncounterVersion !== null
  // A drag (D105) stores the mover's TOKEN_MOVED first, then each dragged token's, in one BATCH.
  const [primary, ...dragged] =
    command.result.delta?.kind === 'BATCH' ? command.result.delta.deltas : [command.result.delta]
  const draggedMatch =
    dragged.length === 0 ||
    (command.input.type === 'MOVE_SCENE_TOKEN' &&
      dragged.every((move) => move?.kind === 'TOKEN_MOVED'))
  const geometryMatches =
    draggedMatch &&
    (bound && command.result.occurrence !== null
      ? command.result.version >= command.input.expectedSceneVersion &&
        command.result.version <= command.input.expectedSceneVersion + 1 &&
        (command.result.delta === null
          ? command.result.version ===
            command.input.expectedSceneVersion + (command.result.fogPatches.length > 0 ? 1 : 0)
          : primary?.kind === 'TOKEN_MOVED' &&
            command.input.type === 'MOVE_SCENE_TOKEN' &&
            primary.tokenId === command.input.tokenId &&
            command.result.version === command.input.expectedSceneVersion + 1)
      : (bound
          ? command.input.expectedSceneVersion + 1 === command.result.version
          : command.input.expectedSceneVersion < command.result.version) &&
        command.result.occurrence === null &&
        checksumCanonicalJson(primary) ===
          checksumCanonicalJson(geometryTarget(command.input).delta))
  if (
    command.inputChecksum !== checksumCanonicalJson(command.input) ||
    command.inputChecksum !== checksumCanonicalJson(normalizeGeometryInput(command.input)) ||
    command.resultChecksum !== checksumCanonicalJson(command.result) ||
    command.sceneId !== command.input.sceneId ||
    command.commandId !== command.input.commandId ||
    command.sceneId !== command.result.sceneId ||
    command.commandId !== command.result.commandId ||
    command.result.replayed ||
    command.result.version > version ||
    !geometryMatches ||
    new Set(command.result.fogPatches.map((patch) => patch.saveId)).size !==
      command.result.fogPatches.length ||
    new Set(command.result.fogPatches.map((patch) => patch.ownerUserId)).size !==
      command.result.fogPatches.length
  )
    throw new Error('Stored Scene geometry command is inconsistent.')
  return command
}
