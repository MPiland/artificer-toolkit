import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { api, internal } from '../../convex/_generated/api'
import { createEncounterRun } from '../../convex/encounters/runs'
import { withSceneVisionTracking } from '../../convex/lib/mutations'
import { setupCharacterRun } from './encounterCharacter'
import { createEncounterInitiativeDefinitions } from './encounterInitiative'
import { attachRoomWorker } from './localRoomWorker'
import { countDatabaseIo, createDatabaseIoTotals } from './databaseIo'
import { importedSubject, importSeededSubjects } from './publication'
import { setAutoRollDice } from './rollPreferences'
import {
  importSeededSrdCreatureSenses,
  seededSrdPinnedSources,
  srdWolf as wolf
} from './srdCreatures'

/**
 * A prepared Run at the actor cap: the party's Character and every other seat a Creature drawn in
 * turn from `creatures`, under an assisted initiative policy, with the room attached. Returns the
 * Run creation's database reads.
 */
export async function createActorCapRun(creatures: readonly CreatureAuthored[] = [wolf]) {
  const base = await setupCharacterRun()
  await attachRoomWorker(base.t)
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
  const drawn = creatures.slice(0, MAX_ENCOUNTER_ACTORS - 1)
  for (const creature of drawn) await importSeededSrdCreatureSenses(base.t, creature)
  // The Creatures' pinned Equipment and Spells are shared, so each imports once.
  const subjects = new Map(
    drawn.flatMap((creature) => [
      ...seededSrdPinnedSources(creature).map((subject) => [subject.id, subject] as const),
      [
        creature.id,
        importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })
      ] as const
    ])
  )
  // An import takes at most ten subjects.
  const imports = [...subjects.values()]
  for (let start = 0; start < imports.length; start += 10)
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: imports.slice(start, start + 10)
    })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  // The party's Character fills the last seat.
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Actor cap',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS - 1 }, (_, index) => ({
      kind: 'CREATURE' as const,
      sourceId: creatures[index % creatures.length]!.id
    }))
  })
  const reads = createDatabaseIoTotals()
  const prepared = await base.owner.caller.run((ctx) =>
    createEncounterRun(
      // Counted beneath the trigger layer, so actor-insert trigger reads count too.
      withSceneVisionTracking({ ...ctx, db: countDatabaseIo(ctx.db, reads) }),
      { campaignId: base.campaign.id, blueprintId: blueprint.id, commandId: crypto.randomUUID() }
    )
  )
  return { base, prepared, reads }
}
