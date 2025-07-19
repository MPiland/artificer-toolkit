import { z } from 'zod/v4'
import { use, type ReactElement } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid, Button, Group } from '@mantine/core'
import {
  Feats,
  Spells,
  Modifiers,
  Senses,
  Proficiencies,
  Expertise,
  Feature,
  SECTION_STEPS,
  useAppForm,
} from '@/components/Form'
import type { ClassInput, Feature as FeatureOutput, RaceInput } from '@/types'
import {
  BackgroundInputSchema,
  ClassInputSchema,
  EquipmentInputSchema,
  FeatInputSchema,
  FeatureInputSchema,
  RaceInputSchema,
} from '@/schemas'
import { useFeatureStore, useFormStore, useFeatureOptionStore } from '@/store'
import { ModalContext } from '@/components/Modal'
import { useBackgroundData, useFeatData, useEquipmentData, useClassData, useRaceData, useFeatureData } from '@/hooks'
import { v4 as uuidv4 } from 'uuid'
import { Outlet } from '@tanstack/react-router'
import Accordion from '@/components/Accordion'
import { startCase } from 'lodash'
import parse from 'html-react-parser'
import { description } from './Feature.css'
import { convertTypenameToKindInput } from '@/utils'

const Features = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: z
      .discriminatedUnion('__kind', [
        RaceInputSchema,
        EquipmentInputSchema,
        FeatureInputSchema,
        ClassInputSchema,
        BackgroundInputSchema,
        FeatInputSchema,
      ])
      .parse(formStore.current),
  })

  const category = (formStore.current as RaceInput | ClassInput)?.category
  const subtypes = (formStore.current as ClassInput)?.subtypes || []

  const sectionStepComponent: {
    [K in (typeof SECTION_STEPS)[number]]?: ReactElement
  } = {
    feats: <Feats category={category} subtypes={subtypes} />,
    senses: <Senses category={category} subtypes={subtypes} />,
    spells: <Spells category={category} subtypes={subtypes} />,
    modifiers: <Modifiers category={category} subtypes={subtypes} />,
    expertise: <Expertise category={category} subtypes={subtypes} />,
    proficiencies: <Proficiencies category={category} subtypes={subtypes} />,
  }

  const { AppField } = form

  const featureStore = useFeatureStore()
  const optionStore = useFeatureOptionStore()
  const { showModal } = use(ModalContext)

  const { races, metaData: raceMetaData } = useRaceData()
  const { classes, metaData: classMetaData } = useClassData()
  const { equipment, metaData: EquipmentMeta } = useEquipmentData()
  const { backgrounds, metaData: backgroundMetaData } = useBackgroundData()
  const { feats, metaData: featMetaData } = useFeatData()
  const { features: featureData, featureOptions: optionData } = useFeatureData()

  const featureTitle =
    featureStore.current?.label != null &&
    featureStore.current?.label !== '' &&
    `(${featureStore.step === 'options' ? (optionStore.current?.label ?? '') : ((featureStore.step === 'features' && featureStore.current?.label) ?? '')})`

  // Add feature
  const handleAddFeature = () => {
    featureStore.setCurrent(
      FeatureInputSchema.parse({
        id: uuidv4(),
        __kind: 'FeatureInput',
      })
    )
    featureStore.setStep('features')
  }

  // Edit feature
  const handleEditFeature = async (id: string) => {
    const featureState = featureData.find((feature) => feature.id === id)
    if (!featureState) return
    const featureInput = FeatureInputSchema.parse(convertTypenameToKindInput(featureState))
    featureStore.setCurrent(featureInput)
    featureStore.setStep('features')
  }

  const onCopyConfirm = (selectedFeature: FeatureOutput) => {
    const feature = FeatureInputSchema.parse({ ...selectedFeature, id: uuidv4() })
    featureStore.setCurrent(feature)
    featureStore.setStep('features')
  }

  // Copy feature
  const handleCopyFeature = () => {
    showModal({
      type: 'copy',
      props: {
        form: 'feature',
        data: {
          ...raceMetaData.features.map((feature) => ({
            ...feature,
            label: featureData.findFeature(feature.id)?.label || '',
          })),
          ...classMetaData.features.map((feature) => ({
            ...feature,
            label: featureData.findFeature(feature.id)?.label || '',
          })),
          ...featMetaData.features.map((feature) => ({
            ...feature,
            label: featureData.findFeature(feature.id)?.label || '',
          })),
          ...EquipmentMeta.features.map((feature) => ({
            ...feature,
            label: featureData.findFeature(feature.id)?.label || '',
          })),
          ...backgroundMetaData.features.map((feature) => ({
            ...feature,
            label: featureData.findFeature(feature.id)?.label || '',
          })),
        },
        filters: {
          races: races,
          classes: classes,
          equipment: equipment,
          backgrounds: backgrounds,
          feats: feats,
        },
        onCopy: (feature) => onCopyConfirm(feature as FeatureOutput),
      },
    })
  }

  return (
    <Grid>
      {featureStore.step == null ?
        <>
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <Button variant='outline' fullWidth onClick={handleAddFeature} className={sprinkles({ me: 'space-4' })}>
              Add Feature
            </Button>
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <Button color='primary' variant='outline' fullWidth onClick={handleCopyFeature}>
              Copy Feature
            </Button>
          </Grid.Col>
          <AppField name='features' mode='array'>
            {(features) =>
              features.state.value?.length && (
                <Grid.Col>
                  <Accordion
                    dataArray={features.state.value}
                    onChange={(dataArray) => features.handleChange(dataArray as string[])}
                  >
                    {features.state.value?.map((f, i) => {
                      const feature = featureData.find((fData) => fData.id === f)
                      return (
                        feature && (
                          <Accordion.Item key={`feature-${i}`} itemId={String(i)} value={`feature-${i}`}>
                            <Accordion.Trigger
                              removeFn={() => {
                                features.removeValue(i)
                                formStore.removeField({ path: `features.${i}` })
                              }}
                              editFn={() => handleEditFeature(f)}
                              title={feature.label != null && feature.label !== '' ? feature.label : `feature ${i + 1}`}
                            >
                              <Group justify='flex-start' wrap='nowrap'>
                                {SECTION_STEPS.map((sectionStep, sI) => {
                                  return (
                                    <span key={`${sectionStep}-${sI}`} className={sprinkles({ me: 'space-2' })}>
                                      {feature[sectionStep] && feature[sectionStep]?.length ?
                                        <strong>
                                          {startCase(sectionStep.charAt(0))}: {feature[sectionStep]?.length}
                                        </strong>
                                      : `${startCase(sectionStep.charAt(0))}: 0`}
                                    </span>
                                  )
                                })}
                              </Group>
                            </Accordion.Trigger>
                            {feature.desc && (
                              <Accordion.Content>
                                <div className={description}>
                                  <div>
                                    {feature?.desc && parse(feature.desc)}
                                    {feature.options &&
                                      feature.options?.length > 0 &&
                                      feature.options?.map((o, oI) => {
                                        const option = optionData.find((option) => option.id === o)
                                        return (
                                          <div key={`option-${oI}`}>
                                            {option?.label && <strong>{option.label}</strong>}
                                            {option?.desc && parse(option.desc)}
                                          </div>
                                        )
                                      })}
                                  </div>
                                </div>
                              </Accordion.Content>
                            )}
                          </Accordion.Item>
                        )
                      )
                    })}
                  </Accordion>
                </Grid.Col>
              )
            }
          </AppField>
          <Outlet />
        </>
      : <>
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
          </Grid.Col>
          {featureStore.step === 'options' || featureStore.step === 'features' ?
            <Feature />
          : sectionStepComponent[featureStore.step]}
        </>
      }
    </Grid>
  )
}

export default Features
