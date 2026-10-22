import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { optionalCombatPassageContinuationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionOptionalCombatPending'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ScenePoint, SceneToken } from '@artificer-toolkit/shared/vtt'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import type { EncounterActionEconomyConsumption } from '../encounterActionEconomyConsumption.js'
import { discoverEncounterMovementPassage } from '../encounterMovementPassageBoundary.js'
import { discoverEncounterMovementPassageContact } from '../encounterMovementPassageContacts.js'
import { movementPassageOfModifiers } from '../encounterMovementPassagePolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import {
  availableEncounterMovementPassageChoice,
  prepareEncounterMovementPassageContest
} from '../encounterMovementPassagePreparation.js'
import { buildMovementTarget, type MovementTarget } from '../encounterMovementTargets.js'
import type { SpatialMovementRuleRoot } from '../encounterSpatialMovementRuleService.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

const ids = {
  encounter: '10000000-0000-4000-8000-000000000001',
  campaign: '10000000-0000-4000-8000-000000000002',
  blueprint: '10000000-0000-4000-8000-000000000003',
  side: '10000000-0000-4000-8000-000000000004',
  scene: '10000000-0000-4000-8000-000000000005',
  command: '10000000-0000-4000-8000-000000000006',
  user: '10000000-0000-4000-8000-000000000007',
  // Actor ids sort as: first < second < ally < neutral < source.
  first: '20000000-0000-4000-8000-000000000001',
  second: '20000000-0000-4000-8000-000000000002',
  ally: '20000000-0000-4000-8000-000000000003',
  neutral: '20000000-0000-4000-8000-000000000004',
  source: '20000000-0000-4000-8000-000000000005',
  firstToken: '30000000-0000-4000-8000-000000000001',
  secondToken: '30000000-0000-4000-8000-000000000002',
  allyToken: '30000000-0000-4000-8000-000000000003',
  neutralToken: '30000000-0000-4000-8000-000000000004',
  sourceToken: '30000000-0000-4000-8000-000000000005'
} as const

const checksum = 'a'.repeat(64)
const timestamp = '2026-09-26T00:00:00.000Z'

function token(id: string, position: ScenePoint): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 10,
    hidden: false,
    id,
    label: 'Token',
    locked: false,
    position,
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 10
  }
}

/**
 * Ten-unit footprints on the x axis. The mover walks from (0, 0) to (256, 0), so every contact
 * is an exact binary fraction of the path. Hostile blockers sit at x = 50 and x = 120, an ally at
 * x = 80 and a neutral creature at x = 160.
 */
const path: ScenePoint[] = [
  { x: 0, y: 0 },
  { x: 256, y: 0 }
]
const tokens = {
  source: token(ids.sourceToken, { x: 0, y: 0 }),
  first: token(ids.firstToken, { x: 50, y: 0 }),
  second: token(ids.secondToken, { x: 120, y: 0 }),
  ally: token(ids.allyToken, { x: 80, y: 0 }),
  neutral: token(ids.neutralToken, { x: 160, y: 0 })
}
const sceneTokens = Object.values(tokens)
const actorIdByTokenId = new Map([
  [ids.sourceToken, ids.source],
  [ids.firstToken, ids.first],
  [ids.secondToken, ids.second],
  [ids.allyToken, ids.ally],
  [ids.neutralToken, ids.neutral]
])
const hostileActorIds = new Set<string>([ids.first, ids.second])

function contacts(input: {
  path?: readonly ScenePoint[]
  tokens?: readonly SceneToken[]
  movementKind?: 'VOLUNTARY' | 'FORCED' | 'TELEPORT'
  movingTokenId?: string
}) {
  return discoverEncounterMovementPassageContact({
    actorIdByTokenId,
    blocks: ({ blockerActorId, movingActorId }) =>
      movingActorId === ids.source && hostileActorIds.has(blockerActorId),
    movementKind: input.movementKind ?? 'VOLUNTARY',
    movingTokenId: input.movingTokenId ?? ids.sourceToken,
    path: input.path ?? path,
    tokens: input.tokens ?? sceneTokens
  })
}

