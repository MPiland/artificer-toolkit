import type { GenericDatabaseReader } from 'convex/server'
import type { CharacterCollectionTable } from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import type { DataModel, Doc, TableNames } from '../_generated/dataModel'

// The Sheet fingerprint's inputs (ADR 0041 Amendment 1, D215), declared once beside
// `readCharacterSheetFingerprint`. `lib/mutations.ts` registers a trigger for every queued input,
// so every tracked write queues the stores it moves in its own transaction; the structural test
// (`sheetFingerprintInputs.test.ts`) fails when the fingerprint reads a table missing here. Every
// tracked mutation loads this module, so it imports no fingerprint or derivation code.

/** A Character whose Sheet store a write queues, or a Campaign whose party's stores it queues. */
export type CharacterSheetStoreTarget = { characterId: string } | { campaignId: string }

type SheetInputChange<TableName extends TableNames> = {
  oldDoc: Doc<TableName> | null
  newDoc: Doc<TableName> | null
}

export type CharacterSheetInput<TableName extends TableNames> =
  | {
      // Method syntax keeps each table's declaration assignable where all of them are registered.
      queue(
        db: GenericDatabaseReader<DataModel>,
        change: SheetInputChange<TableName>
      ): CharacterSheetStoreTarget[] | Promise<CharacterSheetStoreTarget[]>
    }
  /** Why no tracked write needs to queue a store for this input. */
  | { unqueued: string }

type CharacterRowTable =
  | CharacterCollectionTable
  | 'characterPlayStates'
  | 'characterBuildStates'
  | 'campaignCharacterStates'
  | 'campaignCharacterAssignments'

/**
 * The row's own Character, when a write inserts or deletes the row or changes what the Sheet reads
 * from it (`read`, the whole row by default); a write that leaves that alone queues nothing.
 */
function ownCharacter<TableName extends CharacterRowTable>(
  read: (doc: Doc<TableName>) => unknown = (doc) => doc
) {
  return {
    queue: (_: unknown, { oldDoc, newDoc }: SheetInputChange<TableName>) =>
      !oldDoc || !newDoc || JSON.stringify(read(oldDoc)) !== JSON.stringify(read(newDoc))
        ? [{ characterId: (newDoc ?? oldDoc)!.characterId }]
        : []
  }
}

const allFields = ownCharacter()

/**
 * Whether a member has content shared into the Campaign. Share validity reads the sharer's active
 * membership, so only such a member's status or role change moves what the party reads.
 */
export async function memberSharesContent(
  db: GenericDatabaseReader<DataModel>,
  campaignId: string,
  userId: string
) {
  const share = await db
    .query('campaignContentShares')
    .withIndex('by_campaignId_sharedBy', (q) =>
      q.eq('campaignId', campaignId).eq('sharedBy', userId)
    )
    .first()
  return share !== null
}

/** The Character, while it is ACTIVE: a new Character's draft and route exist before its Sheet. */
async function activeCharacter(db: GenericDatabaseReader<DataModel>, characterId: string) {
  const character = await db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', characterId))
    .unique()
  return character?.status === 'ACTIVE' ? [{ characterId }] : []
}

/** A USER source belongs to its owner's Characters in its System; PLATFORM sources are seeded. */
async function sourceOwnerCharacters(db: GenericDatabaseReader<DataModel>, sourceId: string) {
  const source = await db
    .query('contentSources')
    .withIndex('by_publicId', (q) => q.eq('id', sourceId))
    .unique()
  return source ? ownedCharacters(db, source) : []
}

async function ownedCharacters(
  db: GenericDatabaseReader<DataModel>,
  source: Pick<Doc<'contentSources'>, 'kind' | 'ownerUserId' | 'gameSystemId'>
) {
  const { ownerUserId } = source
  if (source.kind !== 'USER' || !ownerUserId) return []
  const characters = await db
    .query('characters')
    .withIndex('by_userId_systemId_id', (q) =>
      q.eq('userId', ownerUserId).eq('systemId', source.gameSystemId)
    )
    .collect()
  return characters.map((character) => ({ characterId: character.id }))
}

