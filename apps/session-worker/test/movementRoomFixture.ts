import { runInDurableObject } from 'cloudflare:test'
import { vi } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { ensureEncounterSpellPins } from '@artificer-toolkit/encounter-persistence/spellPins'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import {
  liveRoomDefinitionSchema,
  liveRoomInputsInputSchema,
  type LiveRoomInputsResponse
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { characterActiveRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectStorage'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { Dnd5eOptionalCombatRuleKindDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { labelEncounterRollModeReasons } from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import {
  currentSrdDefinition,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { initiativePolicySnapshot } from '@artificer-toolkit/rules-runtime/testing/initiativePolicySnapshot'
import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { storedCompilationOf } from '@artificer-toolkit/rules-runtime/testing/storedCompilations'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_REUSABLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import {
  concentrationDescriptor,
  reactionPolicyDefinitions,
  spatialDamageEffect
} from '../src/testing/movementPlannerFixture.js'
import type { CharacterPlayOverrides } from '../src/testing/characterPageFixture.js'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import {
  insertInitiativeRound,
  insertStoredRun,
  memoryRoomDocuments
} from '../src/testing/storedRunFixture.js'
import { characterRoomInputs } from './characterSheetInputsFixture.js'
import { srdSystemRoomInputs } from './srdSenseInputsFixture.js'
import {
  connectPlayer,
  doorScene,
  fixture,
  ROOM_REPLY_WAIT,
  routeEncounterRequests,
  synchronizeScene
} from './liveRoomFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'
const TOKEN_SIZE = 100
/** The maintained Concentration state a `concentration` room holds for its mover. */
export const CONCENTRATION_STATE_ID = testUuid(0x5001)

/** The Feature that gives the Character advantage on its Concentration saves. */
export const concentrationAdvantageFeature: ClassFeature = {
  id: testUuid(0x5301),
  label: 'Focused Concentration',
  description: 'You have advantage on Constitution saving throws to maintain Concentration.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: testUuid(0x5302),
        grantKind: 'MODIFIER_GRANT',
        valueDomainCode: 'SAVING_THROW_MODIFIER',
        domain: {
          ability: 'CONSTITUTION',
          ruleDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        },
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' },
        scope: 'GLOBAL',
        selectionKind: 'GRANTED',
        order: 0
      }
    ]
  }
}

/** An effect with no behavior of its own: it exists to end with the Concentration that maintains it. */
export function dependentEffectDefinition(input: { encounterId: string; sourceActorId: string }) {
  const definitionId = testUuid(0x5201)
  const entryId = testUuid(0x5202)
  return activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: testUuid(0x5203),
      rootCommandId: testUuid(0x5204),
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      anchor: 'HOLDER',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN'
      }
    }
  })
}

/**
 * Serves the room's dice: each roll takes the next of `rolls`, then `fallback`. Each value is the
 * zero-based result of one die, so a d20 rolls face value + 1. Everything else the room asks the
 * platform's random source for is passed through.
 */
function rigDice(rolls: readonly number[], fallback: number) {
  const pending = [...rolls]
  const platform = crypto.getRandomValues
  let drawn = 0
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    if (!(array instanceof Uint32Array) || array.length !== 1) return platform.call(crypto, array)
    drawn += 1
    array[0] = pending.shift() ?? fallback
    return array
  })
  return () => drawn
}

interface SeatedCharacter {
  characterId: string
  spellcasting?: Parameters<typeof characterRoomInputs>[0]['spellcasting']
  play?: CharacterPlayOverrides
}

