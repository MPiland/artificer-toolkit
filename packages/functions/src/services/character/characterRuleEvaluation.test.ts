import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CHARACTER_ABILITY_GENERATION_METHOD,
  GRANT_KIND,
  RACE_CATEGORY_CODE,
  SCALING
} from '@artificer-toolkit/shared/core'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { createEmptyCharacterAuthored, type CharacterBuilderContext } from './builderService.js'

const { resolveBinding, evaluateRevision } = vi.hoisted(() => ({
  resolveBinding: vi.fn(),
  evaluateRevision: vi.fn()
}))

vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: resolveBinding
}))
vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: evaluateRevision
}))

const { collectCharacterRuleEvaluationSpellIds, evaluateCharacterRulePolicy } =
  await import('./characterRuleEvaluation.js')
const { dnd5e2014CharacterPolicyDocument } =
  await import('../rules/systems/dnd5e/2014/characterPolicy.js')

function context(documents: readonly SpellAuthored[] = []): CharacterBuilderContext {
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
    },
    spellDocumentsById: new Map(documents.map((spell) => [spell.id, spell]))
  }
}

function spellDocument(id: string, systemId = 'dnd5e2014') {
  return {
    kind: 'SPELL' as const,
    id,
    label: id,
    description: '',
    castingTime: { unit: 'ROUND' as const, amount: 1 },
    level: 1,
    classIds: ['wizard'],
    magicSchoolId: 'evocation',
    userId: 'user-1',
    systemId
  }
}

function mixedActiveSpellFixture() {
  const snapshot = spellDocument('snapshot-spell')
  const selected = spellDocument('selected-chosen-spell')
  const unselected = spellDocument('unselected-chosen-spell')
  const fixed = spellDocument('fixed-grant-spell')
  const reference = spellDocument('reference-spell')
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'dnd5e2014',
    userId: 'user-1'
  })
  character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
  character.intent.race = { raceId: 'race-1' }
  character.intent.spellSelections = [
    {
      id: 'snapshot-spell-selection',
      source: { kind: 'CLASS', classId: 'wizard' },
      timing: { kind: 'IMMEDIATE' },
      spells: [snapshot.id]
    }
  ]
  character.intent.chosenGrantSelections = [
    {
      id: 'chosen-spell-choice',
      grantId: 'chosen-spell-grant',
      source: { kind: 'RACE', raceId: 'race-1' },
      timing: { kind: 'IMMEDIATE' },
      targetIds: [selected.id]
    }
  ]
  const builderContext = context()
  builderContext.catalog.spells = [snapshot, selected, unselected, fixed, reference].map(
    ({ kind: _kind, systemId: _systemId, userId: _userId, ...summary }) => summary
  )
  builderContext.spellDocumentsById = new Map(
    [snapshot, selected, fixed, reference].map((spell) => [spell.id, spell])
  )
  builderContext.registry.races = [
    {
      id: 'race-1',
      label: 'Race',
      category: RACE_CATEGORY_CODE.BASE,
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      userId: 'user-1',
      systemId: 'dnd5e2014',
      features: [
        {
          id: 'chosen-spell-feature',
          label: 'Chosen spell feature',
          description: '',
          order: 0,
          grants: {
            spells: [
              {
                id: 'chosen-spell-grant',
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                count: 1,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [selected.id, unselected.id],
                attributes: ['CAST_AT_WILL'],
                order: 0
              }
            ]
          }
        },
        {
          id: 'fixed-spell-feature',
          label: 'Fixed spell feature',
          description: '',
          order: 1,
          grants: {
            spells: [
              {
                id: 'fixed-spell-grant',
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [fixed.id],
                attributes: ['CAST_AT_WILL'],
                order: 0
              }
            ]
          }
        }
      ]
    }
  ]
  return {
    builderContext,
    character,
    documents: [snapshot, selected, fixed, reference],
    fixed,
    reference,
    selected,
    snapshot,
    unselected
  }
}

