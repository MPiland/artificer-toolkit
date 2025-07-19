import Collapsible from '@/components/Collapse'
import Accordion from '@/components/Accordion'
import parse from 'html-react-parser'
import type { AncestryOption } from '@/types'
import { Grid, Button } from '@mantine/core'
import { description, useAppForm } from '@/components/Form'
import { FeatureInputSchema, AncestryOptionInputSchema } from '@/schemas'
import { useAncestryOptionStore, useFeatureStore } from '@/store'
import { useStore } from '@tanstack/react-form'
import { v4 as uuidv4 } from 'uuid'
import { sprinkles } from '@/css/sprinkles.css'
import { useFeatureData, useFieldUpdates } from '@/hooks'

const AncestryOption = () => {
  const ancestryStore = useAncestryOptionStore()

  const form = useAppForm({
    defaultValues: AncestryOptionInputSchema.parse(ancestryStore.current),
  })

  const { AppField, Subscribe } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'ancestryOption' })

  const featureStore = useFeatureStore()
  const {
    features: { findFeature },
  } = useFeatureData()
  const { features } = useStore(form.store, (state) => ({
    features: state.values.features,
  }))

  // Add feature
  const handleAddFeature = () => {
    const newFeature = FeatureInputSchema.parse({
      id: uuidv4(),
      ancestryId: ancestryStore.current?.id,
    })
    featureStore.setCurrent(newFeature)
    featureStore.setStep('features')
  }

  // Edit feature
  const handleEditFeature = (i: number) => {
    if (features?.[i]) {
      const featureInputObj = FeatureInputSchema.parse(features?.[i])
      featureStore.setCurrent(featureInputObj)
      featureStore.setStep('features')
    }
  }

  return (
    <>
      <Subscribe selector={(state) => state.values.label}>
        {(label) => (
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{label}</h2>
          </Grid.Col>
        )}
      </Subscribe>
      <AppField
        name='label'
        validators={fieldValidators({
          onBlur: 'Enter an ancestry option name',
        })}
      >
        {({ TextField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <TextField label='Ancestry Option Name' required={true} />
          </Grid.Col>
        )}
      </AppField>
      <Grid.Col>
        <Collapsible props={{ trigger: { title: 'Ancestry Option Description' } }}>
          <AppField name='desc' listeners={fieldListeners}>
            {({ RichTextField }) => <RichTextField />}
          </AppField>
        </Collapsible>
      </Grid.Col>
      <Grid.Col>
        <Button variant='outline' onClick={handleAddFeature}>
          Add Feature
        </Button>
      </Grid.Col>
      <AppField name='features' mode='array'>
        {(features) =>
          features.state.value?.length && (
            <Grid.Col>
              <Accordion dataArray={features.state.value} onChange={(dataArray) => features.handleChange(dataArray as string[])}>
                {features.state.value?.map((f, i) => {
                  const feature = findFeature(f)
                  if (feature) {
                    return (
                      <Accordion.Item key={`${i}-ancestry-option-feature`} itemId={String(i)} value={feature.id}>
                        <Accordion.Trigger
                          removeFn={() => {
                            features.removeValue(i)
                            ancestryStore.removeField({ path: `features.${i}` })
                          }}
                          editFn={() => handleEditFeature(i)}
                        >
                          {feature.label != null && feature.label !== '' ? feature.label : `Feature ${i + 1}`}
                        </Accordion.Trigger>
                        {feature.desc && (
                          <Accordion.Content>
                            <div className={description}>
                              <div>{feature?.desc && parse(feature.desc)}</div>
                            </div>
                          </Accordion.Content>
                        )}
                      </Accordion.Item>
                    )
                  }
                })}
              </Accordion>
            </Grid.Col>
          )
        }
      </AppField>
    </>
  )
}

export default AncestryOption
