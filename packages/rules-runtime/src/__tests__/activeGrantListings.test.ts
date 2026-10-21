import { describe, expect, it } from 'vitest'

import {
  modifierOperationSchema,
  senseOperationSchema
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'

import {
  carriedConcentration,
  heldConcentration,
  hideActiveGrantSources,
  hideConcentrationSource,
  listActiveGrantListings
} from '../activeGrantListings.js'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { fly } from '@artificer-toolkit/source-data/srd/spells/fly.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { rayOfFrost } from '@artificer-toolkit/source-data/srd/spells/ray-of-frost.js'
import { shockingGrasp } from '@artificer-toolkit/source-data/srd/spells/shocking-grasp.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'

import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

type ListedEffect = Pick<
  ActiveRuleEffectRecord,
  'id' | 'createdOrdinal' | 'definition' | 'lifecycle'
>

function grantEffect(input: {
  id: number
  createdOrdinal: number
  sourceHidden?: boolean
  sourceLabel?: string
  lifecycle: ActiveRuleEffectRecord['lifecycle']
}): ListedEffect {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: testUuid(0xd001),
    holderActorId: testUuid(0xd002),
    lifecycle: {},
    ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {})
  })
  return {
    id: testUuid(input.id),
    createdOrdinal: input.createdOrdinal,
    lifecycle: input.lifecycle,
    definition: {
      ...planned.definition,
      stateContributions: planned.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? { ...contribution, sourceHidden: input.sourceHidden ?? false }
          : contribution
      )
    }
  }
}

const nonGrant = (effect: ListedEffect): ListedEffect => ({
  ...effect,
  definition: {
    ...effect.definition,
    stateContributions: effect.definition.stateContributions.filter(
      ({ kind }) => kind !== 'MODIFIER_GRANT'
    )
  }
})

describe('listActiveGrantListings', () => {
  it('lists grants oldest first with their source label and what is left of them', () => {
    const run = grantEffect({
      id: 0xd011,
      createdOrdinal: 2,
      sourceLabel: 'Antitoxin (vial)',
      lifecycle: { schemaVersion: 1, remainingTicks: 7 }
    })
    const carried = grantEffect({
      id: 0xd012,
      createdOrdinal: 1,
      sourceLabel: 'Aid',
      lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: 2001 }
    })
    const untimed = grantEffect({
      id: 0xd013,
      createdOrdinal: 3,
      lifecycle: { schemaVersion: 1, remainingTicks: null }
    })
    expect(listActiveGrantListings([run, untimed, carried])).toEqual([
      {
        effectId: carried.id,
        label: 'Aid',
        sourceHidden: false,
        remainingTicks: null,
        expiresAtCampaignMinute: 2001,
        polarity: 'BENEFICIAL'
      },
      {
        effectId: run.id,
        label: 'Antitoxin (vial)',
        sourceHidden: false,
        remainingTicks: 7,
        expiresAtCampaignMinute: null,
        polarity: 'BENEFICIAL'
      },
      {
        effectId: untimed.id,
        label: expect.any(String),
        sourceHidden: false,
        remainingTicks: null,
        expiresAtCampaignMinute: null,
        polarity: 'BENEFICIAL'
      }
    ])
  })

  it('leaves out effects that are not grants', () => {
    const grant = grantEffect({
      id: 0xd021,
      createdOrdinal: 1,
      lifecycle: { schemaVersion: 1, remainingTicks: 3 }
    })
    expect(listActiveGrantListings([nonGrant(grant)])).toEqual([])
  })
})

type PolarityPiece = { domain: string; kind: string; payload?: unknown }

