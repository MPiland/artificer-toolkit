import type { AuthIdentityDto } from '@artificer-toolkit/schema/api/authIdentity'
import type { AuthoredStoredCompilation } from '@artificer-toolkit/schema/api/authoredPublication'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  GmCampaignRollDto,
  RollRecordDto,
  RollVisibilityDto
} from '@artificer-toolkit/schema/api/rolls'
import type {
  CharacterEncounterCommandInput,
  CharacterEncounterCommandResult
} from '@artificer-toolkit/schema/api/characterEncounter'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterOptionalCombatSnapshotDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { CharacterTurnFacts } from '@artificer-toolkit/rules-runtime/character/turnFacts'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CampaignCharacterState } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import type { CharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterActionSceneReaders } from './actionSceneInputs.js'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/** A stored Character's document, as the Sheet reads it. */
export type EncounterCharacterDocument = Omit<CharacterAuthoredDto, 'primaryRulesCatalogueId'>

export type CampaignAuthority = {
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
}

/** A published Creature, Equipment or Spell source an Encounter snapshot pins, with its stored compilation. */
export type EncounterAuthoredSource = {
  document: unknown
  checksum: string
  version: number
  versionId: string
  compilation: AuthoredStoredCompilation
}

/**
 * What the Encounter code needs from outside the Encounter store: content Convex owns (the room
 * loads it from snapshots), the Character and Scene domains' readers, and Campaign data the room
 * caches. Convex binds each to its transaction; nothing here writes.
 */
export interface EncounterReadPorts {
  /** The signed-in caller; the room's is its socket's user. */
  requireIdentity(): Promise<AuthIdentityDto>
  /** Refuses unless this Campaign's live authority is active at this epoch. */
  requireActiveLiveAuthority(input: { campaignId: string; epoch: string }): Promise<void>
  /** The member's active Campaign and membership; the room answers from its cached membership. */
  requireCampaignAuthority(campaignId: string, userId: string): Promise<CampaignAuthority>
  /** The Campaign's assignment of this Character, which the member must be allowed to read. */
  requireCampaignCharacterAuthority(
    campaignId: string,
    characterId: string,
    userId: string
  ): Promise<CampaignAuthority & { assignment: EncounterDocument<'campaignCharacterAssignments'> }>
  requireSystem(systemId: string): Promise<SystemAuthoredDto>
  /** The label of authored content or a reusable definition with this ID. */
  readContentLabel(id: string): Promise<string | null>
  readCharacterRecord(row: EncounterCharacterRow): EncounterCharacterDocument
  /** Complete Character assembly belongs to the Character domain, outside the Encounter store. */
  readCharacterRow(characterId: string): Promise<EncounterCharacterRow | null>
  readCharacterSheetState(row: EncounterCharacterRow): CharacterSheetState
  /** The play record's fields, verified against its checksum. */
  readCharacterPlay(play: EncounterDocument<'characterPlayStates'>): CharacterPlayState
  readAssignedCharacter(
    campaign: EncounterDocument<'campaigns'>,
    membership: EncounterDocument<'campaignMemberships'>
  ): Promise<{ id: string } | null>
  /**
   * The Campaign's own conditions on an assigned Character, which a Run projection layers on. The
   * Character must be the Campaign's assigned, ACTIVE Character in its System, as stored.
   */
  readCampaignCharacterConditions(
    campaign: EncounterDocument<'campaigns'>,
    characterId: string
  ): Promise<CampaignCharacterState['conditions']>
  /** The definition's current published version as `ownerUserId` reads it; null when it has none. */
  readCurrentDefinition(
    definitionId: string,
    ownerUserId: string
  ): Promise<ReusableDefinitionCurrentDto | null>
  readAutoRollDice(userId: string): Promise<boolean>
  /** The GM's remembered Public/Private roll toggle: it decides rolls the GM did not start. */
  readGmRollVisibility(userId: string): Promise<RollVisibilityDto>
  /**
   * The tokens this member can see on the Scene the room presents, by the map's own visibility
   * predicate (ATTACK-17.3). Null when the host cannot tell, as Convex's reactive reads cannot, so a
   * player's list fails closed: a bound creature is listed only when controlled or revealed.
   */
  readViewerSceneTokens(viewer: {
    userId: string
    role: EncounterDocument<'campaignMemberships'>['role']
  }): Promise<{ sceneId: string; visibleTokenIds: ReadonlySet<string> } | null>
  /** Whether a live room holds this open Run, so Convex leaves its actor departures to the room. */
  isRoomHeldRun(run: Pick<EncounterRunState, 'campaignId' | 'status'>): Promise<boolean>
  /** Whether the app profile of this user still exists (it goes last in account deletion). */
  hasAccountProfile(userId: string): Promise<boolean>
}

