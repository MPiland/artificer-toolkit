import Accordion from '@/components/Accordion'
import Collapsible from '@/components/Collapse'
import { sprinkles } from '@/css/sprinkles.css'
import parse from 'html-react-parser'
import { Grid, Button } from '@mantine/core'
import { AncestryInputSchema, AncestryOptionInputSchema, RaceInputSchema } from '@/schemas'
import { useAncestryOptionStore, useFeatureStore, useTypedFormStore } from '@/store'
import { AncestryOption, Feature, withForm, description } from '@/components/Form'
import { v4 as uuidv4 } from 'uuid'
import { useFeatureData, useFieldUpdates, useSystemPref } from '@/hooks'
import { z } from 'zod/v4'
import { RaceInput } from '@/types'
import { use } from 'react'
import { AuthContext } from '@/pages/auth/AuthContext'

const Ancestries = withForm({
  defaultValues: {} as z.input<typeof RaceInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const { user } = use(AuthContext)
    const [systemPref] = useSystemPref()

    const store = useTypedFormStore<RaceInput>()
    const stepIndex = store((state) => state.stepIndex)
    const updateField = store((state) => state.updateField)
    const removeField = store((state) => state.removeField)
    const ancestry = store((state) => state.current?.ancestry)
    const ancestryOptionArray = store((state) => state.current?.ancestry?.options)

    const { fieldListeners } = useFieldUpdates({ data: 'form', stepIndex })

    const featureStore = useFeatureStore()
    const ancestrySetCurrent = useAncestryOptionStore((state) => state.setCurrent)
    const ancestrySetOptionIndex = useAncestryOptionStore((state) => state.setOptionIndex)
    const ancestrySetStep = useAncestryOptionStore((state) => state.setStep)
    const ancestryStep = useAncestryOptionStore((state) => state.step)

    const {
      ancestryOptions: { findAncestryOption },
    } = useFeatureData()

    const handleAddAncestry = () => {
      const ancestryInputObj = AncestryInputSchema.parse({
        id: uuidv4(),
        label: '',
      })
      form.setFieldValue('ancestry', ancestryInputObj)
      updateField({ path: 'ancestry', value: ancestryInputObj })
    }

    const handleRemoveAncestry = () => {
      form.setFieldValue('ancestry', undefined)
      removeField({ path: 'ancestry' })
    }

    // Add feature
    const handleAddOption = () => {
      const ancestryOptionInputObj = AncestryOptionInputSchema.parse({
        id: uuidv4(),
        label: '',
        ownerId: user?.userId,
        systemId: systemPref,
        masterId: undefined,
      })
      ancestrySetCurrent(ancestryOptionInputObj)
      ancestrySetOptionIndex(ancestryOptionArray?.length || 0)
      ancestrySetStep('ancestryOption')
    }

    return (
      <>
        {ancestryStep == null ?
          <>
            {!ancestry && (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <Button variant='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
                  Add Ancestry
                </Button>
              </Grid.Col>
            )}
            {ancestry && (
              <>
                <AppField
                  name='ancestry.label'
                  validators={{
                    onBlur: ({ value }) =>
                      ancestry?.desc !== '' && ancestry?.desc != null && !value && 'Ancestry name is required',
                  }}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Ancestry Name' required={ancestry?.desc !== '' && ancestry?.desc != null} />
                    </Grid.Col>
                  )}
                </AppField>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <Button fullWidth color='red' variant='outline' onClick={handleRemoveAncestry}>
                    Remove Ancestry
                  </Button>
                </Grid.Col>
                <Grid.Col>
                  <Collapsible
                    props={{
                      trigger: {
                        title: 'Ancestry Description',
                      },
                    }}
                  >
                    <AppField name='ancestry.desc' listeners={fieldListeners}>
                      {({ RichTextField }) => <RichTextField />}
                    </AppField>
                  </Collapsible>
                </Grid.Col>
                <Grid.Col>
                  <Button variant='outline' onClick={handleAddOption}>
                    Add Option
                  </Button>
                </Grid.Col>
              </>
            )}
            <AppField name='ancestry.options' mode='array'>
              {(options) =>
                options.state.value?.length && (
                  <Grid.Col>
                    <Accordion
                      dataArray={options.state.value}
                      onChange={(dataArray) => options.handleChange(dataArray as string[])}
                    >
                      {options.state.value?.map((o, i) => {
                        const option = findAncestryOption(o)
                        if (option) {
                          return (
                            <Accordion.Item key={`${i}-ancestry-options`} itemId={String(i)} value={option?.label}>
                              <Accordion.Trigger
                                removeFn={() => {
                                  options.removeValue(i)
                                  removeField({ path: `ancestry.options.${i}` })
                                }}
                                editFn={() => {
                                  ancestrySetCurrent(AncestryOptionInputSchema.parse(options?.state.value?.[i]))
                                  ancestrySetOptionIndex(i)
                                  ancestrySetStep('ancestryOption')
                                }}
                              >
                                {option.label != null && option.label !== '' ? option.label : `Option ${i + 1}`}
                              </Accordion.Trigger>
                              {option.desc && (
                                <Accordion.Content>
                                  <div className={description}>
                                    <div>{option?.desc && parse(option.desc)}</div>
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
        : featureStore.step == null ?
          <AncestryOption />
        : <Feature />}
      </>
    )
  },
})

export default Ancestries
