import Collapse from '../../../Collapse/Collapse'
import parse from 'html-react-parser'
import Button from '../../../Button/Button'
import { get, isEqual, set } from 'lodash'
import { useCallback, useEffect, useMemo } from 'react'
import Group from '../../../Group/Group'
import { useListSpellsQuery } from '../../../../features/spells/spellsApi'
import {
  Character,
  CharacterClass,
  Class,
  Spell,
  ClassSpell,
  ClassSpellList,
  CharacterSpell,
} from '../../../../../amplify/API'
import { Attributes, Measurement, Rounding } from '../../../../types/enums'
import { UpdateState } from '../../../../types/form'

const ClassSpells = ({
  uClass,
  fullClass,
  classIndex,
  formData,
  updateFormData,
}: {
  uClass: CharacterClass
  fullClass: Class
  classIndex: number
  formData: Character
  updateFormData: (state: UpdateState<Character>) => void
}) => {
  const { data: spells } = useListSpellsQuery()

  const preparesSpells = fullClass?.spellcasting?.attributes?.some(
    (attribute) => attribute === Attributes.preparesSpells
  )

  const casterType = preparesSpells ? 'prepared' : 'known'

  const maxSpellLevel = fullClass?.levelAttributes?.find(
    (levelAttribute) => levelAttribute?.level === Number(uClass.level)
  )?.spellSlots?.length

  const maxSpellsKnown = fullClass?.levelAttributes?.find(
    (levelAttribute) => levelAttribute?.level === Number(uClass.level)
  )?.spellsKnownLimit

  const maxCantripsKnown = fullClass?.levelAttributes?.find(
    (levelAttribute) => levelAttribute?.level === Number(uClass.level)
  )?.cantripsKnownLimit

  const usesSpellbook = fullClass?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.usesSpellbook)

  const createSpellArray = useCallback(() => {
    let subclassMapped: boolean = false

    let spellsArrayUpdated: Array<Omit<ClassSpellList, '__typename'>> = []

    const createArray = (type?: 'subclass' | 'subtype', spellsArray?: Array<Omit<ClassSpellList, '__typename'>>) => {
      if (spellsArray && spellsArray.length > 0) {
        spellsArrayUpdated = [...spellsArray]
      }

      const spellClass = type === 'subclass' ? uClass.subclass.id : uClass.id

      const filteredSpells = spells.filter((spell) => spell?.classes?.some((sClass) => sClass === spellClass))

      const subSpells: Spell[] = []

      fullClass.features.forEach((feature) => {
        // Check features for spells sections
        if (feature.spells?.length > 0) {
          // If spells section exists and is array that's populated
          feature.spells?.some((spell) => {
            // If feature section expands spell list
            if (
              spell.attributes?.some((attribute) => attribute === Attributes.expandsSpellList) &&
              !spell.attributes?.some((attribute) => attribute === Attributes.alwaysPrepared)
            ) {
              if (
                spell.attributes?.some(
                  (attribute) => attribute === Attributes.spellsByLevel && spell.spellsByLevel?.length > 0
                )
              ) {
                if ((spell.subtype != null && spell.subtype === uClass.subclass?.subtype) || spell.subtype == null) {
                  spell.spellsByLevel
                    ?.flatMap((levelObject) =>
                      levelObject.spells.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
                    )
                    .forEach((lSpell) => {
                      if (!subSpells?.some((sSpell) => sSpell.id === lSpell.id)) {
                        subSpells.push(lSpell)
                      }
                    })
                }
              } else {
                spell.spells?.forEach((fSpell) => {
                  const subSpell = spells.find((sSpell) => sSpell.id === fSpell)
                  subSpells.push(subSpell)
                })
              }
            }
          })
        }
      })

      if (subSpells?.length > 0) {
        filteredSpells.push(...subSpells)
      }
      filteredSpells.forEach((spell) => {
        const groupIndex = spellsArrayUpdated?.findIndex((group) => group.level === spell?.level)
        if (groupIndex === -1) {
          const index = spellsArrayUpdated?.length
          set(spellsArrayUpdated, `${index}`, { level: spell?.level, spells: [{ ...spell }] })
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
        groupObject.spells.sort((a, b) => {
          const spellA = spells.find((sSpell) => sSpell.id === a.id)
          const spellB = spells.find((sSpell) => sSpell.id === b.id)
          return spellA?.value.localeCompare(spellB?.value) || 0
        })
        return groupObject
      })

    return spellsArrayUpdated
  }, [spells, fullClass.features, uClass.id, uClass.subclass])

  const spellListArray = useMemo(() => createSpellArray(), [createSpellArray])

  const additionalSpellsArray = useCallback(() => {
    const additionalSpells: Array<Omit<CharacterSpell, '__typename'>> = [...(get(uClass, 'spellList.additional') || [])]

    fullClass.features.forEach((feature) => {
      // Check features for spells sections
      if (feature.spells?.length > 0) {
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
                (attribute) => attribute === Attributes.spellsByLevel && featureSpell.spellsByLevel?.length > 0
              )
            ) {
              if (
                (featureSpell.subtype != null && featureSpell.subtype === uClass.subclass?.subtype) ||
                featureSpell.subtype == null
              ) {
                featureSpell.spellsByLevel
                  ?.flatMap((levelObject) =>
                    levelObject.spells.map((lSpell) => spells.find((sSpell) => sSpell.id === lSpell))
                  )
                  .forEach((lSpell) => {
                    if (!additionalSpells?.some((sSpell) => sSpell.id === lSpell.id)) {
                      additionalSpells.push({
                        level: lSpell.level,
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
              featureSpell.spells.forEach((fSpell) => {
                const spell = spells.find((sSpell) => sSpell.id === fSpell)
                additionalSpells.push({
                  classId: uClass.id,
                  level: spell.level,
                  id: spell.id,
                  isRitual,
                  usesSlot,
                  alwaysPrepared,
                  requiresConcentration,
                  castAtLevel,
                  optionalAbility,
                  ability: featureSpell.ability,
                })
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
    const preparedArray: Array<Omit<ClassSpellList, '__typename'>> = [...(formData.spellcasting?.[casterType] || [])]
    if (formData.spellcasting?.additional?.length > 0) {
      formData.spellcasting?.additional?.forEach((aSpell) => {
        const spell = spells.find((sSpell) => sSpell.id === aSpell.id)
        if (spell.level <= maxSpellLevel) {
          if (preparedArray?.length > 0) {
            const spellObjectIndex = preparedArray.findIndex((listObject) => listObject.level === spell.level)
            if (spellObjectIndex !== -1) {
              if (!preparedArray?.[spellObjectIndex]?.spells?.some((pSpell) => pSpell.id === spell.id)) {
                preparedArray[spellObjectIndex].spells.push({
                  __typename: 'ClassSpell',
                  id: aSpell.id,
                  classId: aSpell.classId,
                  alwaysPrepared: aSpell.alwaysPrepared,
                  isRitual: aSpell.isRitual,
                  usesSlot: aSpell.usesSlot,
                  castAtLevel: aSpell.castAtLevel,
                  requiresConcentration: aSpell.requiresConcentration,
                  optionalAbility: aSpell.optionalAbility,
                  ability: aSpell.ability,
                })
              }
            }
          } else {
            preparedArray.push({
              level: spell.level,
              spells: [
                {
                  __typename: 'ClassSpell',
                  id: spell.id,
                  classId: uClass.id,
                },
              ],
            })
          }
        }
      })
    }

    return preparedArray
  }, [uClass, maxSpellLevel, casterType, spells, formData.spellcasting])

  const preparedSpells = useMemo(() => preparedSpellsArray(), [preparedSpellsArray])

  useEffect(() => {
    if (preparedSpells.length > 0 && !isEqual(preparedSpells, formData.spellcasting?.[casterType])) {
      updateFormData({
        type: 'update',
        path: `spellcasting.${casterType}`,
        value: preparedSpells,
      })
    }
  }, [casterType, classIndex, preparedSpells, formData.spellcasting, updateFormData])

  useEffect(() => {
    if (!isEqual(additionalSpells, formData.spellcasting?.additional)) {
      updateFormData({
        type: 'update',
        path: 'spellcasting.additional',
        value: additionalSpells,
      })
    }
  }, [additionalSpells, classIndex, updateFormData, formData.spellcasting?.additional])

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
    if (formData.spellcasting?.[casterType]?.length > 0) {
      const updatedKnown = formData.spellcasting?.[casterType]?.filter(
        (listObject) => listObject.level <= maxSpellLevel
      )
      if (!isEqual(formData.spellcasting?.[casterType], updatedKnown)) {
        updateFormData({
          type: 'update',
          path: `spellcasting.${casterType}`,
          value: updatedKnown,
        })
      }
    }
    if (usesSpellbook && formData.spellcasting?.known?.length > 0) {
      const updatedKnown = formData.spellcasting?.known?.filter((listObject) => listObject.level <= maxSpellLevel)
      if (!isEqual(formData.spellcasting?.known, updatedKnown)) {
        updateFormData({
          type: 'update',
          path: 'spellcasting.known',
          value: updatedKnown,
        })
      }
    }
  }, [maxSpellLevel, updateFormData, formData.spellcasting, classIndex, casterType, usesSpellbook])

  /* Sets how the spells are stored
     Spell book uses the "known" array */
  const spellList = formData.spellcasting?.[usesSpellbook || !preparesSpells ? 'known' : 'prepared']?.filter(
    (group) => group.level > 0
  )

  const cantripsKnown = formData.spellcasting?.[casterType]?.filter((known) => known.level === 0)

  const preparedSpellCount =
    formData.spellcasting?.prepared
      ?.flatMap((listObject) => listObject.spells.map((spell) => spell))
      .filter((spell) => !spell.alwaysPrepared).length || 0

  const cantripsKnownCount =
    cantripsKnown
      ?.flatMap((listObject) => listObject.spells.map((spell) => spell))
      .filter((spell) => !spell.alwaysPrepared).length || 0

  const knownSpellCount = spellList?.flatMap((listObject) => listObject.spells.map((oSpell) => oSpell)).length || 0

  const handleAddSpell = (spell: Spell, type: 'known' | 'prepared') => {
    let spellList: Array<{ level?: number | null; spells?: Array<Omit<ClassSpell, '__typename'>> }> = JSON.parse(
      JSON.stringify(formData.spellcasting?.[type] || [])
    )
    if (spellList?.length > 0) {
      let spellObjectIndex = spellList.findIndex((listObject) => listObject.level === spell.level)
      if (spellObjectIndex !== -1) {
        spellList[spellObjectIndex].spells = [
          ...spellList[spellObjectIndex].spells,
          { id: spell.id, classId: uClass.id },
        ]
      } else {
        spellObjectIndex = spellList.length
        spellList[spellObjectIndex].spells.push({ id: spell.id, classId: uClass.id })
      }
    } else {
      spellList.push({
        level: spell.level,
        spells: [{ id: spell.id, classId: uClass.id }],
      })
    }

    spellList = spellList
      .sort((a, b) => a.level - b.level)
      .map((listObject) => {
        listObject.spells.sort((a, b) => {
          const aSpell = spells.find((spell) => spell.id === a.id)
          const bSpell = spells.find((spell) => spell.id === b.id)

          return aSpell.value?.localeCompare(bSpell.value) || 0
        })
        return listObject
      })

    updateFormData({
      type: 'update',
      path: `spellcasting.${type}`,
      value: spellList,
    })
  }

  const handleRemoveSpell = (spell: Spell, type: 'known' | 'prepared') => {
    const spellList: ClassSpellList[] = JSON.parse(JSON.stringify(formData.spellcasting?.[type]))
    const spellObjectIndex = spellList.findIndex((listObject) => listObject.level === spell.level)
    const spellArray = spellList[spellObjectIndex].spells.filter((tSpell) => tSpell.id !== spell.id)

    if (!(spellArray.length > 0)) {
      if (spellList.length === 1) {
        return updateFormData({
          type: 'update',
          path: `spellcasting.${type}`,
          value: [],
        })
      }
      return updateFormData({
        type: 'remove',
        path: `spellcasting.${type}.${spellObjectIndex}`,
      })
    }
    return updateFormData({
      type: 'update',
      path: `spellcasting.${type}.${spellObjectIndex}.spells`,
      value: spellArray,
    })
  }

  return (
    <>
      <Collapse>
        <Collapse.Header title={`${preparesSpells ? 'Prepared' : 'Known'} Spells`} startOpened={false} />
        <Collapse.Body>
          {formData.spellcasting?.[casterType]?.length > 0 ? (
            formData.spellcasting?.[casterType]?.map(
              (listObject, lIndex) =>
                listObject.spells?.length > 0 && (
                  <Collapse style='borderless' key={lIndex}>
                    <Collapse.Header title={listObject.level === 0 ? 'Cantrips' : `Level ${listObject.level}`} />
                    <Collapse.Body>
                      {listObject.spells.map((spell, sIndex) => {
                        const stateSpell = spells.find((sSpell) => sSpell.id === spell.id)
                        return (
                          <Collapse key={sIndex}>
                            <Collapse.Header title={stateSpell.label} />
                            <Collapse.Body>{stateSpell?.desc && parse(stateSpell?.desc)}</Collapse.Body>
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
            {spellList?.map((listObject, lIndex) => {
              return (
                listObject.level > 0 &&
                listObject.level <= maxSpellLevel && (
                  <Collapse style='borderless' key={lIndex}>
                    <Collapse.Header title={`Level ${listObject.level}`} />
                    <Collapse.Body>
                      {listObject.spells?.map((spell, sIndex) => {
                        const stateSpell = spells.find((sSpell) => sSpell.id === spell.id)
                        const spellFound = formData.spellcasting?.prepared
                          ?.flatMap((listObject) => listObject.spells)
                          ?.find((lSpell) => stateSpell.id === lSpell.id)
                        return (
                          <Collapse key={sIndex}>
                            <Collapse.Header title={stateSpell.label} startOpened={false}>
                              <Button
                                color={spellFound != null ? 'danger' : 'primary'}
                                height='full'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (spellFound != null) {
                                    handleRemoveSpell(stateSpell, !preparesSpells ? 'known' : 'prepared')
                                  } else {
                                    handleAddSpell(stateSpell, !preparesSpells ? 'known' : 'prepared')
                                  }
                                }}
                                disabled={
                                  formData.spellcasting?.prepared
                                    ?.filter((listObject) => listObject.level > 0)
                                    .flatMap((prepared) => prepared.spells)?.length === maxPreparedSpells()
                                }
                              >
                                {spellFound != null ? 'Remove' : 'Add'}
                              </Button>
                            </Collapse.Header>
                            <Collapse.Body>{stateSpell?.desc && parse(stateSpell?.desc)}</Collapse.Body>
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
          {spellListArray?.map((group, lIndex) => {
            return (
              group.level <= maxSpellLevel && (
                <Collapse style='borderless' key={lIndex}>
                  <Collapse.Header
                    title={group.level === 0 ? 'Cantrips' : `Level ${group.level}`}
                    startOpened={false}
                  />
                  <Collapse.Body>
                    {group.spells.map((spell, sIndex: number) => {
                      const spellFound = spellList
                        ?.flatMap((listObject) => listObject.spells)
                        ?.find((oSpell) => spell.id === oSpell.id)
                      const cantripFound = cantripsKnown
                        ?.flatMap((cantripObject) => cantripObject.spells)
                        ?.find((oSpell) => spell.id === oSpell.id)
                      const fullSpell = spells.find((sSpell) => sSpell.id === spell.id)
                      return (
                        <Collapse key={sIndex}>
                          <Collapse.Header title={fullSpell.label} startOpened={false}>
                            {group.level === 0 ? (
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
                              >
                                {cantripFound != null ? 'Remove' : 'Add'}
                              </Button>
                            ) : (
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
                                disabled={spellFound?.alwaysPrepared}
                              >
                                {spellFound != null ? 'Remove' : 'Add'}
                              </Button>
                            )}
                          </Collapse.Header>
                          <Collapse.Body>{fullSpell?.desc && parse(fullSpell?.desc)}</Collapse.Body>
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
