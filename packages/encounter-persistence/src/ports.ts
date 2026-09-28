import type { AuthIdentityDto } from '@artificer-toolkit/schema/api/authIdentity'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
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
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
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
  readCharacterRecord(row: EncounterDocument<'characters'>): EncounterCharacterDocument
  readCharacterSheetState(row: EncounterDocument<'characters'>): CharacterSheetState
  readAssignedCharacter(
    campaign: EncounterDocument<'campaigns'>,
    membership: EncounterDocument<'campaignMemberships'>
  ): Promise<CampaignSummaryDto['assignedCharacter']>
  readAutoRollDice(userId: string): Promise<boolean>
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
  /** Logs a settled Concentration check as a rules roll entry, once per check. */
  recordConcentrationCheckRoll(input: {
    state: EncounterRunState
    result: StoredRuleExecutionResultDto
    authorUserId: string
    occurredAt: string
  }): Promise<void>
  /** Posts a rules message to the table chat as `authorUserId`, once per client nonce. */
  postRulesChatMessage(
    authority: CampaignAuthority,
    input: { authorUserId: string; clientNonce: string; body: string }
  ): Promise<void>
  /**
   * The single writer of a Character row: stores the document and Sheet state at the given stream
   * version and refreshes the Character's derived stats in the same transaction.
   */
  writeCharacterRecord(input: {
    current: EncounterDocument<'characters'>
    fields: { streamVersion: number; updatedAt: string }
    document?: unknown
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
  /** Runs a Sheet command on an Encounter Character for its Campaign's GM. */
  executeCharacterCommand(
    userId: string,
    input: CharacterEncounterCommandInput
  ): Promise<CharacterEncounterCommandResult>
}

/** A read transaction over the Encounter store and the ports it reads beside it. */
export interface EncounterReadTransaction extends EncounterReadContext {
  readonly ports: EncounterReadPorts
}

/** A write transaction over the Encounter store and the ports it uses beside it. */
export interface EncounterWriteTransaction<CharacterSources = never> extends EncounterWriteContext {
  readonly ports: EncounterWritePorts<CharacterSources>
}
