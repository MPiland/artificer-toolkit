import Collapse from '../../../../Collapse/Collapse'
import parse from 'html-react-parser'
import Button from '../../../../Button/Button'
import { get, isEqual, set } from 'lodash'
import { use, useCallback, useEffect, useMemo } from 'react'
import Group from '../../../../Group/Group'
import {
  Character,
  ClassSpellList,
  CharacterSpell,
  Class,
  CharacterClass,
  type SpellListItem,
} from '../../../../../../amplify/gql/types'
import { Attributes, Measurement, Rounding } from '../../../../../types/enums'
import Grid from '../../../../Grid/Grid'
import { FormContext } from '../../../FormContext'
import { useEnumChecks } from '../../../../../hooks/useEnumChecks'
import useSpellData from '../../../../../hooks/useSpellData'
import type { OnChange } from '../../../../../types/form'

const ClassSpells = ({
  fullClass,
  classIndex,
  uClass,
}: {
  fullClass: Class
  classIndex: number
  uClass: CharacterClass
}) => {
  const {
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      removeField: OnChange<Character>['removeField']
    }
  }

  const { preparesSpells, usesSpellbook } = useEnumChecks({ data: fullClass })
  const { spells } = useSpellData()

  const casterType = preparesSpells ? 'prepared' : 'known'

  const maxSpellLevel = useMemo(() => {
    const fullClassLevel = fullClass?.levelAttributes?.find(
      (levelAttribute) => levelAttribute?.level === Number(uClass.level)
    )
    if (fullClassLevel && fullClassLevel?.spellSlots?.length) {
      return fullClassLevel?.spellSlots?.length
    }
    return 0
  }, [fullClass?.levelAttributes, uClass?.level])

  const maxSpellsKnown = useMemo(() => {
    const fullClassLevel = fullClass?.levelAttributes?.find(
      (levelAttribute) => levelAttribute?.level === Number(uClass.level)
    )
    if (fullClassLevel && fullClassLevel?.spellsKnownLimit) {
      return fullClassLevel?.spellsKnownLimit
    }
    return 0
  }, [fullClass?.levelAttributes, uClass?.level])

  const maxCantripsKnown = useMemo(() => {
    const fullClassLevel = fullClass?.levelAttributes?.find(
      (levelAttribute) => levelAttribute?.level === Number(uClass.level)
    )
    if (fullClassLevel && fullClassLevel?.cantripsKnownLimit) {
      return fullClassLevel?.cantripsKnownLimit
    }
    return 0
  }, [fullClass?.levelAttributes, uClass?.level])

  const createSpellArray = useCallback(() => {
    let subclassMapped: boolean = false

    let spellsArrayUpdated: Array<Omit<ClassSpellList, '__typename'>> = []

    const createArray = (type?: 'subclass' | 'subtype', spellsArray?: Array<Omit<ClassSpellList, '__typename'>>) => {
      if (spellsArray && spellsArray.length) {
        spellsArrayUpdated = [...spellsArray]
      }

      const spellClass = type === 'subclass' ? uClass?.subclass?.id : uClass.id

      const filteredSpells = spells.filterByClass(spellClass)

      const subSpells: (SpellListItem & { level: number })[] = []

      fullClass?.features?.forEach((feature) => {
        // Check features for spells sections
        if (feature.spells?.length) {
          // If spells section exists and is array that's populated
          feature.spells?.some((spell) => {
            // If feature section expands spell list
            if (
              spell.attributes?.some((attribute) => attribute === Attributes.expandsSpellList) &&
              !spell.attributes?.some((attribute) => attribute === Attributes.alwaysPrepared)
            ) {
              if (
                spell.attributes?.some(
                  (attribute) => attribute === Attributes.spellsByLevel && spell.spellsByLevel?.length
                )
              ) {
                if ((spell.subtype != null && spell.subtype === uClass.subclass?.subtype) || spell.subtype == null) {
                  spell.spellsByLevel
                    ?.flatMap((levelObject) =>
                      levelObject?.spells?.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
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

    if (uClass?.subclass && !subclassMapped) {
      subclassMapped = true
      createArray('subclass', spellsArrayUpdated)
    }

    spellsArrayUpdated = spellsArrayUpdated
      .sort((a, b) => a.level - b.level)
      .map((groupObject) => {
        groupObject?.spells?.sort((a, b) => {
          const spellA = spells.find((sSpell) => sSpell.id === a.id)
          const spellB = spells.find((sSpell) => sSpell.id === b.id)
          if (spellA && spellB) {
            return spellA?.value.localeCompare(spellB?.value) || 0
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
  }, [spells, fullClass.features, uClass.id, uClass.subclass])

  const spellListArray = useMemo(() => createSpellArray(), [createSpellArray])

  const additionalSpellsArray = useCallback(() => {
    const additionalSpells: Array<Omit<CharacterSpell, '__typename'>> = [...(get(uClass, 'spellList.additional') || [])]

    fullClass?.features?.forEach((feature) => {
      // Check features for spells sections
      if (feature.spells?.length) {
        // If spells section exists and is array that's populated
        feature.spells?.some((featureSpell) => {
          // If feature section expands spell list
          if (
            featureSpell.attributes?.some((attribute) => attribute === Attributes.expandsSpellList) &&
            featureSpell.attributes?.some((attribute) => attribute === Attributes.alwaysPrepared)
          ) {
            const isRitual = featureSpell.attributes?.some((attribute) => attribute === Attributes.isRitual)
            const usesSlot = featureSpell.attributes?.some((attribute) => attribute === Attributes.usesSlot)
            const alwaysPrepared = true
            const requiresConcentration = featureSpell.attributes?.some(
              (attribute) => attribute === Attributes.requiresConcentration
            )
            const castAtLevel = featureSpell.attributes?.some((attribute) => attribute === Attributes.castAtLevel)
            const optionalAbility = featureSpell.attributes?.some(
              (attribute) => attribute === Attributes.optionalAbility
            )
            if (
              featureSpell.attributes?.some(
                (attribute) => attribute === Attributes.spellsByLevel && featureSpell.spellsByLevel?.length
              )
            ) {
              if (
                (featureSpell.subtype != null && featureSpell.subtype === uClass.subclass?.subtype) ||
                featureSpell.subtype == null
              ) {
                featureSpell.spellsByLevel
                  ?.flatMap((levelObject) =>
                    levelObject?.spells?.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
                  )
                  .forEach((lSpell) => {
                    if (lSpell && !additionalSpells?.some((sSpell) => sSpell.id === lSpell.id)) {
                      const spellLevel = spells.findLevel(lSpell?.id)!
                      additionalSpells.push({
                        level: spellLevel,
                        id: lSpell.id,
                        isRitual,
                        usesSlot,
                        alwaysPrepared,
                        requiresConcentration,
                        castAtLevel,
                        optionalAbility,
                        classId: uClass.id,
                      })
                    }
                  })
              }
            } else {
              featureSpell?.ids?.forEach((fSpell) => {
                const spell = spells.find((sSpell) => sSpell.id === fSpell)
                if (spell && !additionalSpells?.some((sSpell) => sSpell.id === spell.id)) {
                  const spellLevel = spells.findLevel(fSpell)!
                  additionalSpells.push({
                    classId: uClass.id,
                    level: spellLevel,
                    id: spell.id,
                    isRitual,
                    usesSlot,
                    alwaysPrepared,
                    requiresConcentration,
                    castAtLevel,
                    optionalAbility,
                    ability: featureSpell.ability,
                  })
                }
              })
            }
          }
        })
      }
    })

    return additionalSpells
  }, [spells, fullClass.features, uClass])

  const additionalSpells = useMemo(() => additionalSpellsArray(), [additionalSpellsArray])

  const preparedSpellsArray = useCallback(() => {
    const preparedArray: Array<Omit<ClassSpellList, '__typename'>> = [...(data.spellcasting?.[casterType] || [])]
    return preparedArray
  }, [data.spellcasting, casterType])

  const preparedSpells = useMemo(() => preparedSpellsArray(), [preparedSpellsArray])

  useEffect(() => {
    if (preparedSpells.length && !isEqual(preparedSpells, data.spellcasting?.[casterType])) {
      updateField({
        path: `spellcasting.${casterType}`,
        value: preparedSpells,
      })
    }
  }, [casterType, classIndex, preparedSpells, updateField, data.spellcasting])

  useEffect(() => {
    if (!isEqual(additionalSpells, data.spellcasting?.additional)) {
      updateField({
        path: 'spellcasting.additional',
        value: additionalSpells,
      })
    }
  }, [additionalSpells, classIndex, updateField, data.spellcasting])

  const maxPreparedSpells = () => {
    let maxCount: number = 0
    if (fullClass.spellcasting?.prepareLimit?.methods?.some((method) => method === Attributes.spellAbility)) {
      if (fullClass.spellcasting?.prepareLimit?.level?.measurement === Measurement.half) {
        if (fullClass.spellcasting?.prepareLimit.level?.rounding === Rounding.down) {
          maxCount = maxCount + uClass.level < 2 ? 1 : Math.floor(uClass.level / 2)
        } else {
          maxCount = maxCount + uClass.level < 2 ? 1 : Math.ceil(uClass.level / 2)
        }
      } else {
        maxCount = uClass.level
      }

      if (maxCount < 1) {
        maxCount = 1
      }
    }

    return maxCount
  }

  // Remove class spells if class level is below allowed spell level
  useEffect(() => {
    if (data.spellcasting?.[casterType]?.length) {
      const updatedKnown = data.spellcasting?.[casterType]?.filter((listObject) => listObject.level <= maxSpellLevel)
      if (!isEqual(data.spellcasting?.[casterType], updatedKnown)) {
        updateField({
          path: `spellcasting.${casterType}`,
          value: updatedKnown,
        })
      }
    }
    if (usesSpellbook && data.spellcasting?.known?.length) {
      const updatedKnown = data.spellcasting?.known?.filter((listObject) => listObject.level <= maxSpellLevel)
      if (!isEqual(data.spellcasting?.known, updatedKnown)) {
        updateField({
          path: 'spellcasting.known',
          value: updatedKnown,
        })
      }
    }
  }, [maxSpellLevel, updateField, data.spellcasting, classIndex, casterType, usesSpellbook])

  /* Sets how the spells are stored
     Spell book uses the "known" array */
  const spellList = data.spellcasting?.[usesSpellbook || !preparesSpells ? 'known' : 'prepared']?.filter(
    (group) => group.level
  )

  const cantripsKnown = data.spellcasting?.[casterType]?.filter((known) => known.level === 0)

  const preparedSpellCount =
    data.spellcasting?.prepared
      ?.flatMap((listObject) => listObject.spells?.map((spell) => spell))
      .filter((spell) => spell && !spell.alwaysPrepared).length || 0

  const cantripsKnownCount =
    cantripsKnown
      ?.flatMap((listObject) => listObject.spells?.map((spell) => spell))
      .filter((spell) => spell && !spell.alwaysPrepared).length || 0

  const knownSpellCount = spellList?.flatMap((listObject) => listObject.spells?.map((oSpell) => oSpell)).length || 0

  const handleAddSpell = (spell: SpellListItem, type: 'known' | 'prepared') => {
    let spellList: ClassSpellList[] = JSON.parse(JSON.stringify(data.spellcasting?.[type] || []))
    const spellLevel = spells.findLevel(spell.id)!
    if (spellList?.length) {
      let spellLevelIndex = spellList.findIndex((listObject) => listObject.level === spellLevel)
      if (spellLevelIndex !== -1) {
        spellList[spellLevelIndex].spells = [
          ...(spellList[spellLevelIndex].spells || []),
          { id: spell.id, classId: uClass.id, __typename: 'ClassSpell' },
        ]
      } else {
        spellLevelIndex = spellList.length || 0
        spellList[spellLevelIndex] = {
          __typename: 'ClassSpellList',
          level: spellLevel,
          spells: [{ id: spell.id, classId: uClass.id, __typename: 'ClassSpell' }],
        }
      }
    } else {
      spellList.push({
        __typename: 'ClassSpellList',
        level: spellLevel,
        spells: [{ id: spell.id, classId: uClass.id, __typename: 'ClassSpell' }],
      })
    }

    spellList = spellList
      .sort((a, b) => a.level - b.level)
      .map((listObject) => {
        listObject.spells?.sort((a, b) => {
          const aSpell = spells.find((spell) => spell.id === a.id)
          const bSpell = spells.find((spell) => spell.id === b.id)

          if (aSpell && bSpell) {
            return aSpell.value?.localeCompare(bSpell.value) || 0
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

    updateField({
      path: `spellcasting.${type}`,
      value: spellList,
    })
  }

  const handleRemoveSpell = (spell: SpellListItem, type: 'known' | 'prepared') => {
    const spellList: ClassSpellList[] = JSON.parse(JSON.stringify(data.spellcasting?.[type]))
    const spellLevel = spells.findLevel(spell.id)
    const spellObjectIndex = spellList.findIndex((listObject) => listObject.level === spellLevel)
    const spellArray = spellList[spellObjectIndex]?.spells?.filter((tSpell) => tSpell.id !== spell.id)

    if (!spellArray?.length) {
      if (spellList.length === 1) {
        return updateField({
          path: `spellcasting.${type}`,
          value: [],
        })
      }
      return removeField({
        path: `spellcasting.${type}.${spellObjectIndex}`,
      })
    }
    return updateField({
      path: `spellcasting.${type}.${spellObjectIndex}.spells`,
      value: spellArray,
    })
  }

  return (
    <>
      <Grid.Item>
        <Collapse>
          <Collapse.Header title={`${preparesSpells ? 'Prepared' : 'Known'} Spells`} startOpened={false} />
          <Collapse.Body>
            <Grid>
              {data.spellcasting?.[casterType]?.length ?
                data.spellcasting?.[casterType]?.map(
                  (listObject, lIndex) =>
                    listObject.spells?.length && (
                      <Grid.Item key={lIndex}>
                        <Collapse style='borderless'>
                          <Collapse.Header title={listObject.level === 0 ? 'Cantrips' : `Level ${listObject.level}`} />
                          <Collapse.Body>
                            <Grid>
                              {listObject.spells.map((spell, sIndex) => {
                                const stateSpell = spells.find((sSpell) => sSpell.id === spell.id)
                                return (
                                  <Grid.Item key={sIndex}>
                                    <Collapse>
                                      <Collapse.Header title={stateSpell?.label} />
                                      <Collapse.Body>{stateSpell?.desc && parse(stateSpell?.desc)}</Collapse.Body>
                                    </Collapse>
                                  </Grid.Item>
                                )
                              })}
                            </Grid>
                          </Collapse.Body>
                        </Collapse>
                      </Grid.Item>
                    )
                )
              : <div>{`No ${preparesSpells ? 'prepared' : 'known'} spells`}</div>}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
      {usesSpellbook && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title='Spellbook' startOpened={false} />
            <Collapse.Body>
              <Grid>
                <Group directionVariant='column' alignItemsVariant='start'>
                  <span>
                    {`Prepared Spells: ${preparedSpellCount}/${preparesSpells ? maxPreparedSpells() : maxSpellsKnown}`}
                  </span>
                </Group>
                {maxSpellLevel &&
                  spellList?.map((listObject, lIndex) => {
                    return (
                      listObject.level &&
                      listObject.level <= maxSpellLevel && (
                        <Grid.Item key={lIndex}>
                          <Collapse style='borderless'>
                            <Collapse.Header title={`Level ${listObject.level}`} />
                            <Collapse.Body>
                              <Grid>
                                {listObject.spells?.map((spell, sIndex) => {
                                  const fullSpell = spells.find((sSpell) => sSpell.id === spell.id)
                                  if (fullSpell) {
                                    const spellFound = data.spellcasting?.prepared
                                      ?.flatMap((listObject) => listObject.spells)
                                      ?.find((lSpell) => lSpell && fullSpell.id === lSpell.id)
                                    const disabled =
                                      (preparesSpells ?
                                        preparedSpellCount >= maxPreparedSpells()
                                      : knownSpellCount >= maxSpellsKnown) && !spellFound
                                    return (
                                      <Grid.Item key={sIndex}>
                                        <Collapse>
                                          <Collapse.Header title={fullSpell.label} startOpened={false}>
                                            <Button
                                              color={spellFound != null ? 'danger' : 'primary'}
                                              height='full'
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
                                          </Collapse.Header>
                                          <Collapse.Body>{fullSpell?.desc && parse(fullSpell?.desc)}</Collapse.Body>
                                        </Collapse>
                                      </Grid.Item>
                                    )
                                  }
                                })}
                              </Grid>
                            </Collapse.Body>
                          </Collapse>
                        </Grid.Item>
                      )
                    )
                  })}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
      <Grid.Item>
        <Collapse>
          <Collapse.Header title={`${preparesSpells && !usesSpellbook ? 'Known' : 'Add'} Spells`} startOpened={false} />
          <Collapse.Body>
            <Grid>
              <Grid.Item>
                <Group directionVariant='column' alignItemsVariant='start'>
                  <span>{`Cantrips: ${cantripsKnownCount}/${maxCantripsKnown}`}</span>
                  <span>
                    {!usesSpellbook &&
                      `${preparesSpells ? 'Prepared' : 'Known'} Spells: ${knownSpellCount}/${
                        preparesSpells ? maxPreparedSpells() : maxSpellsKnown
                      }`}
                  </span>
                </Group>
              </Grid.Item>
              {spellListArray?.map((group, lIndex) => {
                return (
                  group.level <= maxSpellLevel && (
                    <Grid.Item key={lIndex}>
                      <Collapse style='borderless'>
                        <Collapse.Header
                          title={group.level === 0 ? 'Cantrips' : `Level ${group.level}`}
                          startOpened={false}
                        />
                        <Collapse.Body>
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
                                  <Grid.Item key={sIndex}>
                                    <Collapse>
                                      <Collapse.Header title={fullSpell.label} startOpened={false}>
                                        {group.level === 0 ?
                                          <Button
                                            color={cantripFound != null ? 'danger' : 'primary'}
                                            height='full'
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
                                            height='full'
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
                                          </Button>
                                        }
                                      </Collapse.Header>
                                      <Collapse.Body>{fullSpell?.desc && parse(fullSpell?.desc)}</Collapse.Body>
                                    </Collapse>
                                  </Grid.Item>
                                )
                              }
                            })}
                          </Grid>
                        </Collapse.Body>
                      </Collapse>
                    </Grid.Item>
                  )
                )
              })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </>
  )
}

export default ClassSpells
