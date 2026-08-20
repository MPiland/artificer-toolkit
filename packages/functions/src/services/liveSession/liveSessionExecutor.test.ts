import type { LiveSessionCommandDto } from '@artificer-toolkit/schema/api/liveSessions'
import { describe, expect, it } from 'vitest'

import { liveSessionExecutorInternals } from './liveSessionExecutor.js'

const ids = {
  barrier: '00000000-0000-4000-8000-000000000021',
  campaign: '00000000-0000-4000-8000-000000000022',
  character: '00000000-0000-4000-8000-000000000023',
  characterCommand: '00000000-0000-4000-8000-000000000024',
  encounter: '00000000-0000-4000-8000-000000000025',
  encounterCommand: '00000000-0000-4000-8000-000000000026',
  scene: '00000000-0000-4000-8000-000000000027',
  sceneCommand: '00000000-0000-4000-8000-000000000028',
  sceneDefinition: '00000000-0000-4000-8000-000000000029',
  token: '00000000-0000-4000-8000-000000000030'
} as const

const commands = {
  attach: {
    aggregateKind: 'SCENE',
    command: {
      commandId: ids.sceneCommand,
      encounterId: ids.encounter,
      sceneDefinitionId: ids.sceneDefinition,
      type: 'ATTACH_SCENE'
    }
  },
  character: {
    aggregateKind: 'CHARACTER',
    characterId: ids.character,
    command: {
      commandId: ids.characterCommand,
      expectedVersion: 0,
      preference: { mode: 'AUTO' },
      type: 'SET_MOVEMENT_DISPLAY_PREFERENCE'
    }
  },
  encounter: {
    aggregateKind: 'ENCOUNTER',
    command: {
      commandId: ids.encounterCommand,
      encounterId: ids.encounter,
      expectedVersion: 0,
      type: 'ADVANCE_TURN'
    }
  },
  scene: {
    aggregateKind: 'SCENE',
    command: {
      barrierId: ids.barrier,
      commandId: ids.sceneCommand,
      encounterId: ids.encounter,
      expectedSceneVersion: 0,
      sceneId: ids.scene,
      state: 'OPEN',
      type: 'SET_SCENE_DOOR_STATE'
    }
  }
} satisfies Record<string, LiveSessionCommandDto>

describe('live-session executor command authority', () => {
  it('claims Character, Encounter, and attach commands while non-attach Scene commands use the locked lane', () => {
    expect(liveSessionExecutorInternals.requiresLiveSessionCommandAuthorityClaim(commands.character)).toBe(true)
    expect(liveSessionExecutorInternals.requiresLiveSessionCommandAuthorityClaim(commands.encounter)).toBe(true)
    expect(liveSessionExecutorInternals.requiresLiveSessionCommandAuthorityClaim(commands.attach)).toBe(true)
    expect(liveSessionExecutorInternals.requiresLiveSessionCommandAuthorityClaim(commands.scene)).toBe(false)
  })
})
