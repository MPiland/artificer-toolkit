import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'

/**
 * A player's SRD Fighter with an equipped seeded Longsword, acting first in an Assisted Run against
 * a custom target. Returns the one-handed Longsword attack and its resolved hit damage.
 */
async function setup() {
  const base = await setupCharacterRun({}, longsword)
  await equipAllCharacterItems(base)
  await setAutoRollDice(base.t, base.player.userId, true)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const target = base.run.actors.find((candidate) => candidate.kind === 'CUSTOM')
  if (!target) throw new Error('The Longsword fixture target is missing.')
  const attack = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('The Longsword fixture Run is missing.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: base.actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: base.actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, state, [base.actor.id, target.id])
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.player.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('The Longsword fixture Character facts are missing.')
    const candidates = facts.ruleEvaluation.facts.actionCandidates.filter(
      (candidate) => candidate.equipment?.grip === 'ONE_HANDED'
    )
    const damage = facts.ruleEvaluation.output.actionDecisions
      .find((decision) => decision.actionId === candidates[0]?.actionId)
      ?.mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
    if (candidates.length !== 1 || damage?.kind !== 'DAMAGE')
      throw new Error('Expected one one-handed Longsword attack.')
    return { actionId: candidates[0]!.actionId, damage }
  })
  return {
    ...base,
    attack,
    command: {
      type: 'RESOLVE_ACTION' as const,
      acceptedWieldConflict: null,
      // No Scene is bound, so the Longsword's reach can't be measured (D11).
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED' as const],
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: target.id,
      actionId: attack.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
  }
}

describe('a Character weapon critical hit in the room', () => {
  it('rolls the Longsword’s damage die twice and adds the Strength modifier once', async () => {
    const base = await setup()
    const hit = parseRollExpression(base.attack.damage.expression)
    expect(hit.terms).toMatchObject([{ count: 1, die: 8 }])
    // A natural 20, then the d8s roll 4 and 7.
    const faces = [19, 3, 6]
    const result = await executeInRoom(base.player.caller, { command: base.command }, (maximum) => {
      const face = faces.shift()
      if (face === undefined || face >= maximum) throw new Error(`Unexpected roll (d${maximum}).`)
      return face
    })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(faces).toEqual([])
    const receipt = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', base.run.id).eq('commandId', base.command.commandId)
        )
        .unique()
    )
    if (!receipt) throw new Error('The Longsword receipt is missing.')
    const settled = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      settled.status !== 'COMPLETE' ||
      settled.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    )
      throw new Error('Expected a settled Longsword attack on the custom target.')
    const batch = settled.applicationOutputs
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(
      batch.applications.flatMap((application) =>
        application.kind === 'DAMAGE' ? [application.requestedAmount] : []
      )
    ).toEqual([4 + 7 + hit.modifier])
  }, 30000)
})
