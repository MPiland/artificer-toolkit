import { Fragment, useEffect } from 'react'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  character_header,
  character_header_body,
  character_header_group,
  character_header_item,
  character_header_item_divier,
  character_header_item_label,
} from './Character.css'
import Collapse from '../../Collapse/Collapse'
import { isEqual } from 'lodash'
import { Character, Class, FeatureModifier, Scores } from '../../../../amplify/API'
import { ModifierCategories, ModifierMethods, ModifierTypes } from '../../../types/enums'
import { useListRacesQuery } from '../../../features/races/racesApi'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'

const CharacterHeader = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()

  const race = races.find((aRace) => aRace.id === formData.race)

  // Apply ability modifiers
  useEffect(() => {
    const setAbilityScores = () => {
      if (formData.__typename === 'Character') {
        const abilityScores: Scores[] = JSON.parse(
          JSON.stringify(formData?.abilities?.scores ?? [])
        ) as Character['abilities']['scores']
        const race = races.find((sRace) => sRace.id === formData.race)
        const charClasses: Class[] = formData?.classes?.map((uClass) =>
          classes.find((sClass) => sClass.id === uClass.id)
        )
        const modifiers: FeatureModifier[] = []
        if (race?.features?.length > 0) {
          modifiers.push(...race.features.flatMap((feature) => feature.modifiers))
        }
        if (charClasses) {
          charClasses.forEach((charClass) => {
            if (charClass?.features?.length > 0) {
              modifiers.push(...charClass.features.flatMap((feature) => feature.modifiers))
            }
          })
        }

        const characterModifiers = formData.modifiers

        abilityScores?.forEach((score, index) => {
          // Set the calculated score

          let calculatedScore: number = Number(score.baseScore) || 0
          let raceScore: number = 0
          let classScore: number = 0
          let modifierScore: number = 0

          // Set modifers on ability scores
          modifiers?.forEach((modifier) => {
            if (!characterModifiers?.some((cModifier) => cModifier.modifierId === modifier.id)) {
              return (abilityScores[index].modifierScore = 0)
            }

            const characterModifier = characterModifiers?.find((cModifier) => cModifier.modifierId === modifier.id)

            let method: FeatureModifier['method']
            let type: FeatureModifier['type']
            if (!characterModifier && modifier.category === ModifierCategories.abilityScores) {
              method = modifier.method
              type = modifier.type

              if (type === ModifierTypes.bonus) {
                if (method === ModifierMethods.setGlobally) {
                  if (score.ability === characterModifier.optionId) {
                    if (characterModifier.classId != null) {
                      classScore += modifier.setAmount
                      modifierScore += modifier.setAmount
                    }
                    if (characterModifier.raceId != null) {
                      raceScore += modifier.setAmount
                      modifierScore += modifier.setAmount
                    }
                  }
                }
              }
            }
          })

          calculatedScore += raceScore
          calculatedScore += classScore

          if (calculatedScore !== score.calculatedScore || !score.calculatedScore) {
            abilityScores[index] = {
              ...score,
              calculatedScore: calculatedScore,
              raceScore: raceScore,
              classScore: classScore,
              modifierScore: modifierScore,
            }
          }
        })

        return abilityScores
      }
    }

    const abilityScores = setAbilityScores()

    if (!isEqual(abilityScores, formData?.abilities?.scores)) {
      updateFormData({ type: 'update', path: 'abilities.scores', value: abilityScores })
    }
  }, [formData, updateFormData, races, classes])

  return (
    <div className={character_header}>
      <Collapse style='borderless' className={sprinkles({ mb: 'space-x' })}>
        <Collapse.Header title='Character Details' startOpened={true} />
        <Collapse.Body className={character_header_body}>
          <Group directionVariant='column' alignItemsVariant='start' className={character_header_group}>
            <Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Name:</span>
                {formData.value ?? '--'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Race: </span>
                {race?.value || '---'}
                <span className={character_header_item_divier}>|</span>
              </Group>
              <Group className={character_header_item}>
                <span className={character_header_item_label}>Class(es): </span>
                {formData.classes?.length > 0
                  ? formData.classes?.map((uClass, index) => {
                      const fullClass = classes.find((aClass) => aClass.id === uClass.id)
                      return (
                        <Fragment key={index}>
                          {`${fullClass.value} (Lvl. ${uClass.level})`}
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
                    <span className={character_header_item_label}>{`${ability.value.slice(0, 3)}:`}</span>
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
      <hr className={sprinkles({ mb: 'space-3' })} />
    </div>
  )
}

export default CharacterHeader
