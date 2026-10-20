import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachRoomWorker,
  executeInRoom,
  queueRoomRolls,
  readRoomRollCards,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * A player's SRD Fighter with an equipped seeded Longsword, acting first in an Assisted Run against
 * the seeded SRD Wolf. Returns the one-handed Longsword attack and its resolved hit damage.
 */
async function setup() {
  const base = await setupCharacterRun({}, longsword)
  await attachRoomWorker(base.t)
  await equipAllCharacterItems(base)
  await setAutoRollDice(base.t, base.player.userId, true)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const creature = srdWolf
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  await seedRoomContentSnapshots(base.campaign.id)
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
      target: { kind: 'ACTOR' as const, actorId: target.id },
      actionId: attack.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
  }
}

// The critical's d20 and damage dice live in the room's receipt:
// see apps/session-worker/test/nativeRoomCharacterWeapon.test.ts.
describe('a Character weapon critical hit in the room', () => {
  it('rolls the Longsword’s damage die twice and adds the Strength modifier once', async () => {
    const base = await setup()
    const hit = parseRollExpression(base.attack.damage.expression)
    expect(hit.terms).toMatchObject([{ count: 1, die: 8 }])
    // A natural 20, then the d8s roll 1 and 2. The room holds the settled receipt (D85), so the
    // d20 and the damage are read where a member sees them: the roll cards in the table chat.
    await queueRoomRolls(base.campaign.id, { rolls: [19, 0, 1] })
    const result = await executeInRoom(base.player.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const cards = await readRoomRollCards(base.player.caller, base.campaign.id)
    expect(cards.find((card) => card.source.kind === 'ATTACK')?.evidence.terms[0]?.rolls).toEqual([
      20
    ])
    expect(
      cards.filter((card) => card.source.kind === 'DAMAGE').map((card) => card.evidence.total)
    ).toEqual([1 + 2 + hit.modifier])
  }, 30000)
})
