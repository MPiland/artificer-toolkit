import { sprinkles } from '@/css/sprinkles.css'
import Collapsible from '@/components/Collapse'
import { use } from 'react'
import { calculateModifier } from '@/components/Form'
import { useMediaQuery } from 'usehooks-ts'
import { Grid, Button } from '@mantine/core'
import { useRaceData, useClassData, useSystemData } from '@/hooks'
import { useFormStore } from '@/store'
import type { CharacterInput } from 'gql/types'
import { ModalContext } from '@/components/Modal'
import { header_item, header_item_divider } from '@/components/Form/Steps/Characters'

const CharacterHeader = ({
  setFieldValueFn,
}: {
  setFieldValueFn: (name: string, value: string | number | string[] | undefined | null) => void
}) => {
  const { current } = useFormStore() as { current: CharacterInput }
  const { showModal } = use(ModalContext)

  const {
    races: { findRace },
  } = useRaceData()
  const {
    classes: { findListClass },
  } = useClassData()
  const {
    abilities: { findAbility },
  } = useSystemData()

  const race = findRace(current?.race)

  const sm = useMediaQuery('(max-width: 567px)')

  return (
    <>
      <Grid.Col>
        <Collapsible
          props={{
            trigger: {
              title: 'Character Details',
              titleRight: (
                <Button
                  className={sprinkles({ height: 'size-auto' })}
                  onClick={(e) => {
                    e.stopPropagation()
                    showModal({
                      type: 'hitpoints',
                      props: {
                        setFieldValue: setFieldValueFn,
                      },
                    })
                  }}
                >
                  Manage Hitpoints
                </Button>
              ),
            },
          }}
        >
          <Grid className={sprinkles({ mb: 'space-x' })}>
            <Grid.Col span={6}>
              <Grid>
                <Grid.Col span={{ sm: 12, md: 4 }} className={header_item}>
                  <span>
                    {'Name: '}
                    {current.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                  </span>
                  {!sm && <hr className={header_item_divider} />}
                </Grid.Col>
                <Grid.Col span={{ sm: 12, md: 4 }} className={header_item}>
                  <span>
                    {'Race: '}
                    {race?.label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                  </span>
                  {!sm && <hr className={header_item_divider} />}
                </Grid.Col>
                <Grid.Col span={{ sm: 12, md: 4 }} className={header_item}>
                  <span>
                    {current.classes?.length && current.classes?.length < 2 ? 'Class: ' : 'Class(es): '}
                    {current.classes?.length ?
                      current.classes?.map((uClass, index) => {
                        const fullClass = findListClass(uClass.id)
                        return (
                          <span key={index}>
                            {`${fullClass?.label} (Lvl. ${uClass.level})`}
                            {current.classes?.length &&
                              index !== current?.classes?.length - 1 &&
                              current.classes.length > 1 &&
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
                {current?.abilities?.scores?.map((score, index) => {
                  const ability = findAbility(score.ability)

                  const modifier = calculateModifier(score?.calculatedScore || 0, 'modifier')
                  return (
                    <Grid.Col span={{ sm: 12, md: 4, lg: 'auto' }} className={header_item} key={index}>
                      <span className={sprinkles({ me: 'space-4' })}>
                        {`${ability?.label}: `}
                        {score.calculatedScore ?
                          <span
                            className={sprinkles({ ws: 'nowrap' })}
                          >{`${score.calculatedScore} (${modifier})`}</span>
                        : <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
                      </span>
                      {!sm && current.abilities?.scores?.length && index !== current.abilities?.scores?.length - 1 && (
                        <hr className={header_item_divider} />
                      )}
                    </Grid.Col>
                  )
                })}
              </Grid>
            </Grid.Col>
          </Grid>
        </Collapsible>
      </Grid.Col>
    </>
  )
}

export default CharacterHeader