export interface MovementRoomConfig {
  /** The Run's actors; the mover is the current actor. */
  actors: readonly EncounterRunActorState[]
  moverActorId: string
  /** The scene-pixel center of every actor's 100 px token. */
  positions: Readonly<Record<string, ScenePoint>>
  automationMode?: AutomationModeDto
  /** The Campaign's ammunition tracking option, frozen on the Run (ATTACK-19.4). */
  trackAmmunition?: boolean
  optionalCombatKinds?: readonly Dnd5eOptionalCombatRuleKindDto[]
  /** The Run's sides; the SRD fixture's single side when omitted. */
  sides?: readonly { id: string; label: string }[]
  /** Whose stored preference rolls dice automatically: the GM's, the Character player's, or the other player's. */
  autoRoll?: 'GAME_MASTER' | 'PLAYER' | 'BOTH' | 'EVERYONE'
  /** The actors the room's player controls, besides any Character assigned to them. */
  playerControlledActorIds?: readonly string[]
  /** The actors a second player, who joins the room's members, controls. */
  otherPlayerControlledActorIds?: readonly string[]
  /** The actors whose Scene tokens start hidden from the room's players. */
  hiddenActorIds?: readonly string[]
  /**
   * Spatial effects that deal 1 damage to whoever crosses them (or, with `save`, fails their save).
   * They are fixed to the Scene unless `moving` anchors them to the mover's token.
   */
  spatialEffects?: readonly {
    center: ScenePoint
    radius: number
    variant?: number
    save?: boolean
    /** Applies this condition instead of dealing damage. */
    condition?: { conditionId: string }
    moving?: { activation: 'ONE_SHOT' | 'REPEATABLE'; hidden: boolean }
    /** A Scene-fixed field that is hidden and unrevealed yet flagged for half-speed passage. */
    hiddenHalfSpeedField?: boolean
  }[]
  /** Scene lighting and barriers, where the room's open, bright Scene is not what a test needs. */
  sceneOverrides?: Partial<
    Pick<
      CampaignSceneStateDto,
      'ambientIllumination' | 'barriers' | 'darknessZones' | 'daylight' | 'lights'
    >
  >
  /** The Scene's grid, where it is not the default 100 px square grid of 5 feet per cell. */
  sceneGrid?: CampaignSceneStateDto['grid']
  /** The mover, a Character, maintains Concentration. */
  concentration?: boolean
  /** The Character who maintains Concentration, when not the mover. */
  concentrationOwnerActorId?: string
  /** Actors that each hold one effect the mover's Concentration maintains; they end with it. */
  concentrationDependentActorIds?: readonly string[]
  /** The Character has a 60 ft Darkvision Sense. */
  characterDarkvision?: boolean
  /** Features the mover Character's Class carries (see `concentrationAdvantageFeature`). */
  characterClassFeatures?: readonly ClassFeature[]
  /** Further SRD Equipment the mover Character carries, equipped (see healersKit). */
  characterEquipment?: readonly EquipmentAuthored[]
  /** The mover Character's starting play state, where it differs from the capture. */
  characterPlay?: CharacterPlayOverrides
  /** The mover Character's Class casts these spells, preparing the listed ones. */
  characterSpellcasting?: Parameters<typeof characterRoomInputs>[0]['spellcasting']
  /** Creatures the Campaign's content publishes, such as the forms a spell offers. */
  formCreatures?: Parameters<typeof characterRoomInputs>[0]['creatures']
  /** An assigned Character the Run does not hold, owned by the room's player (SPELLS-5.11, Q1). */
  outsideCasterCharacterId?: string
  /** A second Character of the Run (a CHARACTER actor with this `characterId`), owned by the room's second player. */
  secondCharacter?: SeatedCharacter
  /** A third Character of the Run, owned by a third player (two creatures react to one cast). */
  thirdCharacter?: SeatedCharacter
  /** The next dice results (see `rigDice`); `fallbackRoll` serves every roll after them. */
  rolls?: readonly number[]
  fallbackRoll?: number
  /** Further reusable definitions the room serves, such as Encounter lifecycle policies. */
  definitions?: readonly ReturnType<typeof currentSrdDefinition>[]
  /** Pins the SRD Spells the Run's Creatures name, as the Run's start does (D163). */
  pinSpells?: boolean
  /** Writes rows into the Run's store before the room hydrates, such as turn effects or placed zones. */
  seed?: (input: {
    effects: ReturnType<typeof createActiveRuleEffectStore>
    spatial: NonNullable<
      Awaited<ReturnType<ReturnType<typeof createSpatialRuleEffectStore>['scope']>>
    >
    encounterId: string
    occurredAt: string
    /** The Scene token of the actor `actorId`. */
    tokenIdOf: (actorId: string) => string
  }) => Promise<void>
  /**
   * The Run has not started yet: PREPARED, round 0, no current actor and no initiative, so a
   * START command rolls initiative (d20 + modifier, once at the start) and opens the first turn.
   */
  status?: 'PREPARED'
  /** The initiative policy a PREPARED Run freezes, where it is not d20 + modifier once at the start. */
  initiativePolicy?: ReturnType<typeof initiativePolicySnapshot>
  /** The Campaign clock's absolute minute the room reads (D151); null when the Campaign has none. */
  campaignClockMinute?: number | null
}

