import { sprinkles } from '@/css/sprinkles.css'
import { character_header_body, character_header_item, character_header_item_divider } from '../Character.css'
import Collapsible from '@/components/Collapsible'
import type { Character } from '@/types'
import { use, useState } from 'react'
import { FormContext } from '../FormContext'
import { calculateModifier } from '../utils'
import { useMediaQuery } from 'usehooks-ts'
import { Grid } from '@mantine/core'
import Button from '@/components/Button'
import Hitpoints from '../Substeps/Character/Hitpoints'
import { useRaceData, useClassData, useSystemData } from '@/hooks'
import type { FormStore } from '@/store'

const CharacterHeader = () => {
  const { formStore } = use(FormContext) as {
    formStore: FormStore<Character>
  }

  const [manageHitpoints, setManageHitpoints] = useState<boolean>(false)

  const {
    races: { findRace },
  } = useRaceData()
  const {
    classes: { findListClass },
  } = useClassData()
  const {
    abilities: { findAbility },
  } = useSystemData()

  const race = findRace(formStore.data.race)

  const sm = useMediaQuery('(max-width: 567px)')

  return (
    <>
      <Grid.Col>
        <Collapsible defaultOpen={true}>
          <Collapsible.Trigger
            title='Character Details'
            titleRight={
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
          <Collapsible.Content className={character_header_body}>
            <Grid className={sprinkles({ mb: 'space-x' })}>
              <Grid.Col span={6}>
                <Grid>
                  <Grid.Col span={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {'Name: '}
                      {formStore.data.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                    {!sm && <hr className={character_header_item_divider} />}
                  </Grid.Col>
                  <Grid.Col span={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {'Race: '}
                      {race?.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                    {!sm && <hr className={character_header_item_divider} />}
                  </Grid.Col>
                  <Grid.Col span={{ sm: 12, md: 4 }} className={character_header_item}>
                    <span>
                      {formStore.data.classes?.length && formStore.data.classes?.length < 2 ? 'Class: ' : 'Class(es): '}
                      {formStore.data.classes?.length ?
                        formStore.data.classes?.map((uClass, index) => {
                          const fullClass = findListClass(uClass.id)
                          return (
                            <span key={index}>
                              {`${fullClass?.label} (Lvl. ${uClass.level})`}
                              {formStore.data.classes?.length &&
                                index !== formStore.data?.classes?.length - 1 &&
                                formStore.data.classes.length > 1 &&
                                ' / '}
                            </span>
                          )
                        })
                      : <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                    </span>
                  </Grid.Col>
                </Grid>
              </Grid.Col>
              <Grid.Col span={6}>
                <Grid className={sprinkles({ mb: 'space-x' })}>
                  {formStore.data?.abilities?.scores?.map((score, index) => {
                    const ability = findAbility(score.ability)

                    const modifier = calculateModifier(score?.calculatedScore || 0, 'modifier')
                    return (
                      <Grid.Col span={{ sm: 12, md: 4, lg: 'auto' }} className={character_header_item} key={index}>
                        <span className={sprinkles({ me: 'space-4' })}>
                          {`${ability?.value.toUpperCase()}: `}
                          {score.calculatedScore ?
                            <span
                              className={sprinkles({ ws: 'nowrap' })}
                            >{`${score.calculatedScore} (${modifier})`}</span>
                          : <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                        </span>
                        {!sm &&
                          formStore.data.abilities?.scores?.length &&
                          index !== formStore.data.abilities?.scores?.length - 1 && (
                            <hr className={character_header_item_divider} />
                          )}
                      </Grid.Col>
                    )
                  })}
                </Grid>
              </Grid.Col>
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
      {manageHitpoints && <Hitpoints onClose={() => setManageHitpoints(false)} />}
    </>
  )
}

export default CharacterHeader
