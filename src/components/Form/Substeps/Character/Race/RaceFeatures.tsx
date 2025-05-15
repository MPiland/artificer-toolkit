import parse from 'html-react-parser'
import { use } from 'react'
import Dropdown from '@/components/Dropdown'
import { feature_card_header } from '../../../Character.css'
import { option_dropdown } from '../../../Character.css'
import Collapsible from '@/components/Collapsible'
import { AncestryOption, Character, Race, type RaceListItem } from '../../../../../../amplify/gql/types'
import { FormContext } from '../../../FormContext'
import { Grid } from '@mantine/core'
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
              <Grid.Col key={index}>
                <Collapsible>
                  <Collapsible.Trigger title={lineage?.ancestry.label} className={feature_card_header} />
                  <Collapsible.Content>
                    <Grid>
                      <Grid.Col>{lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}</Grid.Col>
                      <Grid.Col justify='center'>
                        <Dropdown
                          name={`ancestry.id`}
                          label='Ancestry Option'
                          className={option_dropdown}
                          options={lineage?.ancestry.options}
                          onChange={{ updateField, removeField }}
                          value={data?.ancestry?.id}
                        />
                      </Grid.Col>
                      {fullAncestry && (
                        <Grid.Col justify='center'>
                          <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Collapsible.Content>
                </Collapsible>
              </Grid.Col>
            )
          )
        })}
      {fullRace.ancestry?.options?.length && (
        <Grid.Col>
          <Collapsible>
            <Collapsible.Trigger title={fullRace.ancestry.label} className={feature_card_header} />
            <Collapsible.Content>
              <Grid>
                <Grid.Col>{fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}</Grid.Col>
                <Grid.Col justify='center'>
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
                </Grid.Col>
                {fullAncestry && (
                  <Grid.Col justify='center'>
                    <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>
                  </Grid.Col>
                )}
              </Grid>
            </Collapsible.Content>
          </Collapsible>
        </Grid.Col>
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
