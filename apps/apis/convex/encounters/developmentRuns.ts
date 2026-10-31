import { v } from 'convex/values'
import { type MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { deleteReceiptHeaders } from '../lib/receiptLedgers'

const FIXTURE_CAMPAIGN_NAME = 'Encounter execution fixture'
type FixtureRunArgs = {
  ownerUserId: string
  playerUserId: string
  campaignId: string
  characterId: string
}

export async function removeFixtureRunState(ctx: MutationCtx, args: FixtureRunArgs): Promise<null> {
  await requireFixtureAccount(ctx, args.ownerUserId)
  await requireFixtureAccount(ctx, args.playerUserId)
  if (args.ownerUserId === args.playerUserId)
    throw new Error('Fixture owner and player must differ.')
  const participantUserIds = new Set([args.ownerUserId, args.playerUserId])
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', args.campaignId))
    .unique()
  if (!campaign) return null
  if (campaign.ownerUserId !== args.ownerUserId || campaign.name !== FIXTURE_CAMPAIGN_NAME)
    throw new Error('Fixture Campaign ownership mismatch.')
  const [character, sessions, runs, memberships] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', args.characterId))
      .unique(),
    ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
      .take(3),
    ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
      .take(10),
    ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id))
      .take(3)
  ])
  if (character && character.userId !== args.playerUserId)
    throw new Error('Fixture Character ownership mismatch.')
  if (
    memberships.length > 2 ||
    memberships.some(
      (membership) =>
        !(
          (membership.userId === args.ownerUserId && membership.role === 'OWNER') ||
          (membership.userId === args.playerUserId && membership.role === 'PLAYER')
        )
    ) ||
    sessions.length > 2 ||
    (sessions[1] !== undefined && sessions[1].status !== 'OPEN') ||
    runs.length > 9
  )
    throw new Error('Fixture Run ownership or bounds mismatch.')
  const children = await Promise.all(
    runs.map(async (run) => {
      const [
        actors,
        effects,
        maintainedStates,
        commands,
        occurrences,
        receipts,
        rounds,
        participants,
        sides,
        binding,
        actorBindings,
        projectionFacts,
        sourceProjectionFacts,
        spellPins,
        snapshotParts
      ] = await Promise.all([
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
          .take(12),
        ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', run.id))
          .take(101),
        ctx.db
          .query('encounterMaintainedEffectStates')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
          .take(101),
        ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
          .take(145),
        ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id))
          .take(101),
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', run.id))
          .take(101),
        ctx.db
          .query('encounterInitiativeRounds')
          .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id))
          .take(11),
        ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', run.id))
          .take(111),
        ctx.db
          .query('encounterInitiativeSides')
          .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', run.id))
          .take(21),
        ctx.db
          .query('encounterSceneBindings')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
          .unique(),
        ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', run.id))
          .take(13),
        ctx.db
          .query('encounterActorSnapshots')
          .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', run.id))
          .take(12),
        ctx.db
          .query('encounterSourceProjectionFacts')
          .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', run.id))
          .take(12),
        ctx.db
          .query('encounterSpellPins')
          .withIndex('by_encounterId_spellId', (q) => q.eq('encounterId', run.id))
          .take(44),
        ctx.db
          .query('encounterPendingSnapshotParts')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
          .take(129)
      ])
      const scene = binding
        ? await ctx.db
            .query('campaignScenes')
            .withIndex('by_publicId', (q) => q.eq('id', binding.sceneId))
            .unique()
        : null
      return {
        run,
        actors,
        effects,
        maintainedStates,
        commands,
        occurrences,
        receipts,
        rounds,
        participants,
        sides,
        binding,
        scene,
        actorBindings,
        projectionFacts,
        sourceProjectionFacts,
        spellPins,
        snapshotParts
      }
    })
  )
  const totals = (
    key:
      | 'actors'
      | 'effects'
      | 'commands'
      | 'occurrences'
      | 'receipts'
      | 'rounds'
      | 'participants'
      | 'sides'
  ) => children.reduce((total, child) => total + child[key].length, 0)
  // Four initiative scenarios add eleven structural commands and one round each;
  // two concurrent-start fixtures add one actor, four commands, and one round each.
  if (
    totals('actors') > 68 ||
    totals('effects') > 100 ||
    totals('commands') > 152 ||
    totals('occurrences') > 100 ||
    totals('receipts') > 100 ||
    totals('rounds') > 30 ||
    totals('participants') > 112 ||
    totals('sides') > 22
  )
    throw new Error(
      'Fixture Encounter dependency bounds exceeded: ' +
        JSON.stringify({
          actors: totals('actors'),
          effects: totals('effects'),
          commands: totals('commands'),
          occurrences: totals('occurrences'),
          receipts: totals('receipts'),
          rounds: totals('rounds'),
          participants: totals('participants'),
          sides: totals('sides')
        })
    )
  const characterReceipts = await ctx.db
    .query('characterCommandReceipts')
    .withIndex('by_characterId_commandId', (q) => q.eq('characterId', args.characterId))
    .take(101)
  if (
    characterReceipts.length > 100 ||
    children.some(
      ({
        actors,
        effects,
        maintainedStates,
        commands,
        occurrences,
        receipts,
        rounds,
        binding,
        scene,
        actorBindings
      }) =>
        actors.length > 11 ||
        maintainedStates.length > 100 ||
        effects.some(
          (effect) =>
            (effect.maintainedEffectStateId !== null &&
              !maintainedStates.some((state) => state.id === effect.maintainedEffectStateId)) ||
            !actors.some((actor) => actor.id === effect.targetActorId)
        ) ||
        rounds.length > 10 ||
        actorBindings.length > 11 ||
        (!binding && actorBindings.length > 0) ||
        commands.some(
          (command) =>
            command.campaignId !== campaign.id || !participantUserIds.has(command.actorUserId)
        ) ||
        occurrences.some((row) => row.campaignId !== campaign.id) ||
        receipts.some(
          (row) =>
            row.campaignId !== campaign.id ||
            !participantUserIds.has(row.actorUserId) ||
            !occurrences.some((occurrence) => occurrence.id === row.occurrenceId)
        ) ||
        (binding !== null &&
          (binding.campaignId !== campaign.id ||
            !scene ||
            scene.campaignId !== campaign.id ||
            actorBindings.some(
              (row) =>
                row.sceneId !== binding.sceneId || !actors.some((actor) => actor.id === row.actorId)
            ) ||
            new Set(actorBindings.map((row) => row.actorId)).size !== actorBindings.length ||
            new Set(actorBindings.map((row) => row.tokenId)).size !== actorBindings.length))
    ) ||
    characterReceipts.some((receipt) => !participantUserIds.has(receipt.actorId))
  )
    throw new Error('Fixture Encounter dependency or ownership mismatch.')
  await deleteReceiptHeaders(ctx, [
    // The GM's Character commands on the fixture Character leave with the Runs they were issued in.
    ...characterReceipts
      .filter((receipt) => receipt.actorId === args.ownerUserId)
      .map((header) => ({ table: 'characterCommandReceipts' as const, header })),
    ...children.flatMap((child) => [
      ...child.receipts.map((header) => ({ table: 'encounterRuleReceipts' as const, header })),
      ...child.commands.map((header) => ({ table: 'encounterRunCommands' as const, header }))
    ])
  ])
  for (const child of children) {
    for (const row of child.actorBindings) await ctx.db.delete(row._id)
    if (child.binding) await ctx.db.delete(child.binding._id)
    for (const row of child.effects) await ctx.db.delete(row._id)
    for (const row of child.maintainedStates) await ctx.db.delete(row._id)
    for (const row of child.occurrences) await ctx.db.delete(row._id)
    for (const row of [
      ...child.participants,
      ...child.sides,
      ...child.rounds,
      ...child.actors,
      ...child.projectionFacts,
      ...child.sourceProjectionFacts,
      ...child.spellPins,
      ...child.snapshotParts
    ])
      await ctx.db.delete(row._id)
    await ctx.db.delete(child.run._id)
  }
  return null
}

export const removeFixtureState = internalMutation({
  args: {
    ownerUserId: v.string(),
    playerUserId: v.string(),
    campaignId: v.string(),
    characterId: v.string()
  },
  returns: v.null(),
  handler: removeFixtureRunState
})
