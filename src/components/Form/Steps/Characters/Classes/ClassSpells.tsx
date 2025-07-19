import Collapsible from '@/components/Collapse'
import parse from 'html-react-parser'
import { get, isEqual, set } from 'lodash'
import { useCallback, useEffect, useMemo } from 'react'
import { Attributes, Measurements, Rounding } from '@/enums'
import { Grid, Group, Button } from '@mantine/core'
import { useClassData, useEnumChecks, useFeatureData, useSectionData, useSpellData } from '@/hooks'
import type {
  SpellListItem,
  CharacterClassInput,
  CharacterSpellInput,
  CharacterSpellcastingInput,
  ClassSpellListInput,
} from '@/types'
import { withFieldGroup } from '@/components/Form'
import { CharacterSpellInputSchema, ClassSpellInputSchema, ClassSpellListInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'

const ClassSpells = withFieldGroup({
  defaultValues: {
    classInput: {} as CharacterClassInput | null | undefined,
    spellcasting: {} as CharacterSpellcastingInput | null | undefined,
  },
  render: function Render({ group }) {
    const formStore = useFormStore()

    const { getAttributes } = useEnumChecks()

    const { spells } = useSpellData()

    const {
      classes: { findClass },
    } = useClassData()

    const {
      features: { findFeature },
    } = useFeatureData()

    const {
      featureSpells: { findFeatureSpell },
    } = useSectionData()

    const { classInput, spellcasting } = useStore(group.store, (state) => ({
      classInput: state.values.classInput,
      spellcasting: state.values.spellcasting,
    }))

    const fullClass = findClass(classInput?.id)!

    const { preparesSpells, usesSpellbook } = getAttributes({ attributes: fullClass.attributes ?? [] })

    const casterType = preparesSpells ? 'prepared' : 'known'

    const classLevel = classInput?.level ?? 1

    const maxSpellLevel = useMemo(() => {
      const fullClassLevel = fullClass?.levelAttributes?.find(
        (levelAttribute) => levelAttribute?.level === Number(classLevel)
      )
      if (fullClassLevel && fullClassLevel?.spellSlots?.length) {
        return fullClassLevel?.spellSlots?.length
      }
      return 0
    }, [fullClass?.levelAttributes, classLevel])

    const maxSpellsKnown = useMemo(() => {
      const fullClassLevel = fullClass?.levelAttributes?.find(
        (levelAttribute) => levelAttribute?.level === Number(classLevel)
      )
      if (fullClassLevel && fullClassLevel?.spellsKnownLimit) {
        return fullClassLevel?.spellsKnownLimit
      }
      return 0
    }, [fullClass?.levelAttributes, classLevel])

    const maxCantripsKnown = useMemo(() => {
      const fullClassLevel = fullClass?.levelAttributes?.find(
        (levelAttribute) => levelAttribute?.level === Number(classLevel)
      )
      if (fullClassLevel && fullClassLevel?.cantripsKnownLimit) {
        return fullClassLevel?.cantripsKnownLimit
      }
      return 0
    }, [fullClass?.levelAttributes, classLevel])

    const createSpellArray = useCallback(() => {
      let subclassMapped: boolean = false

      let spellsArrayUpdated: ClassSpellListInput[] = []

      const createArray = (type?: 'subclass' | 'subtype', spellsArray?: ClassSpellListInput[]) => {
        if (spellsArray && spellsArray.length) {
          spellsArrayUpdated = [...spellsArray]
        }

        const spellClass = type === 'subclass' ? classInput?.subclass?.id : classInput?.id

        const filteredSpells = spells.filterByClass(spellClass)

        const subSpells: (SpellListItem & { level: number })[] = []

        fullClass?.features?.forEach((f) => {
          const feature = findFeature(f)
          if (!feature) return
          // Check features for spells sections
          if (feature.spells?.length) {
            // If spells section exists and is array that's populated
            feature.spells?.some((s) => {
              const spell = findFeatureSpell(s)
              if (!spell) return
              // If feature section expands spell list
              if (
                spell.attributes?.some((attribute) => attribute === Attributes.EXPANDS_SPELL_LIST) &&
                !spell.attributes?.some((attribute) => attribute === Attributes.ALWAYS_PREPARED)
              ) {
                if (
                  spell.attributes?.some(
                    (attribute) => attribute === Attributes.SPELLS_BY_LEVEL && spell.spellsByLevel?.length
                  )
                ) {
                  if (
                    (spell.subtype != null && spell.subtype === classInput?.subclass?.subtype) ||
                    spell.subtype == null
                  ) {
                    spell.spellsByLevel
                      ?.flatMap((levelObject) =>
                        levelObject?.ids?.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
                      )
                      .forEach((lSpell) => {
                        if (lSpell && !subSpells?.some((sSpell) => sSpell.id === lSpell?.id)) {
                          const spellLevel = spells.findLevel(lSpell?.id)!
                          subSpells.push({ ...lSpell, level: spellLevel })
                        }
                      })
                  }
                } else {
                  spell.ids?.forEach((fSpell) => {
                    const subSpell = spells.find((sSpell) => sSpell.id === fSpell)
                    if (subSpell) {
                      const spellLevel = spells.findLevel(subSpell?.id)!
                      subSpells.push({ ...subSpell, level: spellLevel })
                    }
                  })
                }
              }
            })
          }
        })

        if (subSpells?.length) {
          filteredSpells.push(...subSpells)
        }
        filteredSpells.forEach((spell) => {
          const spellLevel = spells.findLevel(spell?.id)
          const groupIndex = spellsArrayUpdated?.findIndex((group) => group.level === spellLevel)
          if (groupIndex === -1) {
            const index = spellsArrayUpdated?.length
            set(spellsArrayUpdated, `${index}`, { level: spellLevel, spells: [{ ...spell }] })
          } else {
            const groupObject = get(spellsArrayUpdated, `${groupIndex}`)
            if (!groupObject?.spells?.some((gSpell) => gSpell?.id === spell?.id)) {
              set(spellsArrayUpdated, `${groupIndex}.spells`, [...(groupObject?.spells ?? []), { ...spell }])
            }
          }
        })
      }

      createArray()

      if (classInput?.subclass && !subclassMapped) {
        subclassMapped = true
        createArray('subclass', spellsArrayUpdated)
      }

      spellsArrayUpdated = spellsArrayUpdated
        .sort((a, b) => a.level - b.level)
        .map((groupObject) => {
          groupObject?.spells?.sort((a, b) => {
            const spellA = spells.findSpell(a.id)
            const spellB = spells.findSpell(b.id)
            if (spellA && spellB) {
              return spellA?.label.localeCompare(spellB?.label) || 0
            }
            if (spellA) {
              return -1
            }
            if (spellB) {
              return 1
            }
            return 0
          })
          return groupObject
        })

      return spellsArrayUpdated
    }, [spells, fullClass.features, classInput?.id, classInput?.subclass, findFeature, findFeatureSpell])

    const spellListArray = useMemo(() => createSpellArray(), [createSpellArray])

    const additionalSpellsArray = useCallback(() => {
      const additionalSpells: CharacterSpellInput[] = [...(get(classInput, 'spellList.additional') || [])]

      fullClass?.features?.forEach((f) => {
        const feature = findFeature(f)
        if (!feature) return
        // Check features for spells sections
        if (feature.spells?.length) {
          // If spells section exists and is array that's populated
          feature.spells?.some((s) => {
            const spell = findFeatureSpell(s)
            if (!spell) return
            // If feature section expands spell list
            if (
              spell.attributes?.some((attribute) => attribute === Attributes.EXPANDS_SPELL_LIST) &&
              spell.attributes?.some((attribute) => attribute === Attributes.ALWAYS_PREPARED)
            ) {
              const isRitual = spell.attributes?.some((attribute) => attribute === Attributes.IS_RITUAL)
              const usesSlot = spell.attributes?.some((attribute) => attribute === Attributes.USES_SLOT)
              const alwaysPrepared = true
              const requiresConcentration = spell.attributes?.some(
                (attribute) => attribute === Attributes.REQUIRES_CONCENTRATION
              )
              const castAtLevel = spell.attributes?.some((attribute) => attribute === Attributes.CAST_AT_LEVEL)
              const optionalAbility = spell.attributes?.some((attribute) => attribute === Attributes.OPTIONAL_ABILITY)
              if (
                spell.attributes?.some(
                  (attribute) => attribute === Attributes.SPELLS_BY_LEVEL && spell.spellsByLevel?.length
                )
              ) {
                if (
                  (spell.subtype != null && spell.subtype === classInput?.subclass?.subtype) ||
                  spell.subtype == null
                ) {
                  spell.spellsByLevel
                    ?.flatMap((levelObject) =>
                      levelObject?.ids?.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
                    )
                    .forEach((lSpell) => {
                      if (lSpell && !additionalSpells?.some((sSpell) => sSpell.id === lSpell.id)) {
                        const spellLevel = spells.findLevel(lSpell?.id)!
                        additionalSpells.push(
                          CharacterSpellInputSchema.parse({
                            level: spellLevel,
                            id: lSpell.id,
                            isRitual,
                            usesSlot,
                            alwaysPrepared,
                            requiresConcentration,
                            castAtLevel,
                            optionalAbility,
                            classId: classInput?.id,
                          })
                        )
                      }
                    })
                }
              } else {
                spell?.ids?.forEach((fSpell) => {
                  const spell = spells.findSpell(fSpell)
                  if (spell && !additionalSpells?.some((sSpell) => sSpell.id === spell.id)) {
                    const spellLevel = spells.findLevel(fSpell)!
                    additionalSpells.push(
                      CharacterSpellInputSchema.parse({
                        classId: classInput?.id,
                        level: spellLevel,
                        id: spell.id,
                        isRitual,
                        usesSlot,
                        alwaysPrepared,
                        requiresConcentration,
                        castAtLevel,
                        optionalAbility,
                        saveAbility: spell.saveAbility,
                      })
                    )
                  }
                })
              }
            }
          })
        }
      })

      return additionalSpells
    }, [spells, fullClass.features, classInput, findFeature, findFeatureSpell])

    const additionalSpells = useMemo(() => additionalSpellsArray(), [additionalSpellsArray])

    const preparedSpellsArray = useCallback(() => {
      const preparedArray: ClassSpellListInput[] = [...(spellcasting?.[casterType] || [])]
      return preparedArray
    }, [spellcasting, casterType])

    const preparedSpells = useMemo(() => preparedSpellsArray(), [preparedSpellsArray])

    useEffect(() => {
      if (preparedSpells.length && !isEqual(preparedSpells, spellcasting?.[casterType])) {
        group.setFieldValue(`spellcasting.${casterType}`, preparedSpells)
        formStore.updateField({ path: `spellcasting.${casterType}`, value: preparedSpells })
      }
    }, [casterType, group, preparedSpells, spellcasting, formStore])

    useEffect(() => {
      if (!isEqual(additionalSpells, spellcasting?.additional)) {
        group.setFieldValue('spellcasting.additional', additionalSpells)
        formStore.updateField({ path: 'spellcasting.additional', value: additionalSpells })
      }
    }, [additionalSpells, spellcasting, group, formStore])

    const maxPreparedSpells = () => {
      const classLevel = classInput?.level ?? 1
      let maxCount: number = 0
      if (fullClass.spellcasting?.prepareLimit?.methods?.some((method) => method === Attributes.SPELL_ABILITY)) {
        if (fullClass.spellcasting?.prepareLimit?.level?.measurement === Measurements.HALF) {
          if (fullClass.spellcasting?.prepareLimit.level?.rounding === Rounding.DOWN) {
            maxCount = maxCount + classLevel < 2 ? 1 : Math.floor(classLevel / 2)
          } else {
            maxCount = maxCount + classLevel < 2 ? 1 : Math.ceil(classLevel / 2)
          }
        } else {
          maxCount = classLevel
        }

        if (maxCount < 1) {
          maxCount = 1
        }
      }

      return maxCount
    }

    // Remove class spells if class level is below allowed spell level
    useEffect(() => {
      if (spellcasting?.[casterType]?.length) {
        const updatedKnown = spellcasting?.[casterType]?.filter((listObject) => listObject.level <= maxSpellLevel)
        if (!isEqual(spellcasting?.[casterType], updatedKnown)) {
          group.setFieldValue(`spellcasting.${casterType}`, updatedKnown)
          formStore.updateField({ path: `spellcasting.${casterType}`, value: updatedKnown })
        }
      }
      if (usesSpellbook && spellcasting?.known?.length) {
        const updatedKnown = spellcasting?.known?.filter((listObject) => listObject.level <= maxSpellLevel)
        if (!isEqual(spellcasting?.known, updatedKnown)) {
          group.setFieldValue('spellcasting.known', updatedKnown)
          formStore.updateField({ path: 'spellcasting.known', value: updatedKnown })
        }
      }
    }, [maxSpellLevel, spellcasting, group, casterType, usesSpellbook, formStore])

    /* Sets how the spells are stored
     Spell book uses the "known" array */
    const spellList = spellcasting?.[usesSpellbook || !preparesSpells ? 'known' : 'prepared']?.filter(
      (group) => group.level
    )

    const cantripsKnown = spellcasting?.[casterType]?.filter((known) => known.level === 0)

    const preparedSpellCount =
      spellcasting?.prepared
        ?.flatMap((listObject) => listObject.spells?.map((spell) => spell))
        .filter((spell) => spell && !spell.alwaysPrepared).length || 0

    const cantripsKnownCount =
      cantripsKnown
        ?.flatMap((listObject) => listObject.spells?.map((spell) => spell))
        .filter((spell) => spell && !spell.alwaysPrepared).length || 0

    const knownSpellCount = spellList?.flatMap((listObject) => listObject.spells?.map((oSpell) => oSpell)).length || 0

    const handleAddSpell = (spell: SpellListItem, type: 'known' | 'prepared') => {
      let spellList: ClassSpellListInput[] = JSON.parse(JSON.stringify(spellcasting?.[type] || []))
      const spellLevel = spells.findLevel(spell.id)!
      if (spellList?.length) {
        let spellLevelIndex = spellList.findIndex((listObject) => listObject.level === spellLevel)
        if (spellLevelIndex !== -1) {
          spellList[spellLevelIndex].spells = [
            ...(spellList[spellLevelIndex].spells ?? []),
            ClassSpellInputSchema.parse({ id: spell.id, classId: classInput?.id }),
          ]
        } else {
          spellLevelIndex = spellList.length || 0
          spellList[spellLevelIndex] = ClassSpellListInputSchema.parse({
            level: spellLevel,
            spells: [ClassSpellInputSchema.parse({ id: spell.id, classId: classInput?.id })],
          })
        }
      } else {
        spellList.push(
          ClassSpellListInputSchema.parse({
            level: spellLevel,
            spells: [ClassSpellInputSchema.parse({ id: spell.id, classId: classInput?.id })],
          })
        )
      }

      spellList = spellList
        .sort((a, b) => a.level - b.level)
        .map((listObject) => {
          listObject.spells?.sort((a, b) => {
            const aSpell = spells.find((spell) => spell.id === a.id)
            const bSpell = spells.find((spell) => spell.id === b.id)

            if (aSpell && bSpell) {
              return aSpell.label?.localeCompare(bSpell.label) || 0
            }
            if (aSpell) {
              return -1
            }
            if (bSpell) {
              return 1
            }
            return 0
          })
          return listObject
        })

      group.setFieldValue(`spellcasting.${type}`, spellList)
      formStore.updateField({ path: `spellcasting.${type}`, value: spellList })
    }

    const handleRemoveSpell = (spell: SpellListItem, type: 'known' | 'prepared') => {
      const spellList: ClassSpellListInput[] = [ClassSpellListInputSchema.parse(spellcasting?.[type])]
      const spellLevel = spells.findLevel(spell.id)
      const spellObjectIndex = spellList.findIndex((listObject) => listObject.level === spellLevel)
      const spellArray = spellList[spellObjectIndex]?.spells?.filter((tSpell) => tSpell.id !== spell.id)

      if (!spellArray?.length) {
        if (spellList.length === 1) {
          return
        }
        const updatedSpellList = spellcasting?.[type]?.filter((_, i) => i !== spellObjectIndex)
        group.setFieldValue(`spellcasting.${type}`, updatedSpellList)
        return formStore.updateField({ path: `spellcasting.${type}`, value: updatedSpellList })
      }
      group.setFieldValue(`spellcasting.${type}[${spellObjectIndex}].spells`, spellArray)
      return formStore.updateField({ path: `spellcasting.${type}[${spellObjectIndex}].spells`, value: spellArray })
    }

    return (
      <>
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: `${preparesSpells ? 'Prepared' : 'Known'} Spells`,
              },
            }}
          >
            <Grid>
              {spellcasting?.[casterType]?.length ?
                spellcasting?.[casterType]?.map(
                  (listObject, lIndex) =>
                    listObject.spells?.length && (
                      <Grid.Col key={lIndex}>
                        <Collapsible
                          props={{
                            trigger: {
                              title: listObject.level === 0 ? 'Cantrips' : `Level ${listObject.level}`,
                            },
                          }}
                        >
                          <Grid>
                            {listObject.spells.map((spell, sIndex) => {
                              const stateSpell = spells.find((sSpell) => sSpell.id === spell.id)
                              return (
                                <Grid.Col key={sIndex}>
                                  <Collapsible
                                    props={{
                                      trigger: {
                                        title: stateSpell?.label || '',
                                      },
                                    }}
                                  >
                                    {stateSpell?.desc && parse(stateSpell?.desc)}
                                  </Collapsible>
                                </Grid.Col>
                              )
                            })}
                          </Grid>
                        </Collapsible>
                      </Grid.Col>
                    )
                )
              : <div>{`No ${preparesSpells ? 'prepared' : 'known'} spells`}</div>}
            </Grid>
          </Collapsible>
        </Grid.Col>
        {usesSpellbook && (
          <Grid.Col>
            <Collapsible
              props={{
                trigger: {
                  title: 'Spellbook',
                },
              }}
            >
              <Grid>
                <Group>
                  <span>
                    {`Prepared Spells: ${preparedSpellCount}/${preparesSpells ? maxPreparedSpells() : maxSpellsKnown}`}
                  </span>
                </Group>
                {maxSpellLevel &&
                  spellList?.map((listObject, lIndex) => {
                    return (
                      listObject.level &&
                      listObject.level <= maxSpellLevel && (
                        <Grid.Col key={lIndex}>
                          <Collapsible
                            props={{
                              trigger: {
                                title: `Level ${listObject.level}`,
                              },
                            }}
                          >
                            <Grid>
                              {listObject.spells?.map((spell, sIndex) => {
                                const fullSpell = spells.find((sSpell) => sSpell.id === spell.id)
                                if (fullSpell) {
                                  const spellFound = spellcasting?.prepared
                                    ?.flatMap((listObject) => listObject.spells)
                                    ?.find((lSpell) => lSpell && fullSpell.id === lSpell.id)
                                  const disabled =
                                    (preparesSpells ?
                                      preparedSpellCount >= maxPreparedSpells()
                                    : knownSpellCount >= maxSpellsKnown) && !spellFound
                                  return (
                                    <Grid.Col key={sIndex}>
                                      <Collapsible
                                        props={{
                                          trigger: {
                                            title: fullSpell.label,
                                            titleRight: (
                                              <Button
                                                color={spellFound != null ? 'danger' : 'primary'}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  if (spellFound != null) {
                                                    handleRemoveSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                  } else {
                                                    handleAddSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                  }
                                                }}
                                                disabled={disabled}
                                              >
                                                {spellFound != null ?
                                                  'Remove'
                                                : disabled ?
                                                  '---'
                                                : 'Add'}
                                              </Button>
                                            ),
                                          },
                                        }}
                                      >
                                        {fullSpell?.desc && parse(fullSpell?.desc)}
                                      </Collapsible>
                                    </Grid.Col>
                                  )
                                }
                              })}
                            </Grid>
                          </Collapsible>
                        </Grid.Col>
                      )
                    )
                  })}
              </Grid>
            </Collapsible>
          </Grid.Col>
        )}
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: `${preparesSpells && !usesSpellbook ? 'Known' : 'Add'} Spells`,
              },
            }}
          >
            <Grid>
              <Grid.Col>
                <Group>
                  <span>{`Cantrips: ${cantripsKnownCount}/${maxCantripsKnown}`}</span>
                  <span>
                    {!usesSpellbook &&
                      `${preparesSpells ? 'Prepared' : 'Known'} Spells: ${knownSpellCount}/${
                        preparesSpells ? maxPreparedSpells() : maxSpellsKnown
                      }`}
                  </span>
                </Group>
              </Grid.Col>
              {spellListArray?.map((group, lIndex) => {
                return (
                  group.level <= maxSpellLevel && (
                    <Grid.Col key={lIndex}>
                      <Collapsible
                        props={{
                          trigger: {
                            title: group.level === 0 ? 'Cantrips' : `Level ${group.level}`,
                          },
                        }}
                      >
                        <Grid>
                          {group.spells?.map((spell, sIndex) => {
                            const spellFound = spellList
                              ?.flatMap((listObject) => listObject.spells)
                              ?.find((oSpell) => oSpell && spell.id === oSpell.id)
                            const cantripFound = cantripsKnown
                              ?.flatMap((cantripObject) => cantripObject.spells)
                              ?.find((oSpell) => oSpell && spell.id === oSpell.id)
                            const fullSpell = spells.find((sSpell) => sSpell.id === spell.id)
                            const cantripDisabled = cantripsKnownCount === maxCantripsKnown && !cantripFound
                            const spellDisabled =
                              spellFound?.alwaysPrepared ||
                              ((preparesSpells ?
                                preparedSpellCount >= maxPreparedSpells()
                              : knownSpellCount >= maxSpellsKnown) &&
                                !spellFound)
                            if (fullSpell) {
                              return (
                                <Grid.Col key={sIndex}>
                                  <Collapsible
                                    props={{
                                      trigger: {
                                        title: fullSpell.label,
                                        titleRight:
                                          group.level === 0 ?
                                            <Button
                                              color={cantripFound != null ? 'danger' : 'primary'}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (cantripFound != null) {
                                                  handleRemoveSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                } else {
                                                  handleAddSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                }
                                              }}
                                              disabled={cantripDisabled}
                                            >
                                              {cantripFound != null ?
                                                'Remove'
                                              : cantripDisabled ?
                                                '---'
                                              : 'Add'}
                                            </Button>
                                          : <Button
                                              color={spellFound != null ? 'danger' : 'primary'}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (spellFound != null) {
                                                  handleRemoveSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                } else {
                                                  handleAddSpell(fullSpell, !preparesSpells ? 'known' : 'prepared')
                                                }
                                              }}
                                              disabled={spellDisabled}
                                            >
                                              {spellFound != null ?
                                                'Remove'
                                              : spellDisabled ?
                                                '---'
                                              : 'Add'}
                                            </Button>,
                                      },
                                    }}
                                  >
                                    {fullSpell?.desc && parse(fullSpell?.desc)}
                                  </Collapsible>
                                </Grid.Col>
                              )
                            }
                          })}
                        </Grid>
                      </Collapsible>
                    </Grid.Col>
                  )
                )
              })}
            </Grid>
          </Collapsible>
        </Grid.Col>
      </>
    )
  },
})

export default ClassSpells