function piecesEffect(pieces: readonly PolarityPiece[], senseCount: number): ListedEffect {
  const base = grantEffect({
    id: 0xd051,
    createdOrdinal: 1,
    lifecycle: { schemaVersion: 1, remainingTicks: 3 }
  })
  return {
    ...base,
    definition: {
      ...base.definition,
      stateContributions: base.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? {
              ...contribution,
              modifiers: pieces.map((piece, index) =>
                modifierOperationSchema.parse({
                  grantId: `piece-${index}`,
                  valueDomainCode: piece.domain,
                  modifierKind: piece.kind,
                  scope: 'GLOBAL',
                  domain: {},
                  ...(piece.payload ? { payload: piece.payload } : {}),
                  restrictions: [],
                  scopeSpellIds: [],
                  scopeResourceIds: []
                })
              ),
              senses: Array.from({ length: senseCount }, (_, index) =>
                senseOperationSchema.parse({
                  grantId: `sense-${index}`,
                  scalingKind: 'NONE',
                  targetIds: [],
                  levels: [],
                  range: { id: `sense-range-${index}`, rangeKind: 'UNLIMITED' }
                })
              )
            }
          : contribution
      )
    }
  }
}

const polarityOf = (
  pieces: readonly PolarityPiece[],
  senseCount = 0
): ActiveGrantListingDto['polarity'] | undefined =>
  listActiveGrantListings([piecesEffect(pieces, senseCount)])[0]?.polarity

const fixed = (amount: number) => ({ valueKind: 'FIXED', amount })
const advantage = { domain: 'INITIATIVE', kind: 'ADVANTAGE' }
const disadvantage = { domain: 'INITIATIVE', kind: 'DISADVANTAGE' }

