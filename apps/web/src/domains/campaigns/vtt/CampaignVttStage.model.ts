import {
  BrickWall,
  DoorOpen,
  Hand,
  Lightbulb,
  MapPin,
  Moon,
  MousePointer2,
  ScanLine,
  Trees,
  Waypoints,
  StickyNote,
  Ruler,
  Eye,
  EyeOff
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneAnnotation,
  SceneBarrier,
  SceneDarknessZone,
  SceneGrid,
  SceneLight,
  ScenePoint,
  SceneToken
} from '@artificer-toolkit/shared/vtt'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  controlsAssignedCharacter,
  type CharacterControlAssignment
} from '@artificer-toolkit/shared/campaign/characterControl'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CampaignVttTool } from './vttSceneRenderer'
import { isEncounterActorMine } from './encounterActorControl'
import {
  canControlSceneToken,
  resolveSceneTokenMove,
  type VttSceneTokenDragUpdate
} from './vttSceneRenderer.model'

export interface CampaignVttToolDefinition {
  icon: ComponentType<{ 'aria-hidden'?: boolean; size?: number }>
  label: string
  value: CampaignVttTool
}

export type SceneTokenNudgeDirection = 'DOWN' | 'LEFT' | 'RIGHT' | 'UP'

export const playTools: CampaignVttToolDefinition[] = [
  { icon: MousePointer2, label: 'Select and move tokens', value: 'SELECT' },
  { icon: Hand, label: 'Pan map', value: 'PAN' },
  { icon: Ruler, label: 'Measure distance', value: 'MEASURE' }
]

export const editTools: CampaignVttToolDefinition[] = [
  { icon: MousePointer2, label: 'Select', value: 'SELECT' },
  { icon: Hand, label: 'Pan map', value: 'PAN' },
  { icon: BrickWall, label: 'Draw wall', value: 'WALL' },
  { icon: DoorOpen, label: 'Draw door', value: 'DOOR' },
  { icon: ScanLine, label: 'Draw window', value: 'WINDOW' },
  { icon: Waypoints, label: 'Draw one-way barrier', value: 'ONE_WAY' },
  { icon: Trees, label: 'Draw difficult terrain', value: 'TERRAIN' },
  { icon: Lightbulb, label: 'Place light', value: 'LIGHT' },
  { icon: Moon, label: 'Draw darkness zone', value: 'DARKNESS' },
  { icon: MapPin, label: 'Place token', value: 'TOKEN' },
  { icon: StickyNote, label: 'Place GM note', value: 'ANNOTATION' },
  { icon: Eye, label: 'Reveal fog area', value: 'FOG_REVEAL' },
  { icon: EyeOff, label: 'Hide fog area', value: 'FOG_HIDE' }
]

export function isFogTool(tool: CampaignVttTool): boolean {
  return tool === 'FOG_REVEAL' || tool === 'FOG_HIDE'
}

/** What screen readers hear when a member's ping arrives, or when this member's ping is sent. */
export function describeVttPing(
  memberships: CampaignDetailDto['memberships'],
  pingUserId: string,
  currentUserId: string
): string {
  if (pingUserId === currentUserId) return 'You pinged the map.'
  const username = memberships.find((membership) => membership.userId === pingUserId)?.username
  return `${username ?? 'A table member'} pinged the map.`
}

export function canMoveSceneToken(
  token: CampaignSceneStateDto['tokens'][number],
  viewer: Pick<VttSceneTokenDragUpdate, 'boundTokenControl' | 'currentUserId' | 'role'>
): boolean {
  return !token.locked && canControlSceneToken(token, viewer)
}

export function nudgeSceneToken(
  scene: CampaignSceneStateDto,
  token: CampaignSceneStateDto['tokens'][number],
  direction: SceneTokenNudgeDirection
): ScenePoint {
  const step = scene.grid.kind === 'SQUARE' ? scene.grid.cellSize : scene.grid.pixelsPerUnit
  const delta = {
    x: direction === 'LEFT' ? -step : direction === 'RIGHT' ? step : 0,
    y: direction === 'UP' ? -step : direction === 'DOWN' ? step : 0
  }
  return resolveSceneTokenMove(scene, token, token.position, {
    x: token.position.x + delta.x,
    y: token.position.y + delta.y
  })
}

export function createSceneBarrier(
  kind: SceneBarrier['kind'],
  a: ScenePoint,
  b: ScenePoint
): SceneBarrier {
  if (kind === 'DOOR') {
    return {
      a,
      b,
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      id: crypto.randomUUID(),
      initialState: 'CLOSED',
      kind,
      openAngleDegrees: 90
    }
  }
  if (kind === 'WINDOW') {
    return {
      a,
      b,
      blocksLight: false,
      blocksMovement: true,
      id: crypto.randomUUID(),
      kind
    }
  }
  if (kind === 'ONE_WAY') {
    return {
      a,
      b,
      blockedDirection: 'LEFT_TO_RIGHT',
      blocksLight: true,
      blocksMovement: true,
      id: crypto.randomUUID(),
      kind
    }
  }
  if (kind === 'TERRAIN') {
    return { a, b, id: crypto.randomUUID(), kind, movementCostMultiplier: 2 }
  }
  return {
    a,
    b,
    blocksLight: true,
    blocksMovement: true,
    id: crypto.randomUUID(),
    kind
  }
}

