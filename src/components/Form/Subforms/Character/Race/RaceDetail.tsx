import parse from 'html-react-parser'
import Collapse from '../../../../Collapse/Collapse'
import type { Character, RaceListItem } from '../../../../../../amplify/gql/types'
import { Categories } from '../../../../../types/enums'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Modal from '../../../../Modal/Modal'
import ScrollArea from '../../../../ScrollArea/ScrollArea'
import Button from '../../../../Button/Button'
import useRaceData from '../../../../../hooks/useRaceData'
import { FormStore } from '../../../../../store/formStore'
import type { OnChange } from '../../../../../types/form'

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
              <Grid.Item>
                {fullRace?.details?.length && fullRace?.details[0].desc && parse(fullRace?.details[0].desc)}
              </Grid.Item>
              {raceLineages?.length &&
                raceLineages?.map((race, index) => (
                  <Grid.Item key={index}>
                    {race?.details?.length && race?.details[0].desc && parse(race?.details[0].desc)}
                  </Grid.Item>
                ))}
              {fullRace?.category === Categories.subrace && (
                <Grid.Item>{fullRace?.desc && parse(fullRace?.desc)}</Grid.Item>
              )}{' '}
              F
              {fullRace?.traits?.details?.length &&
                fullRace.traits.details.map((detail, index) => (
                  <Grid.Item key={index}>
                    <Collapse key={index}>
                      <Collapse.Header title={detail.label} startOpened={true} />
                      <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
                    </Collapse>
                  </Grid.Item>
                ))}
              {raceLineages?.length &&
                raceLineages?.map((r) => {
                  const race = findRace(r.id)
                  return (
                    race?.traits?.details?.length &&
                    race.traits.details.map((detail, index) => (
                      <Grid.Item key={index}>
                        <Collapse key={index}>
                          <Collapse.Header title={detail.label} startOpened={true} />
                          <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
                        </Collapse>
                      </Grid.Item>
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
                    <Grid.Item key={index}>
                      <Collapse key={index}>
                        <Collapse.Header title={feature?.label || `Feature (${index})`} startOpened={true} />
                        <Collapse.Body>{feature.desc && parse(feature.desc)}</Collapse.Body>
                      </Collapse>
                    </Grid.Item>
                  ))}
              {ancestry && (
                <Grid.Item>
                  <Collapse>
                    <Collapse.Header title={ancestry.label} startOpened={true} />
                    <Collapse.Body>{ancestry.desc && parse(ancestry.desc)}</Collapse.Body>
                  </Collapse>
                </Grid.Item>
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
