import { sprinkles } from '~css/sprinkles.css'
import Collapsible from '~components/Collapse'
import { use } from 'react'
import { calculateModifier } from '~components/Form'
import { useMediaQuery } from 'usehooks-ts'
import { Grid, Button } from '@mantine/core'
import { useSystemData } from '~hooks'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { CharacterInput } from 'gql/types'
import { ModalContext } from '~components/Modal'
import { header_item, header_item_divider } from '~components/Form/Steps/Characters'
import { useSuspenseQueries } from '@tanstack/react-query'
import { queryClient, fetchClass, useGetRace } from '~apis'

const CharacterHeader = ({
  setFieldValueFn,
}: {
  setFieldValueFn: (name: string, value: string | number | string[] | undefined | null) => void
}) => {
  const store = useTypedFormStore<CharacterInput>()

  const { raceId, classes, label, abilities } = useOptimizedSelector(store, (state) => ({
    raceId: state.current?.race,
    classes: state.current?.classes,
    label: state.current?.label,
    abilities: state.current?.abilities,
  }))

  const { data: fullClasses } = useSuspenseQueries({
    queries:
      classes?.map((uClass) => ({
        queryKey: ['classes', uClass.id],
        queryFn: async () => queryClient.fetchQuery(fetchClass(uClass.id || '')),
      })) || [],
    combine: (result) => ({
      data: result.map((res) => res.data),
    }),
  })

  const { data: race } = useGetRace(raceId || '')

  const { showModal } = use(ModalContext)

  const {
    abilities: { findAbility },
  } = useSystemData()

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
                    {label || <span className={sprinkles({ ws: 'nowrap' })}>---</span>}
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
                    {classes?.length && classes?.length < 2 ? 'Class: ' : 'Class(es): '}
                    {classes?.length ?
                      fullClasses?.map((fullClass, index) => {
                        const level = classes?.find((uClass) => uClass.id === fullClass?.id)?.level
                        return (
                          <span key={index}>
                            {`${fullClass?.label} (Lvl. ${level})`}
                            {classes?.length && index !== classes?.length - 1 && classes.length > 1 && ' / '}
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
                {abilities?.scores?.map((score, index) => {
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
                      {!sm && abilities?.scores?.length && index !== abilities?.scores?.length - 1 && (
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
