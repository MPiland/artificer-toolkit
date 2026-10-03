import type { AuthIdentityDto } from '@artificer-toolkit/schema/api/authIdentity'
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
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { RollMode } from '@artificer-toolkit/shared/rolls'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CampaignCharacterState } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import type { CharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/** A stored Character's document, as the Sheet reads it. */
export type EncounterCharacterDocument = Omit<CharacterAuthoredDto, 'primaryRulesCatalogueId'>

export type CampaignAuthority = {
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
}

/** A published Creature or Equipment source an Encounter snapshot pins. */
export type EncounterAuthoredSource = {
  document: unknown
  checksum: string
  version: number
  versionId: string
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
  readEncounterSource(
    userId: string,
    systemId: string,
    id: string,
    kind: 'CREATURE' | 'EQUIPMENT'
  ): Promise<EncounterAuthoredSource>
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
  readAutoRollDice(userId: string): Promise<boolean>
  /** The GM's remembered Public/Private roll toggle: it decides rolls the GM did not start. */
  readGmRollVisibility(userId: string): Promise<RollVisibilityDto>
  /** Whether the app profile of this user still exists (it goes last in account deletion). */
  hasAccountProfile(userId: string): Promise<boolean>
  /** One actor's initiative roll as made: its expression and the Character's roll mode. */
  readActorInitiativeRoll(
    state: EncounterRunState,
    campaign: { id: string; ownerUserId: string },
    actorId: string
  ): Promise<{ characterId: string | null; expression: string; rollMode: RollMode }>
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
 * The writes the Encounter code makes outside the Encounter store. `CharacterSources` is the
 * caller's already-loaded Character rule sources, which a Character write may reuse.
 */
export interface EncounterWritePorts<CharacterSources = never> extends EncounterReadPorts {
  /** Posts an already-evaluated roll to the Campaign's table log, once per client nonce. */
  insertTableRoll(
    authority: CampaignAuthority,
    userId: string,
    clientNonce: string,
    roll: RollRecordDto
  ): Promise<CampaignChatEntryDto>
  /**
   * Retains a roll in the Campaign GM's private history (Q14): players see nothing of it until the
   * GM reveals it. Retaining the same roll again changes nothing.
   */
  retainGmRoll(
    userId: string,
    roll: RollRecordDto,
    gmCampaignRoll: GmCampaignRollDto
  ): Promise<void>
  /**
   * Logs a settled Concentration check as a rules roll entry, once per check. Returns the table
   * entry it posted; a private check posts none.
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
}

/** A read transaction over the Encounter store and the ports it reads beside it. */
export interface EncounterReadTransaction extends EncounterReadContext {
  readonly ports: EncounterReadPorts
}

/** Stored projection reads need only the System vocabulary and verified Character play. */
export interface EncounterProjectionTransaction extends EncounterReadContext {
  readonly ports: Pick<EncounterReadPorts, 'requireSystem' | 'readCharacterPlay'>
}

/** A write transaction over the Encounter store and the ports it uses beside it. */
export interface EncounterPersistenceTransaction extends EncounterWriteContext {
  readonly ports: EncounterReadPorts
}

/** Commands that also write Character or communication state through the owning domains. */
export interface EncounterCharacterWriteTransaction<
  CharacterSources = never
> extends EncounterPersistenceTransaction {
  readonly ports: EncounterReadPorts &
    Pick<EncounterWritePorts<CharacterSources>, 'writeCharacterRecord'>
}

export interface EncounterWriteTransaction<
  CharacterSources = never
> extends EncounterCharacterWriteTransaction<CharacterSources> {
  readonly ports: EncounterWritePorts<CharacterSources>
}
