import { describe, expect, it } from 'vitest'
import {
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { jackal } from '@artificer-toolkit/source-data/srd/creatures/jackal.js'
import {
  encounterActionPositionalContributors,
  loadEncounterFlankingFacts
} from '../encounterPositionalContributors.js'
import { optionalCombatPolicyCapabilityRegistry } from '../platformEncounterPolicy.js'
import {
  installedSrdCreature,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const TARGET_ID = testUuid(0xf01)
const ATTACKER_ID = testUuid(0xf02)
const ALLY_ID = testUuid(0xf03)
const TOKEN_IDS: Readonly<Record<string, string>> = {
  [TARGET_ID]: testUuid(0xf11),
  [ATTACKER_ID]: testUuid(0xf12),
  [ALLY_ID]: testUuid(0xf13)
}
const FLANKING_CONTRIBUTOR = {
  sourceId: DND5E_FLANKING_DEFINITION_ID,
  grantId: null,
  domainKey: DND5E_FLANKING_OPERATION_KEY,
  influence: 'ADVANTAGE',
  source: { kind: 'AUTHORED', id: DND5E_FLANKING_DEFINITION_ID, holderActorId: null }
}

const placed = (actorId: string, column: number, row: number) => ({
  actorId,
  tokenId: TOKEN_IDS[actorId]!,
  position: { x: column * 100 + 50, y: row * 100 + 50 },
  width: 100,
  height: 100
})

/**
 * A jackal attacking a hostile jackal at (2, 2) from the south, with a friendly jackal at
 * `allyAt`, judged by the SRD Flanking policy through the registry as an attack is.
 */
async function flankingContributors(input: {
  allyAt: readonly [number, number]
  allyDisposition?: 'FRIENDLY' | 'HOSTILE'
  allyConditionIds?: readonly string[]
  seeing?: readonly string[]
  flankingOn?: boolean
  melee?: boolean
}) {
  const creature = installedSrdCreature(jackal)
  const actors = [
    srdCreatureActor({ id: TARGET_ID, creature }),
    srdCreatureActor({ id: ATTACKER_ID, creature, disposition: 'FRIENDLY' }),
    srdCreatureActor({
      id: ALLY_ID,
      creature,
      disposition: input.allyDisposition ?? 'FRIENDLY',
      conditionIds: input.allyConditionIds ?? []
    })
  ]
  const state = srdEncounterState({
    actors,
    currentActorId: ATTACKER_ID,
    optionalCombatKinds: input.flankingOn === false ? [] : ['FLANKING']
  })
  const targets = new Map(actors.map((actor) => [actor.id, srdCreatureTarget(actor)]))
  const loaded: string[] = []
  const capabilityDefinitionId = optionalCombatPolicyCapabilityRegistry
    .find(state.gameSystemId)
    ?.flankingParticipantCapabilityDefinitionId(state)
  const facts = await loadEncounterFlankingFacts({
    gameSystemId: state.gameSystemId,
    actors,
    attacker: targets.get(ATTACKER_ID)!,
    target: targets.get(TARGET_ID)!,
    grid: GRID,
    tokens: [
      placed(TARGET_ID, 2, 2),
      placed(ATTACKER_ID, 2, 3),
      placed(ALLY_ID, input.allyAt[0], input.allyAt[1])
    ],
    // With the rule off, the SRD capability still never qualifies a participant.
    capabilityDefinitionId:
      capabilityDefinitionId ?? DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
    loadTarget: async (actor) => {
      loaded.push(actor.id)
      return targets.get(actor.id)!
    },
    definitions: srdDefinitions,
    observersSeeing: async ({ subject, observers }) => {
      expect(subject.actor.id).toBe(TARGET_ID)
      const seeing = input.seeing ?? [ATTACKER_ID, ALLY_ID]
      return new Set(
        observers.flatMap(({ actor }) => (seeing.includes(actor.id) ? [actor.id] : []))
      )
    }
  })
  const contributors = encounterActionPositionalContributors({
    facing: null,
    sceneContext: null,
    flanking: {
      automationMode: state.automationMode,
      gameSystemId: state.gameSystemId,
      optionalCombatSnapshot: state.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      melee: input.melee ?? true,
      ...facts
    }
  })
  return { capabilityDefinitionId, contributors, loaded }
}

describe('Flanking (ATTACK-12.T2f)', () => {
  it('gives a melee attack advantage when an ally that sees the target stands opposite the attacker', async () => {
    const { contributors, loaded } = await flankingContributors({ allyAt: [2, 1] })
    expect(contributors).toEqual([FLANKING_CONTRIBUTOR])
    expect(loaded).toEqual([ALLY_ID])
  })

  it('gives none when the adjacent ally is not opposite the attacker', async () => {
    expect((await flankingContributors({ allyAt: [3, 2] })).contributors).toEqual([])
  })

  it('gives none for a ranged attack', async () => {
    expect((await flankingContributors({ allyAt: [2, 1], melee: false })).contributors).toEqual([])
  })

  it('gives none when the ally or the attacker cannot see the target', async () => {
    expect(
      (await flankingContributors({ allyAt: [2, 1], seeing: [ATTACKER_ID] })).contributors
    ).toEqual([])
    expect(
      (await flankingContributors({ allyAt: [2, 1], seeing: [ALLY_ID] })).contributors
    ).toEqual([])
  })

  it('gives none when the opposite ally is incapacitated', async () => {
    const { contributors } = await flankingContributors({
      allyAt: [2, 1],
      allyConditionIds: [srdCondition('Incapacitated')]
    })
    expect(contributors).toEqual([])
  })

  it('counts only an ally of the attacker in contact with the target, and loads no other', async () => {
    const enemy = await flankingContributors({ allyAt: [2, 1], allyDisposition: 'HOSTILE' })
    expect(enemy.contributors).toEqual([])
    expect(enemy.loaded).toEqual([])
    const distant = await flankingContributors({ allyAt: [2, 0] })
    expect(distant.contributors).toEqual([])
    expect(distant.loaded).toEqual([])
  })

  it('names no participant capability and gives none while the rule is off', async () => {
    const { capabilityDefinitionId, contributors } = await flankingContributors({
      allyAt: [2, 1],
      flankingOn: false
    })
    expect(capabilityDefinitionId).toBeNull()
    expect(contributors).toEqual([])
  })
})
