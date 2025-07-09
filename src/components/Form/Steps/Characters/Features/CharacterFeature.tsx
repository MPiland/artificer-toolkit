import { Grid } from '@mantine/core'
import Collapsible from '@/components/Collapsible'
import { Attributes } from '@/enums'
import parse from 'html-react-parser'
import type { CharacterClassInput, CharacterFeatureInput, SectionFormDataType } from '@/types'
import { type FactoryFeature, useFeatureData, useGetSections } from '@/hooks'
import { feature_card_header, withFieldGroup, SECTION_STEPS, FeatureSection, FeatureOption } from '@/components/Form'
import { CharacterFeatureInputSchema } from '@/schemas'
import {
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterAbilitiesInput,
} from '@/types'
import { useStore } from '@tanstack/react-form'

const defaultValues: {
  modifiers?: CharacterModifierInput[]
  expertise?: CharacterExpertiseInput[]
  proficiencies?: CharacterProficiencyInput[]
  senses?: CharacterSenseInput[]
  feats?: CharacterFeatInput[]
  spellcasting?: CharacterSpellcastingInput
  features?: CharacterFeatureInput[]
  abilities?: CharacterAbilitiesInput
} = {
  modifiers: [],
  expertise: [],
  proficiencies: [],
  senses: [],
  feats: [],
  spellcasting: undefined,
  features: [],
  abilities: undefined,
}

type ChracterFeatureProps = {
  uClass?: CharacterClassInput | undefined
  feature?: FactoryFeature | undefined
  classIndex?: number | undefined
  raceId?: string | undefined
  backgroundId?: string | undefined
}

const CharacterFeature = withFieldGroup({
  defaultValues,
  props: {
    uClass: undefined,
    feature: undefined,
    classIndex: undefined,
    raceId: undefined,
    backgroundId: undefined,
  } as ChracterFeatureProps,
  render: function Render({ group, uClass, classIndex, raceId, backgroundId, feature }) {
    const {
      features: { findFeature },
      featureOptions: { findFeatureOption },
    } = useFeatureData()
    const { sectionTypeMap } = useGetSections()

    const { features } = useStore(group.store, (state) => ({ features: state.values.features }))

    const existFeatureIndex = features?.findIndex((f) => f?.id === feature?.id && f?.level === feature?.level)

    const featureIndex = existFeatureIndex && existFeatureIndex > -1 ? existFeatureIndex : features?.length || 0

    const headerTitle = `${feature?.level && `(${feature?.level}) `}${feature?.label || `Feature (${featureIndex})`}`

    return (
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title={headerTitle} className={feature_card_header} />
          <Collapsible.Content>
            <Grid>
              {feature &&
                (!findFeature(feature?.id)?.options?.length ?
                  SECTION_STEPS.map(
                    (sectionStep: (typeof SECTION_STEPS)[number]) =>
                      feature?.[sectionStep]?.length &&
                      feature?.[sectionStep].map((sectionId, sIndex) => {
                        const sectionMap = sectionTypeMap(sectionStep)
                        const section = sectionMap.schema.parse(sectionMap.get(sectionId))
                        if (section?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                          return (
                            <FeatureSection
                              key={sIndex}
                              section={section as SectionFormDataType}
                              sectionStep={sectionStep}
                              featureIndex={featureIndex}
                              classIndex={classIndex}
                              classId={uClass?.id}
                              raceId={raceId}
                              backgroundId={backgroundId}
                              feature={CharacterFeatureInputSchema.parse(feature)}
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
                          )
                        }
                      })
                  )
                : <FeatureOption
                    form={group}
                    fields={{
                      features: 'features',
                      spellcasting: 'spellcasting',
                      abilities: 'abilities',
                    }}
                  />)}
              {(() => {
                if (feature && feature.options) {
                  const optionId = findFeature(feature.id)?.options?.find((fOption) =>
                    features?.[featureIndex]?.options?.find((o) => o.id === fOption)
                  )

                  const option = findFeatureOption(optionId)

                  if (option) {
                    return (
                      <>
                        <Grid.Col>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Col>
                        {SECTION_STEPS.map(
                          (sectionStep) =>
                            option?.[sectionStep]?.length &&
                            option?.[sectionStep]?.map((sectionId) => {
                              const sectionMap = sectionTypeMap(sectionStep)
                              const section = sectionMap.schema.parse(sectionMap.get(sectionId))
                              if (section.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                                return (
                                  <FeatureSection
                                    key={section.id}
                                    section={section as SectionFormDataType}
                                    sectionStep={sectionStep}
                                    featureIndex={featureIndex}
                                    classIndex={classIndex}
                                    classId={uClass?.id}
                                    optionId={option.id}
                                    feature={CharacterFeatureInputSchema.parse(feature)}
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
                                )
                              }
                            })
                        )}
                      </>
                    )
                  }
                }
              })()}
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})
export default CharacterFeature
