import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import { verifyCampaignCollaborationBrowser } from '../../web/tests/live-backend/campaignCollaboration'

export async function verifyCampaignCollaboration(input: {
  owner: { client: ConvexHttpClient; email: string; password: string; username: string }
  player: { client: ConvexHttpClient; email: string; password: string; username: string }
  anonymous: ConvexHttpClient
  campaignId: string
  publicId: string
  evidenceDirectory: string
}) {
  const { owner, player, anonymous, campaignId } = input
  let privateRollId: string | undefined
  const notebookArgs = { campaignId, paginationOpts: { cursor: null, numItems: 8 } }
  const privateNote = await owner.client.mutation(api.campaigns.notebooks.create, {
    campaignId,
    title: 'P14 private note',
    content: '<p>Private preparation</p>',
    visibility: 'GM_PRIVATE',
    category: 'GENERAL'
  })
  assert.deepEqual((await player.client.query(api.campaigns.notebooks.list, notebookArgs)).page, [])
  await assert.rejects(
    anonymous.query(api.campaigns.notebooks.list, notebookArgs),
    /Unauthenticated/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.conversations.open, { campaignId, kind: 'PARTY' }),
    /Conversation not found/
  )
  const browser = await verifyCampaignCollaborationBrowser({
    owner,
    player,
    publicId: input.publicId,
    evidenceDirectory: input.evidenceDirectory,
    verifyState: async (stage) => {
      if (stage.startsWith('gm-')) {
        const table = await player.client.query(api.campaigns.chat.list, {
          campaignId,
          room: 'TABLE',
          limit: 50
        })
        const privateHistory = await owner.client.query(api.rolls.history, {})
        assert.equal(privateHistory.length, 1)
        assert.equal(privateHistory[0]!.characterId, null)
        privateRollId ??= privateHistory[0]!.id
        assert.equal(privateHistory[0]!.id, privateRollId)
        assert.deepEqual(await player.client.query(api.rolls.history, {}), [])
        const rolls = table.entries.flatMap((entry) => (entry.roll ? [entry.roll] : []))
        assert.ok(rolls.every((roll) => roll.id !== privateRollId))
        assert.equal(rolls.length, stage === 'gm-private-rolled' ? 0 : 1)
      } else if (stage.startsWith('notebook-')) {
        const notes = await player.client.query(api.campaigns.notebooks.list, notebookArgs)
        assert.equal(notes.isDone, true)
        assert.ok(
          notes.page.every((note) => note.visibility === 'SHARED' && note.id !== privateNote.id)
        )
        assert.deepEqual(
          notes.page.map((note) => note.title),
          stage === 'notebook-deleted'
            ? []
            : [stage === 'notebook-created' ? 'P14 shared note' : 'P14 shared note updated']
        )
      } else if (stage === 'party-sent') {
        const party = await player.client.query(api.campaigns.chat.list, {
          campaignId,
          room: 'PARTY',
          limit: 50
        })
        assert.equal(party.entries[0]?.body, 'P14 party only')
        await assert.rejects(
          owner.client.query(api.campaigns.chat.list, { campaignId, room: 'PARTY', limit: 50 }),
          /Conversation not found/
        )
      } else if (stage === 'direct-sent') {
        const rooms = await player.client.query(api.campaigns.conversations.list, { campaignId })
        assert.ok(rooms.some((room) => room.kind === 'DIRECT'))
        const table = await player.client.query(api.campaigns.chat.list, {
          campaignId,
          room: 'TABLE',
          limit: 50
        })
        assert.ok(table.entries.every((entry) => entry.body !== 'P14 direct only'))
      } else {
        const table = await player.client.query(api.campaigns.chat.list, {
          campaignId,
          room: 'TABLE',
          limit: 50
        })
        assert.equal(table.entries.length, 1)
        const entry = table.entries[0]!
        assert.equal(
          entry.body,
          stage === 'table-sent'
            ? 'P14 table original'
            : stage === 'table-edited'
              ? 'P14 table edited'
              : null
        )
        if (stage === 'table-unsent') assert.ok(entry.unsentAt)
      }
      console.log(`Campaign collaboration browser/backend convergence: ${stage}.`)
    }
  })

  // HTTP queue bypass makes both writes contend on the same persisted version.
  const updates = await Promise.allSettled(
    ['first', 'second'].map((suffix) =>
      owner.client.mutation(
        api.campaigns.notebooks.update,
        {
          campaignId,
          sectionId: privateNote.id,
          expectedVersion: privateNote.version,
          title: `P14 private note ${suffix}`
        },
        { skipQueue: true }
      )
    )
  )
  assert.equal(updates.filter((result) => result.status === 'fulfilled').length, 1)
  const loser = updates.find((result) => result.status === 'rejected')
  assert.ok(loser?.status === 'rejected' && loser.reason instanceof Error)
  assert.match(loser.reason.message, /Notebook section version conflict/)
  const remaining = (await owner.client.query(api.campaigns.notebooks.list, notebookArgs)).page
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0]!.version, privateNote.version + 1)
  assert.deepEqual((await player.client.query(api.campaigns.notebooks.list, notebookArgs)).page, [])

  const send = {
    campaignId,
    room: 'TABLE' as const,
    mode: 'OOC' as const,
    body: 'P14 concurrent replay',
    clientNonce: crypto.randomUUID()
  }
  const replays = await Promise.all(
    [0, 1].map(() => owner.client.mutation(api.campaigns.chat.send, send, { skipQueue: true }))
  )
  assert.equal(replays[0]!.id, replays[1]!.id)
  const table = await player.client.query(api.campaigns.chat.list, {
    campaignId,
    room: 'TABLE',
    limit: 50
  })
  assert.equal(table.entries.filter((entry) => entry.id === replays[0]!.id).length, 1)
  await player.client.mutation(api.campaigns.conversations.markRead, {
    campaignId,
    conversationId: replays[0]!.conversationId,
    entryId: replays[0]!.id
  })
  assert.equal(
    (await player.client.query(api.campaigns.chat.list, { campaignId, room: 'TABLE', limit: 50 }))
      .unreadCount,
    0
  )
  await assert.rejects(
    player.client.mutation(api.campaigns.chat.edit, {
      campaignId,
      entryId: replays[0]!.id,
      body: 'Forbidden edit'
    }),
    /Chat entry not found/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.chat.send, {
      ...send,
      room: 'PARTY'
    }),
    /Conversation not found/
  )
  console.log(
    'Native collaboration interactions, privacy, notebook conflict and chat nonce races passed.'
  )
  assert.equal(
    browser.globalDiagnostics.length,
    0,
    'Campaign browser diagnostics must be clean; see campaign-collaboration-diagnostics.json.'
  )
}
