import {
  liveSessionCommandDtoSchema,
  liveSessionCoordinatorSnapshotDtoSchema,
  liveSessionExecutorCommandResultDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionExecutorCommandResultDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND } from '@artificer-toolkit/schema/api/vttScenes'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function owns(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function upgradeLegacyDarknessZone(value: unknown): unknown {
  if (!isRecord(value)) return value
  const hasIllumination = owns(value, 'mechanicalIllumination')
  const hasObscurement = owns(value, 'mechanicalObscurement')
  if (hasIllumination || hasObscurement) return value
  return {
    ...value,
    mechanicalIllumination: null,
    mechanicalObscurement: null
  }
}

function upgradeLegacySceneDelta(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (value.kind === 'DARKNESS_UPSERTED') {
    return { ...value, zone: upgradeLegacyDarknessZone(value.zone) }
  }
  if (value.kind === 'BATCH' && Array.isArray(value.deltas)) {
    return { ...value, deltas: value.deltas.map(upgradeLegacySceneDelta) }
  }
  return value
}

function upgradeLegacySceneState(value: unknown): unknown {
  if (!isRecord(value)) return value
  const upgraded: UnknownRecord = { ...value }
  if (!owns(value, 'ambientIllumination')) upgraded.ambientIllumination = 'BRIGHT'
  if (Array.isArray(value.darknessZones)) {
    upgraded.darknessZones = value.darknessZones.map(upgradeLegacyDarknessZone)
  }
  return upgraded
}

function upgradeLegacySpatialRefresh(value: unknown): unknown {
  if (!isRecord(value)) return value
  return { ...value, sceneState: upgradeLegacySceneState(value.sceneState) }
}

export function parsePersistedLiveSessionCoordinatorSnapshot(
  value: unknown
): LiveSessionCoordinatorSnapshotDto {
  if (!isRecord(value)) return liveSessionCoordinatorSnapshotDtoSchema.parse(value)
  const upgraded = {
    ...value,
    sceneStates: Array.isArray(value.sceneStates)
      ? value.sceneStates.map(upgradeLegacySceneState)
      : value.sceneStates
  }
  return liveSessionCoordinatorSnapshotDtoSchema.parse(upgraded)
}

export function parsePersistedLiveSessionExecutorCommandResult(
  value: unknown
): LiveSessionExecutorCommandResultDto {
  if (!isRecord(value)) return liveSessionExecutorCommandResultDtoSchema.parse(value)
  const upgraded: UnknownRecord = { ...value }
  if (!owns(value, 'changedAggregates')) {
    upgraded.changedAggregates = [
      {
        aggregateId: value.aggregateId,
        aggregateKind: value.aggregateKind,
        version: value.version
      }
    ]
  }
  if (owns(value, 'spatialRefresh')) {
    upgraded.spatialRefresh = upgradeLegacySpatialRefresh(value.spatialRefresh)
  }
  if (value.aggregateKind === 'SCENE') {
    upgraded.state = upgradeLegacySceneState(value.state)
    if (isRecord(value.response) && owns(value.response, 'delta')) {
      upgraded.response = {
        ...value.response,
        delta: value.response.delta === null ? null : upgradeLegacySceneDelta(value.response.delta)
      }
    }
  }
  return liveSessionExecutorCommandResultDtoSchema.parse(upgraded)
}

export function isLegacyVisualOnlyDarknessReplayCommand(command: LiveSessionCommandDto): boolean {
  return (
    command.aggregateKind === 'SCENE' &&
    command.command.type === 'UPSERT_SCENE_DARKNESS' &&
    'legacyReplayKind' in command.command &&
    command.command.legacyReplayKind === LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
  )
}

export function withoutLegacyVisualOnlyDarknessReplayMarker(
  command: LiveSessionCommandDto
): LiveSessionCommandDto {
  if (
    command.aggregateKind !== 'SCENE' ||
    command.command.type !== 'UPSERT_SCENE_DARKNESS' ||
    !('legacyReplayKind' in command.command) ||
    command.command.legacyReplayKind !== LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
  ) {
    return command
  }
  const { legacyReplayKind: _legacyReplayKind, ...sceneCommand } = command.command
  return liveSessionCommandDtoSchema.parse({
    ...command,
    command: sceneCommand
  })
}

export function parsePersistedLiveSessionCommand(value: unknown): LiveSessionCommandDto {
  return withoutLegacyVisualOnlyDarknessReplayMarker(liveSessionCommandDtoSchema.parse(value))
}

export function currentLiveSessionCommandFingerprint(command: LiveSessionCommandDto): string {
  return JSON.stringify(withoutLegacyVisualOnlyDarknessReplayMarker(command))
}

export function legacyVisualOnlyDarknessLiveCommandFingerprint(
  command: LiveSessionCommandDto
): string | null {
  if (
    command.aggregateKind !== 'SCENE' ||
    command.command.type !== 'UPSERT_SCENE_DARKNESS' ||
    command.command.zone.mechanicalIllumination !== null ||
    command.command.zone.mechanicalObscurement !== null
  ) {
    return null
  }
  const { legacyReplayKind: _legacyReplayKind, zone, ...sceneCommand } = command.command
  const {
    mechanicalIllumination: _mechanicalIllumination,
    mechanicalObscurement: _mechanicalObscurement,
    ...legacyZone
  } = zone
  return JSON.stringify({
    ...command,
    command: { ...sceneCommand, zone: legacyZone }
  })
}
