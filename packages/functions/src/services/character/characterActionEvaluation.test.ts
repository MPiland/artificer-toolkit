import { describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'

const { evaluateRevision } = vi.hoisted(() => ({ evaluateRevision: vi.fn() }))

vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: evaluateRevision
}))

const { evaluateCharacterActionStateChange } = await import('./characterActionEvaluation.js')
const { resolveCharacterRulePolicyRollModes } = await import('./characterRuleEvaluation.js')
const { dnd5e2014CharacterPolicyDocument } =
  await import('../rules/systems/dnd5e/2014/characterPolicy.js')

describe('evaluateCharacterActionStateChange', () => {
  it('passes the trusted derived attack roll mode to character action evaluation', async () => {
    const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
      ({ modelKey }) => modelKey === 'character-policy'
    )
    if (!fixture) throw new Error('Character policy fixture missing.')
    const baseFacts = characterRulePolicyInputSchema.parse(fixture.input)
    const facts = characterRulePolicyInputSchema.parse({
      ...baseFacts,
      abilityDefinitions: [{ id: '00000000-0000-4000-8000-0000000000d1', code: 'DEXTERITY' }]
    })
    const expected = characterRulePolicyOutputSchema.parse(fixture.expected)

    const contributor = {
      sourceId: 'manual-adjustment',
      source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: 'manual-adjustment' },
      grantId: 'manual-grant',
      domainKey: 'attack:melee',
      influence: 'ADVANTAGE' as const
    }
    const committedOutput = resolveCharacterRulePolicyRollModes(
      characterRulePolicyOutputSchema.parse({
        ...expected,
        rollModes: {
          ...expected.rollModes,
          attacks: { MELEE: 'DISADVANTAGE', RANGED: 'NORMAL', SPELL: 'NORMAL', UNARMED: 'NORMAL' }
        },
        rollContributorEvidence: {
          ...expected.rollContributorEvidence,
          attacks: {
            ...expected.rollContributorEvidence.attacks,
            MELEE: [contributor]
          }
        },
        spellSlots: {
          ...expected.spellSlots,
          maxByLevel: [
            {
              spellLevel: 1,
              slotCount: 1,
              sourceIds: [],
              rawUsed: 0,
              effectiveUsed: 0,
              remaining: 1
            }
          ]
        }
      })
    )
    evaluateRevision.mockResolvedValue({
      evaluationDurationMs: 1,
      result: {
        actionDecisions: [],
        spellCastMechanics: [],
        spellReferenceMechanics: [],
        spellCastDecisions: []
      }
    })

    await evaluateCharacterActionStateChange({
      db: {} as unknown as DBLike,
      committed: {
        binding: { revisionId: 'revision-1' },
        facts,
        output: committedOutput
      },
      changedSpellSlotKey: 'STANDARD:1',
      resourceUsage: [],
      spellSlotUsage: [{ slotKey: 'STANDARD:1', used: 1 }]
    })

    expect(evaluateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedFacts: expect.objectContaining({
          attackRollModes: expect.objectContaining({ MELEE: 'ADVANTAGE' }),
          abilityDefinitions: [{ id: '00000000-0000-4000-8000-0000000000d1', code: 'DEXTERITY' }]
        })
      })
    )
  })
})