describe('discoverEncounterMovementPassageContact', () => {
  it('orders hostile footprint contacts along the path and ignores non-hostile tokens', () => {
    expect(contacts({})).toEqual({
      kind: 'CROSSING',
      contact: {
        blockerActorId: ids.first,
        blockerTokenId: ids.firstToken,
        contact: { x: 40, y: 0 },
        pathDistance: 40
      },
      laterContacts: [
        {
          blockerActorId: ids.second,
          blockerTokenId: ids.secondToken,
          contact: { x: 110, y: 0 },
          pathDistance: 110
        }
      ]
    })
  })

  it('breaks a same-distance tie by blocker actor id', () => {
    const upper = token(ids.secondToken, { x: 50, y: -3 })
    const lower = token(ids.firstToken, { x: 50, y: 3 })
    const discovery = contacts({ tokens: [tokens.source, upper, lower] })
    expect(discovery.kind === 'CROSSING' && discovery.contact.blockerActorId).toBe(ids.first)
    expect(discovery.kind === 'CROSSING' && discovery.laterContacts).toEqual([
      {
        blockerActorId: ids.second,
        blockerTokenId: ids.secondToken,
        contact: { x: 40, y: 0 },
        pathDistance: 40
      }
    ])
  })

  it('refuses an endpoint inside hostile footprints, naming each blocker once in id order', () => {
    const overlapping = token(ids.firstToken, { x: 126, y: 4 })
    expect(
      contacts({
        path: [path[0]!, { x: 122, y: 0 }],
        tokens: [tokens.source, tokens.second, overlapping, tokens.ally]
      })
    ).toEqual({ kind: 'ENDPOINT_OCCUPIED', blockerActorIds: [ids.first, ids.second] })
    // Ending on an ally or a neutral creature is not an occupied-endpoint refusal.
    expect(
      contacts({ path: [path[0]!, { x: 80, y: 0 }], tokens: [tokens.source, tokens.ally] })
    ).toEqual({ kind: 'NONE' })
    expect(
      contacts({ path: [path[0]!, { x: 160, y: 0 }], tokens: [tokens.source, tokens.neutral] })
    ).toEqual({ kind: 'NONE' })
  })

  it('finds no passage for forced movement, teleports, a stationary path or an unbound mover', () => {
    expect(contacts({ movementKind: 'FORCED' })).toEqual({ kind: 'NONE' })
    expect(contacts({ movementKind: 'TELEPORT' })).toEqual({ kind: 'NONE' })
    expect(contacts({ path: [path[0]!] })).toEqual({ kind: 'NONE' })
    expect(contacts({ movingTokenId: '30000000-0000-4000-8000-000000000099' })).toEqual({
      kind: 'NONE'
    })
    expect(contacts({ tokens: [tokens.source, tokens.ally, tokens.neutral] })).toEqual({
      kind: 'NONE'
    })
  })
})

const overrun = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'OVERRUN'
)!
const tumble = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'TUMBLE'
)!
const optionalCombatSnapshot = {
  schemaVersion: 1 as const,
  gameSystemId: SRD_SYSTEM_ID,
  definitions: [overrun, tumble].map((definition) => ({
    definitionId: definition.id,
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitionVersion: 1,
    definitionChecksum: definition.checksum,
    contractVersion: 1,
    label: definition.label,
    document: definition.document
  }))
}

function runState(automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED'): EncounterRunState {
  return encounterRunStateSchema.parse({
    id: ids.encounter,
    campaignId: ids.campaign,
    gameSystemId: SRD_SYSTEM_ID,
    blueprintId: ids.blueprint,
    blueprintVersion: 1,
    blueprintChecksum: checksum,
    name: 'Bridge ambush',
    status: 'ACTIVE',
    automationMode,
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    turnSequence: 1,
    currentActorId: ids.source,
    reminders: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    actorIds: [ids.first, ids.second, ids.ally, ids.neutral, ids.source],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    sides: [{ id: ids.side, label: 'Everyone', sortOrder: 0 }]
  })
}

