import { useMemo, useEffect, ReactNode } from 'react'
import Collapsible from '@/components/Collapsible'
import { startCase } from 'lodash'
import { Attributes, Damages } from '@/enums'
import { Grid, Divider } from '@mantine/core'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { type SystemAttribute, type UpcastInput } from '@/types'
import { withFieldGroup } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { UpcastLevelInputSchema } from '@/schemas'
import { useFormStore } from '@/store'

const Upcast = withFieldGroup({
  defaultValues: {} as UpcastInput,
  props: {
    upcastOptions: [] as SystemAttribute[],
    damageAttributes: [] as string[],
  },
  render: function Render({ group, upcastOptions, damageAttributes }) {
    const formStore = useFormStore()

    const { setFieldValue, AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', path: 'upcast' })

    const { attributes: upcastAttributes, levels } = useStore(group.store, (state) => ({
      attributes: state.values.attributes,
      levels: state.values.levels,
    }))

    const { attributes, spells, rules, abilities } = useSystemData()

    // Add/remove Upcast table
    useEffect(() => {
      if (upcastAttributes?.length && !levels) {
        const upcastObject = UpcastLevelInputSchema.parse({})
        setFieldValue('levels[0]', upcastObject)
        formStore.updateField({ path: 'upcast.levels[0]', value: upcastObject })
      }
    }, [setFieldValue, upcastAttributes?.length, levels, formStore])

    // Set upcast types based on user selection
    const upcastTypes = useMemo(() => {
      if (upcastAttributes?.length) {
        let types: ('primary' | 'secondary' | 'bonus')[] = []
        // Handle primary
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.PRIMARY_DAMAGE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          if (!types.includes('primary')) {
            types.push('primary')
          }
        } else if (types.includes('primary')) {
          types = types.filter((type) => type !== 'primary')
        }

        // Handle secondary
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.SECONDARY_DAMAGE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          if (!types.includes('secondary')) {
            types.push('secondary')
          }
        } else if (types.includes('secondary')) {
          types = types.filter((type) => type !== 'secondary')
        }

        // Handle bonus damage
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.BONUS_DAMAGE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          if (!types.includes('bonus')) {
            types.push('bonus')
          }
        } else if (types.includes('bonus')) {
          types = types.filter((type) => type !== 'bonus')
        }

        return types
      }
    }, [upcastAttributes])

    // Spell Upcast table data
    const upcastFields = (index?: number) => {
      const headers: Array<ReactNode> = [<span key={`${index}-level-span`}>Level</span>]
      const inputs: Array<ReactNode> = []
      if (index) {
        inputs.push(
          <AppField
            name={`levels[${index}].level`}
            key={`${index}-level-input`}
            validators={fieldValidators({
              onChange: { type: 'integer', name: 'Spell level', min: 0 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField />}
          </AppField>
        )
        upcastTypes?.forEach((type) => {
          if (damageAttributes.includes(Attributes.SET_AMOUNT)) {
            headers.push(<span key={`${index}-${type}-setAmount-header`}>`${startCase(type)} Dmg. Value`</span>)
            inputs.push(
              <AppField
                name={`levels[${index}].damage.${type}.setAmount`}
                key={`${index}-${type}-setAmount-input`}
                validators={fieldValidators({
                  onChange: { type: 'integer', name: 'Set amount', min: 1 },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>
            )
          } else if (
            damageAttributes.includes(Attributes.ABILITY) ||
            damageAttributes.includes(Attributes.SPELLCASTING_ABILITY) ||
            damageAttributes.includes(Attributes.PROFICIENCY)
          ) {
            headers.push(
              <span key={`${index}-${type}-minAmount-header`}> {startCase(type)} Dmg. Min. Value</span>,
              <span key={`${index}-${type}-maxAmount-header`}>{startCase(type)} Dmg. Max Value</span>,
              <span key={`${index}-${type}-multiplier-header`}>{startCase(type)} Dmg. Multiplier</span>
            )
            if (damageAttributes.includes(Attributes.ABILITY)) {
              headers.push(<span key={`${index}-${type}-ability-header`}>{startCase(type)} Dmg. Ability</span>)
              inputs.push(
                <AppField
                  name={`levels[${index}].damage.${type}.ability`}
                  key={`${index}-${type}-ability-input`}
                  validators={fieldValidators({
                    onBlur: 'Please select an ability',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => <DropdownField options={abilities} required={true} />}
                </AppField>
              )
            }
            inputs.push(
              <AppField
                name={`levels[${index}].damage.${type}.minAmount`}
                key={`${index}-${type}-minAmount-input`}
                validators={fieldValidators({
                  onChange: { type: 'integer', name: 'Min amount', min: 1 },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>,
              <AppField
                name={`levels[${index}].damage.${type}.maxAmount`}
                key={`${index}-${type}-maxAmount-input`}
                validators={fieldValidators({
                  onChange: { type: 'integer', name: 'Max amount', min: 1 },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>,
              <AppField
                name={`levels[${index}].damage.${type}.multiplier`}
                key={`${index}-${type}-multiplier-input`}
                validators={fieldValidators({
                  onChange: { type: 'integer', name: 'Multiplier', min: 1 },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>
            )
          } else if (damageAttributes.includes(Attributes.DAMAGE_POOL)) {
            headers.push(
              <span key={`${index}-${type}-pool-option-header`}>`${startCase(type)} Dmg. Pool Options`</span>
            )
            inputs.push(
              <AppField
                name={`levels[${index}].damage.${type}.pool.option`}
                key={`${index}-${type}-pool-option-input`}
                validators={fieldValidators({
                  onBlur: 'Please select an option',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <DropdownField
                    options={attributes.filter(
                      (attribute) => attribute.damage?.length && attribute.damage.includes(Damages.POOL)
                    )}
                    required={true}
                  />
                )}
              </AppField>
            )
            if (
              damageAttributes.includes(Attributes.LEVEL) ||
              damageAttributes.includes(Attributes.ABILITY) ||
              damageAttributes.includes(Attributes.SPELLCASTING_ABILITY) ||
              damageAttributes.includes(Attributes.PROFICIENCY)
            ) {
              if (
                damageAttributes.includes(Attributes.ABILITY) ||
                damageAttributes.includes(Attributes.SPELLCASTING_ABILITY)
              ) {
                if (damageAttributes.includes(Attributes.ABILITY)) {
                  headers.push(
                    <span key={`${index}-${type}-pool-ability-header`}>`${startCase(type)} Dmg. Ability`</span>
                  )
                  inputs.push(
                    <AppField
                      name={`levels[${index}].damage.${type}.pool.ability`}
                      key={`${index}-${type}-pool-ability-input`}
                      validators={fieldValidators({
                        onBlur: 'Please select an ability',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => <DropdownField options={abilities} required={true} />}
                    </AppField>
                  )
                }
                headers.push(
                  <span key={`${index}-${type}-pool-minAmount-header`}>`${startCase(type)} Dmg. Min Value`</span>
                )
                inputs.push(
                  <AppField
                    name={`levels[${index}].damage.${type}.pool.minAmount`}
                    key={`${index}-${type}-pool-minAmount-input`}
                    validators={fieldValidators({
                      onChange: { type: 'integer', name: 'Min amount', min: 1 },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => <TextField />}
                  </AppField>
                )
              }
              headers.push(
                <span key={`${index}-${type}-pool-maxAmount-header`}>{startCase(type)} Dmg. Max Value`</span>,
                <span key={`${index}-${type}-pool-multiplier-header`}>{startCase(type)} Dmg. Multiplier`</span>
              )
              inputs.push(
                <AppField
                  name={`levels[${index}].damage.${type}.pool.maxAmount`}
                  key={`${index}-${type}-pool-maxAmount-input`}
                  validators={fieldValidators({
                    onChange: { type: 'integer', name: 'Max amount', min: 1 },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField />}
                </AppField>,
                <AppField
                  name={`levels[${index}].damage.${type}.pool.multiplier`}
                  key={`${index}-${type}-pool-multiplier-input`}
                  validators={fieldValidators({
                    onChange: { type: 'integer', name: 'Multiplier amount', min: 1 },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField />}
                </AppField>
              )
            }
            if (damageAttributes.includes(Attributes.SET_AMOUNT)) {
              headers.push(
                <span key={`${index}-${type}-pool-setAmount-header`}>{startCase(type)} Dmg. Pool Total</span>
              )
              inputs.push(
                <AppField
                  name={`levels[${index}].damage.${type}.pool.setAmount`}
                  key={`${index}-${type}-pool-setAmount-input`}
                  validators={fieldValidators({
                    onChange: { type: 'integer', name: 'Set amount', min: 1 },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField />}
                </AppField>
              )
            }
          } else {
            headers.push(
              <span key={`${index}-${type}-dieConfig-input-header`}>{startCase(type)} Dmg. Dice Config</span>
            )
            inputs.push(
              <AppField
                name={`levels[${index}].damage.${type}.dieConfig`}
                key={`${index}-${type}-dieConfig-input`}
                validators={fieldValidators({
                  onChange: { type: 'die', name: 'Die config' },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>
            )
          }
        })
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.DURATION) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}-duration-id-header`}>Duration</span>,
            <span key={`${index}-duration-amount-header`}>Duration Increment</span>
          )
          inputs.push(
            <AppField
              name={`levels[${index}].duration.id`}
              key={`${index}-duration-id-input`}
              validators={fieldValidators({
                onBlur: 'Please select a duration',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField required={true} options={spells.durations} />}
            </AppField>,
            <AppField
              name={`levels[${index}].duration.amount`}
              key={`${index}-duration-amount-input`}
              validators={fieldValidators({
                onChange: { type: 'integer', name: 'Duration amount', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.RANGE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}-range-id-header`}>Range</span>,
            <span key={`${index}-range-minAmount-header`}>Min. Range</span>,
            <span key={`${index}-range-maxAmount-header`}>Max Range</span>,
            <span key={`${index}-range-UoM-header`}>UoM</span>
          )
          inputs.push(
            <AppField
              name={`levels[${index}].range.id`}
              key={`${index}-range-id-input`}
              validators={fieldValidators({
                onBlur: 'Please select a range',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField required={true} options={spells.ranges} />}
            </AppField>,
            <AppField
              name={`levels[${index}].range.minRange`}
              key={`${index}-range-minRange-input`}
              validators={fieldValidators({
                onChange: { type: 'number', name: 'Min range amount', min: 0 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>,
            <AppField
              name={`levels[${index}].range.maxRange`}
              key={`${index}-range-maxRange-input`}
              validators={fieldValidators({
                onChange: { type: 'number', name: 'Max range amount', min: 0 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>,
            <AppField
              name={`levels[${index}].range.unit`}
              key={`${index}-range-UoM-input`}
              validators={fieldValidators({
                onBlur: 'Please select a range UoM',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField required={true} options={rules.measurements.imperial.length} />}
            </AppField>
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.SHAPE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}-shape-id-header`}>Shape</span>,
            <span key={`${index}-shape-size-header`}>Shape Size</span>,
            <span key={`${index}-shape-UoM-header`}>UoM</span>
          )
          inputs.push(
            <AppField
              name={`levels[${index}].shape.id`}
              key={`${index}-shape-id-input`}
              validators={fieldValidators({
                onBlur: 'Please select a shape',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField required={true} options={spells.shapes} />}
            </AppField>,
            <AppField
              name={`levels[${index}].shape.size`}
              key={`${index}-shape-size-input`}
              validators={fieldValidators({
                onChange: { type: 'number', name: 'Shape size amount', min: 0 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>,
            <AppField
              name={`levels[${index}].shape.unit`}
              key={`${index}-shape-UoM-input`}
              validators={fieldValidators({
                onBlur: 'Please select a shape UoM',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField required={true} options={rules.measurements.imperial.length} />}
            </AppField>
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.TARGETS) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(<span key={`${index}-targets-header`}>Targets</span>)
          inputs.push(
            <AppField
              name={`levels[${index}].targets`}
              key={`${index}-targets-input`}
              validators={fieldValidators({
                onChange: { type: 'number', name: 'Target amount', min: 1 },
                onBlur: 'Please enter a target amount',
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField required={true} />}
            </AppField>
          )
        }
      }
      return { inputs, headers }
    }

    return (
      <>
        <Divider label='Upcast Options' />
        <AppField name='attributes'>
          {({ DropdownField }) => (
            <Grid.Col span={2}>
              <DropdownField label='Upcast Attributes' options={upcastOptions} multiselect={true} />
            </Grid.Col>
          )}
        </AppField>
        {upcastAttributes?.length && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title='Upcast Table' />
              <Collapsible.Content>
                <Grid>
                  {upcastFields().headers.map((header, i) => (
                    <Grid.Col key={i}>{header}</Grid.Col>
                  ))}
                  <AppField name='levels' mode='array'>
                    {(field) =>
                      field.state.value?.map((_, i) => (
                        <Grid.Col key={i}>
                          <Grid>
                            {upcastFields(i).inputs.map((input, fI) => (
                              <Grid.Col key={fI}>{input}</Grid.Col>
                            ))}
                          </Grid>
                        </Grid.Col>
                      ))
                    }
                  </AppField>
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
      </>
    )
  },
})

export default Upcast
