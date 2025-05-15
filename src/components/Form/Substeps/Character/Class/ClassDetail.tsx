import parse from 'html-react-parser'
import Collapsible from '@/components/Collapsible'
import { startCase } from 'lodash'
import { numberToWords } from '@/utils'
import { Grid, ScrollArea } from '@mantine/core'
import { useGetFeatures, useGetProficiencies, useSystemData, useClassData } from '@/hooks'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import type { FormStore } from '@/store'
import type { OnChange, Character, ClassListItem } from '@/types'
import { parseDiceRoll, type RollConfig } from '@/components/Dice'

const ClassDetail = ({ formClass, setFormClass }: { formClass: ClassListItem; setFormClass: () => void }) => {
  const {
    formStore: { data, updateField, setAddClass },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      setAddClass: FormStore<Character>['setAddClass']
    }
  }

  const { abilities } = useSystemData()
  const {
    classes: { findClass },
  } = useClassData()

  const fullClass = findClass(formClass.id)!
  const { createFeatures } = useGetFeatures({ data: fullClass })
  const proficiencies = useGetProficiencies({ fullClass })

  // Memoize the feature array
  const features = createFeatures()

  const hitpointAbility = abilities.find((ability) => ability.id === fullClass.hitpoint?.ability)

  const { quantity, die } = parseDiceRoll(fullClass.hitpoint?.dieConfig as RollConfig)

  const handleSelect = () => {
    const classIndex = data?.classes?.length || 0
    updateField({
      path: `classes.${classIndex}`,
      value: {
        id: fullClass?.id,
        level: 1,
      },
    })
    setAddClass(false)
  }

  return (
    <Modal onClose={setFormClass}>
      <Modal.Dialogue>
        <Modal.Header title={fullClass.label} onClose={setFormClass} />
        <Modal.Content>
          <ScrollArea>
            <Grid>
              <Grid.Col>{fullClass?.desc && <em>{parse(fullClass.desc)}</em>}</Grid.Col>
              <Grid.Col>
                <Collapsible defaultOpen={true}>
                  <Collapsible.Trigger title='Hit Points' />
                  <Collapsible.Content>
                    <div>
                      <strong>{'Hit Dice: '}</strong>
                      {`${fullClass.hitpoint?.dieConfig} per ${fullClass.label} level`}
                    </div>
                    <div>
                      <strong>{'Hit Points at 1st Level: '}</strong>
                      {`${quantity * die} + your ${hitpointAbility?.label} modifier`}
                    </div>
                    <div>
                      <strong>{'Hit Points at Higher Levels: '}</strong>
                      {`${fullClass.hitpoint?.dieConfig} (or ${Math.round(quantity * (die / 2) + 0.5)}) + your ${
                        hitpointAbility?.label
                      } modifier per ${fullClass.label} level after 1st`}
                    </div>
                  </Collapsible.Content>
                </Collapsible>
              </Grid.Col>
              {proficiencies && (
                <Grid.Col>
                  <Collapsible defaultOpen={true}>
                    <Collapsible.Trigger title='Proficiencies' />
                    <Collapsible.Content>
                      {Object.keys(proficiencies).map((key) => {
                        const typeArray = proficiencies[key]?.type
                        const selectionCount = proficiencies[key]?.selectionCount ?? 0

                        let typeText: string = ''

                        if (selectionCount > 0) {
                          typeText = `Choose ${numberToWords(selectionCount)} from `
                        }
                        typeArray?.map((type, tIndex) => {
                          typeText += `${type.label}`

                          if (typeArray.length > 1 && typeArray.length < 3) {
                            if (tIndex !== typeArray.length - 1) {
                              if (selectionCount) {
                                typeText += ' or '
                              } else {
                                typeText += ', '
                              }
                            }
                          }
                          if (typeArray.length > 2) {
                            if (tIndex !== typeArray?.length - 1) {
                              typeText += ', '
                            }
                            if (tIndex == typeArray?.length - 2) {
                              if (selectionCount) {
                                typeText += ' or '
                              } else {
                                typeText += ' and '
                              }
                            }
                          }
                        })

                        return (
                          <div key={key}>
                            <strong>{`${startCase(key)}: `}</strong>
                            {typeText}
                          </div>
                        )
                      })}
                    </Collapsible.Content>
                  </Collapsible>
                </Grid.Col>
              )}
              {features
                .sort((a, b) => {
                  if (a.level && b.level) {
                    return a?.level - b?.level
                  } else {
                    return 0
                  }
                })
                .map((feature, fIndex) => {
                  const fullFeature = fullClass.features?.find((sFeature) => sFeature.id === feature.id)
                  if (fullFeature) {
                    return (
                      <Grid.Col key={fIndex}>
                        <Collapsible defaultOpen={true}>
                          <Collapsible.Trigger title={`(${feature.level}) ${fullFeature.label}`} />
                          <Collapsible.Content>{fullFeature.desc && parse(fullFeature.desc)}</Collapsible.Content>
                        </Collapsible>
                      </Grid.Col>
                    )
                  }
                })}
            </Grid>
          </ScrollArea>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select Class`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default ClassDetail
