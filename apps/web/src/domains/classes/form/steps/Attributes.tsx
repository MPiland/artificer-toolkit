import { useEffect, Fragment, useMemo, type ReactNode } from 'react'
import { sprinkles } from '@css/sprinkles.css'
import Collapsible from '@components/Collapse'
import { Categories, Classes } from '@enums'
import { useEnumChecks, useFieldUpdates, useFormField, useSystemData } from '@hooks'
import { TbPlus, TbX } from 'react-icons/tb'
import { Grid, Group, Button } from '@mantine/core'
import { row_button, LevelAttributes, Spellcasting, Resource, Multiclass } from '@components/Form'
import { SubtypeInputSchema } from '@artificer-toolkit/shared/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import type { ClassInput } from '@types'

const AttributesStep = () => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { formAttributes, spellcasting, levelAttributes, subtypes, resource, category, updateField }
    = useOptimizedSelector(store, (state) => ({
      formAttributes: state.current?.attributes,
      spellcasting: state.current?.spellcasting,
      levelAttributes: state.current?.levelAttributes,
      subtypes: state.current?.subtypes,
      resource: state.current?.resource,
      category: state.current?.category,
      updateField: state.updateField
    }))

  const { fieldValidators, fieldListeners } = useFieldUpdates()

  const { attributes } = useSystemData()

  const { getAttributes, getResourceMethods } = useEnumChecks()

  const { isSpellcaster, canUpcast, hasSubtypes, hasResourcePoints, limitKnownSpells } = getAttributes({
    attributes: formAttributes || undefined
  })

  const { resourceSetPerLevel } = getResourceMethods({ method: resource?.method || undefined })

  // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
  useEffect(() => {
    const cleanup = () => {
      return [
        {
          condition: !isSpellcaster && spellcasting != null,
          cleanup: () => {
            levelAttributes?.map((_, index) => {
              updateField({ path: `levelAttributes[${index}].spellSlots`, value: undefined })
            })
          }
        },
        {
          condition: (category !== Categories.SUBCLASS || !hasSubtypes) && subtypes?.length,
          cleanup: () => {
            updateField({ path: 'subtypes', value: [] })
          }
        },
        {
          condition: !hasResourcePoints && resource != null,
          cleanup: () => {
            updateField({ path: 'resource', value: undefined })
          }
        }
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
    canUpcast,
    isSpellcaster,
    hasSubtypes,
    updateField,
    hasResourcePoints,
    resource
  ])

  // Add Subtypes to Class as necessary
  useEffect(() => {
    if (category !== Categories.SUBCLASS && hasSubtypes && !subtypes?.length) {
      const subtypeArray = [SubtypeInputSchema.parse({ id: uuidv4() })]
      updateField({ path: 'subtypes', value: subtypeArray })
    }
  }, [
    category, hasSubtypes, subtypes, updateField
  ])

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
                    (attribute) => attribute.classes?.length
                      && (attribute.classes.includes(Classes.BASE)
                        || (category === Categories.SUBCLASS && attribute.classes.includes(Classes.SUBCLASS))
                        || attribute.classes.includes(Classes.ALL))
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
          <Multiclass />
        </Grid.Col>
      )}
      {isSpellcaster && <Spellcasting />}
      {(isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: 'Level Attributes'
              }
            }}
          >
            <Grid>
              <Grid.Col>
                <Grid>
                  <Grid.Col>Level</Grid.Col>
                  {hasResourcePoints && (
                    <Grid.Col>
                      {resource?.label ?? 'Resource'}
                      {' '}
                      Points
                    </Grid.Col>
                  )}
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
                {(field) => field.state.value?.map((_, i) => <LevelAttributes key={`levelAttributes-${i}`} index={i} />)}
              </AppField>
            </Grid>
          </Collapsible>
        </Grid.Col>
      )}
      {hasResourcePoints && <Resource />}
      {hasSubtypes && (
        <AppField name='subtypes' mode='array'>
          {(field) => field.state.value?.length && (
            <Collapsible
              props={{
                trigger: {
                  title: 'Subtypes'
                }
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
                              label: ''
                            })
                            field.pushValue(inputObject)
                            updateField({
                              path: `subtypes[${field.state.value?.length}]`,
                              value: inputObject
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
                            updateField({ path: `subtypes[${i}]`, value: undefined })
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
          )}
        </AppField>
      )}
    </Grid>
  )
}

export default AttributesStep