function creature(input: {
  id: string
  disposition: 'FRIENDLY' | 'NEUTRAL' | 'HOSTILE'
  kind?: 'CREATURE' | 'CUSTOM'
  size?: string
  checkTotals?: Record<string, number>
}): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ids.encounter,
    kind: input.kind ?? 'CREATURE',
    label: 'Creature',
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition: input.disposition,
    initiative: null,
    manualOrder: null,
    conditions: [],
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    defeated: false,
    form: null,
    absence: null,
    resources: {},
    gmNotes: null,
    sideId: ids.side,
    snapshot: {
      payload: {
        size: input.size ?? 'MEDIUM',
        damageVulnerabilities: [],
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        features: []
      },
      ruleFacts: {
        gameSystemId: SRD_SYSTEM_ID,
        vocabularySnapshotId: ids.blueprint,
        vocabularySnapshotVersion: 1,
        vocabularySnapshotChecksum: checksum,
        abilityScores: { [srdSystemRecord.abilities![0]!.id]: 10 },
        checkTotals: input.checkTotals ?? {
          [SRD_ATHLETICS_SKILL_ID]: 2,
          [SRD_ACROBATICS_SKILL_ID]: 3
        },
        saveProficiencyBonuses: {},
        resourceAbilityScores: {},
        initiativeAbilityDefinitionId: srdSystemRecord.abilities![0]!.id,
        modifiers: []
      }
    },
    createdAt: timestamp,
    updatedAt: timestamp
  })
}

const source = creature({ id: ids.source, disposition: 'FRIENDLY' })
const first = creature({ id: ids.first, disposition: 'HOSTILE' })
const actors = [
  source,
  first,
  creature({ id: ids.second, disposition: 'HOSTILE' }),
  creature({ id: ids.ally, disposition: 'FRIENDLY' }),
  creature({ id: ids.neutral, disposition: 'NEUTRAL' })
]

function root(originalPath: readonly ScenePoint[] = path): SpatialMovementRuleRoot {
  return {
    commandId: ids.command,
    commandFingerprint: checksum,
    initiatorUserId: ids.user,
    correlationId: null,
    encounterId: ids.encounter,
    sceneId: ids.scene,
    tokenId: ids.sourceToken,
    expectedEncounterVersion: 1,
    expectedSceneVersion: 1,
    movementKind: 'VOLUNTARY',
    originalPath,
    terminalPassageStop: null
  }
}

function footprintPin(actorId: string, blocker: SceneToken) {
  return checksumRuleDocument({ actorId, tokenId: blocker.id, footprint: blocker })
}

const noPassage = { mover: movementPassageOfModifiers(DND5E_SYSTEM_ID, []), sizeOf: () => null }

