import { describe, expect, it } from 'vitest'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { requireAreaActionPendingRoot } from '../actionAreaPending.js'

const CASTER_ID = '00000000-0000-4000-8000-000000000001'
const SCENE_ID = '00000000-0000-4000-8000-000000000002'
const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000003'
const USER_ID = '00000000-0000-4000-8000-000000000004'
const CHECKSUM = 'optional-combat-checksum'
const ORIGIN = { x: 200, y: 150 }
const TOWARD = { x: 500, y: 150 }
/** What the guard asks the Scene for once the sealed area matches the command. */
const SCENE_READ = new Error('The sealed area matched; the Scene was read.')

const command = (aim: { origin: typeof ORIGIN; toward: typeof TOWARD }) =>
  ({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: ENCOUNTER_ID,
    commandId: '00000000-0000-4000-8000-000000000005',
    expectedVersion: 1,
    actorId: CASTER_ID,
    target: { kind: 'DIRECTED', sceneId: SCENE_ID, expectedSceneVersion: 3, ...aim },
    actionId: 'creature-wolf:cone',
    optionalCombatIntent: null,
    sceneContext: null
  }) satisfies ResolveEncounterActionInputDto

/**
 * The root of a sealed cone aimed at `ORIGIN` toward `TOWARD`, holding only what the guard reads
 * before it asks for the Scene: its other checks all pass, so a refusal is the area's.
 */
function sealedRoot(fingerprint: string, commandJson: string) {
  return {
    snapshotKind: 'AGGREGATE_CHOICE',
    optionalCombatSnapshotChecksum: CHECKSUM,
    applicationContext: {
      kind: 'ENCOUNTER_AREA_ACTION',
      initiatorUserId: USER_ID,
      commandFingerprint: fingerprint,
      commandJson,
      casterActorId: CASTER_ID,
      scene: { sceneId: SCENE_ID, sceneVersion: 3 },
      area: { origin: ORIGIN, shape: { kind: 'CONE', length: 300, toward: TOWARD } },
      targets: [],
      removedActorIds: []
    }
  } as unknown as ServerRuleExecutionPendingSnapshotDto
}

const state = {
  actorIds: [CASTER_ID],
  optionalCombatSnapshotChecksum: CHECKSUM
} as EncounterRunState

function guard(aimed: Parameters<typeof command>[0]) {
  const sealed = command({ origin: ORIGIN, toward: TOWARD })
  const fingerprint = checksumCanonicalJson(sealed)
  const root = sealedRoot(fingerprint, JSON.stringify(sealed))
  return requireAreaActionPendingRoot(
    { snapshot: root, command: command(aimed), fingerprint, initiatorUserId: USER_ID, state },
    () => Promise.reject(SCENE_READ)
  )
}

describe('the sealed directed area against the command in the root guard', () => {
  it('lets a command that aimed the sealed origin and direction on to read the Scene', async () => {
    await expect(guard({ origin: ORIGIN, toward: TOWARD })).rejects.toBe(SCENE_READ)
  })

  it.each([
    ['origin', { origin: { x: 200, y: 160 }, toward: TOWARD }],
    ['direction', { origin: ORIGIN, toward: { x: 500, y: 300 } }]
  ])('refuses a command whose %s differs from the sealed area', async (_name, aim) => {
    await expect(guard(aim)).rejects.toThrow('Live Session pending area action root mismatch.')
  })
})
