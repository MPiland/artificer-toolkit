import Collapsible from '~components/Collapse'
import Accordion from '~components/Accordion'
import parse from 'html-react-parser'
import type { AncestryOption, RaceInput, FeatureInput } from '~types'
import { Grid, Button } from '@mantine/core'
import { description, Feature } from '~components/Form'
import { FeatureInputSchema } from '~schemas'
import { v4 as uuidv4 } from 'uuid'
import { sprinkles } from '~css/sprinkles.css'
import { useFieldUpdates, useFormField } from '~hooks'
import { useOptimizedSelector, useTypedFormStore } from '~store'

const AncestryOption = () => {
  const store = useTypedFormStore<RaceInput>()

  const { AppField } = useFormField({ store })

  const { ancestryId, updateField, label, setEditing, ancestryOptionIndex, featureIndex, features } =
    useOptimizedSelector(store, (state) => ({
      ancestryId: state.current?.ancestry?.id,
      updateField: state.updateField,
      label: state.current?.ancestry?.label,
      setEditing: state.setEditing,
      ancestryOptionIndex: state.meta.editing.ancestryOptionIndex || 0,
      featureIndex: state.meta.editing.featureIndex || 0,
      features: state.current?.ancestry?.options?.[state.meta.editing.ancestryOptionIndex || 0]?.features,
    }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  // Add feature
  const handleAddFeature = () => {
    const newIndex = features?.length || 0
    const featureInputObj = FeatureInputSchema.parse({
      __kind: 'FeatureInput',
      id: uuidv4(),
      ancestryId,
      label: '',
    })
    updateField({ path: `ancestry.options[${ancestryOptionIndex}].features[${newIndex}]`, value: featureInputObj })
    setEditing({ featureIndex: newIndex })
  }

  return (
    <>
      {featureIndex === null ?
        <>
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{label}</h2>
          </Grid.Col>
          <AppField
            name={`ancestry.options[${ancestryOptionIndex}].label`}
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
                  <Accordion
                    dataArray={features.state.value}
                    onChange={(dataArray) => features.handleChange(dataArray as FeatureInput[])}
                  >
                    {features.state.value?.map((feature, i) => (
                      <Accordion.Item key={`ancestry-option-feature-${i}`} itemId={String(i)} value={feature.id}>
                        <Accordion.Trigger
                          removeFn={() => {
                            features.removeValue(i)
                            updateField({
                              path: `ancestry.options[${ancestryOptionIndex}].features.${i}`,
                              value: undefined,
                            })
                          }}
                          editFn={() => setEditing({ featureIndex: i })}
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
                    ))}
                  </Accordion>
                </Grid.Col>
              )
            }
          </AppField>
        </>
      : <Feature />}
    </>
  )
}

export default AncestryOption
