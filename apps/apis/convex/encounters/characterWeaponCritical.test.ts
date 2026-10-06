import { describe, expect, it } from 'vitest'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { executeInRoom, readEncounterHistory } from '../../tests/fixtures/liveSessionWorker'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'

/**
 * A player's SRD Fighter with an equipped seeded Longsword, acting first in an Assisted Run against
 * the seeded SRD Wolf. Returns the one-handed Longsword attack and its resolved hit damage.
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
  const creature = srdWolf
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Longsword critical fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  const target = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  if (!actor || !target) throw new Error('The Longsword fixture actors are missing.')
  const attack = await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, target.id]
    )
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
    run,
    attack,
    command: {
      type: 'RESOLVE_ACTION' as const,
      acceptedWieldConflict: null,
      // No Scene is bound, so the Longsword's reach can't be measured (D11).
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED' as const],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: actor.id,
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
    const receipt = await base.t.run(async (ctx) =>
      (await readEncounterHistory(ctx))
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
      throw new Error('Expected a settled Longsword attack on the Wolf.')
    const batch = settled.applicationOutputs
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(
      batch.applications.flatMap((application) =>
        application.kind === 'DAMAGE' ? [application.requestedAmount] : []
      )
    ).toEqual([4 + 7 + hit.modifier])
  }, 30000)
})
