import { useForm } from '../../../../hooks/UseForm'
import Collapse from '../../../Collapse/Collapse'
import parse from 'html-react-parser'
import Button from '../../../Button/Button'
import { get, isEqual, set } from 'lodash'
import { useCallback, useEffect, useMemo } from 'react'
import { ClassSpellType } from '../../../../utils/types'
import Group from '../../../Group/Group'
import { useGetSpellsQuery } from '../../../../features/spells/spellsApi'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'

const ClassSpells = ({ uClass, classIndex }: { uClass: any; classIndex: number }) => {
  const { setFormState } = useForm()

  const { data: spells } = useGetSpellsQuery() as { data: any[] }
  const { data: classes } = useGetClassesQuery() as { data: any[] }

  const fullClass = classes.find((sClass: any) => sClass._id === uClass._id)

  const preparesSpells = fullClass?.spellcasting?.attribute?.some(
    (attribute: any) => attribute.name === 'preparesSpells'
  )

  const casterType = preparesSpells ? 'prepared' : 'known'

  const maxSpellLevel = uClass?.levelAttribute?.find(
    (levelAttribute: any) => levelAttribute?.level === Number(uClass.level)
  )?.spellSlots?.length

  const maxSpellsKnown = uClass?.levelAttribute?.find(
    (levelAttribute: any) => levelAttribute?.level === Number(uClass.level)
  )?.spellsKnown

  const maxCantripsKnown = uClass?.levelAttribute?.find(
    (levelAttribute: any) => levelAttribute?.level === Number(uClass.level)
  )?.cantripsKnown

  const usesSpellbook = fullClass?.spellcasting?.attribute?.some((attribute: any) => attribute.name === 'usesSpellbook')

  const createSpellArray = useCallback(() => {
    let subclassMapped: boolean = false

    let spellsArrayUpdated: ClassSpellType[] = []

    const createArray = (type?: 'subclass' | 'subtype', spellsArray?: ClassSpellType[]) => {
      if (spellsArray && spellsArray.length > 0) {
        spellsArrayUpdated = [...spellsArray]
      }

      const spellClass = type === 'subclass' ? uClass.subclass : uClass

      const filteredSpells: any[] = spells.filter((spell: any) =>
        spell?.classes?.some((sClass: any) => sClass._id === spellClass._id)
      )

      const subSpells: any[] = []

      uClass.features.forEach((feature: any) => {
        // Check features for spells sections
        if (feature.spells?.length > 0) {
          // If spells section exists and is array that's populated
          feature.spells?.some((spell: any) => {
            // If feature section expands spell list
            if (
              spell.attribute?.some((attribute: any) => attribute.name === 'expandsSpellList') &&
              !spell.attribute?.some((attribute: any) => attribute.name === 'isPrepared')
            ) {
              if (
                spell.attribute?.some(
                  (attribute: any) => attribute.name === 'spellsByLevel' && spell.spellsByLevel?.length > 0
                )
              ) {
                if (
                  (spell.subtype?._id != null && spell.subtype._id === uClass.subclass?.subtype?._id) ||
                  spell.subtype == null
                ) {
                  spell.spellsByLevel
                    ?.flatMap((levelObject: any) =>
                      levelObject.spell.map((spellObject: any) =>
                        spells.find((stateSpell: any) => stateSpell._id === spellObject._id)
                      )
                    )
                    .forEach((lSpell: any) => {
                      if (!subSpells?.some((sSpell: any) => sSpell._id === lSpell._id)) {
                        subSpells.push(lSpell)
                      }
                    })
                }
              } else {
                subSpells.push(spell?.type)
              }
            }
          })
        }
      })

      if (subSpells?.length > 0) {
        filteredSpells.push(subSpells)
      }

      filteredSpells.forEach((spell: any) => {
        const groupIndex = spellsArrayUpdated?.findIndex((group: any) => group.level === spell?.level)
        if (groupIndex === -1) {
          const index = spellsArrayUpdated?.length
          set(spellsArrayUpdated, `${index}`, { level: spell?.level, spells: [{ ...spell }] })
        } else {
          const groupObject: any = get(spellsArrayUpdated, `${groupIndex}`)
          if (!groupObject?.spells?.some((gSpell: any) => gSpell?._id === spell?._id)) {
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
        groupObject.spells.sort((a, b) => a.name?.localeCompare(b.name))
        return groupObject
      })

    return spellsArrayUpdated
  }, [spells, uClass])

  const spellListArray = useMemo(() => createSpellArray(), [createSpellArray])

  const additionalSpellsArray = useCallback(() => {
    const additionalSpells: any[] = [...(get(uClass, 'spellList.additional') ?? [])]

    uClass.features.forEach((feature: any) => {
      // Check features for spells sections
      if (feature.spells?.length > 0) {
        // If spells section exists and is array that's populated
        feature.spells?.some((spell: any) => {
          // If feature section expands spell list
          if (
            spell.attribute?.some((attribute: any) => attribute.name === 'expandsSpellList') &&
            spell.attribute?.some((attribute: any) => attribute.name === 'isPrepared')
          ) {
            const isRitual = spell.attribute?.some((attribute: any) => attribute.name === 'isRitual')
            const usesSlot = spell.attribute?.some((attribute: any) => attribute.name === 'usesSlot')
            const isPrepared = true
            const requiresConcentration = spell.attribute?.some(
              (attribute: any) => attribute.name === 'requiresConcentration'
            )
            const castAtLevel = spell.attribute?.some((attribute: any) => attribute.name === 'castAtLevel')
            const optionalAbility = spell.attribute?.some((attribute: any) => attribute.name === 'optionalAbility')
            if (
              spell.attribute?.some(
                (attribute: any) => attribute.name === 'spellsByLevel' && spell.spellsByLevel?.length > 0
              )
            ) {
              if (
                (spell.subtype?._id != null && spell.subtype._id === uClass.subclass?.subtype?._id) ||
                spell.subtype == null
              ) {
                spell.spellsByLevel
                  ?.flatMap((levelObject: any) =>
                    levelObject.spell.map((spellObject: any) =>
                      spells.find((stateSpell: any) => stateSpell._id === spellObject._id)
                    )
                  )
                  .forEach((lSpell: any) => {
                    const spellObject = {
                      classes: lSpell.classes,
                      name: lSpell.name,
                      value: lSpell.value,
                      _id: lSpell._id,
                      level: lSpell.level,
                      desc: lSpell.desc,
                      isRitual,
                      usesSlot,
                      isPrepared,
                      requiresConcentration,
                      castAtLevel,
                      optionalAbility,
                    }
                    if (!additionalSpells?.some((sSpell: any) => sSpell._id === lSpell._id)) {
                      additionalSpells.push(spellObject)
                    }
                  })
              }
            } else {
              additionalSpells.push(spell?.type)
            }
          }
        })
      }
    })

    return additionalSpells
  }, [spells, uClass])

  const additionalSpells = useMemo(() => additionalSpellsArray(), [additionalSpellsArray])

  const preparedSpellsArray = useCallback(() => {
    const preparedArray: any[] = [...(uClass.spellList?.[casterType] ?? [])]
    if (uClass.spellList?.additional?.length > 0) {
      uClass.spellList?.additional?.forEach((spell: any) => {
        if (spell.level <= maxSpellLevel) {
          if (preparedArray?.length > 0) {
            const spellObjectIndex = preparedArray.findIndex((spellObject: any) => spellObject.level === spell.level)
            if (spellObjectIndex !== -1) {
              if (!preparedArray?.[spellObjectIndex]?.spells?.some((oSpell: any) => oSpell._id === spell._id)) {
                const spellIndex = preparedArray?.[spellObjectIndex]?.spells?.length
                set(preparedArray, `${spellObjectIndex}.spells.${spellIndex}`, spell)
              }
            } else {
              set(preparedArray, `${preparedArray.length}`, { level: spell.level, spells: [{ ...spell }] })
            }
          } else {
            set(preparedArray, '0', { level: spell.level, spells: [{ ...spell }] })
          }
        }
      })
    }

    return preparedArray
  }, [uClass, maxSpellLevel, casterType])

  const preparedSpells = useMemo(() => preparedSpellsArray(), [preparedSpellsArray])

  useEffect(() => {
    if (preparedSpells.length > 0 && !isEqual(preparedSpells, uClass.spellList?.[casterType])) {
      setFormState({
        target: {
          name: `class.${classIndex}.spellList.${casterType}`,
          value: preparedSpells,
        },
      })
    }
  }, [casterType, classIndex, preparedSpells, uClass.spellList, setFormState])

  useEffect(() => {
    if (!isEqual(additionalSpells, uClass.spellList?.additional)) {
      setFormState({
        target: {
          name: `class.${classIndex}.spellList.additional`,
          value: additionalSpells,
        },
      })
    }
  }, [additionalSpells, classIndex, setFormState, uClass.spellList?.additional])

  const maxPreparedSpells = () => {
    let maxCount: number = 0
    if (fullClass.spellcasting?.prepareLimitMethod?.some((method: any) => method.name === 'spellAbility')) {
      maxCount =
        uClass.ability?.scores?.find((ability: any) => fullClass?.spellcasting?.ability._id === ability._id)
          ?.calculatedScore ?? 0

      if (fullClass.spellcasting?.prepareLimitLevel?.measurement?.name === 'half') {
        if (fullClass.spellcasting?.prepareLimitLevel?.rounding?.name === 'down') {
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
    if (uClass?.spellList?.[casterType]?.length > 0) {
      const updatedKnown = uClass?.spellList?.[casterType]?.filter(
        (listObject: any) => listObject.level <= maxSpellLevel
      )
      if (!isEqual(uClass?.spellList?.[casterType], updatedKnown)) {
        setFormState({
          target: {
            name: `class.${classIndex}.spellList.${casterType}`,
            value: updatedKnown,
          },
        })
      }
    }
    if (usesSpellbook && uClass?.spellList?.known?.length > 0) {
      const updatedKnown = uClass?.spellList?.known?.filter((listObject: any) => listObject.level <= maxSpellLevel)
      if (!isEqual(uClass?.spellList?.known, updatedKnown)) {
        setFormState({
          target: {
            name: `class.${classIndex}.spellList.known`,
            value: updatedKnown,
          },
        })
      }
    }
  }, [maxSpellLevel, setFormState, uClass?.spellList, classIndex, casterType, usesSpellbook])

  /* Sets how the spells are stored
     Spell book uses the "known" array */
  const spellList: ClassSpellType[] = uClass?.spellList?.[
    usesSpellbook || !preparesSpells ? 'known' : 'prepared'
  ]?.filter((group: any) => group.level > 0)

  const cantripsKnown: ClassSpellType[] = uClass?.spellList?.[casterType]?.filter((known: any) => known.level === 0)

  const preparedSpellCount =
    uClass.spellList?.prepared
      ?.flatMap((spellObject: any) => spellObject.spells.map((oSpell: any) => oSpell))
      .filter((oSpell: any) => !oSpell.isPrepared).length ?? 0

  const cantripsKnownCount =
    cantripsKnown
      ?.flatMap((spellObject) => spellObject.spells.map((oSpell: any) => oSpell))
      .filter((oSpell) => !oSpell.isPrepared).length ?? 0

  const knownSpellCount =
    spellList?.flatMap((spellObject) => spellObject.spells.map((oSpell: any) => oSpell)).length ?? 0

  const handleAddSpell = (spell: any, type: 'known' | 'prepared') => {
    let spellList: ClassSpellType[] = JSON.parse(JSON.stringify(uClass?.spellList?.[type] ?? []))
    if (spellList?.length > 0) {
      let spellObjectIndex = spellList.findIndex((spellObject: any) => spellObject.level === spell.level)
      if (spellObjectIndex !== -1) {
        set(spellList, `${spellObjectIndex}.spells`, [...spellList[spellObjectIndex].spells, { ...spell }])
      } else {
        spellObjectIndex = spellList.length
        set(spellList, `${spellObjectIndex}`, { level: spell.level, spells: [{ ...spell }] })
      }
    } else {
      set(spellList, '0', { level: spell.level, spells: [{ ...spell }] })
    }

    spellList = spellList
      .sort((a, b) => a.level - b.level)
      .map((groupObject) => {
        groupObject.spells.sort((a, b) => a.name?.localeCompare(b.name))
        return groupObject
      })

    setFormState({
      target: {
        name: `class.${classIndex}.spellList.${type}`,
        value: spellList,
      },
    })
  }

  const handleRemoveSpell = (spell: any, type: 'known' | 'prepared') => {
    const spellList = JSON.parse(JSON.stringify(uClass?.spellList?.[type]))
    const spellObjectIndex = spellList.findIndex((spellObject: any) => spellObject.level === spell.level)
    const spellArray = spellList[spellObjectIndex].spells.filter((tSpell: any) => tSpell._id !== spell._id)

    if (!(spellArray.length > 0)) {
      if (spellList.length === 1) {
        return setFormState({
          target: {
            name: `class.${classIndex}.spellList.${type}`,
            value: [],
          },
        })
      }
      return setFormState({
        type: 'removed',
        target: {
          name: `class.${classIndex}.spellList.${type}.${spellObjectIndex}`,
        },
      })
    }
    return setFormState({
      target: {
        name: `class.${classIndex}.spellList.${type}.${spellObjectIndex}.spells`,
        value: spellArray,
      },
    })
  }

  return (
    <>
      <Collapse>
        <Collapse.Header title={`${preparesSpells ? 'Prepared' : 'Known'} Spells`} startOpened={false} />
        <Collapse.Body>
          {uClass?.spellList?.[casterType]?.length > 0 ? (
            uClass?.spellList?.[casterType]?.map(
              (spellObject: any, oIndex: number) =>
                spellObject.spells?.length > 0 && (
                  <Collapse style='borderless' key={oIndex}>
                    <Collapse.Header title={spellObject.level === 0 ? 'Cantrips' : `Level ${spellObject.level}`} />
                    <Collapse.Body>
                      {spellObject.spells.map((spell: any, sIndex: number) => {
                        return (
                          <Collapse key={sIndex}>
                            <Collapse.Header title={spell.value} />
                            <Collapse.Body>{spell?.desc && parse(spell?.desc)}</Collapse.Body>
                          </Collapse>
                        )
                      })}
                    </Collapse.Body>
                  </Collapse>
                )
            )
          ) : (
            <div>{`No ${preparesSpells ? 'prepared' : 'known'} spells`}</div>
          )}
        </Collapse.Body>
      </Collapse>
      {usesSpellbook && (
        <Collapse>
          <Collapse.Header title='Spellbook' startOpened={false} />
          <Collapse.Body>
            <Group directionVariant='column' alignItemsVariant='start'>
              <span>
                {`Prepared Spells: ${preparedSpellCount}/${preparesSpells ? maxPreparedSpells() : maxSpellsKnown}`}
              </span>
            </Group>
            {spellList?.map((group: any, gIndex: any) => {
              return (
                group.level > 0 &&
                group.level <= maxSpellLevel && (
                  <Collapse style='borderless' key={gIndex}>
                    <Collapse.Header title={`Level ${group.level}`} />
                    <Collapse.Body>
                      {group.spells?.map((spell: any, sIndex: number) => {
                        const spellFound = uClass?.spellList?.prepared
                          ?.flatMap((spellObject: any) => spellObject.spells)
                          ?.find((oSpell: any) => spell._id === oSpell._id)
                        return (
                          <Collapse key={sIndex}>
                            <Collapse.Header title={spell.value} startOpened={false}>
                              <Button
                                color={spellFound != null ? 'danger' : 'primary'}
                                height='full'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  spellFound != null
                                    ? handleRemoveSpell(spell, !preparesSpells ? 'known' : 'prepared')
                                    : handleAddSpell(spell, !preparesSpells ? 'known' : 'prepared')
                                }}
                                disabled={
                                  uClass?.spellList?.prepared
                                    ?.filter((group: any) => group.level > 0)
                                    .flatMap((prepared: any) => prepared.spells)?.length === maxPreparedSpells()
                                }
                              >
                                {spellFound != null ? 'Remove' : 'Add'}
                              </Button>
                            </Collapse.Header>
                            <Collapse.Body>{spell?.desc && parse(spell?.desc)}</Collapse.Body>
                          </Collapse>
                        )
                      })}
                    </Collapse.Body>
                  </Collapse>
                )
              )
            })}
          </Collapse.Body>
        </Collapse>
      )}
      <Collapse>
        <Collapse.Header title={`${preparesSpells && !usesSpellbook ? 'Known' : 'Add'} Spells`} startOpened={false} />
        <Collapse.Body>
          <Group directionVariant='column' alignItemsVariant='start'>
            <span>{`Cantrips: ${cantripsKnownCount}/${maxCantripsKnown}`}</span>
            <span>
              {!usesSpellbook &&
                `${preparesSpells ? 'Prepared' : 'Known'} Spells: ${knownSpellCount}/${
                  preparesSpells ? maxPreparedSpells() : maxSpellsKnown
                }`}
            </span>
          </Group>
          {spellListArray?.map((group: any, gIndex: any) => {
            return (
              group.level <= maxSpellLevel && (
                <Collapse style='borderless' key={gIndex}>
                  <Collapse.Header
                    title={group.level === 0 ? 'Cantrips' : `Level ${group.level}`}
                    startOpened={false}
                  />
                  <Collapse.Body>
                    {group.spells.map((spell: any, sIndex: number) => {
                      const spellFound = spellList
                        ?.flatMap((spellObject: any) => spellObject.spells)
                        ?.find((oSpell: any) => spell._id === oSpell._id)
                      const cantripFound = cantripsKnown
                        ?.flatMap((cantripObject: any) => cantripObject.spells)
                        ?.find((oSpell: any) => spell._id === oSpell._id)
                      return (
                        <Collapse key={sIndex}>
                          <Collapse.Header title={spell.value} startOpened={false}>
                            {group.level === 0 ? (
                              <Button
                                color={cantripFound != null ? 'danger' : 'primary'}
                                height='full'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  cantripFound != null
                                    ? handleRemoveSpell(spell, !preparesSpells ? 'known' : 'prepared')
                                    : handleAddSpell(spell, usesSpellbook || !preparesSpells ? 'known' : 'prepared')
                                }}
                              >
                                {cantripFound != null ? 'Remove' : 'Add'}
                              </Button>
                            ) : (
                              <Button
                                color={spellFound != null ? 'danger' : 'primary'}
                                height='full'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  spellFound != null
                                    ? handleRemoveSpell(spell, !preparesSpells ? 'known' : 'prepared')
                                    : handleAddSpell(spell, usesSpellbook || !preparesSpells ? 'known' : 'prepared')
                                }}
                                disabled={spellFound?.isPrepared}
                              >
                                {spellFound != null ? 'Remove' : 'Add'}
                              </Button>
                            )}
                          </Collapse.Header>
                          <Collapse.Body>{spell?.desc && parse(spell?.desc)}</Collapse.Body>
                        </Collapse>
                      )
                    })}
                  </Collapse.Body>
                </Collapse>
              )
            )
          })}
        </Collapse.Body>
      </Collapse>
    </>
  )
}

export default ClassSpells
