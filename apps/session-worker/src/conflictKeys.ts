import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto,
  LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'

export type LiveSessionConflictKey =
  | `character:${string}`
  | `encounter:${string}`
  | `scene:${string}`
  | `session:${string}`

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
    'characterVisions' | 'encounterCharacterBindings' | 'encounterSceneBindings'
  >
): LiveSessionSceneVisionContextDto {
  if (command.aggregateKind === 'CHARACTER' || command.aggregateKind === 'SESSION') {
    return { characterVisions: [], encounterCharacterBindings: [] }
  }
  const encounterId =
    command.aggregateKind === 'ENCOUNTER'
      ? command.command.encounterId
      : command.command.type === 'MOVE_SCENE_TOKEN' &&
          command.command.expectedEncounterVersion !== null
        ? snapshot.encounterSceneBindings.find(
            (binding) => binding.sceneId === command.command.sceneId
          )?.encounterId
        : undefined
  if (!encounterId) return { characterVisions: [], encounterCharacterBindings: [] }
  const encounterCharacterBindings = snapshot.encounterCharacterBindings.filter(
    (binding) => binding.encounterId === encounterId
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
    case 'SET_SCENE_AMBIENT_ILLUMINATION':
      return `scene:${sceneId}:environment:ambient-illumination` as const
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
      return [command.actorId, command.targetActorId]
    case 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING':
    case 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING':
      return [command.actorId]
    default:
      return []
  }
}

export function deriveLiveSessionConflictKeys(
  command: LiveSessionCommandDto,
  snapshot: Pick<
    LiveSessionCoordinatorSnapshotDto,
    | 'encounterActorTokenBindings'
    | 'encounterCharacterBindings'
    | 'encounterRuleOccurrenceBindings'
    | 'encounterSceneBindings'
    | 'sceneStates'
  >
): LiveSessionConflictKey[] {
  if (command.aggregateKind === 'CHARACTER') return [`character:${command.characterId}`]
  if (command.aggregateKind === 'SESSION') return [`session:${command.command.sessionId}`]
  if (command.aggregateKind === 'SCENE') {
    const keys = new Set<LiveSessionConflictKey>([sceneResourceKey(command)])
    const sceneCommand = command.command
    const scene = snapshot.sceneStates.find((candidate) => candidate.id === sceneCommand.sceneId)
    if (!scene) {
      if (sceneCommand.type === 'MOVE_SCENE_TOKEN') {
        throw new Error('The live-session move requires an authoritative Scene.')
      }
      return [...keys]
    }
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
    const actorBindings = snapshot.encounterActorTokenBindings.filter(
      (binding) => binding.sceneId === scene.id
    )
    switch (sceneCommand.type) {
      case 'MOVE_SCENE_TOKEN': {
        keys.add(`scene:${scene.id}`)
        const token = scene.tokens.find((candidate) => candidate.id === sceneCommand.tokenId)
        const mechanicsBindings =
          sceneCommand.expectedEncounterVersion === null
            ? []
            : snapshot.encounterSceneBindings.filter((binding) => binding.sceneId === scene.id)
        if (mechanicsBindings.length > 1) {
          throw new Error('Mechanics-bearing movement requires one active Encounter overlay.')
        }
        const encounterId = mechanicsBindings[0]?.encounterId
        const actorId = actorBindings.find(
          (binding) =>
            binding.encounterId === encounterId && binding.tokenId === sceneCommand.tokenId
        )?.actorId
        if (actorId) actorIds.add(actorId)
        if (token) claimTokenFog(token.controlledByUserIds)
        if (encounterId) {
          for (const binding of snapshot.encounterCharacterBindings) {
            if (binding.encounterId === encounterId) keys.add(`character:${binding.characterId}`)
          }
          keys.add(`encounter:${encounterId}`)
        }
        break
      }
      case 'UPSERT_SCENE_TOKEN':
        claimTokenFog(sceneCommand.token.controlledByUserIds)
        break
      case 'SET_SCENE_DOOR_STATE':
      case 'UPSERT_SCENE_BARRIER':
      case 'REMOVE_SCENE_BARRIER':
        for (const binding of actorBindings) actorIds.add(binding.actorId)
        claimBarrierFog()
        break
      default:
        break
    }
    for (const binding of snapshot.encounterCharacterBindings) {
      if (actorIds.has(binding.actorId)) {
        keys.add(`character:${binding.characterId}`)
      }
    }
    return [...keys].sort()
  }

  const keys = new Set<LiveSessionConflictKey>([`encounter:${command.command.encounterId}`])
  if (command.command.type === 'RESOLVE_RULE_OCCURRENCE') {
    const encounterId = command.command.encounterId
    const occurrenceId = command.command.occurrenceId
    const bindings = snapshot.encounterRuleOccurrenceBindings.filter(
      (binding) => binding.encounterId === encounterId && binding.occurrenceId === occurrenceId
    )
    if (bindings.length > 1) {
      throw new Error('The live-session rule occurrence requires one authoritative binding.')
    }
    if (bindings.length === 0) {
      for (const binding of snapshot.encounterCharacterBindings) {
        if (binding.encounterId === encounterId) keys.add(`character:${binding.characterId}`)
      }
      const sceneBinding = snapshot.encounterSceneBindings.find(
        (binding) => binding.encounterId === encounterId
      )
      if (sceneBinding) keys.add(`scene:${sceneBinding.sceneId}`)
      return [...keys].sort()
    }
    const binding = bindings[0]!
    if (binding.executionKind === 'SPATIAL') {
      const scenes = snapshot.sceneStates.filter((scene) => scene.id === binding.sceneId)
      if (scenes.length !== 1) {
        throw new Error('The spatial rule occurrence requires its exact authoritative Scene.')
      }
      keys.add(`scene:${binding.sceneId}`)
    }
    for (const binding of snapshot.encounterCharacterBindings) {
      if (binding.encounterId === encounterId) keys.add(`character:${binding.characterId}`)
    }
  }
  const actorIds = new Set(affectedEncounterActorIds(command.command))
  if (
    command.command.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
    command.command.type === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
  ) {
    keys.add(`scene:${command.command.sceneId}`)
  }
  for (const binding of snapshot.encounterCharacterBindings) {
    if (binding.encounterId === command.command.encounterId && actorIds.has(binding.actorId)) {
      keys.add(`character:${binding.characterId}`)
    }
  }
  return [...keys].sort()
}
