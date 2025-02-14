import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Collapse from '../../components/Collapse/Collapse'
import { startCase } from 'lodash'
import { numberToWords } from '../../utils/formatting'
import { Class } from '../../../amplify/gql/types'
import { useGetSystemQuery } from '../systems/systemsApi'
import { parseDiceRoll } from '../../utils/dice'
import { RollConfig } from '../../types/components'
import useGetSections from '../../hooks/useGetSectionState'

const ClassShort = () => {
  const location: any = useLocation()

  const { data: system } = useGetSystemQuery()
  const { createClassProficiencyText, createFeatures } = useGetSections({ formData: location.state.item })

  const fullClass: Class = location.state.item

  const proficiencies = createClassProficiencyText({ fullClass })

  // Memoize the feature array
  const features = createFeatures({ type: 'class', data: fullClass })

  const hitpointAbility = system.abilities.find((ability) => ability.id === fullClass.hitpoint?.ability)

  const { numDice, dieType } = parseDiceRoll(fullClass.hitpoint?.dieConfig as RollConfig)

  return (
    <>
      {fullClass?.desc && <em>{parse(fullClass.desc)}</em>}
      <Collapse>
        <Collapse.Header title='Hit Points' startOpened={true} />
        <Collapse.Body>
          <div>
            <strong>{'Hit Dice: '}</strong>
            {`${fullClass.hitpoint?.dieConfig} per ${fullClass.label} level`}
          </div>
          <div>
            <strong>{'Hit Points at 1st Level: '}</strong>
            {`${numDice * dieType} + your ${hitpointAbility?.label} modifier`}
          </div>
          <div>
            <strong>{'Hit Points at Higher Levels: '}</strong>
            {`${fullClass.hitpoint?.dieConfig} (or ${Math.round(numDice * (dieType / 2) + 0.5)}) + your ${
              hitpointAbility?.label
            } modifier per ${fullClass.label} level after 1st`}
          </div>
        </Collapse.Body>
      </Collapse>
      {proficiencies && (
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
      )}
      {features
        .sort((a, b) => a.level - b.level)
        .map((feature, fIndex) => {
          const fullFeature = fullClass.features?.find((sFeature) => sFeature.id === feature.id)
          return (
            <Collapse key={fIndex}>
              <Collapse.Header title={`(${feature.level}) ${fullFeature.label}`} startOpened={true} />
              <Collapse.Body>{fullFeature.desc && parse(fullFeature.desc)}</Collapse.Body>
            </Collapse>
          )
        })}
    </>
  )
}

export default ClassShort
