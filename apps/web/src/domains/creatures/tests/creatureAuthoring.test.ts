import { afterEach, describe, expect, it, vi } from 'vitest'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import {
  createDefaultAbilityScores,
  createEmptyCreature,
  normalizeCreatureForSubmit,
  toCreatureFormValues
} from '../creatureAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'
const darkvision60 = {
  senseDefinitionId: 'darkvision',
  range: { id: 'darkvision-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }
} as const

describe('creature authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable category-driven creature drafts', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyCreature({ systemId: 'dnd-5e-srd' })).toMatchObject({
      id: generatedId,
      label: '',
      status: 'DRAFT',
      category: 'MONSTER',
      size: 'MEDIUM',
      systemId: 'dnd-5e-srd',
      equipmentLoadout: [],
      abilityScores: createDefaultAbilityScores()
    })
  })

  it('normalizes creature payloads before submit', () => {
    const creature = createEmptyCreature({ systemId: 'dnd-5e-srd' })
    const normalized = normalizeCreatureForSubmit({
      ...creature,
      label: '  ',
      description: undefined
    })

    expect(normalized).toMatchObject({
      label: 'Untitled Creature',
      description: '',
      category: 'MONSTER',
      speeds: []
    })
  })

  it('adapts primitive authored arrays to editable rows and back', () => {
    const authored = normalizeCreatureForSubmit(createEmptyCreature({ systemId: 'dnd-5e-srd' }))
    const formValues = toCreatureFormValues({
      ...authored,
      tags: ['forest', 'ambush'],
      senses: [darkvision60],
      logisticsNotes: ['Requires a saddle.'],
      npcProfile: {
        bonds: ['Protects the village.'],
        flaws: ['Trusts too easily.'],
        ideals: ['Community.'],
        personalityTraits: ['Never names a source.']
      }
    })

    expect(formValues).toMatchObject({
      tags: [{ value: 'forest' }, { value: 'ambush' }],
      senses: [darkvision60],
      logisticsNotes: [{ value: 'Requires a saddle.' }],
      npcProfile: {
        bonds: [{ value: 'Protects the village.' }],
        flaws: [{ value: 'Trusts too easily.' }],
        ideals: [{ value: 'Community.' }],
        personalityTraits: [{ value: 'Never names a source.' }]
      }
    })

    const normalized = normalizeCreatureForSubmit({
      ...formValues,
      tags: [...(formValues.tags ?? []), { value: '  ' }]
    })

    expect(normalized).toMatchObject({
      tags: ['forest', 'ambush'],
      senses: [darkvision60],
      logisticsNotes: ['Requires a saddle.'],
      npcProfile: {
        bonds: ['Protects the village.'],
        flaws: ['Trusts too easily.'],
        ideals: ['Community.'],
        personalityTraits: ['Never names a source.']
      }
    })
  })

  it('preserves advanced equipment loadouts through guided-compatible normalization', () => {
    const formValues = toCreatureFormValues({
      ...normalizeCreatureForSubmit(createEmptyCreature({ systemId: 'dnd-5e-srd' })),
      features: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          label: 'Sword',
          description: 'Makes a weapon attack.',
          section: 'ACTION',
          order: 1
        }
      ],
      equipmentLoadout: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          equipmentId: '00000000-0000-4000-8000-000000000004',
          quantity: 1,
          useState: 'MAIN_HAND',
          attuned: false,
          actionFeatureIds: ['00000000-0000-4000-8000-000000000002']
        }
      ]
    })

    expect(normalizeCreatureForSubmit(formValues).equipmentLoadout).toEqual(
      formValues.equipmentLoadout
    )
  })

  it('creates schema-valid active creature defaults when required fields are selected', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    const creature = normalizeCreatureForSubmit({
      ...createEmptyCreature({ systemId: 'dnd-5e-srd' }),
      userId: 'user-1',
      label: 'River Hart',
      description: 'A sturdy beast.',
      creatureTypeId: 'beast',
      challengeRatingId: 'cr-1-4',
      category: 'BEAST',
      cost: {
        amount: 75,
        currencyId: 'gold'
      },
      mountProfile: { mountType: 'CONTROLLED', riderCount: 1, notes: '' },
      features: [
        {
          id: 'trampling-charge',
          label: 'Trampling Charge',
          description: 'The hart charges a nearby target.',
          section: 'ACTION',
          order: 1
        }
      ]
    })

    expect(creatureAuthoredDtoSchema.parse(creature)).toMatchObject({
      id: generatedId,
      category: 'BEAST',
      cost: {
        amount: 75,
        currencyId: 'gold'
      },
      mountProfile: {
        mountType: 'CONTROLLED'
      },
      features: [{ section: 'ACTION' }]
    })
  })
})
