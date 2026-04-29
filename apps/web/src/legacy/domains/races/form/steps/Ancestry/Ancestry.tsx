import Accordion from '@components/Accordion'
import Collapsible from '@components/Collapse'
import { sprinkles } from '@css/sprinkles.css'
import parse from 'html-react-parser'
import { Grid, Button } from '@mantine/core'
import { AncestryInputSchema, AncestryOptionInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { AncestryOption, description } from '@components/Form'
import { v4 as uuidv4 } from 'uuid'
import { useFieldUpdates, useSystemPref, useFormField } from '@hooks'
import { RaceInput, AncestryOptionInput } from '@types'
import { use } from 'react'
import { AuthContext } from '../../../auth/AuthProvider'

const Ancestry = () => {
  const { user } = use(AuthContext)
  const [systemPref] = useSystemPref()
  const store = useTypedFormStore<RaceInput>()
  const { AppField } = useFormField({ store })

  const { updateField, ancestryOptionIndex, setEditing, options, id } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    ancestryOptionIndex: state.meta.editing.ancestryOptionIndex,
    setEditin: setEditing,
    options: state.current?.ancestry?.options,
    id: state.current?.ancestry?.id
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const handleAddAncestry = () => {
    const ancestryInputObj = AncestryInputSchema.parse({
      __kind: 'AncestryInput',
      id: uuidv4(),
      label: '',
      ownerId: user?.userId,
      systemId: systemPref,
      masterId: undefined
    })
    updateField({ path: 'ancestry', value: ancestryInputObj })
  }

  const handleRemoveAncestry = () => {
    updateField({ path: 'ancestry', value: undefined })
  }

  // Add feature
  const handleAddOption = () => {
    const newOptionIndex = options?.length || 0
    const optionInputObj = AncestryOptionInputSchema.parse({
      __kind: 'AncestryOptionInput',
      id: uuidv4(),
      label: '',
      ownerId: user?.userId,
      systemId: systemPref,
      masterId: undefined
    })
    updateField({ path: `ancestry.options[${newOptionIndex}]`, value: optionInputObj })
    setEditing({ ancestryOptionIndex: newOptionIndex })
  }

  return (
    <>
      {ancestryOptionIndex === null
        ? (
            <>
              {!id
                ? (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <Button variant='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
                        Add Ancestry
                      </Button>
                    </Grid.Col>
                  )
                : (
                    <>
                      <AppField
                        name='ancestry.__kind'
                        validators={fieldValidators({
                          onBlur: 'Ancestry name is required'
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField label='Ancestry Name' required={true} />
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
                              title: 'Ancestry Description'
                            }
                          }}
                        >
                          <AppField name='description' listeners={fieldListeners}>
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
                {(options) => options.state.value?.length && (
                  <Grid.Col>
                    <Accordion
                      dataArray={options.state.value}
                      onChange={(dataArray) => options.handleChange(dataArray as AncestryOptionInput[])}
                    >
                      {options.state.value?.map((option, i) => {
                        if (option) {
                          return (
                            <Accordion.Item key={`ancestry-options-${i}`} itemId={String(i)} value={option?.label}>
                              <Accordion.Trigger
                                removeFn={() => {
                                  options.removeValue(i)
                                  updateField({ path: `ancestry.options.${i}`, value: undefined })
                                }}
                                editFn={() => setEditing({ ancestryOptionIndex: i })}
                              >
                                {option.label != null && option.label !== '' ? option.label : `Option ${i + 1}`}
                              </Accordion.Trigger>
                              {option.description && (
                                <Accordion.Content>
                                  <div className={description}>
                                    <div>{option?.description && parse(option.description)}</div>
                                  </div>
                                </Accordion.Content>
                              )}
                            </Accordion.Item>
                          )
                        }
                      })}
                    </Accordion>
                  </Grid.Col>
                )}
              </AppField>
            </>
          )
        : <AncestryOption />}
    </>
  )
}

export default Ancestry