/** A connected socket and the frames the room sent on it: the GM's or a player's. */
type RoomChannel = Pick<Awaited<ReturnType<typeof connectPlayer>>, 'messages' | 'socket'>

/** The page fixture gives every Character the same row ids; a further Character needs its own. */
function withOwnRowIds<
  Part extends Awaited<ReturnType<typeof characterRoomInputs>>['parts'][number]
>(part: Part, suffix: string): Part {
  if (part.status !== 'ASSIGNED' || !part.inputs) return part
  return {
    ...part,
    inputs: {
      ...part.inputs,
      owner: {
        ...part.inputs.owner,
        _id: `${part.inputs.owner._id}:${suffix}`,
        play: { ...part.inputs.owner.play, _id: `${part.inputs.owner.play._id}:${suffix}` }
      }
    },
    documents: part.documents.map((document) => ({ ...document, id: `${document.id}:${suffix}` }))
  }
}

/**
 * A native room playing one movement: an ACTIVE Encounter bound to the presented Scene, seeded
 * through the room's hydration inputs (Run, Scene, System, definitions, Character page and
 * authorization), so every command runs the real room path. The GM's socket sends the commands.
 */
export async function movementRoom(config: MovementRoomConfig) {
  const campaignId = crypto.randomUUID()
  const encounterId = crypto.randomUUID()
  let actors = config.actors.map((actor) =>
    encounterRunActorStateSchema.parse({ ...actor, encounterId })
  )
  const prepared = config.status === 'PREPARED'
  const state = encounterRunStateSchema.parse({
    ...srdEncounterState({
      actors,
      currentActorId: prepared ? null : config.moverActorId,
      ...(prepared && {
        status: 'PREPARED' as const,
        round: 0,
        turnSequence: 0,
        initiativePolicy:
          config.initiativePolicy ??
          initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' })
      }),
      automationMode: config.automationMode,
      trackAmmunition: config.trackAmmunition,
      optionalCombatKinds: config.optionalCombatKinds,
      sides: config.sides
    }),
    id: encounterId,
    campaignId
  })
  // A Token's id derives from its actor's, so area targets, served in token-id order, keep the
  // actors' order from run to run.
  const tokenIdByActorId = new Map(actors.map((actor) => [actor.id, `f${actor.id.slice(1)}`]))
  const moverTokenId = tokenIdByActorId.get(config.moverActorId)
  if (!moverTokenId) throw new Error('The mover is not an actor of the Run.')
  const scene: CampaignSceneStateDto = {
    ...doorScene(campaignId).scene,
    name: 'Movement planner scene',
    barriers: [],
    doorStates: {},
    ...config.sceneOverrides,
    // Encounter control, not exploration, decides these moves.
    fogMode: 'OFF',
    grid: config.sceneGrid ?? {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: TOKEN_SIZE,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    map: { assetId: crypto.randomUUID(), width: 1000, height: 1000, tileManifestAssetId: null },
    tokens: actors.map((actor) => ({
      id: tokenIdByActorId.get(actor.id)!,
      assetId: null,
      controlledByUserIds: [],
      height: TOKEN_SIZE,
      width: TOKEN_SIZE,
      hidden: config.hiddenActorIds?.includes(actor.id) ?? false,
      locked: false,
      label: actor.label,
      rotationDegrees: 0,
      senses: [],
      position: config.positions[actor.id]!,
      vision: null
    }))
  }
  const base = await fixture(scene)
  base.room.systemId = SRD_SYSTEM_ID
  base.capture.sceneEncounterId = encounterId
  if (config.secondCharacter && config.outsideCasterCharacterId)
    throw new Error('A second player seats one extra Character: pass only one.')
  // A player is assigned one Character per Campaign, so an extra Character joins a second player.
  const seatsOtherPlayer =
    config.otherPlayerControlledActorIds ||
    config.secondCharacter ||
    config.thirdCharacter ||
    config.outsideCasterCharacterId
  if (seatsOtherPlayer)
    base.authorization.members.push({
      membershipEpoch: base.capture.origin.membershipEpoch,
      role: 'PLAYER',
      userId: base.otherPlayerId
    })
  // The third player's Character shares no owner with the second's, as a player holds one.
  const thirdPlayerId = crypto.randomUUID()
  if (config.thirdCharacter)
    base.authorization.members.push({
      membershipEpoch: base.capture.origin.membershipEpoch,
      role: 'PLAYER',
      userId: thirdPlayerId
    })
  actors = actors.map((actor) =>
    config.playerControlledActorIds?.includes(actor.id)
      ? { ...actor, controllerUserIds: [base.playerId] }
      : config.otherPlayerControlledActorIds?.includes(actor.id)
        ? { ...actor, controllerUserIds: [base.otherPlayerId] }
        : actor
  )

  const character = actors.find((actor) => actor.kind === 'CHARACTER')
  const characterId = character?.sourceId ?? null
  // The outside caster is the room's player's Character, so the Run's own Character is not.
  const runCharacterOwnerId = config.outsideCasterCharacterId ? base.otherPlayerId : base.playerId
  const characterPage = characterId
    ? await characterRoomInputs({
        campaignId,
        characterId,
        ownerUserId: runCharacterOwnerId,
        darkvision: config.characterDarkvision,
        classFeatures: config.characterClassFeatures,
        equipment: config.characterEquipment,
        play: config.characterPlay,
        spellcasting: config.characterSpellcasting,
        creatures: config.formCreatures
      })
    : null
  const outsideCasterPage = config.outsideCasterCharacterId
    ? await characterRoomInputs({
        campaignId,
        characterId: config.outsideCasterCharacterId,
        ownerUserId: base.playerId
      })
    : null
  const seatedPage = (seated: SeatedCharacter | undefined, ownerUserId: string) =>
    seated
      ? characterRoomInputs({
          campaignId,
          characterId: seated.characterId,
          ownerUserId,
          play: seated.play,
          spellcasting: seated.spellcasting
        })
      : null
  const secondCharacterPage = await seatedPage(config.secondCharacter, base.otherPlayerId)
  const thirdCharacterPage = await seatedPage(config.thirdCharacter, thirdPlayerId)
  const assignments = [
    ...(characterId ? [{ characterId, userId: runCharacterOwnerId }] : []),
    ...(config.outsideCasterCharacterId
      ? [{ characterId: config.outsideCasterCharacterId, userId: base.playerId }]
      : []),
    ...(config.secondCharacter
      ? [{ characterId: config.secondCharacter.characterId, userId: base.otherPlayerId }]
      : []),
    ...(config.thirdCharacter
      ? [{ characterId: config.thirdCharacter.characterId, userId: thirdPlayerId }]
      : [])
  ]

  const memory = createMemoryEncounterStore({ idPrefix: 'movement-room' })
  await insertStoredRun(memory, state, actors)
  if (!prepared)
    await insertInitiativeRound(memory, {
      encounterId,
      actors,
      currentActorId: config.moverActorId,
      now: NOW
    })
  for (const actor of actors)
    await memory.store.insert('encounterActorTokenBindings', {
      encounterId,
      actorId: actor.id,
      tokenId: tokenIdByActorId.get(actor.id)!,
      sceneId: scene.id
    })
  if (config.pinSpells)
    await ensureEncounterSpellPins(
      { db: memory.store },
      async (_userId, _systemId, spellId) => {
        const document = srdBaselineContent.subjects.spells.find((spell) => spell.id === spellId)
        if (!document) throw new Error(`Unknown SRD Spell ${spellId}.`)
        const compilation = storedCompilationOf(parsePublicationDocument('SPELL', document))
        return {
          document,
          checksum: compilation.authoredChecksum,
          version: 1,
          versionId: testUuid(0xe003),
          compilation
        }
      },
      {
        encounterId,
        userId: base.userId,
        systemId: SRD_SYSTEM_ID,
        snapshots: actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [] : [actor.snapshot]))
      }
    )
  const bindingCommandId = crypto.randomUUID()
  await memory.store.insert(
    'encounterSceneBindings',
    encounterSceneBindingSchema.parse({
      encounterId,
      campaignId,
      sceneId: scene.id,
      commandId: bindingCommandId,
      commandFingerprint: checksumCanonicalJson({ commandId: bindingCommandId }),
      createdAt: NOW
    })
  )
  const spatial = await createSpatialRuleEffectStore({ db: memory.store }).scope({
    encounterId,
    sceneId: scene.id
  })
  if (!spatial) throw new Error('The Scene binding is missing.')
  const spatialEffectIds: string[] = []
  for (const { moving, ...effect } of config.spatialEffects ?? []) {
    const { id } = await spatial.create(
      await spatialDamageEffect({
        encounterId,
        targetActorId: config.moverActorId,
        ...effect,
        moving: moving && { ...moving, sourceTokenId: moverTokenId }
      })
    )
    spatialEffectIds.push(id)
  }
  const dependentEffectIds: string[] = []
  if (config.concentration) {
    const effects = createActiveRuleEffectStore({ db: memory.store })
    const concentrationOwnerId = config.concentrationOwnerActorId ?? config.moverActorId
    await effects.createMaintainedState({
      id: CONCENTRATION_STATE_ID,
      encounterId,
      ownerActorId: concentrationOwnerId,
      descriptor: await concentrationDescriptor(concentrationOwnerId),
      occurredAt: NOW
    })
    for (const [index, targetActorId] of (config.concentrationDependentActorIds ?? []).entries()) {
      const { id } = await effects.create({
        id: testUuid(0x5100 + index),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId },
        maintainedEffectStateId: CONCENTRATION_STATE_ID,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 },
        definition: dependentEffectDefinition({ encounterId, sourceActorId: concentrationOwnerId }),
        occurredAt: NOW
      })
      dependentEffectIds.push(id)
    }
  }
  await config.seed?.({
    effects: createActiveRuleEffectStore({ db: memory.store }),
    spatial,
    encounterId,
    occurredAt: NOW,
    tokenIdOf: (actorId) => tokenIdByActorId.get(actorId)!
  })
  // A Character's dependents are rows of the Character, loaded with it, not of the Run.
  const characterOfActor = new Map(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [[actor.id, actor.sourceId]] : []))
  )
  const characterDependents = memory
    .documents('encounterActiveRuleEffects')
    .filter((row) => characterOfActor.has(row.targetActorId))
  const characterDependentRowIds = new Set<string>(characterDependents.map((row) => row._id))
  const run: Extract<LiveRoomInputsResponse, { kind: 'RUN' }> = {
    kind: 'RUN',
    encounterVersion: state.version,
    activeEncounterId: null,
    maintenanceCharacterOwners: [
      ...new Map(
        characterDependents.flatMap((row) =>
          row.maintainedEffectStateId
            ? [
                [
                  `${row.maintainedEffectStateId}:${characterOfActor.get(row.targetActorId)}`,
                  {
                    maintainedStateId: row.maintainedEffectStateId,
                    characterId: characterOfActor.get(row.targetActorId)!
                  }
                ] as const
              ]
            : []
        )
      ).values()
    ],
    documents: memoryRoomDocuments(memory, [
      'encounterRuns',
      'encounterRunActors',
      'encounterActorSnapshots',
      'encounterSourceProjectionFacts',
      'encounterInitiativeRounds',
      'encounterInitiativeParticipants',
      'encounterActorTokenBindings',
      'encounterSceneBindings',
      'encounterSpatialRuleEffects',
      'encounterMaintainedEffectStates',
      'encounterActiveRuleEffects',
      'encounterSpellPins'
    ]).filter((document) => !characterDependentRowIds.has(document.id)),
    continueCursor: null
  }
  const characterInputs = {
    parts: [
      ...(characterPage?.parts ?? []).map((part) => ({ part, partCharacterId: characterId })),
      ...(outsideCasterPage?.parts ?? []).map((part) => ({
        part: withOwnRowIds(part, 'outside'),
        partCharacterId: config.outsideCasterCharacterId
      })),
      ...(secondCharacterPage?.parts ?? []).map((part) => ({
        part: withOwnRowIds(part, 'second'),
        partCharacterId: config.secondCharacter?.characterId
      })),
      ...(thirdCharacterPage?.parts ?? []).map((part) => ({
        part: withOwnRowIds(part, 'third'),
        partCharacterId: config.thirdCharacter?.characterId
      }))
    ].map(({ part, partCharacterId }) => {
      if (part.status !== 'ASSIGNED') throw new Error('The Character fixture part is not assigned.')
      return {
        ...part,
        documents: [
          ...part.documents,
          ...characterDependents
            .filter((row) => characterOfActor.get(row.targetActorId) === partCharacterId)
            .map((row) => ({
              table: 'characterActiveRuleEffects' as const,
              id: row._id,
              creationTime: row._creationTime,
              fields: characterActiveRuleEffectStoredSchema.parse({
                id: row.id,
                characterId: characterOfActor.get(row.targetActorId),
                concentrationCasterCharacterId:
                  row.lifecycle.concentrationCasterCharacterId ?? null,
                sourceEncounterId: sourceEncounterIdForDefinition(
                  activeRuleEffectDefinitionDtoSchema.parse(JSON.parse(row.definitionJson)),
                  row.maintainedEffectStateId
                ),
                maintainedEffectStateId: row.maintainedEffectStateId,
                createdOrdinal: row.createdOrdinal,
                version: row.version,
                definitionJson: row.definitionJson,
                definitionChecksum: row.definitionChecksum,
                lifecycle: row.lifecycle,
                lifecycleChecksum: row.lifecycleChecksum,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt
              })
            }))
        ]
      }
    }),
    system: characterPage?.system ?? srdSystemRoomInputs(campaignId),
    contentSnapshots: characterPage?.contentSnapshots,
    run
  }
  const definitions = [
    ...SRD_REUSABLE_DEFINITIONS.map(currentSrdDefinition),
    ...reactionPolicyDefinitions,
    ...(config.definitions ?? [])
  ].map((definition) =>
    liveRoomDefinitionSchema.parse({ id: definition.id, sourceKind: 'PLATFORM', definition })
  )
  const autoRollUserIds =
    config.autoRoll === 'GAME_MASTER'
      ? [base.userId]
      : config.autoRoll === 'PLAYER'
        ? [base.playerId]
        : config.autoRoll === 'BOTH'
          ? [base.userId, base.playerId]
          : config.autoRoll === 'EVERYONE'
            ? [base.userId, base.playerId, base.otherPlayerId, thirdPlayerId]
            : []
  /** Set it where a test changes the room's members, as Convex bumps it on every such change. */
  const campaignRevision: { current: string | null } = { current: null }
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === ROOM_AUTHORIZATION_PATH)
      return Response.json(
        roomAuthorizationResponse({
          members: base.authorization.members,
          campaignRevision: campaignRevision.current,
          assignments,
          characterRevisions: [
            ...(characterPage
              ? [{ characterId: characterId!, revision: characterPage.characterRevision }]
              : []),
            ...(outsideCasterPage
              ? [
                  {
                    characterId: config.outsideCasterCharacterId!,
                    revision: outsideCasterPage.characterRevision
                  }
                ]
              : []),
            ...(secondCharacterPage
              ? [
                  {
                    characterId: config.secondCharacter!.characterId,
                    revision: secondCharacterPage.characterRevision
                  }
                ]
              : []),
            ...(thirdCharacterPage
              ? [
                  {
                    characterId: config.thirdCharacter!.characterId,
                    revision: thirdCharacterPage.characterRevision
                  }
                ]
              : [])
          ],
          autoRollUserIds,
          play: {
            encounter: {
              encounterId,
              sceneId: scene.id,
              healthDisplayDefault: state.healthDisplayDefault,
              actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
                id,
                kind,
                sourceId,
                controllerUserIds,
                healthDisplay
              })),
              tokens: actors.map(({ id }) => ({
                actorId: id,
                tokenId: tokenIdByActorId.get(id)!
              }))
            }
          }
        })
      )
    if (pathname !== ROOM_INPUTS_PATH) return undefined
    const { scope } = liveRoomInputsInputSchema.parse(await request.json())
    // The Scene scopes stay with the base room's raw Scene.
    if (scope.kind === 'SCENE' || scope.kind === 'SCENE_DEFINITION') return undefined
    return Response.json(
      roomInputsResponse(scope, {
        campaignId,
        systemId: SRD_SYSTEM_ID,
        ownerUserId: base.userId,
        members: base.authorization.members,
        assignments,
        characterInputs,
        definitions,
        campaignClockMinute: config.campaignClockMinute
      })
    )
  })
  const diceDrawn = rigDice(config.rolls ?? [], config.fallbackRoll ?? 8)
  await synchronizeScene(base, scene)

  /** Sends one frame on `channel` and waits for the room's answer to `commandId`. */
  async function sendOn(channel: RoomChannel, commandId: string, command: Record<string, unknown>) {
    const first = channel.messages.length
    channel.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command
      })
    )
    return vi.waitFor(() => {
      const answer = channel.messages
        .slice(first)
        .find(
          (
            message
          ): message is Extract<
            LiveSessionWebSocketServerMessageDto,
            { type: 'COMMAND_COMMITTED' | 'COMMAND_REJECTED' }
          > =>
            (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
            message.commandId === commandId
        )
      if (!answer)
        throw new Error(
          `The room has not answered the command. It sent: ${JSON.stringify(
            base.messages.slice(first).map((message) => message.type)
          )}`
        )
      return answer
    }, ROOM_REPLY_WAIT)
  }

  /** The Encounter's one PENDING movement decision, as the room stored it; null when none waits. */
  function pending() {
    return runInDurableObject(base.stub, async (_instance, context) => {
      const room = new RoomEncounterStore(context.storage)
      const occurrence = room
        .documents('encounterRuleOccurrences')
        .find((candidate) => candidate.state === 'PENDING')
      if (!occurrence) return null
      const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
      if (!snapshot) throw new Error('The pending occurrence holds no snapshot.')
      return {
        occurrence,
        encounterVersion: room.documents('encounterRuns')[0]!.version,
        ...readEncounterMovementPendingContext(snapshot)
      }
    })
  }

  /** The room's commands, sent on one socket: the GM's or a player's. */
  const commandsOn = (channel: RoomChannel) => {
    const send = (commandId: string, command: Record<string, unknown>) =>
      sendOn(channel, commandId, command)
    const moveToken = (
      movementKind: 'VOLUNTARY' | 'TELEPORT',
      path: readonly ScenePoint[],
      expectedEncounterVersion: number,
      expectedSceneVersion: number,
      tokenId: string,
      carefully = false
    ) => {
      const commandId = crypto.randomUUID()
      return send(commandId, {
        scope: 'SCENE',
        command: {
          type: 'MOVE_SCENE_TOKEN',
          commandId,
          correlationId: null,
          expectedEncounterVersion,
          expectedSceneVersion,
          movementKind,
          path,
          sceneId: scene.id,
          tokenId,
          ...(carefully ? { carefully } : {})
        }
      })
    }
    return {
      send,
      /** The mover (or the Token `tokenId` names) walks `path`, a voluntary move through the room's Scene command. */
      move(
        path: readonly ScenePoint[],
        expectedEncounterVersion: number = state.version,
        expectedSceneVersion: number = scene.version,
        tokenId: string = moverTokenId,
        carefully = false
      ) {
        return moveToken(
          'VOLUNTARY',
          path,
          expectedEncounterVersion,
          expectedSceneVersion,
          tokenId,
          carefully
        )
      },
      /** The mover (or the Token `tokenId` names) teleports from the path's origin to its destination. */
      teleport(
        path: readonly [ScenePoint, ScenePoint],
        expectedEncounterVersion: number = state.version,
        expectedSceneVersion: number = scene.version,
        tokenId: string = moverTokenId
      ) {
        return moveToken('TELEPORT', path, expectedEncounterVersion, expectedSceneVersion, tokenId)
      },
      /** Answers the PENDING movement decision with `resolution`. */
      async respond(resolution: Record<string, unknown>, expectedOccurrenceVersion?: number) {
        const decision = await pending()
        if (!decision) throw new Error('No movement decision is pending.')
        const commandId = crypto.randomUUID()
        return send(commandId, {
          scope: 'ENCOUNTER',
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId,
            commandId,
            expectedVersion: decision.encounterVersion,
            occurrenceId: decision.occurrence.id,
            expectedOccurrenceVersion: expectedOccurrenceVersion ?? decision.occurrence.version,
            correlationId: null,
            resolution
          }
        })
      }
    }
  }

  return {
    base,
    campaignId,
    campaignRevision,
    encounterId,
    /** The Run's version when the room was built. */
    encounterVersion: state.version,
    moverActorId: config.moverActorId,
    /** The Concentration-maintained effects, in `concentrationDependentActorIds` order. */
    dependentEffectIds,
    /** The spatial effects' ids, in `spatialEffects` order. */
    spatialEffectIds,
    /** How many dice the room has rolled since the room was built. */
    diceDrawn,
    scene,
    moverTokenId,
    ...commandsOn(base),
    /**
     * The same commands sent on the socket of the room's player (`PLAYER`) or its second player
     * (`OTHER_PLAYER`), whom the room's admission and actor control judge as any other player.
     */
    async asPlayer(who: 'PLAYER' | 'OTHER_PLAYER' = 'PLAYER') {
      return commandsOn(await connectPlayer(base, who))
    },
    pending,
    /**
     * The PENDING movement decision as a viewer reads it: the GM (`isOwner`) or a player who controls
     * every actor, with the rules-owned reason labels the pending read adds.
     */
    pendingFor(isOwner: boolean) {
      return runInDurableObject(base.stub, async (_instance, context) => {
        const room = new RoomEncounterStore(context.storage)
        const occurrence = room
          .documents('encounterRuleOccurrences')
          .find((candidate) => candidate.state === 'PENDING')
        if (!occurrence) return null
        const pendingSnapshot = await readPendingSnapshot({ db: room.store }, occurrence)
        if (!pendingSnapshot) throw new Error('The pending occurrence holds no snapshot.')
        return projectEncounterSpatialOccurrenceSummary(
          {
            id: occurrence.id,
            version: occurrence.version,
            state: occurrence.state,
            pendingSnapshot
          },
          room.documents('encounterRuns')[0]!.version,
          {
            controlledActorIds: new Set(room.documents('encounterRunActors').map(({ id }) => id)),
            isOwner
          },
          labelEncounterRollModeReasons(new Map())
        ).pending
      })
    },
    /** The room's committed rule receipts in commit order, parsed. */
    receipts() {
      return runInDurableObject(base.stub, async (_instance, context) =>
        new RoomEncounterStore(context.storage)
          .documents('encounterRuleReceipts')
          .map(({ commandId, actorUserId, commandType, commandMetadataJson, resultJson }) => ({
            commandId,
            actorUserId,
            commandType,
            metadata: JSON.parse(commandMetadataJson) as unknown,
            result: JSON.parse(resultJson) as unknown
          }))
      )
    }
  }
}