/**
 * Reads only commands make: authored sources, a Character's initiative and the optional-combat
 * policies to pin. A projection never needs them, so query transactions leave them out and their
 * module graphs stay small (RELIABILITY-21).
 */
export interface EncounterCommandReadPorts extends EncounterReadPorts {
  readEncounterSource(
    userId: string,
    systemId: string,
    id: string,
    kind: 'CREATURE' | 'EQUIPMENT' | 'SPELL'
  ): Promise<EncounterAuthoredSource>
  /** One actor's initiative roll as made: its expression and the Character's roll mode. */
  readActorInitiativeRoll(
    state: EncounterRunState,
    campaign: { id: string; ownerUserId: string },
    actorId: string
  ): Promise<{ characterId: string | null; expression: string; rollMode: string }>
  /** The Campaign's current optional-combat definitions, pinned for a Run. */
  snapshotOptionalCombatPolicies(
    campaign: EncounterDocument<'campaigns'>,
    userId: string,
    definitionIds: string[]
  ): Promise<{
    optionalCombatSnapshot: EncounterOptionalCombatSnapshotDto
    optionalCombatSnapshotChecksum: string
  }>
}

/**
 * What a turn's reads (movement targets, action choices) need beyond the Encounter reads: the
 * Character's current Sheet facts, the reusable definitions and the Scene rows. `TFacts` is the
 * host's own Character facts, which the readers pass through unchanged.
 */
export interface EncounterTurnReadPorts<
  TFacts extends CharacterTurnFacts = CharacterTurnFacts
> extends EncounterReadPorts {
  /**
   * The Character's current Sheet facts as the Campaign owner reads them, with its active rule
   * effects; null when the Character is unavailable.
   */
  readCharacterTurnFacts(
    campaign: EncounterDocument<'campaigns'>,
    characterId: string
  ): Promise<TFacts | null>
  /**
   * The System's published platform basic-action definitions, by label then id. Refuses a
   * catalogue beyond `MAX_BASIC_ACTION_CHOICES`.
   */
  listBasicActionDefinitions(
    gameSystemId: string,
    ownerUserId: string
  ): Promise<ReusableDefinitionCurrentDto[]>
  readonly sceneReaders: EncounterActionSceneReaders
}

/**
 * The writes the Encounter code makes outside the Encounter store. `CharacterSources` is the
 * caller's already-loaded Character rule sources, which a Character write may reuse.
 */
