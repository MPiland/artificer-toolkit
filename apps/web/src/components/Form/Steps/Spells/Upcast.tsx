import { useMemo, useEffect, ReactNode } from 'react'
import Collapsible from '~components/Collapse'
import { startCase } from 'lodash-es'
import { Attributes, Damages } from '~enums'
import { Grid, Divider } from '@mantine/core'
import { useFieldUpdates, useFormField, useSystemData } from '~hooks'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { SpellInput } from '~types'
import { getUpcastOptions } from '~components/Form'
import { UpcastLevelInputSchema } from '~schemas'

const Upcast = () => {
  const store = useTypedFormStore<SpellInput>()

  const { AppField } = useFormField({ store })
  const { updateField, formAttributes, damageAttributes, duration, range, shape, upcastAttributes, upcastLevels } =
    useOptimizedSelector(store, (state) => ({
      updateField: state.updateField,
      formAttributes: [
        ...(state.current?.attributes || []),
        ...(state.current?.damage?.attributes || []),
        ...(state.current?.saveAbility?.attributes || []),
      ],
      damageAttributes: [
        state.current?.damage?.primary?.attribute || '',
        state.current?.damage?.secondary?.attribute || '',
        state.current?.damage?.bonus?.attribute || '',
        state.current?.damage?.primary?.pool?.attribute || '',
        state.current?.damage?.secondary?.pool?.attribute || '',
        state.current?.damage?.bonus?.pool?.attribute || '',
        ...(state.current?.damage?.attributes || []),
      ],
      duration: state.current?.duration,
      range: state.current?.range,
      shape: state.current?.shape,
      upcastAttributes: state.current?.upcast?.attributes,
      upcastLevels: state.current?.upcast?.levels,
    }))

  const { fieldListeners, fieldValidators } = useFieldUpdates({ path: 'upcast' })

  const { attributes, spells, rules, abilities } = useSystemData()

  const upcastOptions = getUpcastOptions({
    systemAttributes: attributes,
    formAttributes,
    shape: shape?.id,
    range: range?.id,
    duration: duration?.id,
  })

  // Add/remove Upcast table
  useEffect(() => {
    if (upcastAttributes?.length && !upcastLevels?.length) {
      const upcastObject = UpcastLevelInputSchema.parse({ __kind: 'UpcastLevelInput' })
      updateField({ path: 'upcast.levels[0]', value: upcastObject })
    }
  }, [upcastAttributes?.length, upcastLevels?.length, updateField])

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
          name={`upcast.levels[${index}].level`}
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
          headers.push(<span key={`setAmount-header-${index}-${type}`}>`${startCase(type)} Dmg. Value`</span>)
          inputs.push(
            <AppField
              name={`upcast.levels[${index}].damage.${type}.setAmount`}
              key={`setAmount-input-${index}-${type}`}
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
            headers.push(<span key={`ability-header-${index}-${type}`}>{startCase(type)} Dmg. Ability</span>)
            inputs.push(
              <AppField
                name={`upcast.levels[${index}].damage.${type}.ability`}
                key={`ability-input-${index}-${type}`}
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
              name={`upcast.levels[${index}].damage.${type}.minAmount`}
              key={`minAmount-input-${index}-${type}`}
              validators={fieldValidators({
                onChange: { type: 'integer', name: 'Min amount', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>,
            <AppField
              name={`upcast.levels[${index}].damage.${type}.maxAmount`}
              key={`maxAmount-input-${index}-${type}`}
              validators={fieldValidators({
                onChange: { type: 'integer', name: 'Max amount', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>,
            <AppField
              name={`upcast.levels[${index}].damage.${type}.multiplier`}
              key={`multiplier-input-${index}-${type}`}
              validators={fieldValidators({
                onChange: { type: 'integer', name: 'Multiplier', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField />}
            </AppField>
          )
        } else if (damageAttributes.includes(Attributes.DAMAGE_POOL)) {
          headers.push(<span key={`${index}-${type}-pool-option-header`}>`${startCase(type)} Dmg. Pool Options`</span>)
          inputs.push(
            <AppField
              name={`upcast.levels[${index}].damage.${type}.pool.option`}
              key={`pool-option-input-${index}-${type}`}
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
                    name={`upcast.levels[${index}].damage.${type}.pool.ability`}
                    key={`pool-ability-input-${index}-${type}`}
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
                <span key={`pool-minAmount-header-${index}-${type}`}>`${startCase(type)} Dmg. Min Value`</span>
              )
              inputs.push(
                <AppField
                  name={`upcast.levels[${index}].damage.${type}.pool.minAmount`}
                  key={`pool-minAmount-input-${index}-${type}`}
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
              <span key={`pool-maxAmount-header-${index}-${type}`}>{startCase(type)} Dmg. Max Value`</span>,
              <span key={`pool-multiplier-header-${index}-${type}`}>{startCase(type)} Dmg. Multiplier`</span>
            )
            inputs.push(
              <AppField
                name={`upcast.levels[${index}].damage.${type}.pool.maxAmount`}
                key={`pool-maxAmount-input-${index}-${type}`}
                validators={fieldValidators({
                  onChange: { type: 'integer', name: 'Max amount', min: 1 },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField />}
              </AppField>,
              <AppField
                name={`upcast.levels[${index}].damage.${type}.pool.multiplier`}
                key={`pool-multiplier-input-${index}-${type}`}
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
            headers.push(<span key={`pool-setAmount-header-${index}-${type}`}>{startCase(type)} Dmg. Pool Total</span>)
            inputs.push(
              <AppField
                name={`upcast.levels[${index}].damage.${type}.pool.setAmount`}
                key={`pool-setAmount-input-${index}-${type}`}
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
          headers.push(<span key={`dieConfig-input-header-${index}-${type}`}>{startCase(type)} Dmg. Dice Config</span>)
          inputs.push(
            <AppField
              name={`upcast.levels[${index}].damage.${type}.dieConfig`}
              key={`dieConfig-input-${index}-${type}`}
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
          <span key={`duration-id-header-${index}`}>Duration</span>,
          <span key={`duration-amount-header-${index}`}>Duration Increment</span>
        )
        inputs.push(
          <AppField
            name={`upcast.levels[${index}].duration.id`}
            key={`duration-id-input-${index}`}
            validators={fieldValidators({
              onBlur: 'Please select a duration',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => <DropdownField required={true} options={spells.durations} />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].duration.amount`}
            key={`duration-amount-input-${index}`}
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
          <span key={`range-id-header-${index}`}>Range</span>,
          <span key={`range-minAmount-header-${index}`}>Min. Range</span>,
          <span key={`range-maxAmount-header-${index}`}>Max Range</span>,
          <span key={`range-UoM-header-${index}`}>UoM</span>
        )
        inputs.push(
          <AppField
            name={`upcast.levels[${index}].range.id`}
            key={`range-id-input-${index}`}
            validators={fieldValidators({
              onBlur: 'Please select a range',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => <DropdownField required={true} options={spells.ranges} />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].range.minRange`}
            key={`range-minRange-input-${index}`}
            validators={fieldValidators({
              onChange: { type: 'number', name: 'Min range amount', min: 0 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].range.maxRange`}
            key={`range-maxRange-input-${index}`}
            validators={fieldValidators({
              onChange: { type: 'number', name: 'Max range amount', min: 0 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].range.unit`}
            key={`range-UoM-input-${index}`}
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
          <span key={`shape-id-header-${index}`}>Shape</span>,
          <span key={`shape-size-header-${index}`}>Shape Size</span>,
          <span key={`shape-UoM-header-${index}`}>UoM</span>
        )
        inputs.push(
          <AppField
            name={`upcast.levels[${index}].shape.id`}
            key={`shape-id-input-${index}`}
            validators={fieldValidators({
              onBlur: 'Please select a shape',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => <DropdownField required={true} options={spells.shapes} />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].shape.size`}
            key={`shape-size-input-${index}`}
            validators={fieldValidators({
              onChange: { type: 'number', name: 'Shape size amount', min: 0 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField />}
          </AppField>,
          <AppField
            name={`upcast.levels[${index}].shape.unit`}
            key={`shape-UoM-input-${index}`}
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
            name={`upcast.levels[${index}].targets`}
            key={`targets-input-${index}`}
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
          <Collapsible
            props={{
              trigger: {
                title: 'Upcast Table',
              },
            }}
          >
            <Grid>
              {upcastFields().headers.map((header, i) => (
                <Grid.Col key={`header-upcast-levels-${i}`}>{header}</Grid.Col>
              ))}
              <AppField name='upcast.levels' mode='array'>
                {(field) =>
                  field.state.value?.map((_, i) => (
                    <Grid.Col key={`upcast-level-${i}`}>
                      <Grid>
                        {upcastFields(i).inputs.map((input, fI) => (
                          <Grid.Col key={`upcast-level-${i}-input-${fI}`}>{input}</Grid.Col>
                        ))}
                      </Grid>
                    </Grid.Col>
                  ))
                }
              </AppField>
            </Grid>
          </Collapsible>
        </Grid.Col>
      )}
    </>
  )
}

export default Upcast
