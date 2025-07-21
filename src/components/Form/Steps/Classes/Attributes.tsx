import { useEffect, Fragment, useMemo, type ReactNode } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import Collapsible from '@/components/Collapse'
import { Categories, Classes } from '@/enums'
import { useEnumChecks, useFieldUpdates, useSystemData } from '@/hooks'
import { TbPlus, TbX } from 'react-icons/tb'
import { Grid, Group, Button } from '@mantine/core'
import { row_button, LevelAttributes, Spellcasting, Resource, Multiclass, withForm } from '@/components/Form'
import { SubtypeInputSchema, ClassInputSchema } from '@/schemas'
import { z } from 'zod/v4'
import { v4 as uuidv4 } from 'uuid'
import { useTypedFormStore } from '@/store'
import type { ClassInput } from '@/types'

const AttributesStep = withForm({
  defaultValues: {} as z.input<typeof ClassInputSchema>,
  render: function Render({ form }) {
    const { AppField, setFieldValue } = form

    const store = useTypedFormStore<ClassInput>()
    const formAttributes = store((state) => state.current?.attributes)
    const spellcasting = store((state) => state.current?.spellcasting)
    const levelAttributes = store((state) => state.current?.levelAttributes)
    const subtypes = store((state) => state.current?.subtypes)
    const resource = store((state) => state.current?.resource)
    const category = store((state) => state.current?.category)
    const removeField = store((state) => state.removeField)
    const updateField = store((state) => state.updateField)

    const { fieldValidators, fieldListeners } = useFieldUpdates({ data: 'form' })

    const { attributes } = useSystemData()

    const { getAttributes, getResourceMethods } = useEnumChecks()

    const { isSpellcaster, canUpcast, hasSubtypes, hasResourcePoints, limitKnownSpells, magicName, preparesSpells } =
      getAttributes({ attributes: formAttributes || undefined })

    const { resourceSetPerLevel } = getResourceMethods({ method: resource?.method || undefined })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        return [
          {
            condition: !isSpellcaster && spellcasting != null,
            cleanup: () => {
              setFieldValue('spellcasting', undefined)
              levelAttributes?.map((_, index) => {
                setFieldValue(`levelAttributes[${index}].spellSlots`, undefined)
                removeField({ path: `levelAttributes[${index}].spellSlots` })
              })
            },
          },
          {
            condition: (category !== Categories.SUBCLASS || !hasSubtypes) && subtypes?.length,
            cleanup: () => {
              setFieldValue('subtypes', undefined)
              removeField({ path: 'subtypes' })
            },
          },
          {
            condition: !hasResourcePoints && resource != null,
            cleanup: () => {
              setFieldValue('resource', undefined)
              removeField({ path: 'resource' })
            },
          },
        ]
      }

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [
      category,
      levelAttributes,
      spellcasting,
      subtypes,
      setFieldValue,
      canUpcast,
      isSpellcaster,
      hasSubtypes,
      removeField,
      hasResourcePoints,
      resource,
    ])

    // Add Subtypes to Class as necessary
    useEffect(() => {
      if (category !== Categories.SUBCLASS && hasSubtypes && !subtypes?.length) {
        const subtypeArray = [SubtypeInputSchema.parse({ id: uuidv4() })]
        setFieldValue('subtypes', subtypeArray)
        updateField({ path: 'subtypes', value: subtypeArray })
      }
    }, [category, hasSubtypes, subtypes, setFieldValue, updateField])

    // Memoize spell slot labels
    const spellSlotLabels = useMemo(() => {
      const spellLabels: ReactNode[] = []
      if (spellcasting?.maxSpellLevel) {
        for (let i = 0; i < spellcasting.maxSpellLevel; i++) {
          spellLabels.push(
            <Grid.Col key={`spell-label-${i}`}>
              <span>{i + 1}</span>
            </Grid.Col>
          )
        }
      }
      return spellLabels
    }, [spellcasting?.maxSpellLevel])

    return (
      <Grid>
        <Grid.Col>
          <Grid>
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField name='attributes' listeners={fieldListeners}>
                {({ DropdownField }) => (
                  <DropdownField
                    multiselect={true}
                    options={attributes.filter(
                      (attribute) =>
                        attribute.classes?.length &&
                        (attribute.classes.includes(Classes.BASE) ||
                          (category === Categories.SUBCLASS && attribute.classes.includes(Classes.SUBCLASS)) ||
                          attribute.classes.includes(Classes.ALL))
                    )}
                    label='Character Attributes'
                  />
                )}
              </AppField>
            </Grid.Col>
          </Grid>
        </Grid.Col>
        {category === Categories.BASE && (
          <Grid.Col>
            <Multiclass fields='multiclass' form={form} />
          </Grid.Col>
        )}
        {isSpellcaster && (
          <Spellcasting
            fields='spellcasting'
            form={form}
            magicName={magicName ?? false}
            preparesSpells={preparesSpells ?? false}
          />
        )}
        {(isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
          <Grid.Col>
            <Collapsible
              props={{
                trigger: {
                  title: 'Level Attributes',
                },
              }}
            >
              <Grid>
                <Grid.Col>
                  <Grid>
                    <Grid.Col>Level</Grid.Col>
                    {hasResourcePoints && <Grid.Col>{resource?.label ?? 'Resource'} Points</Grid.Col>}
                    {isSpellcaster && (
                      <>
                        <Grid.Col>Cantrips Known</Grid.Col>
                        {limitKnownSpells && <Grid.Col>Spells Known</Grid.Col>}
                        {spellSlotLabels}
                      </>
                    )}
                  </Grid>
                </Grid.Col>
                <AppField name='levelAttributes' mode='array'>
                  {(field) =>
                    field.state.value?.map((_, i) => (
                      <LevelAttributes
                        key={`levelAttributes-${i}`}
                        form={form}
                        fields={`levelAttributes[${i}]`}
                        hasResourcePoints={hasResourcePoints ?? false}
                        isSpellcaster={isSpellcaster ?? false}
                        limitKnownSpells={limitKnownSpells ?? false}
                        maxSpellLevel={spellcasting?.maxSpellLevel ?? 0}
                        index={i}
                      />
                    ))
                  }
                </AppField>
              </Grid>
            </Collapsible>
          </Grid.Col>
        )}
        {hasResourcePoints && <Resource form={form} fields='resource' />}
        {hasSubtypes && (
          <AppField name='subtypes' mode='array'>
            {(field) =>
              field.state.value?.length && (
                <Collapsible
                  props={{
                    trigger: {
                      title: 'Subtypes',
                    },
                  }}
                >
                  <Grid>
                    <Grid.Col>Name</Grid.Col>
                    {field.state.value?.map((_, i) => (
                      <Fragment key={`subtypes-${i}`}>
                        <Grid.Col span={6}>
                          <AppField
                            name={`subtypes[${i}].label`}
                            validators={fieldValidators({ onBlur: 'Please enter a subtype name' })}
                            listeners={fieldListeners}
                          >
                            {({ TextField }) => <TextField label='Name' required={true} />}
                          </AppField>
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                          <Group justify='flex-start' grow>
                            <Button
                              variant='unstyled'
                              className={row_button}
                              onClick={() => {
                                const inputObject = SubtypeInputSchema.parse({
                                  id: uuidv4(),
                                  label: '',
                                })
                                field.pushValue(inputObject)
                                updateField({
                                  path: `subtypes[${field.state.value?.length}]`,
                                  value: inputObject,
                                })
                              }}
                            >
                              <TbPlus />
                            </Button>
                            <Button
                              variant='unstyled'
                              className={row_button}
                              onClick={() => {
                                field.removeValue(i)
                                removeField({ path: `subtypes[${i}]` })
                              }}
                            >
                              <TbX />
                            </Button>
                          </Group>
                        </Grid.Col>
                      </Fragment>
                    ))}
                  </Grid>
                </Collapsible>
              )
            }
          </AppField>
        )}
      </Grid>
    )
  },
})

export default AttributesStep
