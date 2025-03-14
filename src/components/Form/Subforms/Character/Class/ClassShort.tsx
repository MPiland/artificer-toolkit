import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Collapse from '../../../../Collapse/Collapse'
import { startCase } from 'lodash'
import { numberToWords } from '../../../../../utils/formatting'
import { Class } from '../../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../../features/systems/systemsApi'
import { parseDiceRoll } from '../../../../../utils/dice'
import { RollConfig } from '../../../../../types/components'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'
import useGetProficiencies from '../../../../../hooks/useGetProficiencies'

const ClassShort = () => {
  const location: any = useLocation()

  const { data: system } = useGetSystemQuery()

  const fullClass: Class = location.state.item

  const { createFeatures } = useGetFeatures({ data: fullClass })

  const proficiencies = useGetProficiencies({ fullClass })

  // Memoize the feature array
  const features = createFeatures()

  console.log({ features })

  const hitpointAbility = system.abilities.find((ability) => ability.id === fullClass.hitpoint?.ability)

  const { numDie, dieType } = parseDiceRoll(fullClass.hitpoint?.dieConfig as RollConfig)

  return (
    <>
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
              {`${numDie * dieType} + your ${hitpointAbility?.label} modifier`}
            </div>
            <div>
              <strong>{'Hit Points at Higher Levels: '}</strong>
              {`${fullClass.hitpoint?.dieConfig} (or ${Math.round(numDie * (dieType / 2) + 0.5)}) + your ${
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
        .sort((a, b) => a.level - b.level)
        .map((feature, fIndex) => {
          const fullFeature = fullClass.features?.find((sFeature) => sFeature.id === feature.id)
          return (
            <Grid.Item key={fIndex}>
              <Collapse>
                <Collapse.Header title={`(${feature.level}) ${fullFeature.label}`} startOpened={true} />
                <Collapse.Body>{fullFeature.desc && parse(fullFeature.desc)}</Collapse.Body>
              </Collapse>
            </Grid.Item>
          )
        })}
    </>
  )
}

export default ClassShort
