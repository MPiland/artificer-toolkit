import { describe, expect, it } from 'vitest'
import type { GmCampaignRollDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  collectRuleRollCard,
  postTableRollCards,
  recordRuleRollCard,
  type TableRollCardBatch
} from '../ruleRollCards.js'

const OWNER_ID = 'owner'
const PLAYER_ID = 'player'
const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000000e1'
const ACTOR_ID = '00000000-0000-4000-8000-0000000000a1'

const roll = { id: 'table-roll', createdAt: '2026-10-14T00:00:00.000Z' } as unknown as RollRecordDto
const gmRoll = {
  id: 'table-roll',
  createdAt: '2026-10-14T00:00:00.000Z',
  gm: true
} as unknown as RollRecordDto

/** A Campaign actor with the controllers, visibility and membership under test. */
function actorOf(options: { controllerUserIds: string[]; public: boolean }) {
  return {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    sourceId: null,
    label: 'Mira',
    ...options
  } as unknown as EncounterRunActorState
}

type Retained = { userId: string; roll: RollRecordDto; binding: GmCampaignRollDto | null }
type Post = { author: string; nonce: string; rolls: RollRecordDto[] }

/** Ports that record every table post and private retention instead of writing them. */
function recordingCtx(
  posted: RollRecordDto[],
  retained: Retained[],
  playerStatus: 'ACTIVE' | 'LEFT' = 'ACTIVE',
  posts: Post[] = []
) {
  return {
    db: {
      query: () => ({
        withIndex: (
          _name: string,
          build: (q: { eq: (...args: unknown[]) => unknown }) => unknown
        ) => {
          const q = { eq: () => q }
          build(q)
          return { unique: async () => ({ status: playerStatus }) }
        }
      })
    },
    ports: {
      readGmRollVisibility: async () => 'PRIVATE',
      requireCampaignAuthority: async () => ({}),
      insertTableRoll: async (
        _authority: unknown,
        author: string,
        nonce: string,
        posting: RollRecordDto[]
      ) => {
        posted.push(...posting)
        posts.push({ author, nonce, rolls: posting })
        return null
      },
      retainPrivateRoll: async (
        userId: string,
        retaining: RollRecordDto,
        binding: GmCampaignRollDto | null
      ) => {
        retained.push({ userId, roll: retaining, binding })
      }
    }
  } as unknown as Parameters<typeof recordRuleRollCard>[0]
}

/** Records a card against recording ports; returns the answer and every retention and table post. */
async function record(
  actor: EncounterRunActorState,
  options: { playerStatus?: 'ACTIVE' | 'LEFT'; withGmRoll?: boolean } = {}
) {
  const posted: RollRecordDto[] = []
  const retained: Retained[] = []
  const ctx = recordingCtx(posted, retained, options.playerStatus)
  const answer = await recordRuleRollCard(ctx, {
    campaign: { id: 'campaign', ownerUserId: OWNER_ID } as Parameters<
      typeof recordRuleRollCard
    >[1]['campaign'],
    encounterId: ENCOUNTER_ID,
    roller: actor,
    initiatorUserId: PLAYER_ID,
    visibility: undefined,
    clientNonce: 'nonce',
    roll,
    gmRoll: options.withGmRoll ? gmRoll : undefined
  })
  return { answer, posted, retained }
}

describe('recordRuleRollCard routing for a private card', () => {
  it('keeps a hidden player actor’s card for the GM and for the player, never the table', async () => {
    const { answer, posted, retained } = await record(
      actorOf({ controllerUserIds: [PLAYER_ID], public: false })
    )
    expect(answer).toMatchObject({ audience: 'PRIVATE', entry: null, playerCopyUserId: PLAYER_ID })
    expect(posted).toEqual([])
    expect(retained).toEqual([
      {
        userId: OWNER_ID,
        roll,
        binding: {
          campaignId: 'campaign',
          creature: { encounterId: ENCOUNTER_ID, actorId: ACTOR_ID },
          revealedAt: null,
          noticedAt: null
        }
      },
      { userId: PLAYER_ID, roll, binding: null }
    ])
  })

  it('gives the player the generic roll and the GM the sight-adjusted one', async () => {
    const { retained } = await record(actorOf({ controllerUserIds: [PLAYER_ID], public: false }), {
      withGmRoll: true
    })
    expect(retained.map(({ userId, roll: kept }) => [userId, kept])).toEqual([
      [OWNER_ID, gmRoll],
      [PLAYER_ID, roll]
    ])
  })

  it('keeps a GM-controlled hidden actor’s card for the GM alone', async () => {
    const { answer, posted, retained } = await record(
      actorOf({ controllerUserIds: [], public: false })
    )
    expect(answer).toMatchObject({ audience: 'PRIVATE', entry: null, playerCopyUserId: null })
    expect(posted).toEqual([])
    expect(retained.map(({ userId }) => userId)).toEqual([OWNER_ID])
  })

  it('keeps a hidden actor’s card for the GM alone once its controller left the Campaign', async () => {
    const { answer, retained } = await record(
      actorOf({ controllerUserIds: [PLAYER_ID], public: false }),
      { playerStatus: 'LEFT' }
    )
    expect(answer).toMatchObject({ audience: 'PRIVATE', playerCopyUserId: null })
    expect(retained.map(({ userId }) => userId)).toEqual([OWNER_ID])
  })
})