export interface EncounterWritePorts<CharacterSources = never> extends EncounterCommandReadPorts {
  /** Reads the Scene a GM command places into, such as an environmental zone's grid. */
  readonly sceneReaders: Pick<EncounterActionSceneReaders, 'readScene'>
  /** Posts an already-evaluated roll to the Campaign's table log, once per client nonce. */
  insertTableRoll(
    authority: CampaignAuthority,
    userId: string,
    clientNonce: string,
    roll: RollRecordDto
  ): Promise<CampaignChatEntryDto>
  /**
   * Retains a roll in one user's private history. The Campaign GM's copy (Q14) carries the
   * `gmCampaignRoll` binding to reveal it; players see nothing of it until the GM does. A player's
   * own copy of a hidden creature they control (D62) carries no binding. Retaining the same roll
   * again changes nothing.
   */
  retainPrivateRoll(
    userId: string,
    roll: RollRecordDto,
    gmCampaignRoll: GmCampaignRollDto | null
  ): Promise<void>
  /**
   * Logs a settled Concentration check as a rules roll entry, once per check. Returns the table
   * entry it posted; a private check posts none and is retained for the GM, and for the
   * player who controls the hidden creature, through `retainPrivateRoll`.
   */
  recordConcentrationCheckRoll(input: {
    state: EncounterRunState
    result: StoredRuleExecutionResultDto
    authorUserId: string
    occurredAt: string
  }): Promise<CampaignChatEntryDto | null>
  /** Posts a rules message to the table chat as `authorUserId`, once per client nonce. */
  postRulesChatMessage(
    authority: CampaignAuthority,
    input: { authorUserId: string; clientNonce: string; body: string }
  ): Promise<CampaignChatEntryDto>
  /**
   * The single writer of a Character row: stores the document and Sheet state at the given stream
   * version and refreshes the Character's derived stats in the same transaction.
   */
  writeCharacterRecord(input: {
    current: EncounterCharacterRow
    fields: { streamVersion: number; updatedAt: string }
    document?: EncounterCharacterDocument
    sheetState?: CharacterSheetState
    sourceContext?: CharacterSources
  }): Promise<void>
  /**
   * Frozen snapshots of the Blueprint enemies' current published sources. It may store the System
   * vocabulary snapshot they compile against.
   */
  snapshotBlueprintEnemies(
    userId: string,
    input: Pick<CreateEncounterBlueprintInputDto, 'gameSystemId' | 'enemies'>
  ): Promise<EncounterBlueprintDto['enemies']>
  /**
   * Runs a Sheet command on an Encounter Character for its Campaign's GM. `encounterId` names the
   * Run issuing it; the room commits it on the Run's held Character.
   */
  executeCharacterCommand(
    userId: string,
    input: CharacterEncounterCommandInput,
    encounterId: string
  ): Promise<CharacterEncounterCommandResult>
  /**
   * Reverts an action's forced movements on its Scene (D139), last first, refusing a token moved
   * since. Only the room settles forced movement, so only the room provides it.
   */
  restoreActionForcedMovements?(input: {
    encounterId: string
    commandId: string
    movements: readonly { sceneId: string; sceneCommandId: string }[]
  }): Promise<void>
  /**
   * Turns a token back to the facing an action's Change facing reaction found (ATTACK-12), refusing
   * a token moved or turned since. Only the room owns the Scene, so only the room provides it.
   */
  restoreActionFacing?(input: {
    encounterId: string
    commandId: string
    sceneId: string
    sceneCommandId: string
  }): Promise<void>
  /**
   * Takes the Scene tokens of conjured creatures off their Scene (D187b) when their effect ends or
   * their cast is reverted. `commandId` names the Encounter command that ends them. Only the room
   * owns the Scene, so only the room provides it.
   */
  removeSummonTokens?(input: {
    encounterId: string
    commandId: string
    tokens: readonly { sceneId: string; tokenId: string }[]
  }): Promise<void>
}

/** A read transaction over the Encounter store and the ports it reads beside it. */
export interface EncounterReadTransaction extends EncounterReadContext {
  readonly ports: EncounterReadPorts
}

/** A read transaction that also reads what a turn's choices and movement targets need. */
export interface EncounterTurnReadTransaction<
  TFacts extends CharacterTurnFacts = CharacterTurnFacts
> extends EncounterReadTransaction {
  readonly ports: EncounterTurnReadPorts<TFacts>
}

/** Stored projection reads need only the System vocabulary, verified Character play and the hold. */
export interface EncounterProjectionTransaction extends EncounterReadContext {
  readonly ports: Pick<EncounterReadPorts, 'requireSystem' | 'readCharacterPlay' | 'isRoomHeldRun'>
}

/** A write transaction over the Encounter store and the ports it uses beside it. */
export interface EncounterPersistenceTransaction extends EncounterWriteContext {
  readonly ports: EncounterCommandReadPorts
}

/** Commands that also write Character or communication state through the owning domains. */
export interface EncounterCharacterWriteTransaction<
  CharacterSources = never
> extends EncounterPersistenceTransaction {
  readonly ports: EncounterCommandReadPorts &
    Pick<
      EncounterWritePorts<CharacterSources>,
      | 'writeCharacterRecord'
      | 'restoreActionForcedMovements'
      | 'restoreActionFacing'
      | 'removeSummonTokens'
    >
}

export interface EncounterWriteTransaction<
  CharacterSources = never
> extends EncounterCharacterWriteTransaction<CharacterSources> {
  readonly ports: EncounterWritePorts<CharacterSources>
}