describe('grant polarity (VTT_UI-1.2)', () => {
  it('reads a sense as beneficial', () => {
    expect(polarityOf([], 1)).toBe('BENEFICIAL')
  })

  it('reads advantage as beneficial and disadvantage as harmful', () => {
    expect(polarityOf([advantage])).toBe('BENEFICIAL')
    expect(polarityOf([disadvantage])).toBe('HARMFUL')
  })

  it('inverts advantage and disadvantage on attacks against the holder', () => {
    expect(polarityOf([{ domain: 'ATTACKS_AGAINST', kind: 'ADVANTAGE' }])).toBe('HARMFUL')
    expect(polarityOf([{ domain: 'ATTACKS_AGAINST', kind: 'DISADVANTAGE' }])).toBe('BENEFICIAL')
  })

  it('reads bonuses as beneficial and penalties as harmful', () => {
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'BONUS', payload: fixed(2) }])).toBe(
      'BENEFICIAL'
    )
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'PENALTY', payload: fixed(2) }])).toBe(
      'HARMFUL'
    )
    for (const kind of ['ABILITY_MODIFIER_BONUS', 'OPTIONAL_ABILITY_MODIFIER_BONUS'])
      expect(polarityOf([{ domain: 'DAMAGE', kind }])).toBe('BENEFICIAL')
  })

  it('reads a speed length bonus as beneficial, a penalty as harmful and a zero length as neutral', () => {
    const length = (amount: number) => ({ amount, unit: 'FEET' })
    expect(polarityOf([{ domain: 'SPEED', kind: 'BONUS', payload: length(10) }])).toBe('BENEFICIAL')
    expect(polarityOf([{ domain: 'SPEED', kind: 'PENALTY', payload: length(10) }])).toBe('HARMFUL')
    expect(polarityOf([{ domain: 'SPEED', kind: 'BONUS', payload: length(0) }])).toBe('NEUTRAL')
    expect(polarityOf([{ domain: 'SPEED', kind: 'PENALTY', payload: length(0) }])).toBe('NEUTRAL')
  })

  it('flips a bonus or penalty whose fixed amount or multiplier is negative', () => {
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'PENALTY', payload: fixed(-2) }])).toBe(
      'BENEFICIAL'
    )
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'BONUS', payload: fixed(-1) }])).toBe(
      'HARMFUL'
    )
    expect(
      polarityOf([
        {
          domain: 'ARMOR_CLASS',
          kind: 'PENALTY',
          payload: { valueKind: 'PROFICIENCY_BONUS', multiplier: -1 }
        }
      ])
    ).toBe('BENEFICIAL')
  })

  it('reads a zero amount or multiplier as neutral and an absent multiplier as one', () => {
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'BONUS', payload: fixed(0) }])).toBe(
      'NEUTRAL'
    )
    expect(
      polarityOf([
        {
          domain: 'ARMOR_CLASS',
          kind: 'PENALTY',
          payload: { valueKind: 'CHARACTER_LEVEL', multiplier: 0 }
        }
      ])
    ).toBe('NEUTRAL')
    expect(
      polarityOf([
        { domain: 'ARMOR_CLASS', kind: 'PENALTY', payload: { valueKind: 'CHARACTER_LEVEL' } }
      ])
    ).toBe('HARMFUL')
  })

  it('reads the opportunity attack immunity as beneficial', () => {
    expect(polarityOf([{ domain: 'OPPORTUNITY_ATTACK_IMMUNITY', kind: 'ENABLE' }])).toBe(
      'BENEFICIAL'
    )
  })

  it('reads added options by what they give the holder', () => {
    for (const domain of [
      'DAMAGE_RESISTANCE',
      'DAMAGE_IMMUNITY',
      'CONDITION',
      'CONDITION_IMMUNITY',
      'MOVEMENT_MODE'
    ])
      expect(polarityOf([{ domain, kind: 'ADD_OPTION' }])).toBe('BENEFICIAL')
    for (const domain of ['DAMAGE_VULNERABILITY'])
      expect(polarityOf([{ domain, kind: 'ADD_OPTION' }])).toBe('HARMFUL')
    expect(polarityOf([{ domain: 'ATTRIBUTE', kind: 'ADD_OPTION' }])).toBe('NEUTRAL')
  })

  it('inverts removed options and keeps a neutral one neutral', () => {
    expect(polarityOf([{ domain: 'DAMAGE_RESISTANCE', kind: 'REMOVE_OPTION' }])).toBe('HARMFUL')
    expect(polarityOf([{ domain: 'DAMAGE_VULNERABILITY', kind: 'REMOVE_OPTION' }])).toBe(
      'BENEFICIAL'
    )
    expect(polarityOf([{ domain: 'ATTRIBUTE', kind: 'REMOVE_OPTION' }])).toBe('NEUTRAL')
  })

  it('reads every other kind as neutral', () => {
    for (const kind of [
      'SET_VALUE',
      'REPLACE_DAMAGE_TYPE',
      'REPLACE_RANGE_KIND',
      'MODIFY_CHARGE_LIMIT'
    ])
      expect(polarityOf([{ domain: 'HIT_POINTS_MAX', kind }])).toBe('NEUTRAL')
  })

  it('refuses a modifier kind or value domain the fold contract does not know', () => {
    expect(() => polarityOf([{ domain: 'HIT_POINTS_MAX', kind: 'NOT_A_KIND' }])).toThrow()
    expect(() => polarityOf([{ domain: 'NOT_A_DOMAIN', kind: 'ENABLE' }])).toThrow()
  })

  it('reads a grant as beneficial or harmful only when every piece agrees', () => {
    expect(polarityOf([advantage, advantage], 1)).toBe('BENEFICIAL')
    expect(polarityOf([disadvantage, disadvantage])).toBe('HARMFUL')
    expect(polarityOf([advantage, disadvantage])).toBe('NEUTRAL')
    expect(polarityOf([disadvantage], 1)).toBe('NEUTRAL')
  })

  it('reads a negative ability modifier multiplier as a flip and a zero one as neutral', () => {
    const abilityBonus = (multiplier: number) => ({
      domain: 'ARMOR_CLASS',
      kind: 'ABILITY_MODIFIER_BONUS',
      payload: { ability: 'DEXTERITY', multiplier }
    })
    expect(polarityOf([abilityBonus(1)])).toBe('BENEFICIAL')
    expect(polarityOf([abilityBonus(-1)])).toBe('HARMFUL')
    expect(polarityOf([abilityBonus(0)])).toBe('NEUTRAL')
  })

  it('reads an added rolled die as beneficial and a subtracted one as harmful', () => {
    const rolledDie = (sign: string) => ({
      domain: 'ATTACK_ROLL',
      kind: 'ADD_BONUS_DIE',
      payload: { count: 1, faces: 4, sign }
    })
    expect(polarityOf([rolledDie('ADD')])).toBe('BENEFICIAL')
    expect(polarityOf([rolledDie('SUBTRACT')])).toBe('HARMFUL')
  })

  it('reads enabling a domain with no polarity as neutral', () => {
    expect(polarityOf([{ domain: 'ARMOR_CLASS', kind: 'ENABLE' }])).toBe('NEUTRAL')
  })

  it('reads a set value by its domain and value (D110)', () => {
    const set = (domain: string, amount: number) => ({
      domain,
      kind: 'SET_VALUE',
      payload: { amount }
    })
    const setSpeed = (amount: number) => ({
      domain: 'SPEED',
      kind: 'SET_VALUE',
      payload: { amount, unit: 'FEET' }
    })
    expect(polarityOf([setSpeed(60)])).toBe('BENEFICIAL')
    expect(polarityOf([setSpeed(0)])).toBe('HARMFUL')
    expect(polarityOf([set('REACTION_COUNT', 0)])).toBe('HARMFUL')
    expect(polarityOf([set('REACTION_COUNT', 2)])).toBe('NEUTRAL')
    expect(polarityOf([set('ACTION_COUNT', 2)])).toBe('BENEFICIAL')
    // A zeroed Action is Haste's lethargy, which the action economy now applies (SPELLS-4.T2l-a).
    expect(polarityOf([set('ACTION_COUNT', 0)])).toBe('HARMFUL')
    expect(polarityOf([set('BONUS_ACTION_COUNT', 0)])).toBe('HARMFUL')
    expect(polarityOf([set('HIT_POINTS_MAX', 0)])).toBe('NEUTRAL')
    expect(polarityOf([set('HIT_POINTS_MAX', 30)])).toBe('NEUTRAL')
  })

  it('reads a grant containing any neutral piece as neutral', () => {
    expect(polarityOf([advantage, { domain: 'HIT_POINTS_MAX', kind: 'SET_VALUE' }])).toBe('NEUTRAL')
  })
})