export const characterSheetInputs: { [TableName in TableNames]?: CharacterSheetInput<TableName> } =
  {
    // A DRAFT-status Character has no Sheet until its first commit makes it ACTIVE.
    characters: {
      queue: (_, { oldDoc, newDoc }) =>
        oldDoc?.status === 'ACTIVE' || newDoc?.status === 'ACTIVE'
          ? [{ characterId: (newDoc ?? oldDoc)!.id }]
          : []
    },
    // The fingerprint reads the play checksum, not the stream version or the stored stats.
    characterPlayStates: ownCharacter<'characterPlayStates'>((play) => play.checksum),
    characterBuildStates: ownCharacter<'characterBuildStates'>((build) => build.checksum),
    characterInventoryItems: allFields,
    characterCurrencyGroups: allFields,
    characterClassSpellStates: allFields,
    characterSpellCustomizations: allFields,
    characterCreatureInstances: allFields,
    characterVehicleInstances: allFields,
    characterNotes: allFields,
    characterNoteGroups: allFields,
    characterExtraEquipment: allFields,
    // An active Character's Sheet shows whether a Builder draft is open; a draft save changes
    // nothing it reads.
    characterDrafts: {
      queue: (db, { oldDoc, newDoc }) =>
        oldDoc && newDoc ? [] : activeCharacter(db, (newDoc ?? oldDoc)!.characterId)
    },
    authoredRouteIds: {
      queue: (db, { oldDoc, newDoc }) => {
        const route = (newDoc ?? oldDoc)!
        return route.subjectKind === 'CHARACTER' ? activeCharacter(db, route.subjectId) : []
      }
    },
    // An effect is read by its owner's Sheet and, while it carries Concentration, its caster's.
    characterActiveRuleEffects: {
      queue: (_, { oldDoc, newDoc }) =>
        [
          ...new Set(
            [oldDoc, newDoc].flatMap((effect) =>
              effect
                ? [effect.characterId, effect.concentrationCasterCharacterId ?? effect.characterId]
                : []
            )
          )
        ].map((characterId) => ({ characterId }))
    },
    campaignCharacterStates: ownCharacter<'campaignCharacterStates'>((state) => state.checksum),
    campaignCharacterAssignments: allFields,
    campaigns: {
      queue: (_, { oldDoc, newDoc }) =>
        oldDoc &&
        newDoc &&
        JSON.stringify(characterSheetCampaignFields(oldDoc)) !==
          JSON.stringify(characterSheetCampaignFields(newDoc))
          ? [{ campaignId: newDoc.id }]
          : []
    },
    campaignCurrencySystems: {
      queue: (_, { oldDoc, newDoc }) => [{ campaignId: (newDoc ?? oldDoc)!.campaignId }]
    },
    // A Sheet reads two memberships: its Character owner's (Campaign authority) and, for shared
    // content, the member who shared it. So a status or role change queues that member's assigned
    // Character, and the whole party only when the member shared content (D216).
    campaignMemberships: {
      queue: async (db, { oldDoc, newDoc }) => {
        if (!oldDoc || (newDoc && oldDoc.status === newDoc.status && oldDoc.role === newDoc.role))
          return []
        const { campaignId, userId } = oldDoc
        const assignment = await db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', campaignId).eq('userId', userId)
          )
          .unique()
        return [
          ...(assignment ? [{ characterId: assignment.characterId }] : []),
          ...((await memberSharesContent(db, campaignId, userId)) ? [{ campaignId }] : [])
        ]
      }
    },
    campaignDeletionJobs: {
      unqueued:
        'Campaign authority refuses every Sheet read while a deletion runs, and the assignment deletes that end it queue each Character.'
    },
    contentSnapshotHeads: {
      queue: (db, { oldDoc, newDoc }) => {
        const head = (newDoc ?? oldDoc)!
        if (oldDoc?.revision === newDoc?.revision) return []
        return head.scope === 'CAMPAIGN'
          ? [{ campaignId: head.scopeId }]
          : sourceOwnerCharacters(db, head.scopeId)
      }
    },
    // The derivation reads the whole source row, so any change to it queues.
    contentSources: {
      queue: (db, { oldDoc, newDoc }) => ownedCharacters(db, (newDoc ?? oldDoc)!)
    },
    rulesCatalogues: {
      unqueued:
        'Platform catalogues change only when a deployment seeds or imports its System; that would queue every Character in it.'
    },
    systemChecksums: {
      unqueued:
        'A System changes only when a deployment seeds or imports it; that would queue every Character in it.'
    }
  }

/** The Campaign fields a Sheet derivation reads; notebook and counter patches leave them alone. */
export function characterSheetCampaignFields(campaign: Doc<'campaigns'>) {
  return {
    id: campaign.id,
    ownerUserId: campaign.ownerUserId,
    gameSystemId: campaign.gameSystemId,
    status: campaign.status,
    contentMaturity: campaign.contentMaturity ?? null,
    attunementSlotOverride: campaign.attunementSlotOverride ?? null,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  }
}