describe('discoverEncounterMovementPassage', () => {
  it('pins the first hostile contact and the next passage stop by disposition', () => {
    // The mover's Scene token has already been paused elsewhere; discovery uses the path origin.
    const paused = sceneTokens.map((entry) =>
      entry.id === ids.sourceToken ? { ...entry, position: { x: 30, y: 0 } } : entry
    )
    expect(
      discoverEncounterMovementPassage({
        state: runState(),
        actors,
        root: root(),
        sceneTokens: paused,
        actorIdByTokenId,
        passage: noPassage
      })
    ).toEqual({
      contact: {
        blockerActorId: ids.first,
        blockerTokenId: ids.firstToken,
        contact: { x: 40, y: 0 },
        pathDistance: 40,
        blockerCurrentnessChecksum: footprintPin(ids.first, tokens.first)
      },
      nextPassageStop: {
        blockerActorId: ids.second,
        blockerTokenId: ids.secondToken,
        contact: { x: 110, y: 0 },
        pathDistance: 110,
        blockerCurrentnessChecksum: footprintPin(ids.second, tokens.second)
      },
      sourceActorId: ids.source
    })
  })

  it('has no next stop past the last hostile and no passage without a hostile on the path', () => {
    const input = { state: runState(), actors, sceneTokens, actorIdByTokenId, passage: noPassage }
    expect(
      discoverEncounterMovementPassage({ ...input, root: root([path[0]!, { x: 100, y: 0 }]) })
        ?.nextPassageStop
    ).toBeNull()
    expect(
      discoverEncounterMovementPassage({ ...input, root: root([path[0]!, { x: 30, y: 0 }]) })
    ).toBeNull()
  })

  it('treats neutral creatures as passable and allies as allies', () => {
    const neutralOnly = discoverEncounterMovementPassage({
      state: runState(),
      actors,
      root: root([path[0]!, { x: 200, y: 20 }]),
      sceneTokens: [tokens.source, tokens.ally, token(ids.neutralToken, { x: 100, y: 10 })],
      actorIdByTokenId,
      passage: noPassage
    })
    expect(neutralOnly).toBeNull()
  })

  it('refuses an endpoint inside a hostile footprint and a mover without an actor', () => {
    expect(() =>
      discoverEncounterMovementPassage({
        state: runState(),
        actors,
        root: root([path[0]!, { x: 52, y: 0 }]),
        sceneTokens,
        actorIdByTokenId,
        passage: noPassage
      })
    ).toThrow('Voluntary movement cannot end inside a hostile occupied footprint.')
    expect(() =>
      discoverEncounterMovementPassage({
        state: runState(),
        actors: actors.filter((actor) => actor.id !== ids.source),
        root: root(),
        sceneTokens,
        actorIdByTokenId,
        passage: noPassage
      })
    ).toThrow('Movement passage source is unavailable.')
  })

  it('discovers nothing in Manual automation', () => {
    expect(
      discoverEncounterMovementPassage({
        state: runState('MANUAL'),
        actors,
        root: root([path[0]!, { x: 52, y: 0 }]),
        sceneTokens,
        actorIdByTokenId,
        passage: noPassage
      })
    ).toBeNull()
  })

  const moverPassage = (
    through: 'ANY' | 'LARGER_THAN_SELF',
    endIn: 'NONE' | 'ANY',
    sizes: Readonly<Record<string, string>> = {}
  ) => ({
    mover: {
      throughCreatures: through,
      endInCreatures: endIn,
      throughBarriers: false,
      costMultiplier: 1
    },
    sizeOf: (actorId: string) => sizes[actorId] ?? null
  })

  it('lets a mover with passage through every hostile it may pass, and stops it at the first it may not', () => {
    const input = { state: runState(), actors, sceneTokens, actorIdByTokenId, root: root() }
    expect(
      discoverEncounterMovementPassage({ ...input, passage: moverPassage('ANY', 'NONE') })
    ).toBeNull()
    expect(
      discoverEncounterMovementPassage({
        ...input,
        passage: moverPassage('LARGER_THAN_SELF', 'NONE', {
          [ids.source]: 'SMALL',
          [ids.first]: 'MEDIUM',
          [ids.second]: 'SMALL'
        })
      })
    ).toMatchObject({ contact: { blockerActorId: ids.second }, nextPassageStop: null })
  })

  it('lets a mover end inside a hostile only when its passage allows ending there', () => {
    const input = {
      state: runState(),
      actors,
      sceneTokens,
      actorIdByTokenId,
      root: root([path[0]!, { x: 52, y: 0 }])
    }
    expect(
      discoverEncounterMovementPassage({ ...input, passage: moverPassage('ANY', 'ANY') })
    ).toBeNull()
    expect(() =>
      discoverEncounterMovementPassage({ ...input, passage: moverPassage('ANY', 'NONE') })
    ).toThrow('Voluntary movement cannot end inside a hostile occupied footprint.')
  })
})

const economyDefinitionIds = {
  ACTION: '40000000-0000-4000-8000-000000000001',
  BONUS_ACTION: '40000000-0000-4000-8000-000000000002'
} as const

