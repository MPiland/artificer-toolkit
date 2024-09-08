import { Fragment, useCallback, useMemo, useEffect } from 'react'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  character_header,
  character_header_group,
  character_header_item,
  character_header_item_divier,
  character_header_item_label,
} from './Character.css'
import Collapse from '../../Collapse/Collapse'
import { useForm } from '../../../hooks/UseForm'
import { isEqual, set } from 'lodash'

const CharacterHeader = () => {
  const { formState, setFormState, context } = useForm()

  const setAbilityScores = useCallback(() => {
    if (context.title === 'characters') {
      const abilityScores = JSON.parse(JSON.stringify(formState?.abilities?.scores ?? []))
      const modifier = formState.modifiers?.abilities

      formState.abilities?.scores?.forEach((ability: any, index: number) => {
        // Set the calculated score

        let calculatedScore: number = Number(ability.baseScore) ?? 0
        let raceScore: number = 0
        let classScore: number = 0

        // Set modifers on ability scores
        modifier?.forEach((modAbility: any, modIndex: number) => {
          if (
            !formState.class?.some((uClass: any) => modAbility.classId === uClass._id) &&
            formState.race?._id !== modAbility.raceId &&
            formState.ancestryId !== formState?.ancestry?._id
          ) {
            return setFormState({
              type: 'removed',
              target: {
                name: `modifier.abilities.${modIndex}`,
              },
            })
          }

          if (modAbility._id === ability._id) {
            const method = modAbility.method
            const mode = modAbility.mode

            if (mode?.name === 'bonus') {
              if (method?.name === 'setValue') {
                if (modAbility.raceId != null) {
                  raceScore += modAbility.setValue
                }
                if (modAbility.classId != null) {
                  classScore += modAbility.setValue
                }
              }
            }
          }
        })

        calculatedScore += raceScore
        calculatedScore += classScore

        if (calculatedScore !== ability.calculatedScore || !ability.calculatedScore) {
          const abilityClone = {
            ...ability,
            calculatedScore: calculatedScore,
            raceScore: raceScore,
            classScore: classScore,
          }
          set(abilityScores, `${index}`, abilityClone)
        }
      })

      return abilityScores
    }
  }, [context.title, formState, setFormState])

  const abilityScores = useMemo(() => setAbilityScores(), [setAbilityScores])

  // Apply ability modifiers
  useEffect(() => {
    if (!isEqual(abilityScores, formState?.abilities?.scores)) {
      setFormState({ target: { name: 'abilities.scores', value: abilityScores } })
    }
  }, [formState, setFormState, abilityScores])

  return (
    <>
      <Collapse style='borderless' className={sprinkles({ mb: 'space-x' })}>
        <Collapse.Header title='Character Details' startOpened={true} />
        <Collapse.Body className={character_header}>
          <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
            <Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Name:</span>
                {formState.value ?? '--'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Race: </span>
                {formState.race?.value ?? '---'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Class(es): </span>
                {formState.class?.length > 0
                  ? formState.class?.map((uClass: any, index: number) => (
                      <Fragment key={index}>
                        {`${uClass.value} (Lvl. ${uClass.level})`}
                        {index !== formState.class.length - 1 && formState.class.length > 1 && ' / '}
                      </Fragment>
                    ))
                  : '---'}
              </Group>
            </Group>
          </Group>
          <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
            <Group justifyContentVariant='spaceBetween'>
              {formState.abilities?.scores?.map((ability: any, index: number) => {
                return (
                  <Group className={character_header_item} key={index} justifyContentVariant='start'>
                    <span className={character_header_item_label}>{`${ability.value.slice(0, 3)}:`}</span>
                    {ability.calculatedScore > 0 || ability.baseScore > 0
                      ? ability.calculatedScore ?? ability.baseScore
                      : '--'}
                    {index !== formState.abilities?.scores?.length - 1 && (
                      <span className={character_header_item_divier}>|</span>
                    )}
                  </Group>
                )
              })}
            </Group>
          </Group>
        </Collapse.Body>
      </Collapse>
      <hr className={sprinkles({ mb: 'space-3' })} />
    </>
  )
}

export default CharacterHeader
