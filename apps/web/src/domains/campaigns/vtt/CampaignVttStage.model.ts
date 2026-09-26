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

export function findPresentedScene(
  scenes: CampaignSceneStateDto[]
): CampaignSceneStateDto | undefined {
  return scenes[0]
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
    vision: null,
    width: size
  }
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
    ? isEncounterActorMine(campaign, currentUserId, currentActor)
    : false
  const turnMovement = currentActorMine
    ? state?.turnMovement.find((entry) => entry.actorId === currentActor?.id)
    : undefined
  return { encounter, currentActor, currentActorMine, turnMovement }
}