describe('polarity of real SRD grants (D110)', () => {
  function srdPolarity(
    effect: EffectAuthored | undefined,
    lifecycle: PathLifecycleAuthored = {},
    resultPath?: 'ON_HIT' | 'ON_SAVE_FAIL'
  ) {
    if (!effect) throw new Error('The SRD source has no effect.')
    const planned = plannedModifierGrant({
      encounterId: ENCOUNTER_ID,
      sourceActorId: testUuid(0xd001),
      holderActorId: testUuid(0xd002),
      lifecycle,
      resultPath,
      effect
    })
    return listActiveGrantListings([
      {
        id: testUuid(0xd061),
        createdOrdinal: 1,
        definition: planned.definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      }
    ]).map(({ polarity }) => polarity)
  }
  const basicAction = (id: string) =>
    SRD_BASIC_ACTION_DEFINITIONS.find((action) => action.id === id)?.document.effects?.[0]

  it('reads Fly (speed set above zero) as beneficial', () => {
    expect(srdPolarity(fly.effects?.[0])).toEqual(['BENEFICIAL'])
  })

  it('reads Shocking Grasp (reactions set to zero) as harmful', () => {
    expect(
      srdPolarity(
        shockingGrasp.effects?.[0],
        {
          turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' }
        },
        'ON_HIT'
      )
    ).toEqual(['HARMFUL'])
  })

  it('reads Ray of Frost (a speed penalty) as harmful', () => {
    expect(
      srdPolarity(
        rayOfFrost.effects?.[0],
        {
          turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' }
        },
        'ON_HIT'
      )
    ).toEqual(['HARMFUL'])
  })

  it('reads Vicious Mockery (disadvantage on attacks) as harmful', () => {
    expect(
      srdPolarity(
        viciousMockery.effects?.[0],
        {
          turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }
        },
        // The grant is the failed save's; it holds only on that path.
        'ON_SAVE_FAIL'
      )
    ).toEqual(['HARMFUL'])
  })

  it('reads Dodge, Disengage and Heroism as beneficial', () => {
    expect(srdPolarity(basicAction(SRD_BASIC_ACTION_IDS.DODGE))).toEqual(['BENEFICIAL'])
    expect(srdPolarity(basicAction(SRD_BASIC_ACTION_IDS.DISENGAGE))).toEqual(['BENEFICIAL'])
    expect(srdPolarity(heroism.effects?.[0])).toEqual(['BENEFICIAL'])
  })

  it('reads a grant that mixes Fly with Ray of Frost as neutral', () => {
    const frost = rayOfFrost.effects?.[0]?.paths
      .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
      .flatMap((outcome) =>
        outcome.effectKind === 'APPLY_GRANT' ? (outcome.grants.modifiers ?? []) : []
      )
    const flyEffect = fly.effects?.[0]
    if (!flyEffect || !frost?.length) throw new Error('The SRD sources lack the expected grants.')
    expect(
      srdPolarity({
        ...flyEffect,
        paths: flyEffect.paths.map((path) =>
          path.selectionKind !== 'FIXED'
            ? path
            : {
                ...path,
                resultBlock: {
                  ...path.resultBlock,
                  outcomes: path.resultBlock.outcomes.map((outcome) =>
                    outcome.effectKind === 'APPLY_GRANT'
                      ? {
                          ...outcome,
                          grants: {
                            ...outcome.grants,
                            modifiers: [...(outcome.grants.modifiers ?? []), ...frost]
                          }
                        }
                      : outcome
                  )
                }
              }
        )
      })
    ).toEqual(['NEUTRAL'])
  })
})

