import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { describe, expect, it } from 'vitest'

import { listActiveGrantListings } from '../activeGrantListings.js'
import { encounterActiveGrantCapabilitySuppressions } from '../encounterActiveGrants.js'
import { onEndGrantEffect, onEndGrantEffectId } from '../encounterEffectOnEnd.js'
import {
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

/** SPELLS-4.T2l-a: the follow-on grant an ended effect leaves, authored as `lifecycle.onEnd` (Haste's lethargy). */

const CASTER_ID = '00000000-0000-4000-8000-0000000f1001'
const HOLDER_ID = '00000000-0000-4000-8000-0000000f1002'
const EFFECT_ID = '00000000-0000-4000-8000-0000000f1003'

function hasteRecord() {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: haste.effects?.[0],
    rounds: 10
  })
  return {
    id: EFFECT_ID,
    owner: {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: HOLDER_ID
    },
    definition: planned.definition,
    lifecycle: planned.lifecycle,
    createdOrdinal: 1
  }
}

describe('Haste authored from core options (SPELLS-4.T2l-a)', () => {
  it('doubles speed, adds 2 AC and grants Dexterity-save advantage while it lasts, and suppresses nothing', () => {
    const { definition } = hasteRecord()
    const [contribution] = definition.stateContributions
    expect(contribution).toMatchObject({ kind: 'MODIFIER_GRANT' })
    if (contribution?.kind !== 'MODIFIER_GRANT') throw new Error('Expected a grant.')
    expect(
      contribution.modifiers.map(({ valueDomainCode, modifierKind }) => [
        valueDomainCode,
        modifierKind
      ])
    ).toEqual([
      ['SPEED', 'MULTIPLY'],
      ['ARMOR_CLASS', 'BONUS'],
      ['SAVING_THROW_MODIFIER', 'ADVANTAGE']
    ])
    expect(contribution.onEnd?.turns).toBe(1)
    expect(encounterActiveGrantCapabilitySuppressions([hasteRecord()])).toEqual([])
    expect(listActiveGrantListings([hasteRecord()]).map(({ polarity }) => polarity)).toEqual([
      'BENEFICIAL'
    ])
  })
})

describe('the lethargy an ended Haste leaves (SPELLS-4.T2l-a)', () => {
  it('is a one-tick grant on the same holder, with its own deterministic id', () => {
    const ended = hasteRecord()
    const follow = onEndGrantEffect(ended)

    expect(follow).toMatchObject({
      id: onEndGrantEffectId(EFFECT_ID),
      owner: ended.owner,
      lifecycle: { schemaVersion: 1, remainingTicks: 1 }
    })
    expect(follow?.id).not.toBe(EFFECT_ID)
    expect(onEndGrantEffectId(EFFECT_ID)).toBe(onEndGrantEffectId(EFFECT_ID))
  })

  it('stops the holder’s Action, Bonus Action and Reaction, lists as harmful, and leaves no follow-on of its own', () => {
    const follow = onEndGrantEffect(hasteRecord())
    if (!follow) throw new Error('Haste leaves no follow-on.')
    const effect = { id: follow.id, definition: follow.definition }

    const suppressions = encounterActiveGrantCapabilitySuppressions([effect])
    expect(suppressions.every(({ activeEffectId }) => activeEffectId === follow.id)).toBe(true)
    expect(suppressions.flatMap(({ capabilityDefinitionIds }) => capabilityDefinitionIds)).toEqual([
      DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_REACTION_ALLOWANCE_DEFINITION_ID
    ])
    expect(
      listActiveGrantListings([{ ...effect, createdOrdinal: 1, lifecycle: follow.lifecycle }]).map(
        ({ polarity }) => polarity
      )
    ).toEqual(['HARMFUL'])
    expect(
      onEndGrantEffect({ ...hasteRecord(), definition: follow.definition, id: follow.id })
    ).toBeNull()
  })
})
