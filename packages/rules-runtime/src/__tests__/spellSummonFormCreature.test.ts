import { describe, expect, it } from 'vitest'
import { animateObjects } from '@artificer-toolkit/source-data/srd/spells/animate-objects.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { snapshotStatBlock } from '../encounterProjection.js'
import { summonFormActorCreature, summonFormCreature } from '../spellSummonFormCreature.js'
import { SRD_VOCABULARY } from '../testing/dnd5eSrdEncounter.js'

const forms = (animateObjects.effects ?? [])
  .flatMap((effect) => effect.paths)
  .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
  .flatMap((outcome) =>
    outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'SUMMON'
      ? (outcome.forms ?? [])
      : []
  )
  .flatMap(({ id, label, statBlock }) => (statBlock ? [{ id, label, statBlock }] : []))

const build = (form: (typeof forms)[number]) =>
  summonFormCreature({ form, systemId: SRD_SYSTEM_ID, userId: SRD_USER_ID })

/** The armor class the Animated Object table prints for each size. */
const PRINTED_ARMOR_CLASS = [18, 16, 13, 10, 10]

describe('summonFormCreature (QUALITY-15.T3x2)', () => {
  it('builds each Animate Objects size as a Creature whose computed armor class is the printed one', () => {
    expect(forms).toHaveLength(PRINTED_ARMOR_CLASS.length)
    forms.forEach((form, index) => {
      const creature = build(form)
      expect(creature.id).toBe(form.id)
      expect(
        snapshotStatBlock({
          kind: 'CREATURE',
          systemId: SRD_SYSTEM_ID,
          snapshot: { payload: creature }
        })?.armorClass
      ).toBe(PRINTED_ARMOR_CLASS[index])
    })
  })

  it('turns each authored attack into one melee attack action of the Creature', () => {
    const [feature] = build(forms[0]!).features
    expect(feature).toMatchObject({
      label: 'Slam',
      rollDefinitions: [{ kind: 'ATTACK', expression: { die: 20, modifier: 8 } }],
      effects: [{ invocation: { range: { amount: 5 } } }]
    })
  })

  it('carries the immutable source provenance creature actions are discovered from', () => {
    const form = forms[0]!
    const { snapshot } = summonFormActorCreature({
      form,
      systemId: SRD_SYSTEM_ID,
      userId: SRD_USER_ID,
      vocabulary: SRD_VOCABULARY
    })
    expect(snapshot).toMatchObject({
      kind: 'CREATURE',
      id: form.id,
      sourceVersionId: form.id,
      sourceChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      sourceRevision: 1
    })
  })

  it('refuses a printed armor class below what the ability scores give', () => {
    const [form] = forms
    expect(() =>
      build({
        ...form!,
        statBlock: { ...form!.statBlock, armorClass: { kind: 'FIXED', value: 1 } }
      })
    ).toThrow('below what its ability scores give')
  })
})
