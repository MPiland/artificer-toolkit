import parse from 'html-react-parser'
import { use } from 'react'
import Dropdown from '@/components/Dropdown'
import { feature_card_header } from '../../../Character.css'
import { option_dropdown } from '../../../Character.css'
import Collapse from '@/components/Collapse'
import { AncestryOption, Character, Race, type RaceListItem } from '../../../../../../amplify/gql/types'
import { FormContext } from '../../../FormContext'
import Grid from '@/components/Grid'
import CharacterFeature from '../Features/CharacterFeature'
import useRaceData from '../../../../../hooks/useRaceData'
import type { OnChange } from '@/types'
import type { FactoryFeature } from '../../../../../hooks/useGetFeatures'

const RaceFeatures = ({
  raceId,
  fullRace,
  fullAncestry,
  raceLineages,
}: {
  raceId: string
  fullRace: Race
  fullAncestry?: AncestryOption

  raceLineages: RaceListItem[]
}) => {
  const {
    features,
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    features: FactoryFeature[]
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      removeField: OnChange<Character>['removeField']
    }
  }

  const {
    races: { findRace },
  } = useRaceData()

  return (
    <>
      {raceLineages?.length &&
        raceLineages?.map((l, index) => {
          const lineage = findRace(l.id)
          return (
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
                          onChange={{ updateField, removeField }}
                          value={data?.ancestry?.id}
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
          )
        })}
      {fullRace.ancestry?.options?.length && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={fullRace.ancestry.label} className={feature_card_header} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>{fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}</Grid.Item>
                <Grid.Item justify='center'>
                  <Dropdown
                    name='ancestry.id'
                    label='Ancestry Option'
                    options={fullRace.ancestry.options}
                    className={option_dropdown}
                    value={data?.ancestry?.id}
                    onChange={
                      {
                        updateField: ({ value }) => {
                          const ancestryId = value
                          const ancestry = fullRace?.ancestry?.options.find((option) => option.id === ancestryId)

                          if (ancestry) {
                            return {
                              path: 'ancestry',
                              value: { id: ancestryId, raceId: fullRace.id },
                            }
                          }
                        },
                        removeField: () => ({ path: 'ancestry' }),
                      } as {
                        updateField: OnChange<Character>['updateField']
                        removeField: OnChange<Character>['removeField']
                      }
                    }
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
        .map((feature, fIndex) => <CharacterFeature feature={feature} key={fIndex} raceId={raceId} />)}
      {fullAncestry &&
        features
          ?.filter((feature) => feature?.ancestryId != null)
          .map((feature, fIndex) => <CharacterFeature feature={feature} key={fIndex} raceId={raceId} />)}
    </>
  )
}

export default RaceFeatures