describe('Concentration listings (SPELLS-5.11)', () => {
  const aid = grantEffect({
    id: 0xd041,
    createdOrdinal: 1,
    sourceLabel: 'Aid',
    lifecycle: { schemaVersion: 1, remainingTicks: 3 }
  })
  const hidden = grantEffect({
    id: 0xd042,
    createdOrdinal: 1,
    sourceLabel: 'Hidden trap blessing',
    sourceHidden: true,
    lifecycle: { schemaVersion: 1, remainingTicks: 3 }
  })

  it('names a held Concentration by its first dependent grant', () => {
    expect(heldConcentration([aid])).toEqual({ label: 'Aid', sourceHidden: false })
    expect(heldConcentration([])).toEqual({ label: null, sourceHidden: false })
  })

  it('reads a carried Concentration only when the caster carries a grant', () => {
    expect(carriedConcentration([])).toBeNull()
    expect(carriedConcentration([aid])).toEqual({ label: 'Aid', sourceHidden: false })
  })

  it('withholds a hidden source label from players and keeps the rest', () => {
    expect(hideConcentrationSource(null)).toBeNull()
    expect(hideConcentrationSource(heldConcentration([aid]))).toEqual({
      label: 'Aid',
      sourceHidden: false
    })
    expect(hideConcentrationSource(heldConcentration([hidden]))).toEqual({
      label: null,
      sourceHidden: true
    })
  })
})

describe('hideActiveGrantSources', () => {
  it('keeps the polarity of a hidden source while its label goes (D110)', () => {
    const [hidden] = listActiveGrantListings([
      grantEffect({
        id: 0xd033,
        createdOrdinal: 1,
        sourceLabel: 'Hidden trap blessing',
        sourceHidden: true,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      })
    ])
    expect(hideActiveGrantSources([hidden!])).toEqual([
      { ...hidden, label: null, polarity: 'BENEFICIAL' }
    ])
  })

  it('clears only the label of a grant whose source was hidden', () => {
    const [shown, hidden] = listActiveGrantListings([
      grantEffect({
        id: 0xd031,
        createdOrdinal: 1,
        sourceLabel: 'Aid',
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      }),
      grantEffect({
        id: 0xd032,
        createdOrdinal: 2,
        sourceLabel: 'Hidden trap blessing',
        sourceHidden: true,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      })
    ])
    expect(hideActiveGrantSources([shown!, hidden!])).toEqual([
      shown,
      { ...hidden, label: null, sourceHidden: true }
    ])
  })
})
