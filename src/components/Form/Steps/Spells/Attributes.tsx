import { z } from 'zod/v4'
import { useEffect } from 'react'
import Damage from '../../Substeps/Damage'
import Upcast from '../../Substeps/Upcast'
import { Attributes as AttributesEnum, Durations, Ranges, Shapes, Spells, Features } from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import { Grid } from '@mantine/core'
import { withForm } from '../../utils/factory'
import { SpellInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { getUpcastOptions } from '../../utils/utils'

const defaultValues: z.input<typeof SpellInputSchema> = SpellInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const { formActions, formAttributes, damage, upcast } = useStore(form.store, (state) => ({
      formActions: state.values.actions,
      formAttributes: state.values.attributes,
      damage: state.values.damage,
      upcast: state.values.upcast,
    }))
    const { AppField, Subscribe, setFieldValue } = form

    const {
      attributes,
      actions,
      rules,
      conditions,
      abilities,
      spells: { durations, shapes, ranges },
    } = useSystemData()

    const { getAttributes, getActions } = useEnumChecks()

    const { specialPrimaryAction, specialSecondaryAction } = getActions({ actions: formActions })

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
    } = getAttributes({ attributes: formAttributes })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        return [
          {
            condition: !doesDamage && damage != null,
            cleanup: () => setFieldValue('damage', undefined),
          },
          {
            condition: !canUpcast && upcast != null,
            cleanup: () => setFieldValue('upcast', undefined),
          },
        ]
      }

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [upcast, damage, setFieldValue, canUpcast, isSpellcaster, doesDamage, hasPrerequisites, hasSubtypes])

    return (
      <Subscribe
        selector={(state) => ({
          duration: state.values.duration,
          shape: state.values.shape,
          range: state.values.range,
          formAttributes: [
            ...(state.values.attributes ?? []),
            ...(state.values.damage?.attributes ?? []),
            ...(state.values.saveAbility?.attributes ?? []),
          ],
        })}
      >
        {({ duration, shape, range, formAttributes }) => (
          <Grid>
            <Grid.Col>
              <Grid>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='attributes'>
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
                        validators={{
                          onSubmit: ({ value }) => !value && 'Select the type of action',
                        }}
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
                          validators={{
                            onChange: z
                              .number('Casting Time must be a number')
                              .int('Casting Time must be a whole number')
                              .gte(1, 'Casting Time must be greater than 0'),
                          }}
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
                        validators={{ onSubmit: ({ value }) => !value && 'Select the type of action' }}
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
                          validators={{
                            onChange: z
                              .number('Increment must be a number')
                              .int('Increment must be a whole number')
                              .gte(1, 'Increment must be greater than 0'),
                            onSubmit: ({ value }) => !value && 'Please enter an increment',
                          }}
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
                    validators={{
                      onSubmit: ({ value }) => !value && 'Select a duration',
                    }}
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
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please enter a duration increment',
                          onChange: z
                            .number('Duration must be a number')
                            .int('Duration must be a whole number')
                            .gte(1, 'Duration must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => <TextField label='Duration Increment' required={true} />}
                      </AppField>
                    </Grid.Col>
                  )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='range.id' validators={{ onSubmit: ({ value }) => !value && 'Select a range' }}>
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
                          validators={{
                            onSubmit: ({ value }) =>
                              range?.id === Ranges.DISTANCE ? !value && 'Please enter a min range' : null,
                            onChange: z
                              .number('Min. range must be a number')
                              .gte(1, 'Min. range must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => (
                            <TextField label='Min. Range' required={range?.id === Ranges.DISTANCE ? true : false} />
                          )}
                        </AppField>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='range.maxRange'
                          validators={{
                            onSubmit: ({ value }) =>
                              range?.id === Ranges.DISTANCE ? !value && 'Please enter a max range' : null,
                            onChange: z
                              .number('Max. range must be a number')
                              .gte(1, 'Max. range must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => (
                            <TextField label='Max. Range' required={range?.id === Ranges.DISTANCE ? true : false} />
                          )}
                        </AppField>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='range.unit'
                          validators={{ onSubmit: ({ value }) => !value && 'Select a range unit of measurement' }}
                        >
                          {({ DropdownField }) => (
                            <DropdownField required={true} options={rules.measurements.imperial.length} label='UoM' />
                          )}
                        </AppField>
                      </Grid.Col>
                    </>
                  )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='shape.id' validators={{ onSubmit: ({ value }) => !value && 'Select a shape' }}>
                    {({ DropdownField }) => <DropdownField required={true} options={shapes} label='Shape' />}
                  </AppField>
                </Grid.Col>
                {shape?.id && shape?.id !== Shapes.NONE && shape?.id !== Shapes.WEAPON && (
                  <>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='shape.size'
                        validators={{
                          onChange: z.number('Shape size must be a number').gte(1, 'Shape size must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => <TextField label='Shape Size' />}
                      </AppField>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='shape.unit'
                        validators={{
                          onSubmit: ({ value }) =>
                            shape?.size != null ? !value && 'Select a shape size unit of measurement' : null,
                        }}
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
                    validators={{
                      onChange: z
                        .number('Target count must be a number')
                        .int('Target count must be a whole number')
                        .gte(1, 'Target count must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => <TextField label='Target Count' />}
                  </AppField>
                </Grid.Col>
                {formAttributes?.some((attribute) => attribute === AttributesEnum.APPLIES_CONDITION) && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='conditions'
                      validators={{ onSubmit: ({ value }) => !value && 'Select a condition' }}
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
                        validators={{ onSubmit: ({ value }) => !value && 'Select a DC ability' }}
                      >
                        {({ DropdownField }) => (
                          <DropdownField required={true} options={abilities} label='DC Ability' />
                        )}
                      </AppField>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField name='saveAbility.attributes'>
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
                          validators={{ onSubmit: ({ value }) => !value && 'Select a modifier ability' }}
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
            {doesDamage && <Damage form={form} fields='damage' __kind='SpellInput' properties={undefined} />}
            {canUpcast && (
              <Upcast
                form={form}
                fields='upcast'
                upcastOptions={getUpcastOptions({
                  systemAttributes: attributes,
                  formAttributes,
                  shape: shape?.id,
                  range: range?.id,
                  duration: duration?.id,
                })}
              />
            )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default AttributesStep