describe('evaluateCharacterRulePolicy', () => {
  beforeEach(() => {
    resolveBinding.mockReset()
    evaluateRevision.mockReset()
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
    const builderContext = context([spell, referenceSpell])
    builderContext.catalog.spells = [spell, referenceSpell].map(
      ({ kind: _kind, systemId: _systemId, userId: _userId, ...summary }) => summary
    )

    await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: builderContext,
      existingRevisionId: 'revision-1',
      referenceSpellIds: ['spell-2']
    })

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

  it('hydrates selected CHOSEN and non-CHOSEN grants without requiring an unselected choice', async () => {
    const { builderContext, character, fixed, selected, unselected } = mixedActiveSpellFixture()

    expect([
      ...collectCharacterRuleEvaluationSpellIds({
        character,
        context: builderContext,
        referenceSpellIds: ['reference-spell']
      })
    ]).toEqual(['snapshot-spell', selected.id, fixed.id, 'reference-spell'])

    await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: builderContext,
      existingRevisionId: 'revision-1',
      referenceSpellIds: ['reference-spell']
    })

    expect([...builderContext.spellDocumentsById!.keys()]).toEqual([
      'snapshot-spell',
      selected.id,
      fixed.id,
      'reference-spell'
    ])
    const normalizedFacts = evaluateRevision.mock.calls[0]?.[0].normalizedFacts
    expect(
      normalizedFacts.spellAccessCandidates.map(({ spellId }: { spellId: string }) => spellId)
    ).toEqual([selected.id, unselected.id, fixed.id])
    expect(
      normalizedFacts.spellActionFacts.map(({ spellId }: { spellId: string }) => spellId)
    ).toEqual(['snapshot-spell', selected.id, fixed.id, 'reference-spell'])
  })

  it.each([
    ['snapshot', 'snapshot-spell'],
    ['selected CHOSEN grant', 'selected-chosen-spell'],
    ['non-CHOSEN grant', 'fixed-grant-spell'],
    ['explicit reference', 'reference-spell']
  ])(
    'fails before binding when the active %s document is missing',
    async (_category, missingId) => {
      const { builderContext, character, documents, reference } = mixedActiveSpellFixture()
      builderContext.spellDocumentsById = new Map(
        documents.filter(({ id }) => id !== missingId).map((document) => [document.id, document])
      )

      await expect(
        evaluateCharacterRulePolicy({
          db: {} as unknown as DBLike,
          character,
          context: builderContext,
          existingRevisionId: 'revision-1',
          referenceSpellIds: [reference.id]
        })
      ).rejects.toThrow(`could not hydrate spell "${missingId}"`)
      expect(resolveBinding).not.toHaveBeenCalled()
      expect(evaluateRevision).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['malformed', {}],
    ['mismatched', spellDocument('different-spell')]
  ])('fails before binding when an active Spell document is %s', async (_case, document) => {
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
    const builderContext = context()
    builderContext.spellDocumentsById = new Map([['spell-1', document as unknown as SpellAuthored]])

    await expect(
      evaluateCharacterRulePolicy({
        db: {} as unknown as DBLike,
        character,
        context: builderContext,
        existingRevisionId: 'revision-1'
      })
    ).rejects.toThrow('could not hydrate spell "spell-1"')
    expect(resolveBinding).not.toHaveBeenCalled()
    expect(evaluateRevision).not.toHaveBeenCalled()
  })

  it('uses a committed Character spell pin without querying active authored versions', async () => {
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
      label: 'Pinned spell',
      description: '',
      castingTime: { unit: 'ROUND' as const, amount: 1 },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      userId: 'user-1',
      systemId: 'dnd5e2014'
    }

    await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: context(),
      existingRevisionId: 'revision-1',
      pinnedSpellsById: new Map([[spell.id, spell]])
    })

    expect(evaluateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedFacts: expect.objectContaining({
          spellActionFacts: [{ spellId: 'spell-1', effects: [] }]
        })
      })
    )
  })

  it('fails closed when an active Spell version belongs to another System', async () => {
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
    const builderContext = context([spellDocument('spell-1', 'other-system')])

    await expect(
      evaluateCharacterRulePolicy({
        db: {} as unknown as DBLike,
        character,
        context: builderContext,
        existingRevisionId: 'revision-1'
      })
    ).rejects.toThrow('could not hydrate spell "spell-1"')
    expect(resolveBinding).not.toHaveBeenCalled()
    expect(evaluateRevision).not.toHaveBeenCalled()
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
