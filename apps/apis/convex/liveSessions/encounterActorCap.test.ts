import { expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'

// Initiative evidence, its order and every refresh list hold one entry per actor, so a Run at the
// actor cap must start and turn, not only a Run within the rule graph's node limit.
it('starts and advances a turn in a Run at the actor cap through the room', async () => {
  const base = await setupCharacterRun()
  // The GM rolls every Creature and the player their Character without a prompt.
  for (const userId of [base.owner.userId, base.player.userId])
    await setAutoRollDice(base.t, userId, true)
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
      ),
      ...initiative.definitions
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  // The party's Character fills the last seat.
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Actor cap',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS - 1 }, () => ({
      kind: 'CREATURE' as const,
      sourceId: wolf.id
    }))
  })
  const prepared = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  expect(prepared.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
  let active = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: prepared.version
    }
  })
  // Tied scores the tie resolver leaves are ordered by the GM, one choice at a time.
  for (let choices = 0; active.occurrence?.status === 'PENDING'; choices++) {
    const pending = active.occurrence.pending
    if (choices >= MAX_ENCOUNTER_ACTORS || pending?.kind !== 'INITIATIVE_ORDER')
      throw new Error(`Unexpected initiative decision: ${pending?.kind ?? 'none'}.`)
    active = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version,
        correlationId: null,
        occurrenceId: active.occurrence.occurrenceId,
        expectedOccurrenceVersion: active.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]!
        }
      }
    })
  }
  const started = encounterGmProjectionDtoSchema.parse(active.projection)
  expect(started).toMatchObject({ status: 'ACTIVE', round: 1 })
  expect(started.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
  const first = started.currentActorId
  const advanced = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.version
    }
  })
  expect(advanced.projection.status).toBe('ACTIVE')
  expect(advanced.projection.currentActorId).not.toBe(first)
  expect(advanced.projection.version).toBeGreaterThan(started.version)
}, 600_000)
