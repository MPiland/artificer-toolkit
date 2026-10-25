import { describe, expect, it } from 'vitest'
import { initiativeDeclarationModifiersDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import {
  initiativeDeclarationFactsDtoSchema,
  type InitiativeDeclarationFactsDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import { SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'

import { encounterActionUndeclared } from '../encounterInitiativeDeclaredAction.js'
import { initiativeDeclarationModifier } from '../encounterInitiativeDeclarationModifier.js'
import { spellCastActionId } from '../spellCastCandidates.js'

/**
 * ENCOUNTER-4.T1: a declared-action initiative policy's authored modifiers give each declaration its
 * modifier, and a declared-action round holds its acting actor to the actions it declared.
 */

const ACTOR_ID = '00000000-0000-4000-8000-000000004a01'
const CHECKSUM = 'a'.repeat(64)

/** The seeded factor labelled label. */
function factorId(label: string) {
  const factor = SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS.factors.find(
    (candidate) => candidate.label === label
  )
  if (!factor) throw new Error(`The SRD seeds no ${label} factor.`)
  return factor.id
}
const HEAVY = factorId('Melee, heavy weapon')
const LOADING = factorId('Ranged, loading weapon')

function weaponAttack(optionId: string, equipmentProperties: string[]) {
  return {
    kind: 'CHARACTER_ACTION' as const,
    optionId,
    effectId: '00000000-0000-4000-8000-000000004a02',
    sourceId: 'weapon-source',
    sourceChecksum: CHECKSUM,
    activationCode: 'ACTION',
    equipmentInstanceId: `item-${optionId}`,
    equipmentProperties
  }
}

function spellCast(optionId: string, castLevel: number) {
  return {
    kind: 'CHARACTER_SPELL_CAST' as const,
    optionId,
    spellId: '00000000-0000-4000-8000-000000004a03',
    spellVersionId: 'spell-version',
    spellVersion: 1,
    spellChecksum: CHECKSUM,
    sourceKind: 'CLASS',
    sourceInstanceId: 'class-source',
    castLevel
  }
}

function adjudicated(factorIds: string[], spellLevel: number | null) {
  return {
    kind: 'GM_ADJUDICATED' as const,
    optionId: 'GM_ADJUDICATED' as const,
    actorId: ACTOR_ID,
    factorIds,
    spellLevel
  }
}

function declaration(
  actorSize: string,
  primary: InitiativeDeclarationFactsDto['primary'],
  bonus: typeof primary | null = null
) {
  return initiativeDeclarationFactsDtoSchema.parse({ actorSize, primary, bonus })
}

const speedFactor = (value: ReturnType<typeof declaration>) =>
  initiativeDeclarationModifier(SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS, value)

describe('the seeded Speed Factor modifiers (ENCOUNTER-4.2)', () => {
  it.each([
    ['TINY', 5],
    ['SMALL', 2],
    ['MEDIUM', 0],
    ['LARGE', -2],
    ['HUGE', -5],
    ['GARGANTUAN', -8]
  ])('gives a %s actor with an unmodified action %i', (size, modifier) => {
    expect(speedFactor(declaration(size, weaponAttack('club', ['MELEE'])))).toBe(modifier)
  })

  it.each([
    ['a heavy melee weapon', ['MELEE', 'HEAVY'], -2],
    ['a light melee weapon', ['MELEE', 'LIGHT'], 2],
    ['a finesse melee weapon', ['MELEE', 'FINESSE'], 2],
    ['a two-handed heavy melee weapon', ['MELEE', 'HEAVY', 'TWO_HANDED'], -4],
    ['a loading ranged weapon', ['RANGED', 'LOADING'], -5],
    ['a ranged weapon of no listed property', ['RANGED', 'LIGHT'], 0]
  ])('adds the factors %s matches', (_label, properties, modifier) => {
    expect(speedFactor(declaration('MEDIUM', weaponAttack('weapon', properties)))).toBe(modifier)
  })

  it('counts a factor once when the action and the bonus action both match it', () => {
    expect(
      speedFactor(
        declaration(
          'MEDIUM',
          weaponAttack('shortsword', ['MELEE', 'LIGHT']),
          weaponAttack('dagger', ['MELEE', 'LIGHT', 'FINESSE'])
        )
      )
    ).toBe(2)
  })

  it('subtracts the highest declared spell level', () => {
    expect(
      speedFactor(declaration('SMALL', spellCast('fireball', 3), spellCast('misty-step', 2)))
    ).toBe(2 - 3)
  })

  it('applies the factors and spell level the GM adjudicated', () => {
    expect(speedFactor(declaration('LARGE', adjudicated([HEAVY, LOADING], 4)))).toBe(-2 - 2 - 5 - 4)
    expect(speedFactor(declaration('MEDIUM', adjudicated([], null)))).toBe(0)
  })

  it('gives no modifier for a size the policy does not author', () => {
    expect(speedFactor(declaration('COLOSSAL', weaponAttack('club', ['MELEE'])))).toBeNull()
  })

  it('reads a homebrew policy’s own authored numbers, not the SRD table', () => {
    const homebrew = initiativeDeclarationModifiersDtoSchema.parse({
      sizes: [{ size: 'MEDIUM', modifier: 1 }],
      factors: [
        {
          id: '00000000-0000-4000-8000-000000004a10',
          label: 'Quick blade',
          equipmentPropertySets: [['FINESSE']],
          modifier: 3
        },
        {
          id: '00000000-0000-4000-8000-000000004a11',
          label: 'Polearm',
          equipmentPropertySets: [['REACH']],
          modifier: -4
        }
      ],
      spellLevel: { modifierPerLevel: -2 }
    })
    expect(
      initiativeDeclarationModifier(
        homebrew,
        declaration('MEDIUM', weaponAttack('rapier', ['MELEE', 'FINESSE']), spellCast('shield', 1))
      )
    ).toBe(1 + 3 - 2)
  })
})

describe('a declared-action round holds its actor to its declaration (ENCOUNTER-4.4)', () => {
  const declaredRound = (value: ReturnType<typeof declaration> | null) => ({
    round: { procedure: 'DECLARED_ACTION_ROLL' as const },
    participants: [{ actorId: ACTOR_ID, declaration: value }]
  })
  const undeclared = (
    round: Parameters<typeof encounterActionUndeclared>[0]['round'],
    actionId: string
  ) => encounterActionUndeclared({ round, actorId: ACTOR_ID, actionId })
  const attackAndCast = declaration(
    'MEDIUM',
    weaponAttack('longsword', ['MELEE', 'VERSATILE']),
    spellCast('healing-word', 1)
  )

  it('permits the declared action and the declared spell', () => {
    expect(undeclared(declaredRound(attackAndCast), 'longsword')).toBe(false)
    expect(undeclared(declaredRound(attackAndCast), spellCastActionId('healing-word'))).toBe(false)
  })

  it('refuses an action or a spell the actor did not declare', () => {
    expect(undeclared(declaredRound(attackAndCast), 'shortbow')).toBe(true)
    expect(undeclared(declaredRound(attackAndCast), spellCastActionId('fireball'))).toBe(true)
    // A spell's own option id is not the action that casts it.
    expect(undeclared(declaredRound(attackAndCast), 'healing-word')).toBe(true)
  })

  it('permits no executable action to a GM-adjudicated declaration', () => {
    expect(
      undeclared(declaredRound(declaration('MEDIUM', adjudicated([HEAVY], null))), 'longsword')
    ).toBe(true)
  })

  it('does not enforce an actor without a declaration, or a round of another procedure', () => {
    expect(undeclared(declaredRound(null), 'shortbow')).toBe(false)
    expect(
      undeclared(
        { ...declaredRound(attackAndCast), round: { procedure: 'ACTOR_ROLL' } },
        'shortbow'
      )
    ).toBe(false)
    expect(undeclared(null, 'shortbow')).toBe(false)
  })
})
