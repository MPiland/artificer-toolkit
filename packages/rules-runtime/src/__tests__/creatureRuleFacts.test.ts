import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { describe, expect, it } from 'vitest'

import { creatureActor, srdAbilityId } from './encounterCreatureAction.js'

describe('Creature save proficiency facts', () => {
  it('pins the CR proficiency bonus for each authored proficient save and no other', () => {
    const { ruleFacts } = creatureActor({
      id: crypto.randomUUID(),
      label: 'Wyrmling',
      features: [],
      statBlock: blackDragonWyrmling
    }).snapshot as { ruleFacts: { saveProficiencyBonuses?: Record<string, number> } }
    // Challenge rating 2 gives +2; the stat block is proficient in DEX, CON, WIS and CHA saves.
    expect(ruleFacts.saveProficiencyBonuses).toEqual({
      [srdAbilityId('DEXTERITY')]: 2,
      [srdAbilityId('CONSTITUTION')]: 2,
      [srdAbilityId('WISDOM')]: 2,
      [srdAbilityId('CHARISMA')]: 2
    })
  })

  it('pins none for a stat block with no save proficiency', () => {
    const { ruleFacts } = creatureActor({
      id: crypto.randomUUID(),
      label: 'Wolf',
      features: [],
      statBlock: wolf
    }).snapshot as { ruleFacts: { saveProficiencyBonuses?: Record<string, number> } }
    expect(ruleFacts.saveProficiencyBonuses).toEqual({})
  })
})
