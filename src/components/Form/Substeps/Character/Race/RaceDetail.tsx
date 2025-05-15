import parse from 'html-react-parser'
import Collapsible from '@/components/Collapsible'
import { Categories } from '@/enums'
import { useGetFeatures, useRaceData } from '@/hooks'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Modal from '@/components/Modal'
import { Grid, ScrollArea } from '@mantine/core'
import Button from '@/components/Button'
import type { FormStore } from '@/store'
import type { OnChange, Character, RaceListItem } from '@/types'

const RaceDetail = ({ race, setRace }: { race: RaceListItem; setRace: () => void }) => {
  const {
    races: { findLineages, findRace },
  } = useRaceData()
  const {
    formStore: { updateField, setAddClass },
  } = use(FormContext) as {
    formStore: {
      updateField: OnChange<Character>['updateField']
      setAddClass: FormStore<Character>['setAddClass']
    }
  }

  const fullRace = findRace(race.id)
  const { createFeatures } = useGetFeatures({ data: fullRace! })
  const raceLineages = findLineages(race.id)
  const ancestry = fullRace?.ancestry
  const features = createFeatures()

  const handleSelect = () => {
    updateField({
      path: 'race',
      value: fullRace?.id,
    })
    setAddClass(false)
  }

  return (
    <Modal onClose={setRace}>
      <Modal.Dialogue>
        <Modal.Header title={race.label} onClose={setRace} />
        <Modal.Content>
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
              {fullRace?.category === Categories.SUBRACE && (
                <Grid.Col>{fullRace?.desc && parse(fullRace?.desc)}</Grid.Col>
              )}{' '}
              F
              {fullRace?.traits?.details?.length &&
                fullRace.traits.details.map((detail, index) => (
                  <Grid.Col key={index}>
                    <Collapsible key={index}>
                      <Collapsible.Trigger title={detail.label} />
                      <Collapsible.Content>{detail.desc && parse(detail.desc)}</Collapsible.Content>
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
                        <Collapsible key={index}>
                          <Collapsible.Trigger title={detail.label} />
                          <Collapsible.Content>{detail.desc && parse(detail.desc)}</Collapsible.Content>
                        </Collapsible>
                      </Grid.Col>
                    ))
                  )
                })}
              {features?.length &&
                features
                  .sort((a, b) => {
                    if (a.value && b.value) {
                      return a.value.localeCompare(b.value)
                    } else if (a.value && !b.value) {
                      return -1
                    } else if (!a.value && b.value) {
                      return 1
                    } else {
                      return 0
                    }
                  })
                  .map((feature, index) => (
                    <Grid.Col key={index}>
                      <Collapsible key={index} defaultOpen={true}>
                        <Collapsible.Trigger title={feature?.label || `Feature (${index})`} />
                        <Collapsible.Content>{feature.desc && parse(feature.desc)}</Collapsible.Content>
                      </Collapsible>
                    </Grid.Col>
                  ))}
              {ancestry && (
                <Grid.Col>
                  <Collapsible defaultOpen={true}>
                    <Collapsible.Trigger title={ancestry.label} />
                    <Collapsible.Content>{ancestry.desc && parse(ancestry.desc)}</Collapsible.Content>
                  </Collapsible>
                </Grid.Col>
              )}
            </Grid>
          </ScrollArea>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select Race`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default RaceDetail
