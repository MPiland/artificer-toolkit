import {
  liveSessionCommandDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionExecutorCommandResultDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'

import {
  currentLiveSessionCommandFingerprint,
  isLegacyVisualOnlyDarknessReplayCommand,
  legacyVisualOnlyDarknessLiveCommandFingerprint,
  parsePersistedLiveSessionCommand,
  parsePersistedLiveSessionCoordinatorSnapshot,
  parsePersistedLiveSessionExecutorCommandResult
} from './legacySceneEnvironmentCutover.js'

const campaignId = '00000000-0000-4000-8000-000000000201'
const commandId = '00000000-0000-4000-8000-000000000202'
const definitionId = '00000000-0000-4000-8000-000000000203'
const mapAssetId = '00000000-0000-4000-8000-000000000205'
const sceneId = '00000000-0000-4000-8000-000000000206'
const zoneId = '00000000-0000-4000-8000-000000000207'

const polygon = {
  points: [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 10, y: 20 }
  ]
}

function sceneState(): CampaignSceneStateDto {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    barriers: [],
    campaignId,
    darknessZones: [
      {
        id: zoneId,
        mechanicalIllumination: null,
        mechanicalObscurement: null,
        opacity: 0.75,
        polygon
      }
    ],
    definitionId,
    definitionVersion: 1,
    doorStates: {},
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: sceneId,
    lights: [],
    map: {
      assetId: mapAssetId,
      height: 100,
      tileManifestAssetId: null,
      width: 100
    },
    measurements: [],
    name: 'Legacy room scene',
    tokens: [],
    version: 1,
    visionRevealMode: 'ON_DRAG'
  }
}

function legacyZone() {
  return { id: zoneId, opacity: 0.75, polygon }
}

function legacyState(): Record<string, unknown> {
  const {
    ambientIllumination: _ambientIllumination,
    darknessZones: _darknessZones,
    ...state
  } = sceneState()
  return { ...state, darknessZones: [legacyZone()] }
}

function currentCommand(): LiveSessionCommandDto {
  return liveSessionCommandDtoSchema.parse({
    aggregateKind: 'SCENE',
    command: {
      commandId,
      expectedSceneVersion: 1,
      sceneId,
      type: 'UPSERT_SCENE_DARKNESS',
      zone: {
        ...legacyZone(),
        mechanicalIllumination: null,
        mechanicalObscurement: null
      }
    }
  })
}

function legacyCommand(): unknown {
  return {
    aggregateKind: 'SCENE',
    command: {
      commandId,
      expectedSceneVersion: 1,
      sceneId,
      type: 'UPSERT_SCENE_DARKNESS',
      zone: legacyZone()
    }
  }
}

describe('legacy Scene environment Durable Object cutover', () => {
  it('upgrades an old persisted room snapshot and rejects a partially migrated darkness zone', () => {
    const persisted: Omit<LiveSessionCoordinatorSnapshotDto, 'sceneStates'> & {
      sceneStates: unknown[]
    } = {
      aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 1 }],
      characterVisions: [],
      encounterActorTokenBindings: [],
      encounterCharacterBindings: [],
      encounterRuleOccurrenceBindings: [],
      encounterSceneBindings: [],
      sceneStates: [legacyState()]
    }

    const parsed = parsePersistedLiveSessionCoordinatorSnapshot(persisted)
    expect(parsed.sceneStates[0]).toMatchObject({
      ambientIllumination: 'BRIGHT',
      darknessZones: [
        {
          id: zoneId,
          mechanicalIllumination: null,
          mechanicalObscurement: null
        }
      ]
    })

    expect(() =>
      parsePersistedLiveSessionCoordinatorSnapshot({
        ...persisted,
        sceneStates: [
          {
            ...legacyState(),
            ambientIllumination: 'BRIGHT',
            darknessZones: [{ ...legacyZone(), mechanicalIllumination: 'DARK' }]
          }
        ]
      })
    ).toThrow()
  })

  it('upgrades old persisted Scene results including BATCH deltas and spatial refresh state', () => {
    const persisted = {
      aggregateId: sceneId,
      aggregateKind: 'SCENE',
      commandId,
      hostTiming: { category: 'SCENE_ONLY', durationMs: 1 },
      replayed: false,
      response: {
        commandId,
        delta: {
          deltas: [{ kind: 'DARKNESS_UPSERTED', zone: legacyZone() }],
          kind: 'BATCH'
        },
        replayed: false,
        sceneId,
        version: 1
      },
      spatialRefresh: { characterVisions: [], sceneState: legacyState() },
      state: legacyState(),
      version: 1
    }

    const parsed: LiveSessionExecutorCommandResultDto =
      parsePersistedLiveSessionExecutorCommandResult(persisted)
    expect(parsed.aggregateKind).toBe('SCENE')
    if (parsed.aggregateKind !== 'SCENE') throw new Error('Expected a Scene execution result.')
    expect(parsed.changedAggregates).toEqual([
      { aggregateId: sceneId, aggregateKind: 'SCENE', version: 1 }
    ])
    expect(parsed.state.ambientIllumination).toBe('BRIGHT')
    expect(parsed.spatialRefresh?.sceneState.darknessZones[0]).toMatchObject({
      mechanicalIllumination: null,
      mechanicalObscurement: null
    })
    expect(parsed.response?.delta).toEqual({
      deltas: [
        {
          kind: 'DARKNESS_UPSERTED',
          zone: {
            ...legacyZone(),
            mechanicalIllumination: null,
            mechanicalObscurement: null
          }
        }
      ],
      kind: 'BATCH'
    })
  })

  it('normalizes old pending commands and accepts only their exact legacy fingerprint', () => {
    const parsedPublicCommand = liveSessionCommandDtoSchema.parse(legacyCommand())
    expect(isLegacyVisualOnlyDarknessReplayCommand(parsedPublicCommand)).toBe(true)

    const persistedCommand = parsePersistedLiveSessionCommand(legacyCommand())
    expect(isLegacyVisualOnlyDarknessReplayCommand(persistedCommand)).toBe(false)
    expect(persistedCommand).toEqual(currentCommand())
    expect(currentLiveSessionCommandFingerprint(persistedCommand)).toBe(
      JSON.stringify(currentCommand())
    )
    expect(legacyVisualOnlyDarknessLiveCommandFingerprint(persistedCommand)).toBe(
      JSON.stringify(legacyCommand())
    )
  })
})
