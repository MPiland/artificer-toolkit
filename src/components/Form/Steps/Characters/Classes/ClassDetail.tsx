import parse from 'html-react-parser'
import Collapsible from '@/components/Collapse'
import { startCase } from 'lodash'
import { numberToWords } from '@/utils'
import { Grid, ScrollArea, Button } from '@mantine/core'
import { useGetFeatures, useGetProficiencies, useSystemData, useClassData, useFeatureData } from '@/hooks'
import Modal from '@/components/Modal'
import type { ClassListItem } from '@/types'
import { parseDiceRoll } from '@/components/Dice'
import { ClassInputSchema } from '@/schemas'
import { useFormStore } from '@/store'

const ClassDetail = ({
  formClass,
  addClass,
  setClass,
}: {
  formClass: ClassListItem
  setClass: () => void
  addClass: () => void
}) => {
  const { abilities } = useSystemData()
  const {
    classes: { findClass },
  } = useClassData()
  const { setAddClass } = useFormStore()
  const { createFeatures } = useGetFeatures()
  const {
    features: { findFeature },
  } = useFeatureData()

  const fullClass = findClass(formClass.id)!
  const classInput = ClassInputSchema.parse(fullClass)
  const proficiencies = useGetProficiencies({ fullClass })

  // Memoize the feature array
  const features = createFeatures({ data: classInput })

  const hitpointAbility = abilities.find((ability) => ability.id === fullClass.hitpoint?.ability)

  const { quantity, die } = parseDiceRoll(fullClass.hitpoint?.dieConfig)

  const handleSelect = () => {
    addClass()
    setClass()
    setAddClass(false)
  }

  return (
    <Modal
      props={{
        footer: {
          children: <Button color='primary' onClick={handleSelect}>{`Select Class`}</Button>,
        },
      }}
    >
      <ScrollArea>
        <Grid>
          <Grid.Col>{fullClass?.desc && <em>{parse(fullClass.desc)}</em>}</Grid.Col>
          <Grid.Col>
            <Collapsible
              props={{
                trigger: {
                  title: 'Hit Points',
                },
              }}
            >
              {fullClass.hitpoint?.dieConfig && quantity && die ?
                <>
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
                </>
              : <div>
                  <strong>Class is missing hit point configuration</strong>
                </div>
              }
            </Collapsible>
          </Grid.Col>
          {proficiencies && (
            <Grid.Col>
              <Collapsible
                props={{
                  trigger: {
                    title: 'Proficiencies',
                  },
                }}
              >
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
            .map((f, i) => {
              const fullFeature = findFeature(f.id)
              if (fullFeature) {
                return (
                  <Grid.Col key={`${i}-features`}>
                    <Collapsible
                      props={{
                        trigger: {
                          title: `(${f.level}) ${fullFeature.label}`,
                        },
                      }}
                    >
                      {fullFeature.desc && parse(fullFeature.desc)}
                    </Collapsible>
                  </Grid.Col>
                )
              }
            })}
        </Grid>
      </ScrollArea>
    </Modal>
  )
}

export default ClassDetail
