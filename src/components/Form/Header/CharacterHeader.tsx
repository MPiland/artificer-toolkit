import { sprinkles } from '../../../css/sprinkles.css'
import { character_header_body, character_header_item, character_header_item_divider } from '../Character.css'
import Collapse from '../../Collapse/Collapse'
import { Character } from '../../../../amplify/gql/types'
import { useListRacesQuery } from '../../../features/races/racesApi'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { UpdateState } from '../../../types/form'
import { use, useState } from 'react'
import { FormContext } from '../FormContext'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { calculateModifier } from '../../../utils/form'
import { useMediaQuery } from 'usehooks-ts'
import Grid from '../../Grid/Grid'
import Button from '../../Button/Button'
import Hitpoints from '../Subforms/Character/Hitpoints/Hitpoints'

const CharacterHeader = () => {
  const { formData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const [manageHitpoints, setManageHitpoints] = useState<boolean>(false)

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()

  const race = races.find((aRace) => aRace.id === formData.race)

  const sm = useMediaQuery('(max-width: 567px)')

  return (
    <>
      <Grid.Item>
        <Collapse>
          <Collapse.Header
            title='Character Details'
            startOpened={true}
            rightSide={
              <Button
                style='filled'
                color='primary'
                className={sprinkles({ height: 'size-auto' })}
                onClick={(e) => {
                  e.stopPropagation()
                  setManageHitpoints(true)
                }}
              >
                Manage Hitpoints
              </Button>
            }
          />
          <Collapse.Body className={character_header_body}>
            <Grid className={sprinkles({ mb: 'space-x' })}>
              <Grid.Item colSpan={6}>
                <Grid>
                  <Grid.Item colSpan={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {'Name: '}
                      {formData.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                    {!sm && <hr className={character_header_item_divider} />}
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {'Race: '}
                      {race?.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                    {!sm && <hr className={character_header_item_divider} />}
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {formData.classes?.length < 2 ? 'Class: ' : 'Class(es): '}
                      {formData.classes?.length > 0 ?
                        formData.classes?.map((uClass, index) => {
                          const fullClass = classes.find((aClass) => aClass.id === uClass.id)
                          return (
                            <span key={index}>
                              {`${fullClass.label} (Lvl. ${uClass.level})`}
                              {index !== formData.classes.length - 1 && formData.classes.length > 1 && ' / '}
                            </span>
                          )
                        })
                      : <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                  </Grid.Item>
                </Grid>
              </Grid.Item>
              <Grid.Item colSpan={6}>
                <Grid className={sprinkles({ mb: 'space-x' })}>
                  {formData?.abilities?.scores?.map((score, index) => {
                    const ability = system?.abilities?.find((sAbility) => sAbility.id === score.ability)

                    const modifier = calculateModifier(score.calculatedScore, 'modifier')
                    return (
                      <Grid.Item colSpan={{ sm: 12, md: 4, lg: 'auto' }} className={character_header_item} key={index}>
                        <span className={sprinkles({ me: 'space-4' })}>
                          {`${ability?.value.toUpperCase()}: `}
                          {score.calculatedScore > 0 ?
                            <span
                              className={sprinkles({ ws: 'nowrap' })}
                            >{`${score.calculatedScore} (${modifier})`}</span>
                          : <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                        </span>
                        {!sm && index !== formData.abilities?.scores?.length - 1 && (
                          <hr className={character_header_item_divider} />
                        )}
                      </Grid.Item>
                    )
                  })}
                </Grid>
              </Grid.Item>
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
      {manageHitpoints && <Hitpoints onClose={() => setManageHitpoints(false)} />}
    </>
  )
}

export default CharacterHeader
