import type {
  LiveSessionAggregateVersionDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { applySceneDelta } from '@artificer-toolkit/shared/vtt'

export interface LiveSessionSceneState {
  aggregateVersions: LiveSessionAggregateVersionDto[]
  deliverySequence: number
  scenes: EncounterSceneStateDto[]
}

export const emptyLiveSessionSceneState: LiveSessionSceneState = {
  aggregateVersions: [],
  deliverySequence: 0,
  scenes: []
}

export function withLiveSessionAggregateVersion(
  versions: LiveSessionAggregateVersionDto[],
  aggregateKind: LiveSessionAggregateVersionDto['aggregateKind'],
  aggregateId: string,
  version: number
): LiveSessionAggregateVersionDto[] {
  const current = versions.find(
    (candidate) =>
      candidate.aggregateKind === aggregateKind && candidate.aggregateId === aggregateId
  )
  return [
    ...versions.filter(
      (candidate) =>
        candidate.aggregateKind !== aggregateKind || candidate.aggregateId !== aggregateId
    ),
    { aggregateId, aggregateKind, version: Math.max(current?.version ?? 0, version) }
  ].sort((left, right) =>
    `${left.aggregateKind}:${left.aggregateId}`.localeCompare(
      `${right.aggregateKind}:${right.aggregateId}`
    )
  )
}

export function applyLiveSessionServerMessage(
  state: LiveSessionSceneState,
  message: LiveSessionWebSocketServerMessageDto
): LiveSessionSceneState {
  if (message.type === 'READY') {
    return {
      aggregateVersions: message.aggregateVersions,
      deliverySequence: message.deliverySequence,
      scenes: message.sceneSnapshots.map((snapshot) => snapshot.scene)
    }
  }
  if (message.type !== 'COMMAND_COMMITTED') return state

  const aggregateVersions = withLiveSessionAggregateVersion(
    state.aggregateVersions,
    message.aggregateKind,
    message.aggregateId,
    message.version
  )
  if (message.aggregateKind !== 'SCENE') {
    const refreshedScenes = message.sceneSnapshots ?? []
    return {
      ...state,
      aggregateVersions,
      deliverySequence: Math.max(state.deliverySequence, message.deliverySequence),
      scenes: refreshedScenes.reduce<EncounterSceneStateDto[]>(
        (scenes, snapshot) => [
          ...scenes.filter((scene) => scene.id !== snapshot.scene.id),
          snapshot.scene
        ],
        state.scenes
      )
    }
  }
  const current = state.scenes.find((scene) => scene.id === message.aggregateId)
  let next: EncounterSceneStateDto | null = message.snapshot?.scene ?? current ?? null
  if (current && !message.snapshot) {
    next = message.delta
      ? applySceneDelta(current, message.delta, message.version)
      : message.version <= current.version
        ? current
        : message.version === current.version + 1
          ? { ...current, version: message.version }
          : null
    if (!next) throw new Error('Live scene versions must remain contiguous.')
  }
  return {
    aggregateVersions,
    deliverySequence: Math.max(state.deliverySequence, message.deliverySequence),
    scenes: next ? [...state.scenes.filter((scene) => scene.id !== next.id), next] : state.scenes
  }
}
