import parse from 'html-react-parser'
import Collapsible from '@/components/Collapse'
import { Categories } from '@/enums'
import { useGetFeatures, useRaceData } from '@/hooks'
import Modal from '@/components/Modal'
import { Grid, ScrollArea, Button } from '@mantine/core'
import type { RaceListItem } from '@/types'
import { RaceInputSchema } from '@/schemas'
import { useFormStore } from '@/store'

const RaceDetail = ({ race, addRace, setRace }: { race: RaceListItem; setRace: () => void; addRace: () => void }) => {
  const {
    races: { findLineages, findRace },
  } = useRaceData()

  const { setChangeRace } = useFormStore()

  const fullRace = findRace(race.id)
  const { createFeatures } = useGetFeatures()
  const raceLineages = findLineages(race.id)
  const ancestry = fullRace?.ancestry
  const features = createFeatures({ data: RaceInputSchema.parse(fullRace)! })

  const handleSelect = () => {
    addRace()
    setRace()
    setChangeRace(false)
  }

  return (
    <Modal
      props={{
        footer: {
          children: <Button color='primary' onClick={handleSelect}>{`Select Race`}</Button>,
        },
      }}
    >
      <ScrollArea>
        <Grid>
          <Grid.Col>
            {fullRace?.details?.length && fullRace?.details[0].desc && parse(fullRace?.details[0].desc)}
          </Grid.Col>
          {raceLineages?.length &&
            raceLineages?.map((race, index) => (
              <Grid.Col key={index}>
                {race?.details?.length && race?.details[0].desc && parse(race?.details[0].desc)}
              </Grid.Col>
            ))}
          {fullRace?.category === Categories.SUBRACE && <Grid.Col>{fullRace?.desc && parse(fullRace?.desc)}</Grid.Col>}
          {fullRace?.traits?.details?.length &&
            fullRace.traits.details.map((detail, index) => (
              <Grid.Col key={`trait-${index}`}>
                <Collapsible
                  props={{
                    trigger: {
                      title: detail.label,
                    },
                  }}
                >
                  {detail.desc && parse(detail.desc)}
                </Collapsible>
              </Grid.Col>
            ))}
          {raceLineages?.length &&
            raceLineages?.map((r) => {
              const race = findRace(r.id)
              return (
                race?.traits?.details?.length &&
                race.traits.details.map((detail, index) => (
                  <Grid.Col key={index}>
                    <Collapsible
                      props={{
                        trigger: {
                          title: detail.label,
                        },
                      }}
                    >
                      {detail.desc && parse(detail.desc)}
                    </Collapsible>
                  </Grid.Col>
                ))
              )
            })}
          {features?.length &&
            features
              .sort((a, b) => {
                if (a.label && b.label) {
                  return a.label.localeCompare(b.label)
                } else if (a.label && !b.label) {
                  return -1
                } else if (!a.label && b.label) {
                  return 1
                } else {
                  return 0
                }
              })
              .map((feature, index) => (
                <Grid.Col key={index}>
                  <Collapsible
                    props={{
                      trigger: {
                        title: feature?.label || `Feature (${index})`,
                      },
                    }}
                  >
                    {feature.desc && parse(feature.desc)}
                  </Collapsible>
                </Grid.Col>
              ))}
          {ancestry && (
            <Grid.Col>
              <Collapsible
                props={{
                  trigger: {
                    title: ancestry.label,
                  },
                }}
              >
                {ancestry.desc && parse(ancestry.desc)}
              </Collapsible>
            </Grid.Col>
          )}
        </Grid>
      </ScrollArea>
    </Modal>
  )
}

export default RaceDetail
