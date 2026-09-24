import { v } from 'convex/values'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { type MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'

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
        commands,
        occurrences,
        receipts,
        rounds,
        participants,
        sides,
        binding,
        actorBindings
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
          .take(13)
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
        commands,
        occurrences,
        receipts,
        rounds,
        participants,
        sides,
        binding,
        scene,
        actorBindings
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
  const linked = new Set(
    children.flatMap((child) =>
      child.commands.flatMap((command) =>
        command.commandType === 'UPDATE_ACTOR' && command.characterReceiptId
          ? [command.characterReceiptId]
          : []
      )
    )
  )
  for (const child of children)
    for (const receipt of child.receipts) {
      let rawResult: unknown
      try {
        rawResult = JSON.parse(receipt.resultJson)
      } catch {
        throw new Error('Fixture Encounter dependency or ownership mismatch.')
      }
      const status =
        typeof rawResult === 'object' && rawResult !== null && 'status' in rawResult
          ? rawResult.status
          : undefined
      if (status !== 'MOVEMENT_COMPLETE' && status !== 'BATCH_COMPLETE') continue
      const result = storedRuleExecutionResultDtoSchema.safeParse(rawResult)
      if (!result.success) throw new Error('Fixture Encounter dependency or ownership mismatch.')
      if (
        result.data.status !== 'MOVEMENT_COMPLETE' &&
        (result.data.status !== 'BATCH_COMPLETE' ||
          result.data.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      )
        continue
      if (
        result.data.encounterId !== child.run.id ||
        result.data.occurrenceId !== receipt.occurrenceId ||
        checksumCanonicalJson(result.data) !== receipt.resultChecksum
      )
        throw new Error('Fixture Encounter dependency or ownership mismatch.')
      for (const reaction of result.data.reactionExecutions ?? []) {
        if (
          reaction.targetCharacterId !== args.characterId ||
          reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH'
        )
          continue
        const commandId = deriveEncounterCharacterMechanicsEventCommandId({
          occurrenceId: result.data.occurrenceId,
          sourceCommandId: reaction.sourceCommandId,
          phase: 'MOVEMENT_REACTION_OUTCOME',
          ordinal: reaction.ordinal,
          targetCharacterId: args.characterId
        })
        const characterReceipt = characterReceipts.find(
          (candidate) => candidate.commandId === commandId
        )
        if (characterReceipt) linked.add(characterReceipt.id)
      }
    }
  if (
    characterReceipts.length > 100 ||
    children.some(
      ({
        actors,
        effects,
        commands,
        occurrences,
        receipts,
        rounds,
        binding,
        scene,
        actorBindings
      }) =>
        actors.length > 11 ||
        effects.some(
          (effect) =>
            effect.maintainedEffectStateId !== null ||
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
    [...linked].some((receiptId) => {
      const receipt = characterReceipts.find((candidate) => candidate.id === receiptId)
      return (
        !receipt ||
        receipt.characterId !== args.characterId ||
        !participantUserIds.has(receipt.actorId)
      )
    }) ||
    characterReceipts.some(
      (receipt) => !linked.has(receipt.id) && receipt.actorId !== args.playerUserId
    )
  )
    throw new Error('Fixture Encounter dependency or ownership mismatch.')
  for (const receipt of characterReceipts)
    if (linked.has(receipt.id)) await ctx.db.delete(receipt._id)
  for (const child of children) {
    for (const row of child.actorBindings) await ctx.db.delete(row._id)
    if (child.binding) await ctx.db.delete(child.binding._id)
    for (const row of [
      ...child.effects,
      ...child.receipts,
      ...child.occurrences,
      ...child.commands,
      ...child.participants,
      ...child.sides,
      ...child.rounds,
      ...child.actors
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
