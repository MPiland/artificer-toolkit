import {
  afterEach,
  describe,
  expect,
  it,
  vi } from 'vitest'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import {
  createDefaultAbilityScores,
  createEmptyAction,
  createEmptyCreature,
  createEmptyMountProfile,
  normalizeCreatureForSubmit,
  resolveCreateCreatureSystemId
} from '../creatureAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

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
      recordKind: 'STAT_BLOCK',
      category: 'MONSTER',
      size: 'MEDIUM',
      systemId: 'dnd-5e-srd',
      abilityScores: createDefaultAbilityScores()
    })
  })

  it('uses only real system list data when creating creatures', () => {
    expect(resolveCreateCreatureSystemId([])).toBeNull()
    expect(resolveCreateCreatureSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
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
      recordKind: 'STAT_BLOCK',
      category: 'MONSTER',
      actions: [],
      speeds: []
    })
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
      mountProfile: createEmptyMountProfile(),
      actions: [createEmptyAction()]
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
      }
    })
  })
})
