import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import { createEmptyCharacterAuthored, type CharacterBuilderContext } from './builderService.js'

const { resolveBinding, evaluateRevision, findSpells } = vi.hoisted(() => ({
  resolveBinding: vi.fn(),
  evaluateRevision: vi.fn(),
  findSpells: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async () => {
  const actual =
    await vi.importActual<typeof import('@artificer-toolkit/db')>('@artificer-toolkit/db')
  return { ...actual, createSpellRepository: () => ({ findByIds: findSpells }) }
})
vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: resolveBinding
}))
vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: evaluateRevision
}))

const { evaluateCharacterRulePolicy } = await import('./characterRuleEvaluation.js')
const { dnd5e2014CharacterPolicyDocument } =
  await import('../rules/systems/dnd5e/2014/characterPolicy.js')

function context(): CharacterBuilderContext {
  return {
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: null,
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: []
    }
  }
}

describe('evaluateCharacterRulePolicy', () => {
  beforeEach(() => {
    resolveBinding.mockReset()
    evaluateRevision.mockReset()
    findSpells.mockReset()
    findSpells.mockResolvedValue(new Map())
    resolveBinding.mockResolvedValue({
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    })
    const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
      ({ modelKey }) => modelKey === 'character-policy'
    )
    if (!fixture) throw new Error('Policy fixture missing.')
    evaluateRevision.mockResolvedValue({
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4,
      modelKey: 'character-policy',
      contractKey: 'character-policy',
      normalizedFacts: fixture.input,
      result: fixture.expected,
      trace: null,
      evaluationDurationMs: 1.25,
      documentBytes: 1_024,
      normalizedFactsBytes: 512,
      resultBytes: 256
    })
  })

  it('resolves one exact revision and invokes the generic runtime once', async () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      userId: 'user-1'
    })
    character.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: { assignments: [{ ability: 'STRENGTH', score: 14 }] }
    }

    const result = await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: context(),
      existingRevisionId: 'revision-1'
    })

    expect(resolveBinding).toHaveBeenCalledWith({
      db: {},
      systemId: 'dnd5e2014',
      existingRevisionId: 'revision-1',
      expectedRevisionId: undefined
    })
    expect(evaluateRevision).toHaveBeenCalledTimes(1)
    expect(findSpells).toHaveBeenCalledWith([])
    expect(evaluateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        revisionId: 'revision-1',
        modelKey: 'character-policy',
        contractKey: 'character-policy'
      })
    )
    expect(result.binding.revisionId).toBe('revision-1')
    expect(result.snapshot.characterId).toBe('character-1')
    expect(result.registry).toMatchObject({
      races: {},
      classes: {},
      backgrounds: {},
      equipment: {},
      feats: {},
      features: {},
      spells: {}
    })
    expect(result.output.proficiencyBonus).toBe(3)
    expect(result.evaluation.timing).toEqual(
      expect.objectContaining({
        zenEvaluationMs: 1.25,
        factDiscoveryMs: expect.any(Number),
        spellHydrationMs: expect.any(Number),
        documentBytes: 1_024,
        normalizedFactsBytes: 512,
        resultBytes: 256
      })
    )
    expect(result.evaluation.timing.totalMs).toBeGreaterThanOrEqual(0)
  })

  it('hydrates the union of Character spells and requested Sheet reference spells before one Zen call', async () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      userId: 'user-1'
    })
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const spell = {
      kind: 'SPELL' as const,
      id: 'spell-1',
      label: 'Spell',
      description: '',
      castingTime: { unit: 'ROUND' as const, amount: 1 },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      userId: 'user-1',
      systemId: 'dnd5e2014'
    }
    const referenceSpell = { ...spell, id: 'spell-2', label: 'Reference spell' }
    findSpells.mockResolvedValueOnce(
      new Map([
        ['spell-1', spell],
        ['spell-2', referenceSpell]
      ])
    )
    const builderContext = context()
    builderContext.catalog.spells = [spell, referenceSpell]

    await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: builderContext,
      existingRevisionId: 'revision-1',
      referenceSpellIds: ['spell-2']
    })

    expect(findSpells).toHaveBeenCalledWith(['spell-1', 'spell-2'])
    expect(evaluateRevision).toHaveBeenCalledTimes(1)
    expect(evaluateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedFacts: expect.objectContaining({
          spellActionFacts: [
            { spellId: 'spell-1', effects: [] },
            { spellId: 'spell-2', effects: [] }
          ]
        })
      })
    )
  })

  it('propagates binding failures without invoking Zen', async () => {
    const error = new Error('revision mismatch')
    resolveBinding.mockRejectedValueOnce(error)
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      userId: 'user-1'
    })

    await expect(
      evaluateCharacterRulePolicy({
        db: {} as unknown as DBLike,
        character,
        context: context(),
        existingRevisionId: null
      })
    ).rejects.toBe(error)
    expect(evaluateRevision).not.toHaveBeenCalled()
  })
})
