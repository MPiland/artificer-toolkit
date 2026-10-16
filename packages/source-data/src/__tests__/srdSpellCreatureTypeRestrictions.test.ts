import { describe, expect, it } from 'vitest'

import { animalFriendship } from '../srd/spells/animal-friendship.js'
import { charmPerson } from '../srd/spells/charm-person.js'
import { command } from '../srd/spells/command.js'
import { dominateBeast } from '../srd/spells/dominate-beast.js'
import { dominatePerson } from '../srd/spells/dominate-person.js'
import { holdMonster } from '../srd/spells/hold-monster.js'
import { holdPerson } from '../srd/spells/hold-person.js'
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
    { spell: command, restriction: { excludedCreatureTypeIds: [creatureTypeId('UNDEAD')] } }
  ])('$spell.label names the creature types it affects', ({ spell, restriction }) => {
    expect(spell.effects?.[0]?.invocation.targeting).toMatchObject(restriction)
  })
})
