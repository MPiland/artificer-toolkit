import { androsphinx } from '@artificer-toolkit/source-data/srd/creatures/androsphinx.js'
import { gynosphinx } from '@artificer-toolkit/source-data/srd/creatures/gynosphinx.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import {
  SRD_MAGIC_SCHOOLS,
  SRD_SKILLS,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { listActiveGrantListings } from '../activeGrantListings.js'
import { withCharacterActiveGrants } from '../encounterActiveGrants.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import type { NativeEncounterActionSource } from '../encounterActionSources.js'
import { encounterSpellSchoolImmunity } from '../encounterSpellSchoolImmunity.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { installedSrdCreature, srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { plannedGrantEffect } from './antitoxinEffectFixture.js'

type CharacterActionMechanicsOwner = Extract<
  NativeEncounterActionSource,
  { kind: 'CHARACTER_ACTION' }
>['candidate']['mechanicsOwner']

const HOLDER_ID = '00000000-0000-4000-8000-00000000d301'
const EFFECT_ID = '00000000-0000-4000-8000-00000000d302'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000d303'

const schoolId = (code: string) => {
  const school = SRD_MAGIC_SCHOOLS.find((entry) => entry.code === code)
  if (!school) throw new Error(`The SRD names the ${code} school.`)
  return school.id
}
const divinationId = schoolId('DIVINATION')

const mindBlankEffect = () =>
  plannedGrantEffect({
    id: EFFECT_ID,
    holderActorId: HOLDER_ID,
    effect: mindBlank.effects?.[0],
    sourceLabel: mindBlank.label
  })

const creatureTarget = (
  creature: Parameters<typeof srdCreatureActor>[0]['creature'],
  activeEffects: ReturnType<typeof mindBlankEffect>[] = []
) =>
  buildMovementTarget({
    actor: srdCreatureActor({ id: HOLDER_ID, creature }),
    activeEffects,
    gameSystemId: SRD_SYSTEM_ID,
    campaignId: CAMPAIGN_ID,
    characterFacts: null
  })

describe('SPELL_SCHOOL_IMMUNITY (SPELLS-33.T6m1)', () => {
  it.each([
    ['Gynosphinx', installedSrdCreature(gynosphinx)],
    ['Androsphinx', installedSrdCreature(androsphinx)]
  ])('holds immunity to divination spells through the %s Inscrutable feature', (_name, sphinx) => {
    expect(creatureTarget(sphinx).spellSchoolImmunityIds).toEqual([divinationId])
  })

  it('holds the Mind Blank divination clause on a Creature and on a Character, only while the effect is held', () => {
    const effect = mindBlankEffect()
    const sphinxless = { ...installedSrdCreature(gynosphinx), features: [] }
    expect(creatureTarget(sphinxless, [effect]).spellSchoolImmunityIds).toEqual([divinationId])
    expect(creatureTarget(sphinxless).spellSchoolImmunityIds).toEqual([])

    const fighter = evaluateSrdCharacter({
      race: 'Human',
      abilities: {},
      classes: [{ label: 'Fighter', level: 1 }]
    })
    expect(
      evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(fighter.facts, [effect]))
        .spellSchoolImmunityIds
    ).toEqual([divinationId])
    expect(evaluateDnd5e2014CharacterPolicy(fighter.facts).spellSchoolImmunityIds).toEqual([])
  })

  it('lists the Mind Blank grants on the holder as beneficial', () => {
    const effect = mindBlankEffect()
    expect(
      listActiveGrantListings([
        { ...effect, createdOrdinal: 1, lifecycle: { schemaVersion: 1, remainingTicks: 3 } }
      ]).map(({ polarity }) => polarity)
    ).not.toContain('HARMFUL')
  })

  it('gates a Character spell of the school, and no other cast', () => {
    const source = (mechanicsOwner: CharacterActionMechanicsOwner) =>
      ({ kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner } }) as const
    const casting = (spellId: string, schoolCode: string) => ({
      characterSpellCast: {
        candidates: [],
        decisions: [],
        compiledActionEntryPoints: [],
        magicSchoolIdBySpellId: new Map([[spellId, schoolId(schoolCode)]]),
        componentsLabelBySpellId: new Map(),
        unavailable: []
      }
    })
    const holder = creatureTarget(installedSrdCreature(gynosphinx))
    expect(
      encounterSpellSchoolImmunity({
        source: source({ kind: 'SPELL', id: 'detect-thoughts' }),
        sourceFacts: casting('detect-thoughts', 'DIVINATION'),
        target: holder
      })
    ).toBe(true)
    expect(
      encounterSpellSchoolImmunity({
        source: source({ kind: 'SPELL', id: 'fireball' }),
        sourceFacts: casting('fireball', 'EVOCATION'),
        target: holder
      })
    ).toBe(false)
    expect(
      encounterSpellSchoolImmunity({
        source: source({ kind: 'EQUIPMENT', id: 'wand' }),
        sourceFacts: casting('wand', 'DIVINATION'),
        target: holder
      })
    ).toBe(false)
  })
})

describe('CHECKS_AGAINST_HOLDER (SPELLS-33.T6m1)', () => {
  it.each([
    ['Gynosphinx', installedSrdCreature(gynosphinx)],
    ['Androsphinx', installedSrdCreature(androsphinx)]
  ])(
    'folds the %s Inscrutable Insight disadvantage into its feature modifiers',
    (_name, sphinx) => {
      const insight = SRD_SKILLS.find(({ code }) => code === 'INSIGHT')?.id
      const { ruleFacts } = srdCreatureActor({ id: HOLDER_ID, creature: sphinx }).snapshot as {
        ruleFacts: { modifiers: { valueDomainCode: string; payload: unknown }[] }
      }
      expect(
        ruleFacts.modifiers.filter(
          ({ valueDomainCode }) => valueDomainCode === 'CHECKS_AGAINST_HOLDER'
        )
      ).toMatchObject([{ payload: { skillId: insight } }])
    }
  )
})