function passageInput(state: EncounterRunState, targetActors: readonly EncounterRunActorState[]) {
  const passage = discoverEncounterMovementPassage({
    state,
    actors,
    root: root(),
    sceneTokens,
    actorIdByTokenId,
    passage: noPassage
  })
  if (!passage) throw new Error('Expected a passage contact.')
  const movement = optionalCombatPassageContinuationDtoSchema.parse({
    root: {
      ...root(),
      pathChecksum: checksumRuleDocument(path),
      pathStartDistance: passage.contact.pathDistance,
      currentPosition: passage.contact.contact,
      currentSceneVersion: 2,
      resolutionCommands: []
    },
    blockerActorId: passage.contact.blockerActorId,
    blockerTokenId: passage.contact.blockerTokenId,
    contact: passage.contact.contact,
    contactPathDistance: passage.contact.pathDistance,
    blockerCurrentnessChecksum: passage.contact.blockerCurrentnessChecksum,
    nextPassageStop: passage.nextPassageStop,
    spatialSelectionChecksum: checksum,
    spatialCurrentnessChecksum: checksum,
    completedSpatialExecutions: [],
    appliedSpatialPrefix: null,
    completedReactionExecutions: [],
    remainingSpatialCandidates: [],
    reactionTimeline: []
  })
  const targets = new Map<string, MovementTarget>(
    targetActors.map((actor) => [
      actor.id,
      buildMovementTarget({
        actor,
        activeEffects: [],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: ids.campaign,
        characterFacts: null
      })
    ])
  )
  return { state, movement, sourceActorId: passage.sourceActorId, targets }
}

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)

function reads(
  available: readonly ('ACTION' | 'BONUS_ACTION')[] = ['ACTION', 'BONUS_ACTION'],
  systemId = system.id
) {
  return {
    loadSystem: async () => ({ ...system, id: systemId }),
    prepareEconomy: async ({
      activation
    }: {
      activation: { code: string; amount: number }
    }): Promise<EncounterActionEconomyConsumption | null> => {
      const code = activation.code
      if (code !== 'ACTION' && code !== 'BONUS_ACTION') throw new Error('Unexpected economy.')
      return available.includes(code)
        ? {
            definitionId: economyDefinitionIds[code],
            definitionVersion: 1,
            definitionChecksum: checksum,
            maximum: 1,
            beforeUsed: 0,
            afterUsed: 1
          }
        : null
    }
  }
}

function offered(choice: Awaited<ReturnType<typeof availableEncounterMovementPassageChoice>>) {
  return (choice?.options ?? []).map((option) => `${option.ruleKind}:${option.economy}`).sort()
}

describe('availableEncounterMovementPassageChoice', () => {
  it('offers Overrun and Tumble for each available economy against the first blocker', async () => {
    const input = passageInput(runState(), [source, first])
    const choice = await availableEncounterMovementPassageChoice(reads(), input)
    if (!choice) throw new Error('Expected a passage choice.')
    expect(offered(choice)).toEqual([
      'OVERRUN:ACTION',
      'OVERRUN:BONUS_ACTION',
      'TUMBLE:ACTION',
      'TUMBLE:BONUS_ACTION'
    ])
    expect(choice).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE',
      schemaVersion: 1,
      movement: input.movement,
      sourceActorId: ids.source,
      sourceTokenId: ids.sourceToken,
      sourceControllerCharacterId: null,
      optionsChecksum: checksumRuleDocument(choice.options)
    })
    expect(choice.options.map((option) => option.optionId)).toEqual(
      choice.options.map((option) => option.optionId).sort()
    )
    const byKind = Object.fromEntries(
      choice.options.map((option) => [
        option.ruleKind,
        {
          definitionId: option.definitionId,
          definitionChecksum: option.definitionChecksum,
          moduleKey: option.moduleKey,
          moduleContractVersion: option.moduleContractVersion
        }
      ])
    )
    expect(byKind).toEqual({
      OVERRUN: {
        definitionId: overrun.id,
        definitionChecksum: overrun.checksum,
        moduleKey: overrun.document.module.policyModuleKey,
        moduleContractVersion: 1
      },
      TUMBLE: {
        definitionId: tumble.id,
        definitionChecksum: tumble.checksum,
        moduleKey: tumble.document.module.policyModuleKey,
        moduleContractVersion: 1
      }
    })
  })

  it('offers only the economies the mover still has', async () => {
    const input = passageInput(runState(), [source, first])
    expect(
      offered(await availableEncounterMovementPassageChoice(reads(['BONUS_ACTION']), input))
    ).toEqual(['OVERRUN:BONUS_ACTION', 'TUMBLE:BONUS_ACTION'])
    expect(await availableEncounterMovementPassageChoice(reads([]), input)).toBeNull()
  })

  it('drops the contest whose check facts are missing', async () => {
    const noAcrobatics = creature({
      id: ids.first,
      disposition: 'HOSTILE',
      checkTotals: { [SRD_ATHLETICS_SKILL_ID]: 1 }
    })
    expect(
      offered(
        await availableEncounterMovementPassageChoice(
          reads(),
          passageInput(runState(), [source, noAcrobatics])
        )
      )
    ).toEqual(['OVERRUN:ACTION', 'OVERRUN:BONUS_ACTION'])
  })

  it('offers nothing for a Custom blocker, Manual automation, a stale System or a missing mover', async () => {
    const custom = creature({ id: ids.first, disposition: 'HOSTILE', kind: 'CUSTOM' })
    expect(
      await availableEncounterMovementPassageChoice(
        reads(),
        passageInput(runState(), [source, custom])
      )
    ).toBeNull()
    const manual = passageInput(runState(), [source, first])
    expect(
      await availableEncounterMovementPassageChoice(reads(), {
        ...manual,
        state: { ...manual.state, automationMode: 'MANUAL' }
      })
    ).toBeNull()
    expect(
      await availableEncounterMovementPassageChoice(
        reads(undefined, '00000000-0000-4000-8000-000000000999'),
        passageInput(runState(), [source, first])
      )
    ).toBeNull()
    expect(
      await availableEncounterMovementPassageChoice(reads(), passageInput(runState(), [first]))
    ).toBeNull()
  })
})

