import type { ResolveConsequenceRollOfferInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  MAX_CHARACTER_CONSEQUENCES,
  type ConsequenceRollResolutionDto
} from '@artificer-toolkit/schema/shared/consequenceRolls'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  consequenceRollRow,
  encounterConsequenceRollTables,
  withoutConsequenceRollOffer
} from '@artificer-toolkit/rules-runtime/encounterConsequenceRolls'
import { tableRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { rejectDomain } from './domainRejections.js'
import { readRunActors } from './documents.js'
import { admitGmEncounterCommand, commitGmEncounterCommand } from './gmEncounterCommands.js'
import type { EncounterWriteTransaction } from './ports.js'
import { recordRuleRollCard } from './ruleRollCards.js'

/**
 * The GM resolves a consequence roll offer (ATTACK-15): declining removes it; accepting rolls the
 * table's die on the server, posts its card and records the roll and the row it landed on, or none
 * in a gap between rows. A row is recorded on the Character with its text as rolled (ATTACK-15.2);
 * applying its effect and any recovery stay the GM's judgment (D187a).
 */
export async function recordConsequenceRollCommand(
  ctx: EncounterWriteTransaction,
  command: ResolveConsequenceRollOfferInputDto,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase(),
    sourceCommandId: command.sourceCommandId.toLowerCase(),
    definitionId: command.definitionId.toLowerCase()
  }
  const admitted = await admitGmEncounterCommand(ctx, input, userId)
  if (admitted.replay) return admitted.replay
  const { campaign, state } = admitted
  const actor = (await readRunActors(ctx, state)).find(({ id }) => id === input.actorId)
  const offer = actor?.consequenceRollOffers?.find(
    (candidate) =>
      candidate.sourceCommandId === input.sourceCommandId &&
      candidate.definitionId === input.definitionId
  )
  if (!actor || !offer) rejectDomain('TARGET_UNAVAILABLE', 'That roll is no longer offered.')
  const now = new Date().toISOString()
  let resolution: ConsequenceRollResolutionDto = { decision: 'DECLINE' }
  let roll: RollRecordDto | null = null
  let rollIsPrivate = false
  if (input.decision === 'ACCEPT') {
    const table = encounterConsequenceRollTables(state).find(
      ({ pin }) => pin.definitionId === offer.definitionId
    )
    if (!table) rejectDomain('TARGET_UNAVAILABLE', 'That table is not on for this Encounter.')
    const character = await ctx.ports.readCharacterRow(actor.sourceId)
    if (character?.status !== 'ACTIVE')
      rejectDomain('TARGET_UNAVAILABLE', 'That Character is unavailable.')
    const document = ctx.ports.readCharacterRecord(character) as CharacterAuthored
    const consequences = document.state.consequences ?? []
    if (consequences.length >= MAX_CHARACTER_CONSEQUENCES)
      rejectDomain('ROLL_UNAVAILABLE', 'Remove a recorded consequence before rolling another.')
    const rawDie = nextInt(table.dieFaces) + 1
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    roll = tableRollRecord({
      occurrenceId: input.commandId,
      dieFaces: table.dieFaces,
      rawDie,
      tableLabel: table.label,
      rollerLabel: actor.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: now
    })
    const card = await recordRuleRollCard(ctx, {
      campaign,
      encounterId: state.id,
      roller: null,
      initiatorUserId: userId,
      visibility: input.visibility,
      clientNonce: input.commandId,
      roll
    })
    rollIsPrivate = card.audience === 'PRIVATE'
    const row = consequenceRollRow(table, rawDie)
    resolution = {
      decision: 'ACCEPT',
      dieFaces: table.dieFaces,
      roll: rawDie,
      rowId: row?.id ?? null
    }
    if (row) {
      const consequence = {
        id: input.commandId,
        definitionId: offer.definitionId,
        rowId: row.id,
        tableLabel: table.label,
        label: row.label,
        effect: row.effect,
        healing: row.healing,
        recordedAt: now
      }
      await ctx.ports.writeCharacterRecord({
        current: character,
        fields: { streamVersion: character.play.streamVersion + 1, updatedAt: now },
        document: JSON.parse(
          JSON.stringify(
            characterAuthoredDtoSchema.parse({
              ...document,
              state: { ...document.state, consequences: [...consequences, consequence] }
            })
          )
        )
      })
    }
  }
  return commitGmEncounterCommand(ctx, admitted, {
    input,
    userId,
    now,
    changes: [{ before: actor, after: withoutConsequenceRollOffer(actor, offer, now) }],
    roll,
    rollIsPrivate,
    receipt: { actorId: actor.id, offer, resolution }
  })
}
