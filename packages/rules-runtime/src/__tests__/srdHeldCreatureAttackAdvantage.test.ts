import type { CreatureAuthored } from '@artificer-toolkit/shared/authored'
import { mimic } from '@artificer-toolkit/source-data/srd/creatures/mimic.js'
import { GRAPPLED_CONDITION_ID } from '@artificer-toolkit/source-data/srd/creatures/shared.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  creatureFeatureAttackContributors,
  featureModifiersReadEnemyProximity
} from '../encounterActiveGrants.js'
import { encounterHeldConditionTypeIds } from '../encounterRelationshipActionFacts.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { dnd5eAttackRollContributors } from '../systems/dnd5e/characterRollModes.js'
import { DND5E_CHARACTER_WIDE_TARGET } from '../systems/dnd5e/modifierApplicability.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-33 T8a (Q30): the Mimic's Grappler and the Grappler feat's advantage are one authored
 * option, "advantage on attacks against a creature you hold with condition X". The same behaviour
 * authored by hand from core options on a homebrew creature, against another held condition, passes
 * the same assertions (authoring parity).
 */

const ATTACK_DOMAINS = ['MELEE', 'RANGED', 'SPELL', 'UNARMED'] as const
const HOLDER_ID = 'holder'
const TARGET_ID = 'target'
const OTHER_ID = 'other'
const RESTRAINED_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'RESTRAINED')!.id

/** A homebrew holder authoring the options by hand, with none of the SRD helper. */
function homebrewHolder(heldConditionTypeId: string): CreatureAuthored {
  return {
    ...structuredClone(mimic),
    label: 'Homebrew Clinger',
    features: [
      {
        id: '7e57a000-0000-4000-8000-00000000a801',
        label: 'Clinging Hunter',
        description: 'Advantage on attack rolls against any creature it holds restrained.',
        grants: {
          modifiers: ATTACK_DOMAINS.map((attackDomain, order) => ({
            id: `7e57a000-0000-4000-8000-00000000a8${(0x10 + order).toString(16)}`,
            grantKind: 'MODIFIER_GRANT' as const,
            valueDomainCode: 'ATTACK_ROLL' as const,
            domain: { attackDomain, againstHeldConditionTypeId: heldConditionTypeId },
            modifierKind: 'ROLL_INFLUENCE' as const,
            payload: { influence: 'ADVANTAGE' as const },
            scope: 'GLOBAL' as const,
            selectionKind: 'GRANTED' as const,
            order
          }))
        },
        order: 1
      }
    ]
  }
}

const holders = [
  { name: 'the SRD Mimic', creature: mimic, held: GRAPPLED_CONDITION_ID },
  { name: 'a homebrew creature', creature: homebrewHolder(RESTRAINED_ID), held: RESTRAINED_ID }
]

function attackMode(
  creature: CreatureAuthored,
  attackDomain: string,
  heldConditionTypeIds: ReadonlySet<string>
) {
  return resolveDnd5eRollMode(
    creatureFeatureAttackContributors(
      HOLDER_ID,
      attackDomain,
      null,
      foldDnd5eCreatureFeatureGrants(creature),
      null,
      false,
      null,
      heldConditionTypeIds
    )
  ).rollMode
}

describe.each(holders)('a Creature Grappler-style advantage: $name (SPELLS-33 T8a)', (holder) => {
  it('folds one held-condition attack advantage per attack domain, reading no other circumstance', () => {
    const grants = foldDnd5eCreatureFeatureGrants(holder.creature).filter(
      ({ domain }) => domain.againstHeldConditionTypeId !== undefined
    )
    expect(grants.map(({ domain }) => domain.attackDomain).sort()).toEqual(
      [...ATTACK_DOMAINS].sort()
    )
    for (const { domain } of grants) expect(domain.againstHeldConditionTypeId).toBe(holder.held)
    expect(featureModifiersReadEnemyProximity(grants)).toBe(false)
  })

  it('has advantage on every attack domain against a creature held with the condition', () => {
    for (const attackDomain of ATTACK_DOMAINS)
      expect(attackMode(holder.creature, attackDomain, new Set([holder.held]))).toBe('ADVANTAGE')
  })

  it('rolls normally against a creature not held, or held with another condition', () => {
    for (const attackDomain of ATTACK_DOMAINS) {
      expect(attackMode(holder.creature, attackDomain, new Set())).toBe('NORMAL')
      expect(attackMode(holder.creature, attackDomain, new Set(['another-condition']))).toBe(
        'NORMAL'
      )
    }
  })
})

