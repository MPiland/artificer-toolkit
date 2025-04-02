import parse from 'html-react-parser'
import { useListRacesQuery } from '../../../../../apis/racesApi'
import Collapse from '../../../../Collapse/Collapse'
import { Character, Race } from '../../../../../../amplify/gql/types'
import { Categories } from '../../../../../types/enums'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import { UpdateState } from '../../../../../types/form'
import Modal from '../../../../Modal/Modal'
import ScrollArea from '../../../../ScrollArea/ScrollArea'
import Button from '../../../../Button/Button'

const RaceDetail = ({ fullRace, setFullRace }: { fullRace: Race; setFullRace: () => void }) => {
  const { data: races } = useListRacesQuery()
  const { updateFormData, setAddClass } = use(FormContext) as {
    formData: Character
    updateFormData: (data: UpdateState<Character>) => void
    setAddClass: (value: boolean) => void
  }

  const { createFeatures } = useGetFeatures({ data: fullRace })
  const raceLineages = races.filter((sRace) => fullRace?.lineages?.includes(sRace.id))
  const ancestry = fullRace?.ancestry
  const features = createFeatures()

  const handleSelect = () => {
    updateFormData({
      type: 'update',
      path: 'race',
      value: fullRace?.id,
    })
    setAddClass(false)
  }

  return (
    <Modal onClose={setFullRace}>
      <Modal.Dialogue>
        <Modal.Header title={fullRace.label} onClose={setFullRace} />
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
                raceLineages?.map(
                  (race) =>
                    race?.traits?.details?.length &&
                    race.traits.details.map((detail, index) => (
                      <Grid.Item key={index}>
                        <Collapse key={index}>
                          <Collapse.Header title={detail.label} startOpened={true} />
                          <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
                        </Collapse>
                      </Grid.Item>
                    ))
                )}
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
