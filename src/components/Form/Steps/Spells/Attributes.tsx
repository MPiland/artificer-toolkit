import { useEffect } from 'react'
import { Attributes as AttributesEnum, Durations, Ranges, Shapes, Spells, Features } from '@/enums'
import { useEnumChecks, useFieldUpdates, useSystemData } from '@/hooks'
import { Grid } from '@mantine/core'
import { Damage, Upcast, withForm } from '@/components/Form'
import { useTypedFormStore } from '@/store'
import { SpellInputSchema } from '@/schemas'
import { z } from 'zod/v4'
import { SpellInput } from 'gql/types'

const AttributesStep = withForm({
  defaultValues: {} as z.input<typeof SpellInputSchema>,
  render: function Render({ form }) {
    const store = useTypedFormStore<SpellInput>()
    const formActions = store((state) => state.current?.actions)
    const formAttributes = store((state) => [
      ...(state.current?.attributes || []),
      ...(state.current?.damage?.attributes || []),
      ...(state.current?.saveAbility?.attributes || []),
    ])
    const damage = store((state) => state.current?.damage)
    const upcast = store((state) => state.current?.upcast)
    const removeField = store((state) => state.removeField)
    const updateField = store((state) => state.updateField)
    const stepIndex = store((state) => state.stepIndex)
    const duration = store((state) => state.current?.duration)
    const range = store((state) => state.current?.range)
    const shape = store((state) => state.current?.shape)

    const { AppField, setFieldValue } = form

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', stepIndex })

    const {
      attributes,
      actions,
      rules,
      conditions,
      abilities,
      spells: { durations, shapes, ranges },
    } = useSystemData()

    const { getAttributes, getActions } = useEnumChecks()

    const { specialPrimaryAction, specialSecondaryAction } = getActions({ actions: formActions || undefined })

    const {
      doesDamage,
      hasPrerequisites,
      isSpellcaster,
      canUpcast,
      isAction,
      secondaryAction,
      requiresSave,
      primaryAbility,
      hasSubtypes,
    } = getAttributes({ attributes: formAttributes || undefined })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        return [
          {
            condition: !doesDamage && damage != null,
            cleanup: () => {
              setFieldValue('damage', undefined)
              removeField({ path: 'damage' })
            },
          },
          {
            condition: !canUpcast && upcast != null,
            cleanup: () => {
              setFieldValue('upcast', undefined)
              removeField({ path: 'upcast' })
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
      upcast,
      damage,
      setFieldValue,
      canUpcast,
      isSpellcaster,
      doesDamage,
      hasPrerequisites,
      hasSubtypes,
      removeField,
    ])

    return (
      <Grid>
        <Grid.Col>
          <Grid>
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField name='attributes' listeners={fieldListeners}>
                {({ DropdownField }) => (
                  <DropdownField
                    multiselect={true}
                    options={attributes
                      .filter((attribute) => attribute.spells?.length && attribute.spells.includes(Spells.ALL))
                      .filter((attribute) =>
                        primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                      )}
                    label='Spell Attributes'
                  />
                )}
              </AppField>
            </Grid.Col>
            {isAction && (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='actions.primary.id'
                    validators={fieldValidators({
                      onBlur: 'Select the type of action',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <DropdownField
                        label='Casting Time'
                        required={true}
                        options={actions.filter((action) => action.spells)}
                      />
                    )}
                  </AppField>
                </Grid.Col>
                {!specialPrimaryAction && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='actions.primary.amount'
                      validators={fieldValidators({
                        onChange: { type: 'number', min: 1, name: 'Casting Time' },
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => <TextField required={true} label='Casting Time' />}
                    </AppField>
                  </Grid.Col>
                )}
              </>
            )}
            {secondaryAction && (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='actions.secondary.id'
                    validators={fieldValidators({
                      onBlur: 'Select the type of action',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <DropdownField
                        label='Secondary Action'
                        required={true}
                        options={actions.filter((action) => action.spells)}
                      />
                    )}
                  </AppField>
                </Grid.Col>
                {!specialSecondaryAction && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='actions.secondary.amount'
                      validators={fieldValidators({
                        onChange: { type: 'number', min: 1, name: 'Secondary Action' },
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => <TextField label='Sec. Increment' required={true} />}
                    </AppField>
                  </Grid.Col>
                )}
              </>
            )}
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField
                name='duration.id'
                validators={fieldValidators({
                  onBlur: 'Select a duration',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => <DropdownField required={true} options={durations} label='Duration' />}
              </AppField>
            </Grid.Col>
            {duration?.id &&
              duration?.id !== Durations.INSTANTANEOUS &&
              duration?.id !== Durations.UNTIL_DISPELLED &&
              duration?.id !== Durations.SPECIAL && (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='duration.amount'
                    validators={fieldValidators({
                      onBlur: 'Please enter a duration increment',
                      onChange: { type: 'number', min: 1, name: 'Duration Increment' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => <TextField label='Duration Increment' required={true} />}
                  </AppField>
                </Grid.Col>
              )}
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField
                name='range.id'
                validators={fieldValidators({
                  onBlur: 'Select a range',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => <DropdownField required={true} options={ranges} label='Range' />}
              </AppField>
            </Grid.Col>
            {range?.id &&
              range?.id !== Ranges.TOUCH &&
              range?.id !== Ranges.SIGHT &&
              range?.id !== Ranges.UNLIMITED &&
              range?.id !== Ranges.SELF && (
                <>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='range.minRange'
                      validators={fieldValidators({
                        onBlur: 'Please enter a min range',
                        onChange: { type: 'number', min: 0, name: 'Min. Range' },
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => (
                        <TextField label='Min. Range' required={range?.id === Ranges.DISTANCE ? true : false} />
                      )}
                    </AppField>
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='range.maxRange'
                      validators={fieldValidators({
                        onBlur: 'Please enter a max range',
                        onChange: { type: 'number', min: 0, name: 'Max. Range' },
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => (
                        <TextField label='Max. Range' required={range?.id === Ranges.DISTANCE ? true : false} />
                      )}
                    </AppField>
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='range.unit'
                      validators={fieldValidators({
                        onBlur: 'Select a range unit of measurement',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <DropdownField required={true} options={rules.measurements.imperial.length} label='UoM' />
                      )}
                    </AppField>
                  </Grid.Col>
                </>
              )}
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField
                name='shape.id'
                validators={fieldValidators({
                  onBlur: 'Select a shape',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => <DropdownField required={true} options={shapes} label='Shape' />}
              </AppField>
            </Grid.Col>
            {shape?.id && shape?.id !== Shapes.NONE && shape?.id !== Shapes.WEAPON && (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='shape.size'
                    validators={fieldValidators({
                      onChange: { type: 'number', min: 0, name: 'Shape Size' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => <TextField label='Shape Size' />}
                  </AppField>
                </Grid.Col>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='shape.unit'
                    validators={fieldValidators({
                      onBlur: 'Select a shape unit of measurement',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <DropdownField required={shape?.size != null} options={shapes} label='UoM' />
                    )}
                  </AppField>
                </Grid.Col>
              </>
            )}
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField
                name='targets'
                validators={fieldValidators({
                  onChange: { type: 'number', min: 1, name: 'Target Count' },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField label='Target Count' />}
              </AppField>
            </Grid.Col>
            {formAttributes?.some((attribute) => attribute === AttributesEnum.APPLIES_CONDITION) && (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField
                  name='conditions'
                  validators={fieldValidators({
                    onBlur: 'Select a condition',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => <DropdownField required={true} options={conditions} label='Condition' />}
                </AppField>
              </Grid.Col>
            )}
            {requiresSave && (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='saveAbility.id'
                    validators={fieldValidators({
                      onBlur: 'Select a DC ability',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => <DropdownField required={true} options={abilities} label='DC Ability' />}
                  </AppField>
                </Grid.Col>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='saveAbility.attributes' listeners={fieldListeners}>
                    {({ DropdownField }) => (
                      <DropdownField
                        options={attributes.filter(
                          (attribute) => attribute.features && attribute.features.includes(Features.SAVE_ABILITY)
                        )}
                        label='DC Ability'
                      />
                    )}
                  </AppField>
                </Grid.Col>
                {formAttributes?.some((attribute) => attribute === AttributesEnum.ADD_ABILITY_MODIFIER) && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='saveAbility.abilityModifier'
                      validators={fieldValidators({
                        onBlur: 'Select a modifier ability',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <DropdownField required={true} options={abilities} label='Modifier Ability' />
                      )}
                    </AppField>
                  </Grid.Col>
                )}
              </>
            )}
          </Grid>
        </Grid.Col>
        {doesDamage && (
          <Damage
            form={form}
            fields='damage'
            __kind='SpellInput'
            properties={undefined}
            updateFn={updateField}
            removeFn={removeField}
          />
        )}
        {canUpcast && <Upcast form={form} fields='upcast' />}
      </Grid>
    )
  },
})

export default AttributesStep
