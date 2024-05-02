import { Fragment, useContext } from 'react'
import { FormStepsContext } from '../FormStepsContext'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  character_header_group,
  character_header_group_label,
  character_header_item,
  character_header_item_label,
} from './Character.css'

const CharacterHeader = () => {
  const { formState } = useContext(FormStepsContext)
  return (
    <section className={sprinkles({ mb: 'size-3' })}>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
          <h4 className={character_header_group_label}>Character Details</h4>
          <Group>
            <Group className={character_header_item}>
              <h4 className={character_header_item_label}>Name:</h4>
              {formState.value ?? '--'}
            </Group>
            <Group className={character_header_item}>
              <h4 className={character_header_item_label}>Race: </h4>
              {formState.race?.value ?? '---'}
            </Group>
            <Group className={character_header_item}>
              <h4 className={character_header_item_label}>Class(es): </h4>
              {formState.classes?.length > 0
                ? formState.classes?.forEach((uClass: any, index: number) => (
                    <Fragment key={index}>{uClass.value}</Fragment>
                  ))
                : '---'}
            </Group>
          </Group>
        </Group>
        <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
          <h4 className={character_header_group_label}>Ability Scores</h4>
          <Group>
            {formState.ability?.map((ability: any, index: number) => (
              <Group className={character_header_item} key={index}>
                <h4 className={character_header_item_label}>{`${ability.value}:`}</h4>
                {ability.score ?? '---'}
              </Group>
            ))}
          </Group>
        </Group>
      </Group>
      <hr />
    </section>
  )
}

export default CharacterHeader
