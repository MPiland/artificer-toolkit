import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import type { ConvexHttpClient } from 'convex/browser'
import {
  encounterGmProjectionDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommandAction } from './developmentClient'
import { readAuthoritativeSceneToken } from './developmentEncounterCutover'
import type { prepareEncounterMovementFixture } from './developmentEncounterMovement'

type ActionClient = DevelopmentClient & Pick<ConvexHttpClient, 'action'>

function reactionAllowanceUsed(run: unknown, actorId: string): number {
  const projection = encounterGmProjectionDtoSchema.parse(run)
  const actor = projection.actors.find((entry) => entry.id === actorId)
  if (!actor) throw new Error('Reaction actor is absent from the Run projection.')
  return encounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID)
}

export async function verifyEncounterReactionTransactions({
  owner,
  peer,
  player,
  fixture
}: {
  owner: ActionClient
  peer: ActionClient
  player: ActionClient
  fixture: Awaited<ReturnType<typeof prepareEncounterMovementFixture>>
}) {
  assert.notEqual(owner, peer, 'Reaction contenders require independent clients.')
  const initial = await readAuthoritativeSceneToken(owner, {
    sceneId: fixture.scene.liveSceneId,
    tokenId: fixture.mover.tokenId
  })
  const move = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId: fixture.scene.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: initial.header.version,
    expectedEncounterVersion: fixture.run.version,
    correlationId: null,
    movementKind: 'VOLUNTARY' as const,
    tokenId: fixture.mover.tokenId,
    path: [initial.token.position, { x: 350, y: 50 }]
  }
  const presentation = { expectedPresentationVersion: fixture.presentation.version }
  const issued = await player.action(api.scenes.geometryActions.execute, {
    input: move,
    presentation
  })
  assert.ok(issued.occurrence)
  assert.equal(issued.occurrence.status, 'PENDING')
  assert.equal(
    issued.occurrence.pending,
    null,
    'The moving player cannot see the GM reaction choice.'
  )
  const issuedOccurrenceId = issued.occurrence.occurrenceId
  assert.equal(
    await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: fixture.run.id
    }),
    null
  )
  const pending = await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: fixture.run.id
  })
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Reaction choice is unavailable.')
  assert.equal(
    await readAuthoritativeSceneToken(player, {
      sceneId: fixture.scene.liveSceneId,
      tokenId: fixture.reactor.tokenId
    }).then(
      () => true,
      () => false
    ),
    true,
    'The reaction contact must reveal the reactor to the moving player.'
  )
  const option = pending.choice.options.find((entry) => entry.actionId === fixture.reactor.actionId)
  if (!option) throw new Error('Fixture reaction action is unavailable.')
  const reactionStartRun = await owner.query(api.encounters.projectionReads.get, {
    encounterId: fixture.run.id
  })
  const reactionStartTimeline = await owner.query(api.encounters.timelineReads.timeline, {
    encounterId: fixture.run.id,
    limit: 100
  })
  assert.equal(reactionAllowanceUsed(reactionStartRun, fixture.reactor.actorId), 0)
  const selected: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: fixture.run.id,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: option.optionId }
  }
  const duplicates = await Promise.all([
    owner.action(executeEncounterCommandAction, { command: selected }),
    peer.action(executeEncounterCommandAction, { command: selected })
  ])
  assert.deepEqual(duplicates[0], duplicates[1])
  assert.equal(duplicates[0].occurrence?.occurrenceId, pending.occurrenceId)
  assert.equal(duplicates[0].occurrence?.occurrenceVersion, pending.occurrenceVersion + 1)
  assert.equal(duplicates[1].occurrence?.occurrenceId, pending.occurrenceId)
  assert.equal(duplicates[1].occurrence?.occurrenceVersion, pending.occurrenceVersion + 1)
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    reactionStartRun,
    'Selecting a reaction cannot advance the Run before evidence completes.'
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: fixture.run.id,
      limit: 100
    }),
    reactionStartTimeline,
    'Selecting a reaction cannot append mechanics before evidence completes.'
  )
  const evidence = await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: fixture.run.id
  })
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Reaction d20 evidence is unavailable.')
  assert.equal(evidence.occurrenceId, duplicates[0].occurrence?.occurrenceId)
  assert.equal(evidence.occurrenceVersion, duplicates[0].occurrence?.occurrenceVersion)
  const dice = (commandId: string): ResolveRuleOccurrenceInputDto => ({
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId,
    encounterId: fixture.run.id,
    expectedVersion: evidence.encounterVersion,
    occurrenceId: evidence.occurrenceId,
    expectedOccurrenceVersion: evidence.occurrenceVersion,
    correlationId: null,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: evidence.request.requestId,
      rawFaces:
        evidence.request.rollMode === 'NORMAL'
          ? [evidence.request.max]
          : [evidence.request.max, evidence.request.max]
    }
  })
  const contenders = [dice(crypto.randomUUID()), dice(crypto.randomUUID())] as const
  const raced = await Promise.allSettled([
    owner.action(executeEncounterCommandAction, { command: contenders[0] }),
    peer.action(executeEncounterCommandAction, { command: contenders[1] })
  ])
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1)
  const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
  const winner = raced[winnerIndex]
  const loser = raced[1 - winnerIndex]
  if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
    throw new Error('Reaction dice contention did not produce one winner and one stale loser.')
  assert.match(String(loser.reason), /stale/)
  assert.deepEqual(
    await owner.action(executeEncounterCommandAction, {
      command: contenders[winnerIndex]!
    }),
    winner.value
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    reactionStartRun,
    'Entering d20 evidence cannot advance the Run before outcome completes.'
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: fixture.run.id,
      limit: 100
    }),
    reactionStartTimeline,
    'Entering d20 evidence cannot append mechanics before outcome completes.'
  )
  let outcome = await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: fixture.run.id
  })
  if (!outcome || outcome.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error('Reaction outcome evidence is unavailable.')
  const outcomeOccurrenceId = outcome.occurrenceId
  const mover = encounterGmProjectionDtoSchema
    .parse(fixture.run)
    .actors.find((actor) => actor.id === fixture.mover.actorId)
  if (mover?.kind !== 'CHARACTER' || !mover.sourceId)
    throw new Error('Reaction contention requires the assigned Character mover.')
  const characterId = mover.sourceId
  const readRetryState = async () => {
    const [run, timeline, sheet, ownerToken, playerToken, pending] = await Promise.all([
      owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
      owner.query(api.encounters.timelineReads.timeline, {
        encounterId: fixture.run.id,
        limit: 100
      }),
      player.query(api.characters.sheet.get, { id: characterId }),
      readAuthoritativeSceneToken(owner, {
        sceneId: fixture.scene.liveSceneId,
        tokenId: fixture.mover.tokenId
      }),
      readAuthoritativeSceneToken(player, {
        sceneId: fixture.scene.liveSceneId,
        tokenId: fixture.mover.tokenId
      }),
      owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: fixture.run.id
      })
    ])
    assert.ok(sheet, 'The assigned Character Sheet must remain available.')
    return { run, timeline, sheet, ownerToken, playerToken, pending }
  }
  // A completed occurrence has no pending snapshot to route an unrecorded response.
  const staleOutcome =
    /Movement response (?:occurrence|Encounter scope) is stale\.|Scene changed before geometry publication\.|Rule occurrence is unavailable\./
  const resolvedOutcomeRequestIds = new Set<string>()
  let terminalCommand: ResolveRuleOccurrenceInputDto | null = null
  let terminalLoser: ResolveRuleOccurrenceInputDto | null = null
  let terminalLoserReason: string | null = null
  let terminalLoserRetryReason: string | null = null
  let terminal: unknown = null
  while (outcome) {
    assert.equal(outcome.occurrenceId, outcomeOccurrenceId)
    assert.ok(
      !resolvedOutcomeRequestIds.has(outcome.request.requestId),
      'Reaction outcome evidence repeated an already-resolved request.'
    )
    resolvedOutcomeRequestIds.add(outcome.request.requestId)
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: fixture.run.id,
      expectedVersion: outcome.encounterVersion,
      occurrenceId: outcome.occurrenceId,
      expectedOccurrenceVersion: outcome.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'SYSTEM_ROLL', requestId: outcome.request.requestId }
    }
    const outcomeCommands = [command, { ...command, commandId: crypto.randomUUID() }] as const
    const outcomeResults = await Promise.allSettled([
      owner.action(executeEncounterCommandAction, { command: outcomeCommands[0] }),
      peer.action(executeEncounterCommandAction, { command: outcomeCommands[1] })
    ])
    assert.equal(outcomeResults.filter((result) => result.status === 'fulfilled').length, 1)
    const outcomeWinnerIndex = outcomeResults.findIndex((result) => result.status === 'fulfilled')
    const outcomeWinner = outcomeResults[outcomeWinnerIndex]
    const outcomeLoser = outcomeResults[1 - outcomeWinnerIndex]
    if (
      !outcomeWinner ||
      outcomeWinner.status !== 'fulfilled' ||
      !outcomeLoser ||
      outcomeLoser.status !== 'rejected'
    )
      throw new Error('Reaction outcome contention did not produce one winner and one stale loser.')
    assert.match(String(outcomeLoser.reason), staleOutcome)
    const winningCommand = outcomeCommands[outcomeWinnerIndex]!
    const losingCommand = outcomeCommands[1 - outcomeWinnerIndex]!
    const settled = await readRetryState()
    assert.deepEqual(
      await owner.action(executeEncounterCommandAction, { command: winningCommand }),
      outcomeWinner.value
    )
    assert.deepEqual(await readRetryState(), settled, 'Outcome winner replay cannot change state.')
    let loserRetryReason: string | null = null
    await assert.rejects(
      peer.action(executeEncounterCommandAction, { command: losingCommand }),
      (error: unknown) => {
        loserRetryReason = String(error)
        assert.match(loserRetryReason, staleOutcome)
        return true
      }
    )
    assert.deepEqual(await readRetryState(), settled, 'Outcome loser retry cannot change state.')
    const next = settled.pending
    if (next === null) {
      terminalCommand = winningCommand
      terminalLoser = losingCommand
      terminalLoserReason = String(outcomeLoser.reason).match(staleOutcome)![0]
      terminalLoserRetryReason = String(loserRetryReason).match(staleOutcome)![0]
      terminal = outcomeWinner.value
      break
    }
    if (next.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Reaction outcome evidence advanced to an unexpected decision.')
    assert.equal(next.occurrenceId, outcomeOccurrenceId)
    assert.ok(next.occurrenceVersion > outcome.occurrenceVersion)
    const pendingOutcomeRun = await owner.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    assert.deepEqual(
      pendingOutcomeRun,
      reactionStartRun,
      'Entering outcome evidence cannot advance the Run before outcome completes.'
    )
    assert.deepEqual(
      await owner.query(api.encounters.timelineReads.timeline, {
        encounterId: fixture.run.id,
        limit: 100
      }),
      reactionStartTimeline,
      'Entering outcome evidence cannot append mechanics before outcome completes.'
    )
    assert.equal(reactionAllowanceUsed(pendingOutcomeRun, fixture.reactor.actorId), 0)
    assert.equal(
      await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: fixture.run.id
      }),
      null,
      'The moving player cannot see private GM outcome evidence.'
    )
    outcome = next
  }
  assert.ok(
    resolvedOutcomeRequestIds.size > 1,
    'Critical reaction damage must request multiple dice.'
  )
  if (!terminalCommand || !terminalLoser || !terminal)
    throw new Error('Reaction outcome did not complete.')
  const terminalState = await readRetryState()
  const finalRun = await owner.query(api.encounters.projectionReads.get, {
    encounterId: fixture.run.id
  })
  const finalTimeline = await owner.query(api.encounters.timelineReads.timeline, {
    encounterId: fixture.run.id,
    limit: 100
  })
  const finalOwnerToken = await readAuthoritativeSceneToken(owner, {
    sceneId: fixture.scene.liveSceneId,
    tokenId: fixture.mover.tokenId
  })
  const finalPlayerToken = await readAuthoritativeSceneToken(player, {
    sceneId: fixture.scene.liveSceneId,
    tokenId: fixture.mover.tokenId
  })
  const finalPlayerReactorVisible = await readAuthoritativeSceneToken(player, {
    sceneId: fixture.scene.liveSceneId,
    tokenId: fixture.reactor.tokenId
  }).then(
    () => true,
    () => false
  )
  assert.equal(
    await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: fixture.run.id
    }),
    null
  )
  assert.equal(
    await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: fixture.run.id
    }),
    null
  )
  assert.equal(finalRun.version, reactionStartRun.version + 1)
  assert.equal(finalTimeline.entries.length, reactionStartTimeline.entries.length + 1)
  assert.equal(
    finalTimeline.entries.filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE').length,
    reactionStartTimeline.entries.filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE')
      .length + 1,
    'Only the terminal reaction response may append a mechanics receipt.'
  )
  assert.equal(reactionAllowanceUsed(finalRun, fixture.reactor.actorId), 1)
  assert.deepEqual(finalOwnerToken.token.position, { x: 350, y: 50 })
  assert.deepEqual(finalPlayerToken.token.position, { x: 350, y: 50 })
  assert.equal(
    finalPlayerReactorVisible,
    true,
    "The revealed, non-hidden reactor remains visible in the player's persistent exploration."
  )

  assert.deepEqual(
    await owner.action(executeEncounterCommandAction, { command: terminalCommand }),
    terminal
  )
  const replay = await player.action(api.scenes.geometryActions.execute, {
    input: move,
    presentation
  })
  assert.equal(replay.replayed, true)
  assert.equal(replay.occurrence?.occurrenceId, issuedOccurrenceId)
  assert.equal(replay.occurrence?.status, 'COMPLETE')
  assert.equal(replay.occurrence?.pending, null)
  assert.deepEqual(replay, { ...issued, occurrence: replay.occurrence, replayed: true })
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    finalRun
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: fixture.run.id,
      limit: 100
    }),
    finalTimeline
  )
  assert.deepEqual(
    await readAuthoritativeSceneToken(owner, {
      sceneId: fixture.scene.liveSceneId,
      tokenId: fixture.mover.tokenId
    }),
    finalOwnerToken
  )
  assert.deepEqual(
    await readAuthoritativeSceneToken(player, {
      sceneId: fixture.scene.liveSceneId,
      tokenId: fixture.mover.tokenId
    }),
    finalPlayerToken
  )
  assert.equal(
    await readAuthoritativeSceneToken(player, {
      sceneId: fixture.scene.liveSceneId,
      tokenId: fixture.reactor.tokenId
    }).then(
      () => true,
      () => false
    ),
    finalPlayerReactorVisible
  )
  assert.deepEqual(
    await readRetryState(),
    terminalState,
    'Terminal and root replays cannot change state.'
  )
  const evidenceDirectory = new URL(
    '../../../.codex/validation/equipment-builder-catalogue-20260915/reaction-driver/',
    import.meta.url
  )
  await mkdir(evidenceDirectory, { recursive: true })
  await writeFile(
    new URL(`terminal-contention-${fixture.run.id}.json`, evidenceDirectory),
    JSON.stringify(
      {
        proof: 'Movement reaction outcome contention through public commandActions',
        encounterId: fixture.run.id,
        occurrenceId: outcomeOccurrenceId,
        rootCommandId: move.commandId,
        characterId,
        outcomeRequestsRaced: resolvedOutcomeRequestIds.size,
        winnerCommandId: terminalCommand.commandId,
        staleCommandId: terminalLoser.commandId,
        loserReason: terminalLoserReason,
        loserRetryReason: terminalLoserRetryReason,
        beforeRunVersion: reactionStartRun.version,
        afterRunVersion: finalRun.version,
        afterCharacterVersion: terminalState.sheet.meta.streamVersion,
        afterSceneVersion: finalOwnerToken.header.version,
        reactionSpent: reactionAllowanceUsed(finalRun, fixture.reactor.actorId),
        mechanicsReceiptsAdded: finalTimeline.entries.length - reactionStartTimeline.entries.length,
        winnerReplayMatched: true,
        loserRetryRejected: true,
        runTimelineCharacterAndSceneUnchangedByRetries: true,
        ownerPlayerPositionAgreement: true,
        projectionPrivacy: true
      },
      null,
      2
    ) + '\n'
  )
}
