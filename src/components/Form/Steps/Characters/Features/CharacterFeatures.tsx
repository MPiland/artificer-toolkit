import { Grid } from '@mantine/core'
import Collapsible from '@/components/Collapse'
import parse from 'html-react-parser'
import type {
  CharacterClassInput,
  CharacterInput,
  CharacterFeatureInput,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterAbilitiesInput,
} from '@/types'
import { useFeatureData } from '@/hooks'
import { card_header, withFieldGroup, FeatureSections, FeatureOptions } from '@/components/Form'
import { useFormStore } from '@/store'

type ChracterFeatureProps = {
  uClass?: CharacterClassInput | undefined
  raceId?: string | undefined
  backgroundId?: string | undefined
  ancestryId?: string | undefined
}

const CharacterFeatures = withFieldGroup({
  defaultValues: {
    features: [] as CharacterFeatureInput[] | null | undefined,
    modifiers: [] as CharacterModifierInput[] | null | undefined,
    expertise: [] as CharacterExpertiseInput[] | null | undefined,
    proficiencies: [] as CharacterProficiencyInput[] | null | undefined,
    senses: [] as CharacterSenseInput[] | null | undefined,
    feats: [] as CharacterFeatInput[] | null | undefined,
    spellcasting: {} as CharacterSpellcastingInput | null | undefined,
    abilities: {} as CharacterAbilitiesInput | null | undefined,
  },
  props: {
    uClass: undefined,
    raceId: undefined,
    backgroundId: undefined,
    ancestryId: undefined,
  } as ChracterFeatureProps,
  render: function Render({ group, uClass, raceId, backgroundId, ancestryId }) {
    const formStore = useFormStore()
    const { features: featuresData, featureOptions } = useFeatureData()

    const { AppField } = group

    return (
      <AppField name='features'>
        {(featureArray) =>
          featureArray.state.value?.length &&
          featureArray.state.value
            .filter((f) => {
              if (ancestryId && f?.ancestryId != null) {
                return f?.ancestryId === ancestryId
              }
              if (raceId && f?.raceId != null) {
                return f?.raceId === raceId
              }
              if (backgroundId && f?.backgroundId != null) {
                return f?.backgroundId === backgroundId
              }
              if (uClass?.id && f?.classId != null) {
                return f?.classId === uClass?.id
              }
              return true
            })
            .map((_, i) => (
              <AppField name={`features[${i}]`} key={`feature-${i}`}>
                {(featureField) => {
                  const existFeatureIndex = (formStore.current as CharacterInput)?.features?.findIndex(
                    (f) => f?.id === featureField.state.value?.id && f?.level === featureField.state.value?.level
                  )

                  const featureIndex =
                    existFeatureIndex && existFeatureIndex > -1 ?
                      existFeatureIndex
                    : (formStore.current as CharacterInput)?.features?.length || 0

                  const headerTitle = `${featureField.state.value?.level && `(${featureField.state.value?.level}) `}${featuresData.find((f) => f?.id === featureField.state.value?.id)?.label || `Feature (${featureIndex})`}`

                  const feature = featuresData.find((f) => f?.id === featureField.state.value?.id)

                  const factoryOptionId = feature?.options?.find((oId) =>
                    featureArray?.state.value?.[featureIndex]?.options?.find((o) => o.id === oId)
                  )

                  const option = featureOptions.find((o) => o.id === factoryOptionId)

                  return (
                    featureField.state.value && (
                      <>
                        <Grid.Col>
                          <Collapsible
                            props={{
                              trigger: {
                                title: headerTitle,
                                className: card_header,
                              },
                            }}
                          >
                            <Grid>
                              {!feature?.options?.length ?
                                <FeatureSections
                                  featureIndex={featureIndex}
                                  classId={uClass?.id}
                                  raceId={raceId}
                                  backgroundId={backgroundId}
                                  form={group}
                                  fields={{
                                    features: 'features',
                                    modifiers: 'modifiers',
                                    expertise: 'expertise',
                                    proficiencies: 'proficiencies',
                                    senses: 'senses',
                                    feats: 'feats',
                                    spellcasting: 'spellcasting',
                                  }}
                                />
                              : <FeatureOptions
                                  form={group}
                                  featureIndex={featureIndex}
                                  fields={{
                                    features: 'features',
                                    spellcasting: 'spellcasting',
                                    abilities: 'abilities',
                                  }}
                                />
                              }
                              {option && (
                                <>
                                  <Grid.Col>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Col>
                                  <FeatureSections
                                    featureIndex={featureIndex}
                                    classId={uClass?.id}
                                    raceId={raceId}
                                    backgroundId={backgroundId}
                                    optionId={option.id}
                                    form={group}
                                    fields={{
                                      features: 'features',
                                      modifiers: 'modifiers',
                                      expertise: 'expertise',
                                      proficiencies: 'proficiencies',
                                      senses: 'senses',
                                      feats: 'feats',
                                      spellcasting: 'spellcasting',
                                    }}
                                  />
                                </>
                              )}
                            </Grid>
                          </Collapsible>
                        </Grid.Col>
                      </>
                    )
                  )
                }}
              </AppField>
            ))
        }
      </AppField>
    )
  },
})
export default CharacterFeatures
