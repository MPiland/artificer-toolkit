import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type { MovementPassageOption } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import {
  encounterActorMovementPassage,
  movementPassageAdmits,
  movementPassageOfModifiers
} from '../encounterMovementPassagePolicy.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

type CreatureFeature = CreatureAuthored['features'][number]

const INCORPOREAL = {
  throughCreatures: 'ANY',
  endInCreatures: 'NONE',
  throughBarriers: true,
  costMultiplier: 2
} as const
const ELEMENTAL_FORM = {
  throughCreatures: 'ANY',
  endInCreatures: 'ANY',
  throughBarriers: false,
  costMultiplier: 1
} as const

/** SRD text: Incorporeal Movement passes creatures and objects as difficult terrain; the forms stop inside. */
const TRAITS = [
  { creature: 'Ghost', feature: 'Incorporeal Movement', passage: INCORPOREAL },
  { creature: 'Specter', feature: 'Incorporeal Movement', passage: INCORPOREAL },
  { creature: 'Wraith', feature: 'Incorporeal Movement', passage: INCORPOREAL },
  { creature: "Will-o'-Wisp", feature: 'Incorporeal Movement', passage: INCORPOREAL },
  { creature: 'Air Elemental', feature: 'Air Form', passage: ELEMENTAL_FORM },
  { creature: 'Water Elemental', feature: 'Water Form', passage: ELEMENTAL_FORM }
]

function srdCreature(label: string): CreatureAuthored {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return creature
}

/** A homebrew feature granting passage, authored only from the core modifier options. */
function authoredPassageFeature(
  id: string,
  payload: MovementPassageOption,
  restrictions?: FacetAuthored
): CreatureFeature {
  return {
    id,
    label: 'Homebrew Passage',
    description: 'Moves through what it may.',
    order: 99,
    ...(restrictions ? { restrictions } : {}),
    grants: {
      modifiers: [
        {
          id: `${id}-grant`,
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'MOVEMENT_PASSAGE',
          domain: {},
          modifierKind: 'ADD_OPTION',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload,
          order: 0
        }
      ]
    }
  }
}

function withFeature(creature: CreatureAuthored, feature: CreatureFeature): CreatureAuthored {
  return { ...creature, features: [...creature.features, feature] }
}

function holderRestriction(subject: 'CHARACTER' | 'CREATURE'): FacetAuthored {
  return {
    id: testUuid(0x3100),
    groups: [
      {
        id: testUuid(0x3101),
        order: 0,
        contexts: [
          subject === 'CHARACTER'
            ? { id: testUuid(0x3102), order: 0, subject, conditions: [] }
            : { id: testUuid(0x3102), order: 0, subject, authoringModeKind: 'ALL', conditions: [] }
        ]
      }
    ]
  }
}

const creaturePassage = (creature: CreatureAuthored) =>
  encounterActorMovementPassage(
    DND5E_SYSTEM_ID,
    srdCreatureActor({ id: testUuid(0x3000), creature }),
    null
  )

describe('MOVEMENT_PASSAGE grants on SRD Creatures (SPELLS-33.T6k1)', () => {
  it.each(TRAITS)(
    "$creature's $feature resolves the same passage as a homebrew trait authored from core options",
    ({ creature: label, feature: featureLabel, passage }) => {
      const creature = srdCreature(label)
      expect(creaturePassage(creature)).toEqual(passage)

      const srdGrant = creature.features.find((entry) => entry.label === featureLabel)?.grants
        ?.modifiers?.[0]
      if (!srdGrant || srdGrant.valueDomainCode !== 'MOVEMENT_PASSAGE')
        throw new Error(`${label} ${featureLabel} grants no passage.`)
      const homebrew = withFeature(
        { ...srdCreature('Goblin'), id: testUuid(0x3200) },
        authoredPassageFeature(testUuid(0x3201), srdGrant.payload as MovementPassageOption)
      )
      expect(creaturePassage(homebrew)).toEqual(passage)
    }
  )

  it('gives a Creature without a passage grant no passage', () => {
    expect(creaturePassage(srdCreature('Goblin'))).toEqual({
      throughCreatures: 'NONE',
      endInCreatures: 'NONE',
      throughBarriers: false,
      costMultiplier: 1
    })
  })
})

describe('the Creature feature-grant fold', () => {
  const payload = {
    creatures: 'ANY',
    mayEndInCreature: false,
    blockingBarriers: false,
    costMultiplier: 1
  } as const

  it('accepts a feature restricted to Creatures and refuses one restricted to Characters', () => {
    const creature = (subject: 'CHARACTER' | 'CREATURE') =>
      withFeature(
        srdCreature('Goblin'),
        authoredPassageFeature(testUuid(0x3300), payload, holderRestriction(subject))
      )
    expect(
      foldDnd5eCreatureFeatureGrants(creature('CREATURE')).map(
        ({ valueDomainCode }) => valueDomainCode
      )
    ).toEqual(['MOVEMENT_PASSAGE'])
    expect(foldDnd5eCreatureFeatureGrants(creature('CHARACTER'))).toEqual([])
  })
})

describe('MOVEMENT_PASSAGE on a Character', () => {
  it('gives a Halfling passage through larger creatures only (Halfling Nimbleness)', () => {
    const { output } = evaluateSrdCharacter({
      race: 'Halfling',
      classes: [{ label: 'Rogue', level: 1 }]
    })
    expect(movementPassageOfModifiers(DND5E_SYSTEM_ID, output.grantFold.modifiers)).toEqual({
      throughCreatures: 'LARGER_THAN_SELF',
      endInCreatures: 'NONE',
      throughBarriers: false,
      costMultiplier: 1
    })
  })
})

describe('movementPassageOfModifiers', () => {
  const foldOf = (label: string) => foldDnd5eCreatureFeatureGrants(srdCreature(label))

  it('combines grants as a union with the highest multiplier', () => {
    const halfling = evaluateSrdCharacter({
      race: 'Halfling',
      classes: [{ label: 'Rogue', level: 1 }]
    }).output.grantFold.modifiers
    expect(
      movementPassageOfModifiers(DND5E_SYSTEM_ID, [...halfling, ...foldOf('Air Elemental')])
    ).toEqual(ELEMENTAL_FORM)
    expect(
      movementPassageOfModifiers(DND5E_SYSTEM_ID, [...foldOf('Air Elemental'), ...foldOf('Ghost')])
    ).toEqual({
      throughCreatures: 'ANY',
      endInCreatures: 'ANY',
      throughBarriers: true,
      costMultiplier: 2
    })
  })
})

describe('movementPassageAdmits', () => {
  it.each([
    { relation: 'ANY', mover: 'LARGE', blocker: 'TINY', admits: true },
    { relation: 'NONE', mover: 'TINY', blocker: 'HUGE', admits: false },
    { relation: 'LARGER_THAN_SELF', mover: 'SMALL', blocker: 'MEDIUM', admits: true },
    { relation: 'LARGER_THAN_SELF', mover: 'MEDIUM', blocker: 'MEDIUM', admits: false },
    { relation: 'LARGER_THAN_SELF', mover: 'MEDIUM', blocker: 'SMALL', admits: false },
    { relation: 'LARGER_THAN_SELF', mover: null, blocker: 'HUGE', admits: false }
  ] as const)(
    '$relation lets a $mover mover into a $blocker blocker: $admits',
    ({ relation, mover, blocker, admits }) => {
      expect(movementPassageAdmits(DND5E_SYSTEM_ID, relation, mover, blocker)).toBe(admits)
    }
  )
})
