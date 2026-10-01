import type {
  LiveRoomInputsResponse,
  LiveRoomInputsScope,
  LiveRoomInputsDocument
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import {
  campaignStoredRecordSchema,
  campaignStoredMembershipSchema,
  campaignStoredAssignmentSchema
} from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { LiveSessionTransientMember } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'

export const ROOM_INPUTS_PATH = LIVE_SESSION_ROUTE_PATHS.roomInputs

const zero = '00000000-0000-4000-8000-000000000000'
const revisions = (['SYSTEM', 'CAMPAIGN', 'PLAY'] as const).map((scope) => ({
  scope,
  id: zero,
  revision: null
}))
const fixtureTime = '2026-09-29T00:00:00.000Z'

/**
 * Empty Run and System inputs plus native Campaign authority fixtures. Callers supply their actual
 * membership and assignment facts, or complete native documents when metadata matters to the test.
 */
export function roomInputsResponse(
  scope: LiveRoomInputsScope,
  {
    campaignId,
    systemId,
    ownerUserId = zero,
    members = [],
    assignments = [],
    accountUserIds,
    authorityDocuments
  }: {
    campaignId: string
    systemId: string
    ownerUserId?: string
    members?: readonly LiveSessionTransientMember[]
    assignments?: LiveSessionRoomAuthorization['campaign']['assignments']
    accountUserIds?: readonly string[]
    authorityDocuments?: LiveRoomInputsDocument[]
  }
): LiveRoomInputsResponse {
  switch (scope.kind) {
    case 'CHAT_METADATA':
      return { kind: 'CHAT_METADATA', documents: [], continueCursor: null }
    case 'AUTHORITY': {
      const uniqueMembers = [...new Map(members.map((member) => [member.userId, member])).values()]
      const owner = uniqueMembers.find((member) => member.role === 'OWNER')?.userId ?? ownerUserId
      const document = (table: string, id: string, fields: Record<string, unknown>) => ({
        table,
        id,
        creationTime: Date.parse(fixtureTime),
        fields
      })
      return {
        kind: 'AUTHORITY',
        accountUserIds: [...(accountUserIds ?? uniqueMembers.map((member) => member.userId))],
        revisions: [
          { scope: 'SYSTEM', id: systemId, revision: null },
          { scope: 'CAMPAIGN', id: campaignId, revision: null }
        ],
        continueCursor: null,
        documents: authorityDocuments ?? [
          document(
            'campaigns',
            `fixture:campaign:${campaignId}`,
            campaignStoredRecordSchema.parse({
              id: campaignId,
              publicId: campaignId,
              name: 'Encounter execution fixture',
              description: null,
              format: 'ONGOING',
              toneTags: ['HEROIC'],
              toneDetails: null,
              contentMaturity: 'STANDARD',
              gameSystemId: systemId,
              primaryRulesCatalogueId: zero,
              additionalRulesCatalogueIds: [],
              status: 'ACTIVE',
              version: 1,
              createdAt: fixtureTime,
              updatedAt: fixtureTime,
              ownerUserId: owner,
              attunementSlotOverride: null
            })
          ),
          ...uniqueMembers.map((member) =>
            document(
              'campaignMemberships',
              `fixture:membership:${campaignId}:${member.userId}`,
              campaignStoredMembershipSchema.parse({
                campaignId,
                userId: member.userId,
                role: member.role,
                status: 'ACTIVE',
                accessStartedAt: member.membershipEpoch,
                joinedAt: member.membershipEpoch,
                leftAt: null
              })
            )
          ),
          ...assignments.map((assignment) =>
            document(
              'campaignCharacterAssignments',
              `fixture:assignment:${campaignId}:${assignment.userId}`,
              campaignStoredAssignmentSchema.parse({
                campaignId,
                ...assignment,
                assignedAt: fixtureTime
              })
            )
          )
        ]
      }
    }
    case 'RUN':
      return { kind: 'RUN', encounterVersion: 0, documents: [], continueCursor: null }
    case 'CAMPAIGN_PLAY':
      return {
        kind: 'CAMPAIGN_PLAY',
        revisions,
        contentSnapshots: {
          systemId,
          sources: [],
          campaign: {
            id: campaignId,
            contentMaturity: 'STANDARD',
            head: {
              scope: 'CAMPAIGN',
              scopeId: campaignId,
              revision: 0,
              builtRevision: 0,
              kinds: {}
            }
          }
        },
        campaign: {
          id: campaignId,
          gameSystemId: systemId,
          ownerUserId: members.find((member) => member.role === 'OWNER')?.userId ?? ownerUserId,
          contentMaturity: 'STANDARD',
          attunementSlotOverride: null,
          currencyOptions: []
        }
      }
    case 'SYSTEM':
      return { kind: 'SYSTEM', revisions, system: null, vocabulary: null }
    case 'DEFINITIONS':
      return {
        kind: 'DEFINITIONS',
        revisions: revisions.filter((entry) => entry.scope !== 'PLAY'),
        definitions: [],
        continueCursor: null
      }
    case 'CHARACTERS':
      throw new Error('A Character read needs a real Character page.')
    case 'SCENE':
      throw new Error('A Scene read needs raw native Scene documents.')
    case 'SCENE_DEFINITION':
      throw new Error('A Scene definition read needs immutable native Scene documents.')
  }
}
