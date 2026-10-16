import { describe, expect, it } from 'vitest'

import { animalMessenger } from '../srd/spells/animal-messenger.js'
import { animalFriendship } from '../srd/spells/animal-friendship.js'
import { awaken } from '../srd/spells/awaken.js'
import { charmPerson } from '../srd/spells/charm-person.js'
import { command } from '../srd/spells/command.js'
import { dominateBeast } from '../srd/spells/dominate-beast.js'
import { dominatePerson } from '../srd/spells/dominate-person.js'
import { heal } from '../srd/spells/heal.js'
import { holdMonster } from '../srd/spells/hold-monster.js'
import { holdPerson } from '../srd/spells/hold-person.js'
import { massHeal } from '../srd/spells/mass-heal.js'
import { planarBinding } from '../srd/spells/planar-binding.js'
import { creatureTypeId } from '../srd/spells/shared.js'

describe('SRD spells restricted to a creature type', () => {
  it.each([
    { spell: holdPerson, restriction: { allowedCreatureTypeIds: [creatureTypeId('HUMANOID')] } },
    { spell: charmPerson, restriction: { allowedCreatureTypeIds: [creatureTypeId('HUMANOID')] } },
    {
      spell: dominatePerson,
      restriction: { allowedCreatureTypeIds: [creatureTypeId('HUMANOID')] }
    },
    { spell: dominateBeast, restriction: { allowedCreatureTypeIds: [creatureTypeId('BEAST')] } },
    { spell: animalFriendship, restriction: { allowedCreatureTypeIds: [creatureTypeId('BEAST')] } },
    { spell: holdMonster, restriction: { excludedCreatureTypeIds: [creatureTypeId('UNDEAD')] } },
    { spell: command, restriction: { excludedCreatureTypeIds: [creatureTypeId('UNDEAD')] } },
    { spell: animalMessenger, restriction: { allowedCreatureTypeIds: [creatureTypeId('BEAST')] } },
    {
      spell: awaken,
      restriction: { allowedCreatureTypeIds: [creatureTypeId('BEAST'), creatureTypeId('PLANT')] }
    },
    {
      spell: planarBinding,
      restriction: {
        allowedCreatureTypeIds: ['CELESTIAL', 'ELEMENTAL', 'FEY', 'FIEND'].map(creatureTypeId)
      }
    },
    ...[heal, massHeal].map((spell) => ({
      spell,
      restriction: {
        excludedCreatureTypeIds: [creatureTypeId('CONSTRUCT'), creatureTypeId('UNDEAD')]
      }
    }))
  ])('$spell.label names the creature types it affects', ({ spell, restriction }) => {
    expect(spell.effects?.[0]?.invocation.targeting).toMatchObject(restriction)
  })
})
