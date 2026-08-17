import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto,
  LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'

export type LiveSessionConflictKey =
  | `character:${string}`
  | `encounter:${string}`
  | `scene:${string}`

export function liveSessionConflictKeysOverlap(
  left: LiveSessionConflictKey,
  right: LiveSessionConflictKey
): boolean {
  return left === right || left.startsWith(`${right}:`) || right.startsWith(`${left}:`)
}

export function deriveLiveSessionSceneVisionContext(
  command: LiveSessionCommandDto,
  snapshot: Pick<
    LiveSessionCoordinatorSnapshotDto,
    'characterVisions' | 'encounterCharacterBindings'
  >
): LiveSessionSceneVisionContextDto {
  if (command.aggregateKind !== 'SCENE') {
    return { characterVisions: [], encounterCharacterBindings: [] }
  }
  const encounterCharacterBindings = snapshot.encounterCharacterBindings.filter(
    (binding) => binding.encounterId === command.command.encounterId
  )
  const characterIds = new Set(encounterCharacterBindings.map((binding) => binding.characterId))
  return {
    characterVisions: snapshot.characterVisions.filter((vision) =>
      characterIds.has(vision.characterId)
    ),
    encounterCharacterBindings
  }
}

function sceneResourceKey(command: Extract<LiveSessionCommandDto, { aggregateKind: 'SCENE' }>) {
  if (command.command.type === 'ATTACH_SCENE') {
    return `encounter:${command.command.encounterId}` as const
  }
  const sceneId = command.command.sceneId
  switch (command.command.type) {
    case 'UPSERT_SCENE_TOKEN':
      return `scene:${sceneId}:token:${command.command.token.id}` as const
    case 'REMOVE_SCENE_TOKEN':
    case 'MOVE_SCENE_TOKEN':
      return `scene:${sceneId}:token:${command.command.tokenId}` as const
    case 'SET_SCENE_DOOR_STATE':
    case 'REMOVE_SCENE_BARRIER':
      return `scene:${sceneId}:barrier:${command.command.barrierId}` as const
    case 'UPSERT_SCENE_BARRIER':
      return `scene:${sceneId}:barrier:${command.command.barrier.id}` as const
    case 'UPSERT_SCENE_LIGHT':
      return `scene:${sceneId}:light:${command.command.light.id}` as const
    case 'REMOVE_SCENE_LIGHT':
      return `scene:${sceneId}:light:${command.command.lightId}` as const
    case 'UPSERT_SCENE_DARKNESS':
      return `scene:${sceneId}:darkness:${command.command.zone.id}` as const
    case 'REMOVE_SCENE_DARKNESS':
      return `scene:${sceneId}:darkness:${command.command.zoneId}` as const
    case 'UPSERT_SCENE_ANNOTATION':
      return `scene:${sceneId}:annotation:${command.command.annotation.id}` as const
    case 'REMOVE_SCENE_ANNOTATION':
      return `scene:${sceneId}:annotation:${command.command.annotationId}` as const
    case 'PATCH_SCENE_FOG':
      return `scene:${sceneId}:fog:${command.command.layer.ownerUserId ?? 'shared'}` as const
    case 'SET_SCENE_VISION_REVEAL_MODE':
      return `scene:${sceneId}:vision-reveal` as const
    case 'UNDO_LAST_SCENE_MOVE':
      return `scene:${sceneId}` as const
    case 'UPSERT_SCENE_MEASUREMENT':
      return `scene:${sceneId}:measurement:${command.command.measurement.id}` as const
    case 'REMOVE_SCENE_MEASUREMENT':
      return `scene:${sceneId}:measurement:${command.command.measurementId}` as const
  }
}

function affectedEncounterActorIds(
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'ENCOUNTER' }>['command']
): string[] {
  switch (command.type) {
    case 'UPDATE_ACTOR':
      return command.characterCommand ? [command.actorId] : []
    case 'ROLL_ACTOR_INITIATIVE':
      return [command.actorId]
    case 'RESOLVE_ACTION':
      return [command.actorId, ...command.targetActorIds]
    default:
      return []
  }
}

export function deriveLiveSessionConflictKeys(
  command: LiveSessionCommandDto,
  snapshot: Pick<LiveSessionCoordinatorSnapshotDto, 'encounterCharacterBindings' | 'sceneStates'>
): LiveSessionConflictKey[] {
  if (command.aggregateKind === 'CHARACTER') return [`character:${command.characterId}`]
  if (command.aggregateKind === 'SCENE') {
    const keys = new Set<LiveSessionConflictKey>([sceneResourceKey(command)])
    if (command.command.type === 'ATTACH_SCENE') return [...keys]
    const sceneCommand = command.command
    const scene = snapshot.sceneStates.find((candidate) => candidate.id === sceneCommand.sceneId)
    if (!scene) return [...keys]
    const fogKey = (ownerUserId: string | null) =>
      `scene:${scene.id}:fog:${ownerUserId ?? 'shared'}` as LiveSessionConflictKey
    const claimTokenFog = (controlledByUserIds: readonly string[]) => {
      if (scene.fogMode === 'SHARED_PARTY') {
        keys.add(fogKey(null))
        return
      }
      for (const userId of controlledByUserIds) keys.add(fogKey(userId))
    }
    const claimBarrierFog = () => {
      if (scene.fogMode === 'SHARED_PARTY') {
        keys.add(fogKey(null))
        return
      }
      for (const token of scene.tokens) claimTokenFog(token.controlledByUserIds)
    }
    const actorIds = new Set<string>()
    switch (sceneCommand.type) {
      case 'MOVE_SCENE_TOKEN': {
        const token = scene.tokens.find((candidate) => candidate.id === sceneCommand.tokenId)
        const actorId = token?.actorId
        if (actorId) actorIds.add(actorId)
        if (token) claimTokenFog(token.controlledByUserIds)
        break
      }
      case 'UPSERT_SCENE_TOKEN':
        if (sceneCommand.token.actorId) actorIds.add(sceneCommand.token.actorId)
        claimTokenFog(sceneCommand.token.controlledByUserIds)
        break
      case 'SET_SCENE_DOOR_STATE':
      case 'UPSERT_SCENE_BARRIER':
      case 'REMOVE_SCENE_BARRIER':
        for (const token of scene.tokens) if (token.actorId) actorIds.add(token.actorId)
        claimBarrierFog()
        break
      default:
        break
    }
    for (const binding of snapshot.encounterCharacterBindings) {
      if (binding.encounterId === scene.encounterId && actorIds.has(binding.actorId)) {
        keys.add(`character:${binding.characterId}`)
      }
    }
    return [...keys].sort()
  }

  const keys = new Set<LiveSessionConflictKey>([`encounter:${command.command.encounterId}`])
  const actorIds = new Set(affectedEncounterActorIds(command.command))
  for (const binding of snapshot.encounterCharacterBindings) {
    if (binding.encounterId === command.command.encounterId && actorIds.has(binding.actorId)) {
      keys.add(`character:${binding.characterId}`)
    }
  }
  return [...keys].sort()
}
