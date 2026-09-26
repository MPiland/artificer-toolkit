import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { api } from '../convex/_generated/api'

// The real HTTP client and the in-process convex-test adapter both satisfy this surface.
export type SessionControlClient = Pick<ConvexHttpClient, 'query' | 'mutation'>
type FixtureClient = { client: SessionControlClient; identity: { userId: string } }

function settled<T>(results: PromiseSettledResult<T>[], conflict: RegExp) {
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof Error)
  assert.match(rejected.reason.message, conflict)
  return results.find(
    (result): result is PromiseFulfilledResult<T> => result.status === 'fulfilled'
  )!.value
}

/** Drives the public native live-play APIs against the isolated P15 fixture Campaign. */
export async function verifySessionControl(input: {
  owner: FixtureClient
  player: FixtureClient
  anonymous: SessionControlClient
  campaignId: string
  characterId: string
}) {
  const { owner, player, anonymous, campaignId, characterId } = input
  const page = { campaignId, paginationOpts: { cursor: null, numItems: 8 } }
  const creates = await Promise.allSettled(
    ['P15 session one', 'P15 session two'].map((title) =>
      owner.client.mutation(
        api.campaigns.sessions.create,
        { campaignId, title },
        { skipQueue: true }
      )
    )
  )
  assert.equal(creates.filter((result) => result.status === 'fulfilled').length, 2)
  const sessions = creates
    .filter(
      (result): result is PromiseFulfilledResult<CampaignSessionDto> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value)
    .sort((left, right) => left.sessionNumber - right.sessionNumber)
  assert.deepEqual(
    sessions.map((session) => session.sessionNumber),
    [1, 2]
  )
  for (const session of sessions) {
    const attendance = await owner.client.query(api.campaigns.sessionAttendance.list, {
      campaignId,
      sessionId: session.id,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.deepEqual(
      attendance.page.map((row) => row.characterId),
      [characterId]
    )
  }
  const first = sessions[0]!
  const updated = settled(
    await Promise.allSettled(
      ['P15 metadata a', 'P15 metadata b'].map((title) =>
        owner.client.mutation(
          api.campaigns.sessions.update,
          { campaignId, sessionId: first.id, title, expectedVersion: first.version },
          { skipQueue: true }
        )
      )
    ),
    /Session version conflict/
  )
  console.log('P15 sessions: concurrent creation and metadata version conflict passed.')

  await Promise.all([
    owner.client.mutation(api.campaigns.sessionRsvps.set, {
      campaignId,
      sessionId: first.id,
      response: 'YES'
    }),
    player.client.mutation(api.campaigns.sessionRsvps.set, {
      campaignId,
      sessionId: first.id,
      response: 'MAYBE'
    })
  ])
  await Promise.all(
    (['YES', 'NO'] as const).map((response) =>
      player.client.mutation(
        api.campaigns.sessionRsvps.set,
        { campaignId, sessionId: first.id, response },
        { skipQueue: true }
      )
    )
  )
  const rsvps = await owner.client.query(api.campaigns.sessionRsvps.list, {
    ...page,
    sessionId: first.id
  })
  assert.equal(rsvps.isDone, true)
  assert.equal(rsvps.page.length, 2)
  const playerRsvps = rsvps.page.filter((row) => row.userId === player.identity.userId)
  assert.equal(playerRsvps.length, 1)
  assert.ok(['YES', 'NO'].includes(playerRsvps[0]!.response))
  assert.deepEqual(
    (
      await player.client.query(api.campaigns.sessionRsvps.list, {
        campaignId,
        sessionId: first.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).page,
    []
  )
  await assert.rejects(
    player.client.mutation(api.campaigns.sessionAttendance.set, {
      campaignId,
      sessionId: first.id,
      characterId,
      present: false,
      expectedVersion: updated.version
    }),
    /Campaign not found/
  )
  await owner.client.mutation(api.campaigns.sessionAttendance.set, {
    campaignId,
    sessionId: first.id,
    characterId,
    present: false,
    expectedVersion: updated.version
  })
  const attendance = await player.client.query(api.campaigns.sessionAttendance.list, {
    ...page,
    sessionId: first.id
  })
  assert.equal(attendance.isDone, true)
  assert.deepEqual(
    attendance.page.map(({ characterId: id, present }) => ({ id, present })),
    [{ id: characterId, present: false }]
  )
  assert.equal(
    (
      await owner.client.query(api.campaigns.sessions.get, {
        campaignId,
        sessionNumber: first.sessionNumber
      })
    ).version,
    updated.version
  )
  const shared = await owner.client.mutation(api.campaigns.sessionNotes.create, {
    campaignId,
    sessionId: first.id,
    title: 'P15 shared',
    content: '<p>P15 shared</p>',
    visibility: 'SHARED',
    kind: 'SHARED_NOTE'
  })
  settled(
    await Promise.allSettled(
      [owner, player].map(({ client }, index) =>
        client.mutation(
          api.campaigns.sessionNotes.update,
          {
            campaignId,
            sessionId: first.id,
            sectionId: shared.id,
            title: `P15 shared ${index}`,
            expectedVersion: 0
          },
          { skipQueue: true }
        )
      )
    ),
    /Session note version conflict/
  )
  const privateNote = await owner.client.mutation(api.campaigns.sessionNotes.create, {
    campaignId,
    sessionId: first.id,
    title: 'P15 private',
    content: '<p>P15 private</p>',
    visibility: 'GM_PRIVATE',
    kind: 'SECRET'
  })
  const playerNotes = await player.client.query(api.campaigns.sessionNotes.list, {
    campaignId,
    sessionId: first.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  assert.ok(playerNotes.page.every((note) => note.id !== privateNote.id))
  const notebook = await owner.client.mutation(api.campaigns.notebooks.create, {
    campaignId,
    title: 'P15 reference label',
    content: '<p>P15 reference</p>',
    visibility: 'GM_PRIVATE',
    category: 'GENERAL'
  })
  const pin = await owner.client.mutation(api.campaigns.sessionReferences.create, {
    campaignId,
    sessionId: first.id,
    target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
  })
  await owner.client.mutation(api.campaigns.notebooks.update, {
    campaignId,
    sectionId: notebook.id,
    title: 'P15 reference current label',
    expectedVersion: notebook.version
  })
  const pins = await owner.client.query(api.campaigns.sessionReferences.list, {
    campaignId,
    sessionId: first.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  assert.equal(
    pins.page.find((candidate) => candidate.id === pin.id)?.label,
    'P15 reference current label'
  )
  assert.deepEqual(
    (
      await player.client.query(api.campaigns.sessionReferences.list, {
        campaignId,
        sessionId: first.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).page,
    []
  )

  const finishInput = {
    campaignId,
    sessionId: first.id,
    expectedVersion: updated.version,
    commandId: crypto.randomUUID()
  }
  const finishes = await Promise.all(
    [0, 1].map(() =>
      owner.client.mutation(api.campaigns.sessionFinish.finish, finishInput, { skipQueue: true })
    )
  )
  assert.deepEqual(finishes[0], finishes[1])
  assert.equal(finishes[0]!.status, 'FINISHED')
  assert.equal(finishes[0]!.version, updated.version + 1)
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionFinish.finish, {
      ...finishInput,
      expectedVersion: finishes[0]!.version,
      commandId: crypto.randomUUID()
    }),
    /already finished/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionFinish.finish, {
      ...finishInput,
      sessionId: sessions[1]!.id
    }),
    /already used with different input/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionRsvps.set, {
      campaignId,
      sessionId: first.id,
      response: 'NO'
    }),
    /Finished sessions/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionAttendance.set, {
      campaignId,
      sessionId: first.id,
      characterId,
      present: false,
      expectedVersion: finishes[0]!.version
    }),
    /Finished sessions/
  )
  await owner.client.mutation(api.campaigns.sessionNotes.update, {
    campaignId,
    sessionId: first.id,
    sectionId: shared.id,
    title: 'P15 finished editable',
    expectedVersion: 1
  })
  const editedFinished = await owner.client.mutation(api.campaigns.sessions.update, {
    campaignId,
    sessionId: first.id,
    expectedVersion: finishes[0]!.version,
    title: 'P15 finished metadata'
  })
  assert.equal(editedFinished.version, finishes[0]!.version + 1)
  assert.deepEqual(
    await owner.client.mutation(api.campaigns.sessionFinish.finish, finishInput),
    finishes[0]
  )
  console.log(
    'P15 Session RSVP uniqueness, attendance, note privacy, pins and finish replay passed.'
  )

  const playerSheet = await player.client.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  const daily = playerSheet.resources.items.find(
    (resource) => resource.label === 'P15 daily charge'
  )
  assert.ok(daily)
  await player.client.mutation(api.campaigns.characterSheet.execute, {
    campaignId,
    characterId,
    command: {
      type: 'USE_RESOURCE',
      commandId: crypto.randomUUID(),
      expectedVersion: playerSheet.meta.streamVersion,
      resourceGrantId: daily.id,
      amount: 1
    }
  })
  const initialized = await owner.client.mutation(api.campaigns.clock.initialize, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: 0,
    day: 1,
    minuteOfDay: 1439,
    dawnMinute: 360,
    duskMinute: 1080
  })
  const configured = await owner.client.mutation(api.campaigns.clock.configure, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: initialized.version,
    dawnMinute: 420,
    duskMinute: 1020
  })
  assert.equal(configured.dawnMinute, 420)
  assert.equal(configured.duskMinute, 1020)
  const advanceInput = {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: configured.version,
    minutes: 1
  }
  const advanceInputs = [advanceInput, { ...advanceInput, commandId: crypto.randomUUID() }]
  const advanced = settled(
    await Promise.allSettled(
      advanceInputs.map((command) =>
        owner.client.mutation(api.campaigns.clock.advance, command, { skipQueue: true })
      )
    ),
    /Campaign clock changed/
  )
  // Only the winning request has a replay receipt; retain its exact input.
  const advanceReplays = await Promise.allSettled(
    advanceInputs.map((command) =>
      owner.client.mutation(api.campaigns.clock.advance, command, { skipQueue: true })
    )
  )
  const replay = settled(advanceReplays, /Campaign clock changed/)
  assert.deepEqual(replay, advanced)
  const winningAdvance =
    advanceInputs[advanceReplays.findIndex((result) => result.status === 'fulfilled')]!
  assert.equal(replay.day, 2)
  const recoveredSheet = await player.client.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  assert.equal(recoveredSheet.resources.items.find((resource) => resource.id === daily.id)?.used, 0)
  assert.equal(recoveredSheet.meta.streamVersion, playerSheet.meta.streamVersion + 2)
  const recoveredEvents = await player.client.query(api.campaigns.events.list, {
    campaignId,
    characterId,
    limit: 32
  })
  assert.equal(recoveredEvents.nextCursor, null)
  assert.deepEqual(
    recoveredEvents.events.map((event) => event.type),
    ['CAMPAIGN_CLOCK_RESOURCE_RECOVERED']
  )
  await player.client.mutation(api.campaigns.characterSheet.execute, {
    campaignId,
    characterId,
    command: {
      type: 'USE_RESOURCE',
      commandId: crypto.randomUUID(),
      expectedVersion: recoveredSheet.meta.streamVersion,
      resourceGrantId: daily.id,
      amount: 1
    }
  })
  const started = await owner.client.mutation(api.campaigns.clock.start, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: replay.version
  })
  const reconciled = await owner.client.mutation(api.campaigns.clock.reconcile, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: started.version
  })
  const paused = await owner.client.mutation(api.campaigns.clock.pause, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: reconciled.version
  })
  const rewound = await owner.client.mutation(api.campaigns.clock.rewind, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: paused.version,
    minutes: 1,
    correctionReason: 'P15 correction'
  })
  const reset = await owner.client.mutation(api.campaigns.clock.reset, {
    campaignId,
    commandId: crypto.randomUUID(),
    expectedVersion: rewound.version,
    day: 2,
    minuteOfDay: 0,
    correctionReason: 'P15 reset'
  })
  assert.ok(reset.processedBoundaryAbsoluteMinute >= rewound.processedBoundaryAbsoluteMinute)
  const replayAfterUse = await owner.client.mutation(api.campaigns.clock.advance, winningAdvance)
  assert.deepEqual(replayAfterUse, advanced)
  const afterCorrection = await player.client.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  assert.equal(
    afterCorrection.resources.items.find((resource) => resource.id === daily.id)?.used,
    1
  )
  assert.equal(afterCorrection.meta.streamVersion, recoveredSheet.meta.streamVersion + 1)
  assert.deepEqual(
    await player.client.query(api.campaigns.events.list, { campaignId, characterId, limit: 32 }),
    recoveredEvents
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.clock.advance, {
      campaignId,
      commandId: finishInput.commandId,
      expectedVersion: reset.version,
      minutes: 1
    }),
    /already used/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionFinish.finish, {
      campaignId,
      sessionId: sessions[1]!.id,
      expectedVersion: sessions[1]!.version,
      commandId: winningAdvance.commandId
    }),
    /already used/
  )
  await assert.rejects(
    player.client.mutation(api.campaigns.clock.advance, {
      campaignId,
      commandId: crypto.randomUUID(),
      expectedVersion: reset.version,
      minutes: 1
    }),
    /Campaign not found/
  )
  console.log('P15 Clock contention, replay, watermark and once-only resource recovery passed.')
  const adjustment = {
    campaignId,
    characterId,
    visibility: 'SECRET' as const,
    expectedVersion: 0,
    adjustment: {
      family: 'HIT_POINTS' as const,
      field: 'MAXIMUM_MODIFIER' as const,
      value: 4,
      sourceNote: 'P15 secret'
    }
  }
  const savedAdjustment = await owner.client.mutation(
    api.campaigns.gmWrites.saveAdjustment,
    adjustment
  )
  const updatedAdjustment = settled(
    await Promise.allSettled(
      [5, 6].map((value) =>
        owner.client.mutation(
          api.campaigns.gmWrites.saveAdjustment,
          {
            ...adjustment,
            adjustment: { ...adjustment.adjustment, value },
            expectedVersion: savedAdjustment.version
          },
          { skipQueue: true }
        )
      )
    ),
    /Campaign adjustment changed/
  )
  const condition = {
    campaignId,
    characterId,
    conditionTypeId: SRD_CONDITION_TYPES[0].id,
    visibility: 'VISIBLE' as const,
    expectedVersion: 0,
    notes: 'P15 condition'
  }
  const savedCondition = await owner.client.mutation(
    api.campaigns.gmWrites.saveCondition,
    condition
  )
  const updatedCondition = settled(
    await Promise.allSettled(
      ['P15 one', 'P15 two'].map((notes) =>
        owner.client.mutation(
          api.campaigns.gmWrites.saveCondition,
          { ...condition, notes, expectedVersion: savedCondition.version },
          { skipQueue: true }
        )
      )
    ),
    /Campaign condition changed/
  )
  assert.equal(
    (await player.client.query(api.campaigns.gmReads.adjustments, { campaignId, characterId }))
      .length,
    0
  )
  assert.equal(
    (await player.client.query(api.campaigns.gmReads.conditions, { campaignId, characterId }))
      .length,
    1
  )
  const adjustedSheet = await player.client.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  assert.equal(updatedAdjustment.adjustment.family, 'HIT_POINTS')
  if (updatedAdjustment.adjustment.family !== 'HIT_POINTS')
    throw new Error('Expected HP adjustment.')
  assert.equal(
    adjustedSheet.overview.maxHitPoints,
    afterCorrection.overview.maxHitPoints + updatedAdjustment.adjustment.value
  )
  assert.ok(!JSON.stringify(adjustedSheet).includes('P15 secret'))
  for (const client of [player.client, anonymous]) {
    await assert.rejects(
      client.mutation(api.campaigns.gmWrites.saveAdjustment, adjustment),
      /cannot perform this Campaign action|Unauthenticated/
    )
    await assert.rejects(
      client.mutation(api.campaigns.gmWrites.saveCondition, condition),
      /cannot perform this Campaign action|Unauthenticated/
    )
  }
  await owner.client.mutation(api.campaigns.gmWrites.deleteAdjustment, {
    campaignId,
    characterId,
    adjustmentId: updatedAdjustment.id,
    expectedVersion: updatedAdjustment.version
  })
  await owner.client.mutation(api.campaigns.gmWrites.deleteCondition, {
    campaignId,
    characterId,
    conditionId: updatedCondition.id,
    expectedVersion: updatedCondition.version
  })
  assert.deepEqual(
    await owner.client.query(api.campaigns.gmReads.adjustments, { campaignId, characterId }),
    []
  )
  assert.deepEqual(
    await owner.client.query(api.campaigns.gmReads.conditions, { campaignId, characterId }),
    []
  )
  console.log('P15 GM control contention, effective adjustment, privacy and removal passed.')
  const detail = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
  await owner.client.mutation(api.campaigns.archive.archive, {
    campaignId,
    expectedVersion: detail.version
  })
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessions.create, { campaignId, title: 'P15 archived' }),
    /Archived Campaigns/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.clock.advance, winningAdvance),
    /Archived Campaigns/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.sessionFinish.finish, finishInput),
    /Archived Campaigns/
  )
  await assert.rejects(
    owner.client.mutation(api.campaigns.gmWrites.saveCondition, condition),
    /Archived Campaigns/
  )
  assert.equal(
    (await player.client.query(api.campaigns.sessions.list, page)).page.length,
    sessions.length
  )
  await assert.rejects(anonymous.query(api.campaigns.sessions.list, page), /Unauthenticated/)
  console.log('P15 archived authority before replay, member reads and anonymous denial passed.')
}