export function createSceneDarknessZone(a: ScenePoint, b: ScenePoint): SceneDarknessZone | null {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return null
  return {
    id: crypto.randomUUID(),
    mechanicalIllumination: null,
    mechanicalObscurement: null,
    opacity: 0.72,
    polygon: {
      points: [
        { x: a.x, y: a.y },
        { x: b.x, y: a.y },
        { x: b.x, y: b.y },
        { x: a.x, y: b.y }
      ]
    }
  }
}

export function createSceneLight(position: ScenePoint): SceneLight {
  return {
    brightRadius: 120,
    color: '#f6c56f',
    dimRadius: 240,
    id: crypto.randomUUID(),
    intensity: 0.8,
    kind: 'POINT',
    position
  }
}

export function createSceneAnnotation(
  existingAnnotationCount: number,
  position: ScenePoint
): SceneAnnotation {
  return {
    id: crypto.randomUUID(),
    position,
    text: `Note ${existingAnnotationCount + 1}`,
    visibility: 'GM_ONLY'
  }
}

export function createSceneToken(
  grid: SceneGrid,
  existingTokenCount: number,
  position: ScenePoint
): SceneToken {
  const size = grid.kind === 'SQUARE' ? grid.cellSize : 64
  return {
    assetId: null,
    controlledByUserIds: [],
    height: size,
    hidden: false,
    id: crypto.randomUUID(),
    label: `Token ${existingTokenCount + 1}`,
    locked: false,
    position,
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: size
  }
}

type CampaignMembership = CampaignDetailDto['memberships'][number]

/** Every member's Character assignment with its GM grants, as the room and Convex read them (D162). */
export function characterControlAssignments(
  memberships: readonly CampaignMembership[]
): CharacterControlAssignment[] {
  return memberships.flatMap((membership) =>
    membership.assignedCharacter
      ? [
          {
            characterId: membership.assignedCharacter.id,
            controllerUserIds: membership.characterControllerUserIds,
            userId: membership.userId
          }
        ]
      : []
  )
}

/** The Characters a member controls, their own first, so the first is the default main Character. */
export function controlledCharacters(
  memberships: readonly CampaignMembership[],
  userId: string
): NonNullable<CampaignMembership['assignedCharacter']>[] {
  const controlled = memberships.flatMap((membership) =>
    membership.assignedCharacter &&
    controlsAssignedCharacter(
      { controllerUserIds: membership.characterControllerUserIds, userId: membership.userId },
      userId
    )
      ? [{ character: membership.assignedCharacter, own: membership.userId === userId }]
      : []
  )
  return [...controlled.filter(({ own }) => own), ...controlled.filter(({ own }) => !own)].map(
    ({ character }) => character
  )
}

/** The picked main Character while it is still controlled, else the member's default. */
export function resolveMainCharacterId(
  controlled: readonly { id: string }[],
  pickedId: string | null
): string | null {
  return controlled.find(({ id }) => id === pickedId)?.id ?? controlled[0]?.id ?? null
}

/**
 * The Scene token of a Character: the token bound to its Encounter actor, else an unbound token
 * linked to it by `characterId` (D162).
 */
export function assignedCharacterTokenId(input: {
  actorIdByTokenId: ReadonlyMap<string, string>
  actors: readonly Pick<
    NonNullable<EncounterSessionStateDto['encounter']>['actors'][number],
    'id' | 'kind' | 'sourceId'
  >[]
  assignedCharacterId: string | null
  tokens: readonly Pick<SceneToken, 'characterId' | 'id'>[]
}): string | null {
  const { assignedCharacterId } = input
  if (assignedCharacterId === null) return null
  const actor = input.actors.find(
    (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === assignedCharacterId
  )
  if (actor) {
    for (const [tokenId, actorId] of input.actorIdByTokenId) {
      if (actorId === actor.id) return tokenId
    }
  }
  return input.tokens.find((token) => token.characterId === assignedCharacterId)?.id ?? null
}

type EncounterActors = NonNullable<EncounterSessionStateDto['encounter']>['actors']

/** Whether the viewer acts for the actor bound to each Scene token. */
export function controlledActorByTokenId(
  campaign: Pick<CampaignDetailDto, 'assignedCharacter' | 'role'>,
  viewerUserId: string,
  actors: EncounterActors,
  actorIdByTokenId: ReadonlyMap<string, string>
): Map<string, boolean> {
  return new Map(
    [...actorIdByTokenId].map(([tokenId, actorId]) => {
      const actor = actors.find((candidate) => candidate.id === actorId)
      return [tokenId, !!actor && isEncounterActorMine(campaign, viewerUserId, actor, actors)]
    })
  )
}

/**
 * The Run's current turn as the stage offers it: the current actor, whether the viewer acts for it
 * (the GM for every actor, a player for an actor they control), and that actor's movement readout
 * (V07.5), which only a viewer who acts for it sees.
 */
export function readActiveTurn(
  campaign: Pick<CampaignDetailDto, 'assignedCharacter' | 'role'>,
  currentUserId: string,
  state: EncounterSessionStateDto | undefined
) {
  const encounter = state?.encounter?.status === 'ACTIVE' ? state.encounter : undefined
  const currentActor = encounter?.actors.find((actor) => actor.id === encounter.currentActorId)
  const currentActorMine = currentActor
    ? isEncounterActorMine(campaign, currentUserId, currentActor, encounter?.actors ?? [])
    : false
  const turnMovement = currentActorMine
    ? state?.turnMovement.find((entry) => entry.actorId === currentActor?.id)
    : undefined
  return { encounter, currentActor, currentActorMine, turnMovement }
}
