import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'

const repositoryState = vi.hoisted(() => ({
  classes: [] as ClassAuthored[]
}))

vi.mock('@artificer-toolkit/db', () => ({
  createSystemRepository: () => ({ findById: async () => null }),
  createRaceRepository: () => ({
    findResolvedAll: async () => [],
    findResolvedById: async () => null
  }),
  createClassRepository: () => ({
    findByIds: async (ids: readonly string[]) => new Map(
      repositoryState.classes
        .filter((record) => ids.includes(record.id))
        .map((record) => [record.id, record])
    )
  }),
  createBackgroundRepository: () => ({ findByIds: async () => new Map() }),
  createEquipmentRepository: () => ({ findResolvedById: async () => null }),
  createFeatRepository: () => ({ findByIds: async () => new Map() }),
  createFeatureRepository: () => ({ findByIds: async () => new Map() }),
  getCharacterAssemblyStructureQuery: async () => ({
    rootFeatureLinks: [],
    ancestryOptions: [],
    featureOptions: [],
    featureOptionChoices: []
  }),
  getRaceListQuery: async () => ({
    items: [],
    meta: { categories: [], selectionModes: [], parentRaces: [], features: [] }
  }),
  getClassListQuery: async () => ({
    items: repositoryState.classes.map((record) => ({
      id: record.id,
      label: record.label,
      category: record.category,
      parentClassId: 'parentClassId' in record ? record.parentClassId ?? null : null,
      subclassSelectionLevel:
        'subclassSelectionLevel' in record ? record.subclassSelectionLevel ?? null : null
    })),
    meta: { categories: [], parentClasses: [], multiclass: [], features: [] }
  }),
  getBackgroundListQuery: async () => ({ items: [], meta: { features: [] } }),
  getEquipmentListQuery: async () => ({
    items: [],
    meta: { categories: [], rarities: [], properties: [], features: [] }
  }),
  getFeatListQuery: async () => ({ items: [], meta: { features: [] } }),
  getSpellListQuery: async () => ({
    items: [],
    meta: { attributes: [], classes: [], schools: [], levels: [], castingTimeUnits: [] }
  })
}))

import { createEmptyCharacterAuthored, resolveCharacterBuilder } from './builderService.js'

function createBaseClass(): Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }> {
  return {
    id: 'fighter',
    label: 'Fighter',
    category: CLASS_CATEGORY.BASE,
    subclassSelectionLevel: 3,
    userId: 'user-1',
    systemId: 'system-1',
    startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
    startingEquipment: { id: 'fighter-equipment', sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d10' },
    multiclass: { id: 'fighter-multiclass', requirementGroups: { groups: [] } }
  }
}

function createSubclass(params: {
  id: string
  parentClassId?: string
}): Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }> {
  return {
    id: params.id,
    label: params.id === 'champion' ? 'Champion' : 'Other Archetype',
    category: CLASS_CATEGORY.SUBCLASS,
    parentClassId: params.parentClassId ?? 'fighter',
    userId: 'user-1',
    systemId: 'system-1'
  }
}

function createCharacter(classLevel: number, subclassId?: string) {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.intent.classes = [{ classId: 'fighter', classLevel, subclassId }]
  return character
}

describe('character Builder subclass selection level', () => {
  beforeEach(() => {
    repositoryState.classes = [createBaseClass(), createSubclass({ id: 'champion' })]
  })

  it('blocks a subclass supplied below the base class selection level', async () => {
    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter(2, 'champion'),
      'create'
    )

    expect(resolution.validations).toContainEqual(
      expect.objectContaining({
        code: 'SUBCLASS_SELECTION_UNAVAILABLE',
        severity: 'blocking'
      })
    )
    expect(resolution.readiness.ready).toBe(false)
  })

  it('requires an eligible subclass at the selection level', async () => {
    const resolution = await resolveCharacterBuilder({} as never, createCharacter(3), 'create')

    expect(resolution.outstandingChoices).toContainEqual(
      expect.objectContaining({
        code: 'SUBCLASS_SELECTION_REQUIRED',
        required: true
      })
    )
    expect(resolution.readiness.outstandingRequiredChoices).toContain(
      'Fighter requires a subclass selection at class level 3.'
    )
  })

  it('accepts an eligible child subclass while retaining parent mismatch validation', async () => {
    const valid = await resolveCharacterBuilder(
      {} as never,
      createCharacter(3, 'champion'),
      'create'
    )
    expect(valid.validations.map((issue) => issue.code)).not.toContain(
      'SUBCLASS_SELECTION_UNAVAILABLE'
    )
    expect(valid.outstandingChoices.map((issue) => issue.code)).not.toContain(
      'SUBCLASS_SELECTION_REQUIRED'
    )

    repositoryState.classes = [
      createBaseClass(),
      createSubclass({ id: 'other-archetype', parentClassId: 'wizard' })
    ]
    const mismatched = await resolveCharacterBuilder(
      {} as never,
      createCharacter(3, 'other-archetype'),
      'create'
    )
    expect(mismatched.validations.map((issue) => issue.code)).toContain('SUBCLASS_PARENT_MISMATCH')
  })
})
