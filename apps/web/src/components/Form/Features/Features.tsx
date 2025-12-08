import { sprinkles } from '~css/sprinkles.css'
import { Grid, Button, Group } from '@mantine/core'
import { SECTION_STEPS, description, Feature } from '~components/Form'
import type { FeatureInput, Feature as FeatureOutput, FormDataType, CharacterInput, SpellInput } from '~types'
import { v4 as uuidv4 } from 'uuid'
import { Outlet } from '@tanstack/react-router'
import Accordion from '~components/Accordion'
import { startCase } from 'lodash-es'
import parse from 'html-react-parser'
import { FeatureInputSchema } from '~schemas'
import { convertTypenameToKindInput } from '~utils'
import { AuthContext } from '../../../auth/AuthProvider'
import { useSystemPref, useFormField } from '~hooks'
import { ModalContext } from '~components/Modal'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import { use } from 'react'
import {
  useListRaces,
  useListClasses,
  useListEquipment,
  useListBackgrounds,
  useListFeats,
  useListFeatures,
} from '~apis'

const Features = () => {
  const { user } = use(AuthContext)
  const [systemPref] = useSystemPref()
  const { showModal } = use(ModalContext)

  const store = useTypedFormStore<Exclude<FormDataType, CharacterInput | SpellInput>>()

  const { updateField, featureData, setEditing, featureIndex } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    featureData: state.current?.features,
    setEditing: state.setEditing,
    featureIndex: state.meta.editing.featureIndex,
  }))

  const { AppField } = useFormField({ store })

  const {
    data: { metaData: raceMeta },
  } = useListRaces()
  const {
    data: { metaData: classMeta },
  } = useListClasses()
  const {
    data: { metaData: equipmentMeta },
  } = useListEquipment()
  const {
    data: { metaData: backgroundMeta },
  } = useListBackgrounds()
  const {
    data: { metaData: featMeta },
  } = useListFeats()
  const {
    data: { features },
  } = useListFeatures()

  // Add feature
  const handleAddFeature = () => {
    const featureInputObj = FeatureInputSchema.parse({
      id: uuidv4(),
      __kind: 'FeatureInput',
      label: '',
      ownerId: user?.userId,
      systemId: systemPref,
      masterId: undefined,
    })
    const newIndex = featureData?.length || 0
    updateField({ path: `features[${newIndex}]`, value: featureInputObj })
    setEditing({ featureIndex: newIndex })
  }

  // Edit feature
  const handleEditFeature = async (index: number) => {
    setEditing({ featureIndex: index })
  }

  const handleConfirm = (selectedFeature: FeatureOutput) => {
    const newIndex = featureData?.length || 0
    const newFeature = convertTypenameToKindInput(selectedFeature) as FeatureInput
    const featureInpObj = FeatureInputSchema.parse({
      ...newFeature,
      id: uuidv4(),
      label: '',
      ownerId: user?.userId,
      systemId: systemPref,
      masterId: undefined,
    })
    updateField({ path: `features[${newIndex}]`, value: featureInpObj })
    setEditing({ featureIndex: newIndex })
  }

  const featureArray = features.map((feature) => {
    const racesIds = raceMeta?.features?.find((f) => f.id === feature.id)?.raceIds
    const classIds = classMeta?.features?.find((f) => f.id === feature.id)?.classIds
    const equipmentIds = equipmentMeta?.features?.find((f) => f.id === feature.id)?.equipmentIds
    const backgroundIds = backgroundMeta?.features?.find((f) => f.id === feature.id)?.backgroundIds
    const featIds = featMeta?.features?.find((f) => f.id === feature.id)?.featIds
    return {
      id: feature.id,
      label: feature.label,
      racesIds,
      classIds,
      equipmentIds,
      backgroundIds,
      featIds,
    }
  })

  // Copy feature
  const handleCopyFeature = async () => {
    showModal({
      type: 'copy',
      props: {
        form: 'feature',
        data: featureArray,
        onCopy: (item) => handleConfirm(item as FeatureOutput),
      },
    })
  }

  return (
    <>
      {featureIndex === null ?
        <Grid>
          <AppField name='features' mode='array'>
            {(featureArray) => (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <Button
                    color='primary'
                    variant='outline'
                    fullWidth
                    onClick={handleAddFeature}
                    className={sprinkles({ me: 'space-4' })}
                  >
                    Add Feature
                  </Button>
                </Grid.Col>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <Button color='primary' variant='outline' fullWidth onClick={() => handleCopyFeature()}>
                    Copy Feature
                  </Button>
                </Grid.Col>
                {featureArray.state.value?.length && (
                  <Grid.Col>
                    <Accordion
                      dataArray={featureArray.state.value}
                      onChange={(dataArray) => featureArray.handleChange(dataArray as FeatureInput[])}
                    >
                      {featureArray.state.value?.map((feature, i) => {
                        return (
                          <Accordion.Item key={`feature-${i}`} itemId={String(i)} value={`feature-${i}`}>
                            <Accordion.Trigger
                              removeFn={() => {
                                featureArray.removeValue(i)
                                updateField({ path: `features.${i}`, value: undefined })
                              }}
                              editFn={() => handleEditFeature(i)}
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
                                      feature.options?.map((option, oI) => (
                                        <div key={`option-${oI}`}>
                                          {option?.label && <strong>{option.label}</strong>}
                                          {option?.desc && parse(option.desc)}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </Accordion.Content>
                            )}
                          </Accordion.Item>
                        )
                      })}
                    </Accordion>
                  </Grid.Col>
                )}
              </>
            )}
          </AppField>
          <Outlet />
        </Grid>
      : <Feature />}
    </>
  )
}

export default Features