describe("passage contests under the contestants' conditions (D94)", () => {
  const POISONED = SRD_CONDITION_TYPES.find((condition) => condition.code === 'POISONED')!.id
  const poisoned = (actor: EncounterRunActorState): EncounterRunActorState => {
    // A Character actor's conditions live on its Character, which the Run reads.
    if (actor.kind === 'CHARACTER') throw new Error('Expected a Creature contestant.')
    return { ...actor, conditions: [POISONED] }
  }

  async function contest(ruleKind: 'OVERRUN' | 'TUMBLE', contestants: EncounterRunActorState[]) {
    const input = passageInput(runState(), contestants)
    const targets = new Map(
      await Promise.all(
        [...input.targets].map(
          async ([actorId, target]) =>
            [
              actorId,
              await withEncounterConditionMechanics({
                target,
                gameSystemId: SRD_SYSTEM_ID,
                definitions: srdConditionDefinitionSource()
              })
            ] as const
        )
      )
    )
    const choice = await availableEncounterMovementPassageChoice(reads(), { ...input, targets })
    const option = choice?.options.find(
      (candidate) => candidate.ruleKind === ruleKind && candidate.economy === 'ACTION'
    )
    if (!choice || !option) throw new Error('Expected a passage option.')
    return prepareEncounterMovementPassageContest(reads(), {
      state: input.state,
      choice,
      optionId: option.optionId,
      targets
    })
  }

  const poisonedBy = (holderActorId: string) => ({
    sourceId: `condition:${POISONED}`,
    grantId: null,
    domainKey: `condition:${holderActorId}`,
    influence: 'DISADVANTAGE',
    source: { kind: 'CONDITION', id: POISONED, holderActorId }
  })

  it.each(['OVERRUN', 'TUMBLE'] as const)(
    'a Poisoned mover makes its %s check with disadvantage, naming the condition and its holder',
    async (ruleKind) => {
      const prepared = await contest(ruleKind, [poisoned(source), first])
      expect(prepared.initiator).toMatchObject({
        rollMode: 'DISADVANTAGE',
        contributors: [poisonedBy(ids.source)]
      })
      expect(prepared.defender.checks).toMatchObject([{ rollMode: 'NORMAL', contributors: [] }])
    }
  )

  it('a Poisoned blocker makes its contest check with disadvantage', async () => {
    const prepared = await contest('TUMBLE', [source, poisoned(first)])
    expect(prepared.initiator).toMatchObject({ rollMode: 'NORMAL', contributors: [] })
    expect(prepared.defender.checks).toMatchObject([
      { rollMode: 'DISADVANTAGE', contributors: [poisonedBy(ids.first)] }
    ])
  })
})
