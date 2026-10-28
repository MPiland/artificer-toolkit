import type {
  EncounterReadPorts,
  EncounterPersistenceTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { readInitiativeSourceRoll } from '@artificer-toolkit/rules-runtime/encounterInitiativeRoll'
import { prepareEncounterInitiativeSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeSources'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { characterEncounterInitiativeResultSchema } from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import { resolveCurrentOptionalCombatSources } from '@artificer-toolkit/rules-runtime/optionalCombatSourceAccess'
import { validateOptionalCombatCheckDefinitions } from '@artificer-toolkit/authoring/reusableDefinitions'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  readCharacterPlay,
  readCharacterRecord,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import { characterHeadDocument, type RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

/** The Scene tokens the room draws for a member (ATTACK-17.3); null when the room cannot tell. */
export type RoomSceneTokens = EncounterReadPorts['readViewerSceneTokens']

/** The caller owns admission and the enclosing room transaction. */
export async function roomEncounterReadTransaction(input: {
  store: RoomEncounterStore
  transaction?: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  observed: LiveSessionRulesRevisions
  /**
   * The tokens the room's Scene draws for a member. Every path that presents a Run to a player
   * passes it; without it the host cannot tell and a player's list fails closed (ATTACK-17.3).
   */
  sceneTokens?: RoomSceneTokens
}): Promise<EncounterPersistenceTransaction> {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, observed } = input
  if (transaction) await inputs.authority(observed, transaction)
  const db = store.store
  const authority: EncounterReadPorts['requireCampaignAuthority'] = async (id, caller) => {
    if (id !== campaignId || store.epoch !== epoch)
      throw new Error('Room Campaign authority scope changed.')
    const member = authorization.campaign.members.find((entry) => entry.userId === caller)
    if (!member) throw new Error('Campaign access ended.')
    const [campaign, membership] = await Promise.all([
      db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique(),
      db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', id).eq('userId', caller))
        .unique()
    ])
    if (
      !campaign ||
      !membership ||
      campaign.status !== 'ACTIVE' ||
      membership.status !== 'ACTIVE' ||
      membership.role !== member.role ||
      membership.accessStartedAt !== member.membershipEpoch ||
      campaign.ownerUserId !== authorization.campaign.ownerUserId
    )
      throw new Error('Room Campaign authority facts are stale.')
    return { campaign, membership }
  }
  const readAssignedCharacter: EncounterReadPorts['readAssignedCharacter'] = async (
    campaign,
    member
  ) => {
    const assignment = await db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', member.userId)
      )
      .unique()
    if (!assignment) return null
    const [unique, part] = await Promise.all([
      db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', assignment.characterId))
        .unique(),
      inputs.character(assignment.characterId, observed, transaction)
    ])
    const row = part.inputs?.owner
    if (
      !row ||
      unique?._id !== assignment._id ||
      row.userId !== member.userId ||
      row.systemId !== campaign.gameSystemId
    )
      throw new Error('Stored Campaign Character assignment mismatch.')
    return { id: row.id }
  }
  const ports: EncounterReadPorts = {
    requireIdentity: async () => ({ userId, role: 'user' }),
    requireActiveLiveAuthority: async (scope) => {
      if (scope.campaignId !== campaignId || scope.epoch !== epoch || store.epoch !== epoch)
        throw new Error('Room live authority changed.')
    },
    requireCampaignAuthority: authority,
    requireCampaignCharacterAuthority: async (id, characterId, caller) => {
      const current = await authority(id, caller)
      const assignment = await db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      if (
        !assignment ||
        assignment.campaignId !== id ||
        (current.membership.role !== 'OWNER' && assignment.userId !== caller)
      )
        throw new Error('Assigned Character not found.')
      const member = await db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', id).eq('userId', assignment.userId)
        )
        .unique()
      if (
        !member ||
        member.status !== 'ACTIVE' ||
        (await readAssignedCharacter(current.campaign, member))?.id !== characterId
      )
        throw new Error('Stored Campaign Character assignment mismatch.')
      return { ...current, assignment }
    },
    requireSystem: async (systemId) => {
      const loaded = await inputs.system('SYSTEM', observed, transaction)
      if (!loaded.system || loaded.system.id !== systemId)
        throw new Error('Encounter Game System is unavailable.')
      return loaded.system
    },
    readContentLabel: async (id) => {
      const objects = await inputs.contentObjects(null, observed, transaction)
      for (const object of objects) {
        const root = object.roots.find((candidate) => candidate.id === id)
        if (root) return root.label
      }
      return (await inputs.definition(id, observed, transaction)).definition?.label ?? null
    },
    readEncounterSource: async (caller, systemId, id, kind) => {
      const current = await authority(campaignId, caller)
      if (current.campaign.gameSystemId !== systemId)
        throw new Error('Encounter source Game System mismatch.')
      const objects = await inputs.contentObjects(null, observed, transaction)
      const ordered = [...objects].sort(
        (left, right) => Number(left.scope === 'CAMPAIGN') - Number(right.scope === 'CAMPAIGN')
      )
      for (const object of ordered) {
        if (object.part !== 'documents' || object.kind !== kind) continue
        const index = object.roots.findIndex((root) => root.id === id)
        if (index < 0) continue
        const document = object.roots[index]!
        const pin = object.versions[index]!
        const compilation = object.compilations[index]!
        if (
          document.systemId !== systemId ||
          pin.identity.subjectId !== id ||
          pin.identity.subjectKind !== kind ||
          pin.identity.systemId !== systemId
        )
          throw new Error('Encounter source snapshot identity mismatch.')
        return {
          document,
          compilation,
          checksum: pin.identity.checksum,
          version: pin.version,
          versionId: pin.identity.versionId
        }
      }
      throw new Error('Encounter source is unavailable in the selected Game System.')
    },
    readCharacterRecord,
    readCharacterRow: async (id) => {
      const part = await inputs.character(id, observed, transaction)
      const head = await db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (!part.inputs || !head) return null
      // The head is restored with the inputs that carry it; a head from other inputs is stale.
      const { _id: _headId, _creationTime: _headCreated, ...headFields } = head
      if (
        checksumCanonicalJson(headFields) !==
        checksumCanonicalJson(characterHeadDocument(part.inputs.owner).fields)
      )
        throw new Error('Room Character structure is stale.')
      const play = await db
        .query('characterPlayStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', id))
        .unique()
      if (!play) throw new Error('Room Character play record is missing.')
      return { ...part.inputs.owner, ...head, play }
    },
    readCharacterSheetState,
    readCharacterPlay,
    readAssignedCharacter,
    readCampaignCharacterConditions: async (campaign, characterId) => {
      if (campaign.id !== campaignId) throw new Error('Room Campaign authority scope changed.')
      const part = await inputs.character(characterId, observed, transaction)
      if (
        !part.inputs ||
        part.inputs.campaign.id !== campaign.id ||
        part.inputs.owner.id !== characterId
      )
        throw new Error('Room Campaign Character state is unavailable.')
      return part.inputs.campaign.state.conditions
    },
    readCurrentDefinition: async (definitionId) =>
      (await inputs.definition(definitionId, observed, transaction)).definition,
    readAutoRollDice: async (id) => readRoomPreference(authorization, id).autoRollDice,
    readGmRollVisibility: async (id) => readRoomPreference(authorization, id).gmRollVisibility,
    isRoomHeldRun: async () => true,
    readViewerSceneTokens: input.sceneTokens ?? (async () => null),
    hasAccountProfile: async (id) => inputs.hasAccountProfile(id, transaction),
    readActorInitiativeRoll: async (state, campaign, actorId) => {
      if (campaign.id !== campaignId || state.campaignId !== campaignId)
        throw new Error('Encounter initiative Campaign authority mismatch.')
      const sources = await prepareEncounterInitiativeSources({
        state,
        campaignId,
        actors: await readRunActors({ db }, state),
        loadCharacter: async (actor) => {
          const facts = await prepareRoomLiveCharacterSheet(
            store,
            inputs,
            {
              campaignId,
              authorityEpoch: epoch,
              expectedUserId: campaign.ownerUserId,
              expectedRole: 'OWNER',
              characterId: actor.sourceId
            },
            observed,
            transaction
          )
          const { snapshot, registry, output } = facts.ruleEvaluation
          return characterEncounterInitiativeResultSchema.parse({
            streamVersion: facts.active.play.streamVersion,
            initiativeActorFacts: toCharacterInitiativeActorFacts({
              snapshot,
              registry,
              rulePolicyOutput: output
            }),
            rulePolicyOutput: output
          })
        }
      })
      const source = sources.actors.find((entry) => entry.actor.id === actorId)
      if (!source) throw new Error('Encounter initiative source was not found.')
      const { characterId, expression, rollMode } = readInitiativeSourceRoll(source)
      return { characterId, expression, rollMode }
    },
    snapshotOptionalCombatPolicies: async (campaign, caller, definitionIds) => {
      await authority(campaign.id, caller)
      const play = await inputs.play(observed, transaction)
      const system = await ports.requireSystem(campaign.gameSystemId)
      const sourceIds = new Set(play.contentSnapshots.sources.map((entry) => entry.contentSourceId))
      const optionalCombat = await resolveCurrentOptionalCombatSources({
        definitions: {
          requireCurrent: async (id) => {
            const current = (await inputs.definition(id, observed, transaction)).definition
            if (
              !current ||
              current.gameSystemId !== campaign.gameSystemId ||
              !sourceIds.has(current.contentSourceId)
            )
              throw new Error('Rule definition is not enabled for this Campaign.')
            return current
          }
        },
        readSystemVocabulary: async () => system,
        validateCheckDefinitions: validateOptionalCombatCheckDefinitions,
        gameSystemId: campaign.gameSystemId,
        definitionIds
      })
      const optionalCombatSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
        schemaVersion: 1,
        gameSystemId: campaign.gameSystemId,
        definitions: optionalCombat.map(({ current, document }) => ({
          definitionId: current.id,
          contentSourceId: current.contentSourceId,
          definitionVersion: current.version,
          definitionChecksum: current.checksum,
          contractVersion: current.contractVersion,
          label: current.label,
          document
        }))
      })
      return {
        optionalCombatSnapshot,
        optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot)
      }
    }
  }
  return { db, ports }
}

function readRoomPreference(authorization: LiveSessionRoomAuthorization, userId: string) {
  const preference = authorization.preferences.find((entry) => entry.userId === userId)
  if (!preference) throw new Error('Room roll preference is unavailable.')
  return preference
}
