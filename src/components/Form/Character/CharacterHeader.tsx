import { Fragment } from 'react'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  character_header_body,
  character_header_item,
  character_header_item_divider,
} from './Character.css'
import Collapse from '../../Collapse/Collapse'
import { Character } from '../../../../amplify/gql/types'
import { useListRacesQuery } from '../../../features/races/racesApi'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { calculateModifier } from '../../../utils/form'
import { useMediaQuery } from 'usehooks-ts'
import Row from '../../Row/Row'

const CharacterHeader = () => {
  const { formData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()

  const race = races.find((aRace) => aRace.id === formData.race)

  const sm = useMediaQuery('(max-width: 567px)')

  return (
    <>
      <Collapse className={sprinkles({ mb: 'space-3', mx: 'space-4' })}>
        <Collapse.Header title='Character Details' startOpened={true} />
        <Collapse.Body className={character_header_body}>
          <Row cols={{ base: 2 }} className={sprinkles({ mb: 'space-x' })}>
            <Row cols={{ base: 1, md: 3 }} cellSize={'default'} className={sprinkles({ mb: 'space-x' })}>
              <div className={character_header_item}>
                <span>
                  {'Name: '}
                  {formData.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                </span>
                {!sm && <hr className={character_header_item_divider} />}
              </div>
              <div className={character_header_item}>
                <span>
                  {'Race: '}
                  {race?.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                </span>
                {!sm && <hr className={character_header_item_divider} />}
              </div>
              <div className={character_header_item}>
                <span>{`Class(es): ${
                  formData.classes?.length > 0
                    ? formData.classes?.map((uClass, index) => {
                        const fullClass = classes.find((aClass) => aClass.id === uClass.id)
                        return (
                          <Fragment key={index}>
                            {`${fullClass.label} (Lvl. ${uClass.level})`}
                            {index !== formData.classes.length - 1 && formData.classes.length > 1 && ' / '}
                          </Fragment>
                        )
                      })
                    : '---'
                }`}</span>
              </div>
            </Row>
            <Row cellSize={'auto'} className={sprinkles({ mb: 'space-x' })}>
              {formData.abilities?.scores?.map((score, index) => {
                const ability = system.abilities.find((sAbility) => sAbility.id === score.ability)

                const modifier = calculateModifier(score.calculatedScore, 'modifier')
                return (
                  <div className={character_header_item} key={index}>
                    <span>
                      {`${ability.value.toUpperCase()}: `}
                      {score.calculatedScore > 0 ? (
                        <span className={sprinkles({ ws: 'nowrap' })}>{`${score.calculatedScore} (${modifier})`}</span>
                      ) : (
                        <span className={sprinkles({ ws: 'nowrap' })}>---</span>
                      )}
                    </span>
                    {!sm && index !== formData.abilities?.scores?.length - 1 && (
                      <hr className={character_header_item_divider} />
                    )}
                  </div>
                )
              })}
            </Row>
          </Row>
        </Collapse.Body>
      </Collapse>
    </>
  )
}

export default CharacterHeader
