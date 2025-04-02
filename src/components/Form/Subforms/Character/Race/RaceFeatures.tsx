import parse from 'html-react-parser'
import { use } from 'react'
import Dropdown from '../../../../Dropdown/Dropdown'
import { feature_card_header } from '../../../Character.css'
import { option_dropdown } from '../../../Character.css'
import Collapse from '../../../../Collapse/Collapse'
import { AncestryOption, Character, Race } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'
import CharacterFeature from '../Features/CharacterFeature'

const RaceFeatures = ({
  raceId,
  fullRace,
  fullAncestry,
  updateFormData,
  formData,
  raceLineages,
}: {
  raceId: string
  fullRace: Race
  fullAncestry?: AncestryOption
  updateFormData: (arg: UpdateState<Character>) => void
  formData: Character
  raceLineages: Race[]
}) => {
  const { features } = use(FormContext)

  const handleAncestryChange = (e: UpdateState<Character>) => {
    if (e.type === 'update') {
      const ancestryId = e.value
      const ancestry = fullRace?.ancestry?.options.find((option) => option.id === ancestryId)

      if (ancestry) {
        updateFormData({
          type: 'update',
          path: 'ancestry',
          value: { id: ancestryId, raceId: fullRace.id },
        })
      }
    }

    if (e.type === 'remove') {
      updateFormData({
        type: 'remove',
        path: 'ancestry',
      })
    }
  }

  return (
    <>
      {raceLineages?.length &&
        raceLineages?.map(
          (lineage, index) =>
            lineage?.ancestry?.options?.length && (
              <Grid.Item key={index}>
                <Collapse>
                  <Collapse.Header title={lineage?.ancestry.label} className={feature_card_header} />
                  <Collapse.Body>
                    <Grid>
                      <Grid.Item>{lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}</Grid.Item>
                      <Grid.Item justify='center'>
                        <Dropdown
                          name={`ancestry.id`}
                          label='Ancestry Option'
                          className={option_dropdown}
                          options={lineage?.ancestry.options}
                          onChange={updateFormData}
                          value={formData?.ancestry?.id}
                        />
                      </Grid.Item>
                      {fullAncestry && (
                        <Grid.Item justify='center'>
                          <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>
                        </Grid.Item>
                      )}
                    </Grid>
                  </Collapse.Body>
                </Collapse>
              </Grid.Item>
            )
        )}
      {fullRace.ancestry?.options?.length && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={fullRace.ancestry.label} className={feature_card_header} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>{fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}</Grid.Item>
                <Grid.Item justify='center'>
                  <Dropdown<Character>
                    name='ancestry.id'
                    label='Ancestry Option'
                    options={fullRace.ancestry.options}
                    className={option_dropdown}
                    value={formData?.ancestry?.id}
                    onChange={(e) => handleAncestryChange(e)}
                  />
                </Grid.Item>
                {fullAncestry && (
                  <Grid.Item justify='center'>
                    <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>
                  </Grid.Item>
                )}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
      {features
        ?.filter((feature) => feature?.raceId === fullRace.id)
        .map((feature, fIndex) => {
          return <CharacterFeature feature={feature} key={fIndex} raceId={raceId} />
        })}
      {fullAncestry &&
        features
          ?.filter((feature) => feature?.ancestryId != null)
          .map((feature, fIndex) => {
            return <CharacterFeature feature={feature} key={fIndex} raceId={raceId} />
          })}
    </>
  )
}

export default RaceFeatures
