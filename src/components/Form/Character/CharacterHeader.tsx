import { Fragment } from 'react'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  character_header_body,
  character_header_group,
  character_header_item,
  character_header_item_divier,
  character_header_item_label,
} from './Character.css'
import Collapse from '../../Collapse/Collapse'
import { Character} from '../../../../amplify/gql/types'
import { useListRacesQuery } from '../../../features/races/racesApi'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'

const CharacterHeader = () => {
  const { formData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()

  const race = races.find((aRace) => aRace.id === formData.race)

  return (
    <>
      <Collapse className={sprinkles({ mb: 'space-3' })}>
        <Collapse.Header title='Character Details' startOpened={true} />
        <Collapse.Body className={character_header_body}>
          <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
            <Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Name:</span>
                {formData.label ?? '--'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Race: </span>
                {race?.label || '---'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Class(es): </span>
                {formData.classes?.length > 0
                  ? formData.classes?.map((uClass, index) => {
                      const fullClass = classes.find((aClass) => aClass.id === uClass.id)
                      return (
                        <Fragment key={index}>
                          {`${fullClass.label} (Lvl. ${uClass.level})`}
                          {index !== formData.classes.length - 1 && formData.classes.length > 1 && ' / '}
                        </Fragment>
                      )
                    })
                  : '---'}
              </Group>
            </Group>
          </Group>
          <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
            <Group justifyContentVariant='spaceBetween'>
              {formData.abilities?.scores?.map((score, index) => {
                const ability = system.abilities.find((sAbility) => sAbility.id === score.ability)
                return (
                  <Group className={character_header_item} key={index} justifyContentVariant='start'>
                    <span className={character_header_item_label}>{`${ability.value.toUpperCase()}:`}</span>
                    {score.calculatedScore > 0 || score.baseScore > 0 ? score.calculatedScore ?? score.baseScore : '--'}
                    {index !== formData.abilities?.scores?.length - 1 && (
                      <span className={character_header_item_divier}>|</span>
                    )}
                  </Group>
                )
              })}
            </Group>
          </Group>
        </Collapse.Body>
      </Collapse>
    </>
  )
}

export default CharacterHeader
