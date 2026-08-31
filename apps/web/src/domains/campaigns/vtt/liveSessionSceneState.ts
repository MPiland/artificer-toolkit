import type {
  LiveSessionAggregateVersionDto,
  LiveSessionCoordinatorSnapshotDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { applySceneDelta } from '@artificer-toolkit/shared/vtt'

export interface LiveSessionSceneState {
  aggregateVersions: LiveSessionAggregateVersionDto[]
  deliverySequence: number
  encounterActorTokenBindings: LiveSessionCoordinatorSnapshotDto['encounterActorTokenBindings']
  encounterSceneBindings: LiveSessionCoordinatorSnapshotDto['encounterSceneBindings']
  scenes: CampaignSceneStateDto[]
}

export const emptyLiveSessionSceneState: LiveSessionSceneState = {
  aggregateVersions: [],
  deliverySequence: 0,
  encounterActorTokenBindings: [],
  encounterSceneBindings: [],
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
      encounterActorTokenBindings: message.encounterActorTokenBindings,
      encounterSceneBindings: message.encounterSceneBindings,
      scenes: message.sceneSnapshots.map((snapshot) => snapshot.scene)
    }
  }
  if (message.type !== 'COMMAND_COMMITTED') return state

  const aggregateVersions = message.changedAggregates.reduce(
    (versions, aggregate) =>
      withLiveSessionAggregateVersion(
        versions,
        aggregate.aggregateKind,
        aggregate.aggregateId,
        aggregate.version
      ),
    state.aggregateVersions
  )
  if (message.aggregateKind !== 'SCENE') {
    const refreshedScenes = message.sceneSnapshots ?? []
    return {
      ...state,
      aggregateVersions,
      deliverySequence: Math.max(state.deliverySequence, message.deliverySequence),
      encounterActorTokenBindings:
        message.aggregateKind === 'ENCOUNTER'
          ? message.encounterActorTokenBindings
          : state.encounterActorTokenBindings,
      encounterSceneBindings:
        message.aggregateKind === 'ENCOUNTER'
          ? message.encounterSceneBindings
          : state.encounterSceneBindings,
      scenes:
        message.aggregateKind === 'SESSION'
          ? refreshedScenes.map((snapshot) => snapshot.scene)
          : refreshedScenes.reduce<CampaignSceneStateDto[]>(
              (scenes, snapshot) => [
                ...scenes.filter((scene) => scene.id !== snapshot.scene.id),
                snapshot.scene
              ],
              state.scenes
            )
    }
  }
  const current = state.scenes.find((scene) => scene.id === message.aggregateId)
  let next: CampaignSceneStateDto | null = message.snapshot?.scene ?? current ?? null
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
    ...state,
    aggregateVersions,
    deliverySequence: Math.max(state.deliverySequence, message.deliverySequence),
    scenes: next ? [...state.scenes.filter((scene) => scene.id !== next.id), next] : state.scenes
  }
}