describe('the Mimic Adhesive pseudopod (SPELLS-33 T8a, Q30c)', () => {
  const pseudopod = mimic.features?.find(({ label }) => label === 'Pseudopod')
  const text = JSON.stringify(pseudopod?.effects)

  it('grapples a Huge or smaller target at escape DC 13 from the core grapple options', () => {
    expect(text).toContain('"effectKind":"ACTOR_RELATIONSHIP"')
    expect(text).toContain('"conditionId":"' + GRAPPLED_CONDITION_ID + '"')
    expect(text).toContain('"dc":{"kind":"FIXED","value":13}')
    expect(text).toContain('"maximumSizeCode":"HUGE"')
    expect(text).not.toContain('MANUAL_ADJUDICATION')
  })
})

describe('the held conditions of a target, from the relationships its attacker applied (SPELLS-33 T8a)', () => {
  const relationship = (
    sourceActorId: string | null,
    conditionIds: readonly string[]
  ): { id: string; definition: never } =>
    ({
      id: `effect-${sourceActorId}-${conditionIds.join('-')}`,
      definition: {
        origin: { kind: 'ENCOUNTER', sourceActorId },
        stateContributions: [
          {
            kind: 'ACTOR_RELATIONSHIP',
            relationshipOutcomeId: 'outcome',
            conditionIds,
            modules: []
          }
        ]
      }
    }) as never

  it('is the conditions of the relationships the attacker applied to that target alone', () => {
    const effects = new Map([
      [
        TARGET_ID,
        [relationship(HOLDER_ID, [GRAPPLED_CONDITION_ID]), relationship(OTHER_ID, ['x'])]
      ],
      [OTHER_ID, [relationship(HOLDER_ID, [RESTRAINED_ID])]]
    ])
    expect([...encounterHeldConditionTypeIds(effects, HOLDER_ID, TARGET_ID)]).toEqual([
      GRAPPLED_CONDITION_ID
    ])
    expect([...encounterHeldConditionTypeIds(effects, HOLDER_ID, OTHER_ID)]).toEqual([
      RESTRAINED_ID
    ])
    expect(encounterHeldConditionTypeIds(effects, OTHER_ID, OTHER_ID).size).toBe(0)
  })

  it('is empty for a relationship no actor applied', () => {
    const effects = new Map([[TARGET_ID, [relationship(null, [GRAPPLED_CONDITION_ID])]]])
    expect(encounterHeldConditionTypeIds(effects, HOLDER_ID, TARGET_ID).size).toBe(0)
  })
})

describe('the Grappler feat advantage on a Character (SPELLS-33 T8a)', () => {
  const feature = grappler.features?.find(({ label }) => label === 'Advantage on Grappled Target')
  if (!feature) throw new Error('The Grappler feat must author its advantage.')
  const character = evaluateSrdCharacter({
    classes: [{ label: 'Fighter', level: 1 }],
    extraFeatures: [feature],
    features: [
      {
        acquisitionId: `acquired:${feature.id}`,
        featureId: feature.id,
        source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
  })
  const contributors = (domain: string, held: ReadonlySet<string>) =>
    dnd5eAttackRollContributors(
      character.output,
      domain as never,
      DND5E_CHARACTER_WIDE_TARGET,
      held
    )

  it('carries no closed rule', () => {
    expect(JSON.stringify(grappler)).not.toContain('CLOSED_RULE')
  })

  it('has advantage on every attack domain against a creature it holds grappled', () => {
    for (const domain of ATTACK_DOMAINS)
      expect(
        resolveDnd5eRollMode(contributors(domain, new Set([GRAPPLED_CONDITION_ID]))).rollMode
      ).toBe('ADVANTAGE')
  })

  it('rolls normally against a creature it does not hold, and the Sheet policy ignores it', () => {
    for (const domain of ATTACK_DOMAINS) {
      expect(contributors(domain, new Set())).toEqual([])
      expect(contributors(domain, new Set([RESTRAINED_ID]))).toEqual([])
    }
    expect(character.output.rollModes.attacks.MELEE).toBe('NORMAL')
    expect(character.output.rollContributorEvidence.attacks.MELEE).toEqual([])
  })

  it('leaves Pin as a GM ruling with no mechanic of its own', () => {
    const pin = grappler.features?.find(({ label }) => label === 'Pin')
    expect(JSON.stringify(pin?.effects)).toContain('MANUAL_ADJUDICATION')
    expect(JSON.stringify(pin?.effects)).toContain('GM_CHOICE')
    expect(pin?.grants).toBeUndefined()
  })
})