describe('recordRuleRollCard routing for a table card', () => {
  it('still posts a public player actor’s card to the table and retains nothing for the player', async () => {
    const { answer, posted, retained } = await record(
      actorOf({ controllerUserIds: [PLAYER_ID], public: true })
    )
    expect(answer).toMatchObject({ audience: 'TABLE', playerCopyUserId: null })
    expect(posted).toEqual([roll])
    expect(retained).toEqual([])
  })

  it('posts a standalone roll as a one-roll list under the caller’s nonce', async () => {
    const posts: Post[] = []
    const ctx = recordingCtx([], [], 'ACTIVE', posts)
    await recordRuleRollCard(ctx, {
      campaign: { id: 'campaign', ownerUserId: OWNER_ID } as Parameters<
        typeof recordRuleRollCard
      >[1]['campaign'],
      encounterId: ENCOUNTER_ID,
      roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }),
      initiatorUserId: PLAYER_ID,
      visibility: undefined,
      clientNonce: 'command-nonce',
      roll
    })
    expect(posts).toEqual([{ author: PLAYER_ID, nonce: 'command-nonce', rolls: [roll] }])
  })
})

const campaign = { id: 'campaign', ownerUserId: OWNER_ID } as Parameters<
  typeof collectRuleRollCard
>[2]['campaign']

/** An action's rolls, collected from each roller in turn and posted once at commit end. */
async function commitAction(
  rolls: { roller: EncounterRunActorState; roll: RollRecordDto }[],
  posted: RollRecordDto[] = [],
  retained: Retained[] = [],
  posts: Post[] = []
) {
  const ctx = recordingCtx(posted, retained, 'ACTIVE', posts)
  const batch: TableRollCardBatch = new Map()
  for (const { roller, roll: collected } of rolls)
    await collectRuleRollCard(ctx, batch, {
      campaign,
      encounterId: ENCOUNTER_ID,
      roller,
      initiatorUserId: PLAYER_ID,
      visibility: undefined,
      roll: collected
    })
  await postTableRollCards(ctx, { campaign, batch })
}

const rollNamed = (id: string) => ({ id }) as unknown as RollRecordDto

describe('an action’s table card', () => {
  it('holds every table roll of the action in the order rolled, in one card', async () => {
    const [attack, damage, save] = [rollNamed('attack'), rollNamed('damage'), rollNamed('save')]
    const posts: Post[] = []
    await commitAction(
      [
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: attack },
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: damage },
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: save }
      ],
      [],
      [],
      posts
    )
    expect(posts).toEqual([{ author: PLAYER_ID, nonce: 'attack', rolls: [attack, damage, save] }])
  })

  it('keeps a private roll of the same action out of the table card', async () => {
    const [open, hidden] = [rollNamed('open'), rollNamed('hidden')]
    const [posts, retained]: [Post[], Retained[]] = [[], []]
    await commitAction(
      [
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: open },
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: false }), roll: hidden }
      ],
      [],
      retained,
      posts
    )
    expect(posts).toEqual([{ author: PLAYER_ID, nonce: 'open', rolls: [open] }])
    expect(retained.map(({ userId, roll: kept }) => [userId, kept])).toEqual([
      [OWNER_ID, hidden],
      [PLAYER_ID, hidden]
    ])
  })

  it('posts one card per author when the rollers have different controllers', async () => {
    const [mine, theirs, mineAgain] = [rollNamed('mine'), rollNamed('theirs'), rollNamed('again')]
    const posts: Post[] = []
    await commitAction(
      [
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: mine },
        { roller: actorOf({ controllerUserIds: ['other'], public: true }), roll: theirs },
        { roller: actorOf({ controllerUserIds: [PLAYER_ID], public: true }), roll: mineAgain }
      ],
      [],
      [],
      posts
    )
    expect(posts).toEqual([
      { author: PLAYER_ID, nonce: 'mine', rolls: [mine, mineAgain] },
      { author: 'other', nonce: 'theirs', rolls: [theirs] }
    ])
  })

  it('posts nothing for an action whose rolls were all private', async () => {
    const posts: Post[] = []
    await commitAction(
      [
        {
          roller: actorOf({ controllerUserIds: [PLAYER_ID], public: false }),
          roll: rollNamed('hidden')
        }
      ],
      [],
      [],
      posts
    )
    expect(posts).toEqual([])
  })
})
