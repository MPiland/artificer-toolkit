import { GRANT_KIND } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { wish } from '@artificer-toolkit/source-data/srd/spells/wish.js'
import { describe, expect, it } from 'vitest'

import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import {
  prepareFixtureBuilder,
  prepareFixtureContext,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

// RELIABILITY-21.T35: a chosen spell grant listing most of the catalogue (Magical Secrets) gives
// spell access candidates for the spells the Character picked, not one per listed spell.
const documents = {
  ...readyFighterFixture().documents,
  CLASS: [bard, collegeOfLore],
  EQUIPMENT: srdEquipment,
  SPELL: srdSpells
}

function loreBard(level: number): CharacterAuthored {
  const { character } = readyFighterFixture()
  return {
    ...character,
    intent: {
      ...character.intent,
      classes: [{ classId: bard.id, classLevel: level, subclassId: collegeOfLore.id }],
      hitpoints: {
        method: 'FIXED',
        levels: Array.from({ length: level }, (_, index) => ({
          level: index + 1,
          classId: bard.id,
          classLevel: index + 1,
          value: 8
        }))
      }
    }
  }
}

/** Picks distinct options for every chosen spell grant the Builder offers. */
async function pickSpellGrants(character: CharacterAuthored) {
  const { resolution } = await prepareFixtureBuilder({ character, documents })
  const spellChoices = resolution.chosenGrantChoices.filter(
    (choice) => choice.grantKind === GRANT_KIND.SPELL_GRANT
  )
  const picked: CharacterAuthored = {
    ...character,
    intent: {
      ...character.intent,
      chosenGrantSelections: spellChoices.map((choice, index) => ({
        id: crypto.randomUUID(),
        grantId: choice.grantId,
        source: choice.source,
        timing: choice.timing,
        progressionLevel: choice.progressionLevel,
        targetIds: choice.options
          .slice(index * choice.requiredCount, (index + 1) * choice.requiredCount)
          .map((option) => option.id)
      }))
    }
  }
  return { picked, spellChoices }
}

async function evaluate(character: CharacterAuthored) {
  const context = await prepareFixtureContext(character, documents)
  return evaluateCharacterRules({ character, context, spellsById: context.spellsById })
}

describe('Spell access candidates over the full SRD catalogue', () => {
  it.each([3, 20])(
    'prepares a level %i College of Lore Bard in the Builder',
    async (level) => {
      const { resolution } = await prepareFixtureBuilder({ character: loreBard(level), documents })
      expect(resolution.summary.totalLevel).toBe(level)
    },
    60_000
  )

  it('gives a level 20 Bard one candidate per picked Magical Secrets spell', async () => {
    const { picked, spellChoices } = await pickSpellGrants(loreBard(20))
    // Magical Secrets at 10, 14 and 18, and Lore's Additional Magical Secrets at 6.
    expect(spellChoices).toHaveLength(4)

    const { facts, output } = await evaluate(picked)
    const chosen = facts.spellAccessCandidates.filter(
      (candidate) => candidate.selectionKind === 'CHOSEN'
    )
    const pickedIds = (picked.intent.chosenGrantSelections ?? []).flatMap(
      (selection) => selection.targetIds
    )
    expect(chosen.map((candidate) => candidate.spellId).sort()).toEqual([...pickedIds].sort())
    const included = new Set(output.spellAccess.map((access) => access.accessId))
    expect(chosen.every((candidate) => included.has(candidate.accessId))).toBe(true)
  }, 60_000)

  it('offers each Magical Secrets choice every spell its grant lists', async () => {
    const { spellChoices } = await pickSpellGrants(loreBard(20))
    const grants = [...(bard.features ?? []), ...(collegeOfLore.features ?? [])].flatMap(
      (feature) => feature.grants?.spells ?? []
    )
    for (const choice of spellChoices) {
      const grant = grants.find((candidate) => candidate.id === choice.grantId)
      if (grant?.scalingKind !== 'NONE' || grant.authoringModeKind !== 'SELECTED')
        throw new Error('Expected a listed spell grant.')
      expect(choice.options.map((option) => option.id).sort()).toEqual(
        [...(grant.spellIds ?? [])].sort()
      )
    }
  }, 60_000)

  it('refuses a pick outside the grant list', async () => {
    const { picked } = await pickSpellGrants(loreBard(6))
    const [selection] = picked.intent.chosenGrantSelections ?? []
    if (!selection) throw new Error('Expected the Additional Magical Secrets choice.')
    const { resolution } = await prepareFixtureBuilder({
      character: {
        ...picked,
        intent: {
          ...picked.intent,
          chosenGrantSelections: [{ ...selection, targetIds: [selection.targetIds[0]!, wish.id] }]
        }
      },
      documents
    })
    expect(resolution.validations.map((validation) => validation.code)).toContain(
      'CHOSEN_GRANT_SELECTION_INVALID'
    )
  }, 60_000)

  it('locks a pick recorded for a feature the Bard has not reached', async () => {
    const { picked } = await pickSpellGrants(loreBard(6))
    const [selection] = picked.intent.chosenGrantSelections ?? []
    if (!selection) throw new Error('Expected the Additional Magical Secrets choice.')
    const early = loreBard(3)
    const { facts, output } = await evaluate({
      ...early,
      intent: { ...early.intent, chosenGrantSelections: [selection] }
    })

    const chosen = facts.spellAccessCandidates.filter(
      (candidate) => candidate.selectionKind === 'CHOSEN'
    )
    expect(chosen.map((candidate) => candidate.spellId)).toEqual(selection.targetIds)
    const decisions = output.spellAccessDecisions.filter((decision) =>
      chosen.some((candidate) => candidate.accessId === decision.accessId)
    )
    expect(decisions.map(({ status, reasonCode }) => ({ status, reasonCode }))).toEqual(
      selection.targetIds.map(() => ({ status: 'EXCLUDED', reasonCode: 'SOURCE_LEVEL_LOCKED' }))
    )
  }, 60_000)
})
