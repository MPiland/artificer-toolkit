import parse from 'html-react-parser'
import Collapse from '../../../../Collapse/Collapse'
import { startCase } from 'lodash'
import { numberToWords } from '../../../../../utils/formatting'
import { Character, Class } from '../../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../../apis/systemsApi'
import { parseDiceRoll } from '../../../../../utils/dice'
import { RollConfig } from '../../../../../types/components'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'
import useGetProficiencies from '../../../../../hooks/useGetProficiencies'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import { UpdateState } from '../../../../../types/form'
import Modal from '../../../../Modal/Modal'
import ScrollArea from '../../../../ScrollArea/ScrollArea'
import Button from '../../../../Button/Button'

const ClassDetail = ({ fullClass, setFullClass }: { fullClass: Class; setFullClass: () => void }) => {
  const { data: system } = useGetSystemQuery()
  const { formData, updateFormData, setAddClass } = use(FormContext) as {
    formData: Character
    updateFormData: (data: UpdateState<Character>) => void
    setAddClass: (value: boolean) => void
  }
  const { createFeatures } = useGetFeatures({ data: fullClass })
  const proficiencies = useGetProficiencies({ fullClass })

  // Memoize the feature array
  const features = createFeatures()

  const hitpointAbility = system.abilities.find((ability) => ability.id === fullClass.hitpoint?.ability)

  const { quantity, die } = parseDiceRoll(fullClass.hitpoint?.dieConfig as RollConfig)

  const handleSelect = () => {
    const classIndex = formData?.classes?.length || 0
    updateFormData({
      type: 'update',
      path: `classes.${classIndex}`,
      value: {
        id: fullClass?.id,
        level: 1,
      },
    })
    setAddClass(false)
  }

  return (
    <Modal onClose={setFullClass}>
      <Modal.Dialogue>
        <Modal.Header title={fullClass.label} onClose={setFullClass} />
        <Modal.Content>
          <ScrollArea>
            <Grid>
              <Grid.Item>{fullClass?.desc && <em>{parse(fullClass.desc)}</em>}</Grid.Item>
              <Grid.Item>
                <Collapse>
                  <Collapse.Header title='Hit Points' startOpened={true} />
                  <Collapse.Body>
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
                  </Collapse.Body>
                </Collapse>
              </Grid.Item>
              {proficiencies && (
                <Grid.Item>
                  <Collapse>
                    <Collapse.Header title='Proficiencies' startOpened={true} />
                    <Collapse.Body>
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
                    </Collapse.Body>
                  </Collapse>
                </Grid.Item>
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
                      <Grid.Item key={fIndex}>
                        <Collapse>
                          <Collapse.Header title={`(${feature.level}) ${fullFeature.label}`} startOpened={true} />
                          <Collapse.Body>{fullFeature.desc && parse(fullFeature.desc)}</Collapse.Body>
                        </Collapse>
                      </Grid.Item>
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
