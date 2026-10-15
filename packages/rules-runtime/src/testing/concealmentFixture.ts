import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareEncounterConcealmentEffect } from '../encounterActionEffectPlans.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'
import { TIMESTAMP, testUuid } from './dnd5eSrdEncounter.js'

/** The authored effect of a catalogue basic action, under the identity the action tests compile it as. */
export function catalogueBasicActionEffect(actionId: string): EffectAuthored {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === actionId)?.document.effects[0]
  if (!effect) throw new Error('The basic action has no authored effect.')
  return { ...effect, id: ACTION_EFFECT_ID }
}

/**
 * The concealment the real planner stores for the SRD Hide: its Stealth total frozen and hidden
 * from `observerActorIds`, held by `holderActorId`. Seed it as an active effect.
 */
export function concealmentRecord(input: {
  encounterId: string
  holderActorId: string
  observerActorIds: readonly string[]
  concealmentTotal: number
  id?: string
}): ActiveRuleEffectRecord {
  const action = characterActionDescriptor(
    compileEffect(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE))
  )
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const [activeEffectPlan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  const effect = prepareEncounterConcealmentEffect({
    encounterId: input.encounterId,
    occurrenceId: testUuid(0xc320),
    commandId: testUuid(0xc321),
    sourceActorId: input.holderActorId,
    sourceLabel: 'Hide',
    sourceHidden: false,
    currentActorId: input.holderActorId,
    activeEffectPlan: activeEffectPlan ?? null,
    concealment: {
      concealmentTotal: input.concealmentTotal,
      observerActorIds: input.observerActorIds
    },
    published: published as ServerPublishedRuleDefinitionDto
  })
  if (!effect) throw new Error('No concealment effect was planned.')
  return prepareActiveRuleEffectRecord({
    id: input.id ?? testUuid(0xc322),
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: input.encounterId,
      targetActorId: input.holderActorId
    },
    definition: effect.definition,
    lifecycle: effect.lifecycle,
    currentEffects: [],
    occurredAt: TIMESTAMP
  })
}
