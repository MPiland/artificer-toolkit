import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { turnEffectOwner } from '../encounterTurnEffectState.js'
import { plannedTimedCondition } from './plannedTimedCondition.js'

/** The condition the SRD Sleep spell's effect owns while it holds its target. */
export const SLEEP_CONDITION_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'UNCONSCIOUS')!.id

/**
 * The effect the real Sleep cast plans on a creature, ended by damage: its condition ownership and
 * its `DAMAGE_TAKEN` end trigger come from the spell's authored data, not from the test.
 */
export function sleepEffectOn(input: {
  encounterId: string
  id: string
  sourceActorId: string
  holder: Parameters<typeof turnEffectOwner>[0]
}) {
  const spell = srdSpells.find(({ label }) => label === 'Sleep')
  if (!spell) throw new Error('SRD Sleep is missing.')
  const { definition, lifecycle } = plannedTimedCondition({
    encounterId: input.encounterId,
    sourceActorId: input.sourceActorId,
    holderActorId: input.holder.id,
    spell,
    lifetimeScope: 'ENCOUNTER'
  })
  return prepareActiveRuleEffectRecord({
    id: input.id,
    owner: turnEffectOwner(input.holder, input.encounterId),
    definition,
    lifecycle,
    currentEffects: [],
    occurredAt: '2026-10-17T00:00:00.000Z'
  })
}
