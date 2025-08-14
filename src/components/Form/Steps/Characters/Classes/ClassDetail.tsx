import parse from 'html-react-parser'
import Collapsible from '~/components/Collapse'
import { startCase } from 'lodash-es'
import { convertTypenameToKindInput, numberToWords } from '~/utils'
import { Grid, ScrollArea, Button } from '@mantine/core'
import { useSystemData, useClassProficiency } from '~/hooks'
import Modal from '~/components/Modal'
import type { ClassListItem, FeatureInput } from '~/types'
import { parseDiceRoll } from '~/components/Dice'
import { useFormStore } from '~/store'
import { useGetClass } from '~/apis'
import { useMemo } from 'react'

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
  const { setAddClass } = useFormStore()

  const { data: fullClass } = useGetClass(formClass.id)
  const proficiencies = useClassProficiency({ fullClass: fullClass! })

  // Memoize the feature array
  const features = useMemo(() => {
    const featureArray: Omit<FeatureInput & { level: number }, 'levelAvailable'>[] = []
    if (fullClass?.features?.length) {
      for (const feature of fullClass.features) {
        const featureState = convertTypenameToKindInput(feature) as FeatureInput
        const levels = featureState?.levelAvailable?.split(',')
        levels?.forEach((level) => {
          featureArray.push({
            level: parseInt(level),
            ...featureState,
          })
        })
      }
    }
    return featureArray
  }, [fullClass])

  const hitpointAbility = abilities.find((ability) => ability.id === fullClass?.hitpoint?.ability)

  const { quantity, die } = parseDiceRoll(fullClass?.hitpoint?.dieConfig)

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
              {fullClass?.hitpoint?.dieConfig && quantity && die ?
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
          {features?.length &&
            features
              .sort((a, b) => {
                if (a.level && b.level) {
                  return a?.level - b?.level
                } else {
                  return 0
                }
              })
              .map((feature, i) => (
                <Grid.Col key={`${i}-features`}>
                  <Collapsible
                    props={{
                      trigger: {
                        title: `(${feature.level}) ${feature.label}`,
                      },
                    }}
                  >
                    {feature.desc && parse(feature.desc)}
                  </Collapsible>
                </Grid.Col>
              ))}
        </Grid>
      </ScrollArea>
    </Modal>
  )
}

export default ClassDetail
