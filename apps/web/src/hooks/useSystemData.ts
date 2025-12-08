import { useRouteContext } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchSystem } from '~apis'
import { createArrayWithMethods } from '~utils'
import type { System, GenericType } from '~types'

type ModifierMethod = System['modifiers']['methods'][number]

type FilteredModifierMethods = ModifierMethod[] & {
  _typeId?: string
  _categoryId?: string
} & ModMethodMethods

type ModMethodMethods = {
  findMethod: (id?: string | null) => ModifierMethod | undefined | null
  filterByType: (typeId?: string | null) => FilteredModifierMethods
  filterByCategory: (categoryId?: string | null) => FilteredModifierMethods
  filterByTypeAndCategory: (typeId?: string | null, categoryId?: string | null) => FilteredModifierMethods
}

type EquipmentCategoryMethods = {
  findCategory: (id?: string | null) => System['modifiers']['categories'][number] | undefined | null
  filterByProperties: (ids: string[] | null | undefined) => System['equipment']['categories']
}

type EquipmentPropertyMethods = {
  findProperty: (id?: string | null) => System['equipment']['properties'][number] | undefined | null
  filterByCategory: (categoryId?: string | null | undefined) => System['equipment']['properties']
}

const useSystemData = () => {
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data: system } = useSuspenseQuery(fetchSystem(systemPref))

  if (!system) return null

  const modMethodMethods: ModMethodMethods = {
    findMethod(this: FilteredModifierMethods, id) {
      if (!id) return undefined
      return this.find((m) => m.id === id)
    },
    filterByType(this: FilteredModifierMethods, typeId) {
      if (!typeId) return createArrayWithMethods(this, modMethodMethods)
      if (this._categoryId) {
        const filteredModifierMethods = system.modifiers.methods.filter((method) =>
          system.modifiers.categoryMethods
            .filter((bridge) => bridge?.typeId === typeId && bridge?.categoryId === this._categoryId)
            .some((bridge) => bridge?.methodId === method?.id)
        )
        const enrichedMethods = createArrayWithMethods(
          filteredModifierMethods,
          modMethodMethods
        ) as FilteredModifierMethods
        enrichedMethods._typeId = typeId
        return enrichedMethods
      }
      const filteredModifierMethods = system.modifiers.methods.filter((method) =>
        system.modifiers.typeMethods
          .filter((bridge) => bridge?.typeId === typeId)
          .some((bridge) => bridge?.methodId === method?.id)
      )
      const enrichedMethods = createArrayWithMethods(
        filteredModifierMethods,
        modMethodMethods
      ) as FilteredModifierMethods
      enrichedMethods._typeId = typeId
      return enrichedMethods
    },
    filterByCategory(this: FilteredModifierMethods, categoryId) {
      if (!categoryId) return createArrayWithMethods(this, modMethodMethods)
      let filteredModifierMethods: GenericType[] = []
      if (this._typeId) {
        filteredModifierMethods = system.modifiers.methods.filter((method) => {
          return system.modifiers.categoryMethods
            .filter((bridge) => bridge?.categoryId === categoryId && bridge?.typeId === this._typeId)
            .some((bridge) => bridge?.methodId === method?.id)
        })
      }
      filteredModifierMethods = system.modifiers.methods.filter((method) => {
        return system.modifiers.categoryMethods
          .filter((bridge) => bridge?.categoryId === categoryId)
          .some((bridge) => bridge?.methodId === method?.id)
      })
      const enrichedMethods = createArrayWithMethods(
        filteredModifierMethods,
        modMethodMethods
      ) as FilteredModifierMethods
      enrichedMethods._categoryId = categoryId
      return enrichedMethods
    },
    filterByTypeAndCategory(this: FilteredModifierMethods, typeId, categoryId) {
      if (!typeId || !this._typeId || !categoryId || this._categoryId) {
        return createArrayWithMethods(this, modMethodMethods)
      }
      const fTypeId = this._typeId || typeId
      const fCategoryId = this._categoryId || categoryId
      const filteredModifierMethods = system.modifiers.methods.filter((method) => {
        return system.modifiers.categoryMethods.some(
          (bridge) => bridge.methodId === method.id && bridge.categoryId === fCategoryId && bridge.typeId === fTypeId
        )
      })
      const enrichedMethods = createArrayWithMethods(
        filteredModifierMethods,
        modMethodMethods
      ) as FilteredModifierMethods
      enrichedMethods._typeId = typeId
      enrichedMethods._categoryId = categoryId
      return enrichedMethods
    },
  }

  return {
    system: system,
    abilities: createArrayWithMethods(system.abilities, {
      findAbility: (id?: string | null) => {
        if (!id) return null
        return system.abilities.find((a) => a.id === id)
      },
    }),
    actions: createArrayWithMethods(system.actions, {
      findAction: (id?: string | null) => {
        if (!id) return null
        return system.actions.find((a) => a.id === id)
      },
    }),
    alignments: createArrayWithMethods(system.alignments, {
      findAlignment: (id?: string | null) => {
        if (!id) return null
        return system.alignments.find((a) => a.id === id)
      },
    }),
    attributes: createArrayWithMethods(system.attributes, {
      findAttribute: (id?: string | null) => {
        if (!id) return null
        return system.attributes.find((a) => a.id === id)
      },
    }),
    categories: createArrayWithMethods(system.categories, {
      findCategory: (id?: string | null) => system.categories.find((c) => c.id === id),
    }),
    characters: {
      hitpointCalcMethods: createArrayWithMethods(system.characters.hitpointCalcMethods, {
        findHitpointCalcMethod: (id?: string | null) => {
          if (!id) return null
          return system.characters.hitpointCalcMethods.find((h) => h.id === id)
        },
      }),
      advancementMethods: createArrayWithMethods(system.characters.advancementMethods, {
        findAdvancementMethod: (id?: string | null) => {
          if (!id) return null
          return system.characters.advancementMethods.find((a) => a.id === id)
        },
      }),
      spellPointCalcMethods: createArrayWithMethods(system.characters.spellPointCalcMethods, {
        findSpellPointCalcMethod: (id?: string | null) => {
          if (!id) return null
          return system.characters.spellPointCalcMethods.find((s) => s.id === id)
        },
      }),
      startingEquipmentOptions: createArrayWithMethods(system.characters.startingEquipmentOptions, {
        findStartingEquipmentOption: (id?: string | null) => {
          if (!id) return null
          return system.characters.startingEquipmentOptions.find((s) => s.id === id)
        },
      }),
    },
    charges: {
      resets: createArrayWithMethods(system.charges.resets, {
        findReset: (id?: string | null) => {
          if (!id) return null
          return system.charges.resets.find((r) => r.id === id)
        },
      }),
      limits: createArrayWithMethods(system.charges.limits, {
        findLimit: (id?: string | null) => {
          if (!id) return null
          return system.charges.limits.find((l) => l.id === id)
        },
      }),
    },
    conditions: createArrayWithMethods(system.conditions, {
      findCondition: (id?: string | null) => {
        if (!id) return null
        return system.conditions.find((c) => c.id === id)
      },
    }),
    currencies: createArrayWithMethods(system.currencies, {
      findCurrency: (id?: string | null) => {
        if (!id) return null
        return system.currencies.find((c) => c.id === id)
      },
    }),
    damageTypes: createArrayWithMethods(system.damageTypes, {
      findDamageType: (id?: string | null) => {
        if (!id) return null
        return system.damageTypes.find((d) => d.id === id)
      },
    }),
    equipment: {
      categories: createArrayWithMethods(system.equipment.categories, {
        findCategory: (id?: string | null) => {
          if (!id) return null
          return system.equipment.categories.find((c) => c.id === id)
        },
        filterByProperties(this: System['equipment']['categories'] & EquipmentCategoryMethods, ids?: string[] | null) {
          if (!ids || !ids.length) return system.equipment.categories
          return this.filter((c) => {
            return system.equipment.categoryProperties.some(
              (bridge) => bridge.categoryId === c.id && ids?.includes(bridge.propertyId)
            )
          })
        },
      }),
      properties: createArrayWithMethods(system.equipment.properties, {
        findProperty: (id?: string | null | undefined) => {
          if (!id) return null
          system.equipment.properties.find((p) => p.id === id)
        },
        filterByCategory(
          this: System['equipment']['properties'] & EquipmentPropertyMethods,
          id?: string | null | undefined
        ) {
          if (!id || id === '') return system.equipment.properties
          return this.filter((property) =>
            system.equipment.categoryProperties.some(
              (bridge) => bridge?.categoryId === id && bridge?.propertyId === property?.id
            )
          )
        },
      }),
      rarities: createArrayWithMethods(system.equipment.rarities, {
        findRarity: (id?: string | null | undefined) => {
          if (!id) return null
          return system.equipment.rarities.find((r) => r.id === id)
        },
      }),
    },
    languages: createArrayWithMethods(system.languages, {
      findLanguage: (id?: string | null) => {
        if (!id) return null
        return system.languages.find((l) => l.id === id)
      },
    }),
    modifiers: {
      categories: createArrayWithMethods(system.modifiers.categories, {
        findCategory: (id?: string | null | undefined) => {
          if (!id) return null
          return system.modifiers.categories.find((c) => c.id === id)
        },
      }),
      types: createArrayWithMethods(system.modifiers.types, {
        findType: (id?: string | null | undefined) => {
          if (!id) return null
          return system.modifiers.types.find((t) => t.id === id)
        },
        filterByCategory: (categoryId?: string | null | undefined) => {
          if (!categoryId) return system.modifiers.types
          return system.modifiers.types.filter((type) =>
            system.modifiers.categoryTypes
              .filter((bridge) => bridge?.categoryId === categoryId)
              .some((bridge) => bridge?.typeId === type?.id)
          )
        },
      }),
      methods: createArrayWithMethods(system.modifiers.methods, modMethodMethods),
      spellCategories: createArrayWithMethods(system.modifiers.spellCategories, {
        findSpellCategory: (id?: string | null | undefined) => {
          if (!id) return null
          return system.modifiers.spellCategories.find((s) => s.id === id)
        },
      }),
    },
    passives: createArrayWithMethods(system.passives, {
      findPassive: (id?: string | null) => {
        if (!id) return null
        return system.passives.find((p) => p.id === id)
      },
    }),
    prerequisites: createArrayWithMethods(system.prerequisites, {
      findPrerequisite: (id?: string | null) => {
        if (!id) return null
        return system.prerequisites.find((p) => p.id === id)
      },
    }),
    proficiencies: {
      levels: createArrayWithMethods(system.proficiencies.levels, {
        findLevel: (id?: string | null) => {
          if (!id) return null
          return system.proficiencies.levels.find((l) => l.id === id)
        },
      }),
      categories: createArrayWithMethods(system.proficiencies.categories, {
        findCategory: (id?: string | null | undefined) => {
          if (!id) return null
          return system.proficiencies.categories.find((c) => c.id === id)
        },
      }),
    },
    rules: {
      measurements: {
        amount: createArrayWithMethods(system.rules.measurements.amount, {
          findAmount: (id?: string | null | undefined) => {
            if (!id) return null
            return system.rules.measurements.amount.find((a) => a.id === id)
          },
        }),
        rounding: createArrayWithMethods(system.rules.measurements.rounding, {
          findRounding: (id?: string | null | undefined) => {
            if (!id) return null
            system.rules.measurements.rounding.find((r) => r.id === id)
          },
        }),
        imperial: {
          weight: createArrayWithMethods(system.rules.measurements.imperial.weight, {
            findWeight: (id?: string | null) => {
              if (!id) return null
              return system.rules.measurements.imperial.weight.find((w) => w.id === id)
            },
          }),
          volume: createArrayWithMethods(system.rules.measurements.imperial.volume, {
            findVolume: (id?: string | null) => {
              if (!id) return null
              return system.rules.measurements.imperial.volume.find((v) => v.id === id)
            },
          }),
          length: createArrayWithMethods(system.rules.measurements.imperial.length, {
            findLength: (id?: string | null) => {
              if (!id) return null
              return system.rules.measurements.imperial.length.find((l) => l.id === id)
            },
          }),
        },
      },
      abilityGenerateMethod: createArrayWithMethods(system.rules.abilityGenerateMethod, {
        findAbilityGenerateMethod: (id?: string | null) => {
          if (!id) return null
          return system.rules.abilityGenerateMethod.find((a) => a.id === id)
        },
      }),
    },
    senses: createArrayWithMethods(system.senses, {
      findSense: (id?: string | null) => {
        if (!id) return null
        return system.senses.find((s) => s.id === id)
      },
    }),
    sizes: createArrayWithMethods(system.sizes, {
      findSize: (id?: string | null) => {
        if (!id) return null
        return system.sizes.find((s) => s.id === id)
      },
    }),
    skills: createArrayWithMethods(system.skills, {
      findSkill: (id?: string | null) => {
        if (!id) return null
        return system.skills.find((s) => s.id === id)
      },
    }),
    speeds: createArrayWithMethods(system.speeds, {
      findSpeed: (id?: string | null) => {
        if (!id) return null
        return system.speeds.find((s) => s.id === id)
      },
    }),
    spells: {
      categories: createArrayWithMethods(system.spells.categories, {
        findCategory: (id?: string | null) => {
          if (!id) return null
          return system.spells.categories.find((c) => c.id === id)
        },
      }),
      durations: createArrayWithMethods(system.spells.durations, {
        findDuration: (id?: string | null) => {
          if (!id) return null
          return system.spells.durations.find((d) => d.id === id)
        },
      }),
      ranges: createArrayWithMethods(system.spells.ranges, {
        findRange: (id?: string | null) => {
          if (!id) return null
          return system.spells.ranges.find((r) => r.id === id)
        },
      }),
      schools: createArrayWithMethods(system.spells.schools, {
        findSchool: (id?: string | null) => {
          if (!id) return null
          return system.spells.schools.find((s) => s.id === id)
        },
      }),
      shapes: createArrayWithMethods(system.spells.shapes, {
        findShape: (id?: string | null) => {
          if (!id) return null
          return system.spells.shapes.find((s) => s.id === id)
        },
      }),
      requirements: createArrayWithMethods(system.spells.requirements, {
        findRequirement: (id?: string | null) => {
          if (!id) return null
          return system.spells.requirements.find((r) => r.id === id)
        },
      }),
    },
    terrains: createArrayWithMethods(system.terrains, {
      findTerrain: (id?: string | null) => {
        if (!id) return null
        return system.terrains.find((t) => t.id === id)
      },
    }),
  } as const
}

// Export with a non-null assertion in the type, not the implementation
export default useSystemData as () => NonNullable<ReturnType<typeof useSystemData>>
