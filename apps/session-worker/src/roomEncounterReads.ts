import {
  readEncounterActionChoices,
  readEncounterOptionalActionChoices
} from '@artificer-toolkit/encounter-persistence/actionChoiceReads'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readLatestEvidenceRolls } from '@artificer-toolkit/encounter-persistence/evidenceRolls'
import type {
  CampaignAuthority,
  EncounterTurnReadTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import {
  presentSceneEncounterBinding,
  readBoundEncounterScene
} from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import type {
  EncounterReadDto,
  EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type {
  LiveSessionCommandRejectionCodeDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { DomainRejectionReasonDto } from '@artificer-toolkit/schema/api/domainRejections'
import { admitsRoomMember } from './roomAuthorization.js'
import type { FeedMember, FeedScope } from './roomCharacterSheetFeed.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import type { RoomEncounterStore } from './roomEncounterStore.js'
import { roomEncounterTurnReadTransaction } from './roomEncounterTurnReadPorts.js'
import { RoomInputsUnheldError, type RoomInputs } from './roomInputs.js'
import { readRoomScene } from './roomSceneRead.js'

type Refusal = {
  code: LiveSessionCommandRejectionCodeDto
  message: string
  reason: DomainRejectionReasonDto | null
}

const UNAVAILABLE: Refusal = {
  code: 'UNAVAILABLE',
  message: 'The room cannot answer this read.',
  reason: null
}

/** The read at the Run's current version, over the same readers as Convex's queries. */
async function readEncounter(
  tx: EncounterTurnReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    authority: CampaignAuthority
    read: EncounterReadDto
    store: RoomEncounterStore
    presentedSceneId: string | null
  }
): Promise<EncounterReadResultDto> {
  const { run, authority, read } = input
  switch (read.kind) {
    case 'ACTION_CHOICES':
      return {
        kind: read.kind,
        result: await readEncounterActionChoices(tx, {
          run,
          ...authority,
          request: { ...read.input, expectedVersion: run.version }
        })
      }
    case 'OPTIONAL_ACTION_CHOICES':
      return {
        kind: read.kind,
        result: await readEncounterOptionalActionChoices(tx, {
          run,
          ...authority,
          request: { ...read.input, expectedVersion: run.version }
        })
      }
    case 'LATEST_EVIDENCE_ROLLS':
      return { kind: read.kind, result: await readLatestEvidenceRolls(tx, { run, ...authority }) }
    case 'SCENE_BINDING': {
      const { binding } = await readBoundEncounterScene(
        tx,
        { run, campaign: authority.campaign, sceneId: read.input.sceneId },
        {
          readScene: async () => readRoomScene(input.store, read.input.sceneId),
          readPresentedSceneId: async () => input.presentedSceneId
        }
      )
      return { kind: read.kind, result: presentSceneEncounterBinding(run, binding) }
    }
    case 'ACTOR_TOKEN_BINDINGS': {
      const vision = await tx.ports.readViewerSceneTokens({
        userId: authority.membership.userId,
        role: authority.membership.role
      })
      if (vision?.sceneId !== read.input.sceneId) throw new RoomInputsUnheldError()
      const visible = vision.visibleTokenIds
      const rows = await tx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', run.id))
        .collect()
      return {
        kind: read.kind,
        result: rows
          .filter((row) => row.sceneId === read.input.sceneId && visible.has(row.tokenId))
          .map(({ actorId, encounterId, sceneId, tokenId }) => ({
            actorId,
            encounterId,
            sceneId,
            tokenId
          }))
      }
    }
  }
}

/**
 * Answers a member's version-keyed turn reads from the room's held Encounter state, with the
 * readers Convex's queries use. A read never loads from Convex: an input the room does not hold
 * current refuses it as UNAVAILABLE, and the client reads from Convex instead. The caller runs
 * each read on the room's command chain, so it sees one committed version.
 */
export class RoomEncounterReads {
  constructor(
    private readonly dependencies: {
      store: RoomEncounterStore
      inputs: RoomInputs
      /** The current play authorization, or null while the lease or the play inputs are stale. */
      authorization: (scope: FeedScope) => LiveSessionRoomAuthorization | null
      admission: (socket: WebSocket) => FeedMember | null
      scope: (socket: WebSocket) => FeedScope | null
      presentedSceneId: () => string | null
      sceneTokens: (scope: FeedScope) => RoomSceneTokens
      send: (socket: WebSocket, message: LiveSessionWebSocketServerMessageDto) => void
    }
  ) {}

  async answer(socket: WebSocket, message: { requestId: string; read: EncounterReadDto }) {
    const { requestId } = message
    const refusal = (value: Refusal) =>
      this.dependencies.send(socket, { ...value, requestId, type: 'ENCOUNTER_READ_REJECTED' })
    try {
      const { admission, authorization: current, scope: scopeOf } = this.dependencies
      const member = admission(socket)
      const scope = scopeOf(socket)
      const authorization = scope && current(scope)
      if (!member || !scope || !authorization)
        return refusal({
          code: 'AUTHORITY_CHANGED',
          message: 'Live Session authority changed.',
          reason: null
        })
      if (!admitsRoomMember(authorization, member))
        return refusal({ code: 'FORBIDDEN', message: 'Campaign access ended.', reason: null })
      const { read } = message
      const run = this.dependencies.store
        .documents('encounterRuns')
        .find((row) => row.id === read.input.encounterId && row.campaignId === scope.campaignId)
      if (!run) return refusal(UNAVAILABLE)
      const { store, inputs } = this.dependencies
      const tx = await roomEncounterTurnReadTransaction({
        store,
        inputs: inputs.heldOnly(),
        authorization,
        campaignId: scope.campaignId,
        epoch: scope.authorityEpoch,
        userId: member.userId,
        observed: inputs.revisions(scope.campaignId, authorization.revisions),
        sceneTokens: this.dependencies.sceneTokens(scope)
      })
      const authority = await tx.ports.requireCampaignAuthority(scope.campaignId, member.userId)
      this.dependencies.send(socket, {
        requestId,
        result: await readEncounter(tx, {
          run,
          authority,
          read,
          store,
          presentedSceneId: this.dependencies.presentedSceneId()
        }),
        type: 'ENCOUNTER_READ_RESULT',
        version: run.version
      })
    } catch (error) {
      if (error instanceof EncounterDomainRejection)
        return refusal({
          code: 'DOMAIN_REJECTED',
          message: error.data.message,
          reason: error.data.reason
        })
      if (!(error instanceof RoomInputsUnheldError))
        console.error('Live Session Encounter read failed.', error)
      refusal(UNAVAILABLE)
    }
  }
}
