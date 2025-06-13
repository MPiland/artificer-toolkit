import { z } from 'zod/v4'
import { useMemo, useEffect, ReactNode } from 'react'
import Dropdown from '@/components/Dropdown'
import Collapsible from '@/components/Collapsible'
import { startCase } from 'lodash'
import { Attributes, Damages } from '@/enums'
import Input from '@/components/Input'
import { Grid, Divider } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { type SystemAttribute } from '@/types'
import { withFieldGroup } from '../utils/factory'
import { useStore } from '@tanstack/react-form'
import { UpcastInputSchema, UpcastLevelInputSchema } from '@/schemas'

const defaultValues: z.input<typeof UpcastInputSchema> = UpcastInputSchema.parse({})

const Upcast = withFieldGroup({
  defaultValues,
  props: {
    upcastOptions: [] as SystemAttribute[],
  },
  render: function Render({ group, upcastOptions }) {
    const { attributes: upcastAttributes, levels } = useStore(group.store, (state) => ({
      attributes: state.values.attributes,
      levels: state.values.levels,
    }))
    const { setFieldValue, AppField, Subscribe } = group
    const { attributes, spells, rules, abilities } = useSystemData()

    // Add/remove Upcast table
    useEffect(() => {
      if (upcastAttributes?.length && !levels) {
        setFieldValue('levels[0]', UpcastLevelInputSchema.parse({}))
      }
    }, [setFieldValue, upcastAttributes?.length, levels])

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
      const headers: Array<ReactNode> = [<span key={`${index}levelSpan`}>Level</span>]
      const inputs: Array<ReactNode> = []
      if (index) {
        inputs.push(
          <Input
            name={`upcast.levels.${index}.level`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={data?.upcast?.levels?.[index]?.level}
            onChange={{ updateField }}
            key={`${index}level`}
          />
        )
        upcastTypes?.forEach((type) => {
          if (data?.damage?.[type]?.attribute === Attributes.SET_AMOUNT) {
            headers.push(`${startCase(type)} Dmg. Value`)
            inputs.push(
              <Input
                name={`upcast.levels.${index}.damage.${type}.setAmount`}
                validation='num'
                errorMsg='Must contain only numbers'
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.setAmount}
                onChange={{ updateField }}
                key={`${index}damageSetAmount`}
              />
            )
          } else if (
            data?.damage?.[type]?.attribute === Attributes.ABILITY ||
            data?.damage?.[type]?.attribute === Attributes.SPELLCASTING_ABILITY ||
            data?.damage?.[type]?.attribute === Attributes.PROFICIENCY
          ) {
            headers.push(
              <span key={`${index}damage${type}MinAmountSpan`}> {startCase(type)} Dmg. Min. Value</span>,
              <span key={`${index}damage${type}MaxAmountSpan`}>{startCase(type)} Dmg. Max Value</span>,
              <span key={`${index}damage${type}MultiplierSpan`}>{startCase(type)} Dmg. Multiplier</span>
            )
            if (data?.damage?.[type]?.attribute === Attributes.ABILITY) {
              headers.push(<span key={`${index}damage${type}AbilitySpan`}>{startCase(type)} Dmg. Ability</span>)
              inputs.push(
                <Dropdown
                  name={`upcast.levels.${index}.damage.${type}.ability`}
                  value={data?.upcast?.levels?.[index]?.damage?.[type]?.ability}
                  options={attributes.filter(
                    (attribute) => attribute.damage?.length && attribute.damage.includes(Damages.POOL)
                  )}
                  required={true}
                  errorMsg='Please select an ability.'
                  key={`${index}damage${type}Ability`}
                  onChange={{ updateField, removeField }}
                />
              )
            }
            inputs.push(
              <Input
                name={`upcast.levels.${index}.damage.${type}.minAmount`}
                validation='num'
                errorMsg='Must contain only numbers'
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.minAmount}
                key={`${index}damage${type}MinAmount`}
                onChange={{ updateField }}
              />,
              <Input
                name={`upcast.levels.${index}.damage.${type}.maxAmount`}
                validation='num'
                errorMsg='Must contain only numbers'
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.maxAmount}
                key={`${index}damage${type}MaxAmount`}
                onChange={{ updateField }}
              />,
              <Input
                name={`upcast.levels.${index}.damage.${type}.multiplier`}
                validation='num'
                errorMsg='Must contain only numbers'
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.multiplier}
                key={`${index}damage${type}Multiplier`}
                onChange={{ updateField }}
              />
            )
          } else if (data?.damage?.[type]?.attribute === Attributes.DAMAGE_POOL) {
            headers.push(
              <span key={`${index}damage${type}PoolOptionSpan`}>`${startCase(type)} Dmg. Pool Options`</span>
            )
            inputs.push(
              <Dropdown
                name={`upcast.levels.${index}.damage.${type}.pool.option`}
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.option}
                options={attributes.filter(
                  (attribute) => attribute.damage?.length && attribute.damage.includes(Damages.POOL)
                )}
                required={true}
                errorMsg='Please select an ability.'
                key={`${index}damage${type}PoolOption`}
                onChange={{ updateField, removeField }}
              />
            )
            if (
              data?.damage?.[type]?.pool?.attribute === Attributes.LEVEL ||
              data.damage?.[type]?.pool?.attribute === Attributes.ABILITY ||
              data?.damage?.[type]?.pool?.attribute === Attributes.SPELLCASTING_ABILITY ||
              data?.damage?.[type]?.pool?.attribute === Attributes.PROFICIENCY
            ) {
              if (
                data.damage?.[type]?.pool?.attribute === Attributes.ABILITY ||
                data?.damage?.[type]?.pool?.attribute === Attributes.SPELLCASTING_ABILITY
              ) {
                if (data.damage?.[type]?.pool?.attribute === Attributes.ABILITY) {
                  headers.push(
                    <span key={`${index}damage${type}PoolAbilitySpan`}>`${startCase(type)} Dmg. Ability`</span>
                  )
                  inputs.push(
                    <Dropdown
                      name={`upcast.levels.${index}.damage.${type}.pool.ability`}
                      value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.ability}
                      options={abilities}
                      required={true}
                      errorMsg='Please select an ability.'
                      key={`${index}damage${type}PoolAbility`}
                      onChange={{ updateField, removeField }}
                    />
                  )
                }
                headers.push(
                  <span key={`${index}damage${type}PoolMinAmountSpan`}>`${startCase(type)} Dmg. Min Value`</span>
                )
                inputs.push(
                  <Input
                    name={`upcast.levels.${index}.damage.${type}.pool.minAmount`}
                    validation='num'
                    errorMsg='Must contain only numbers'
                    value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.minAmount}
                    key={`${index}damage${type}PoolMinAmount`}
                    onChange={{ updateField }}
                  />
                )
              }
              headers.push(
                <span key={`${index}damage${type}PoolMaxAmountSpan`}>{startCase(type)} Dmg. Max Value`</span>,
                <span key={`${index}damage${type}PoolMultiplierSpan`}>{startCase(type)} Dmg. Multiplier`</span>
              )
              inputs.push(
                <Input
                  name={`upcast.levels.${index}.damage.${type}.pool.maxAmount`}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.maxAmount}
                  key={`${index}damage${type}PoolMaxAmount`}
                  onChange={{ updateField }}
                />,
                <Input
                  name={`upcast.levels.${index}.damage.${type}.pool.multiplier`}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.multiplier}
                  key={`${index}damage${type}PoolMultiplier`}
                  onChange={{ updateField }}
                />
              )
            }
            if (data?.damage?.[type]?.pool?.attribute === Attributes.SET_AMOUNT) {
              headers.push(
                <span key={`${index}damage${type}PoolSetAmountSpan`}>{startCase(type)} Dmg. Pool Total</span>
              )
              inputs.push(
                <Input
                  name={`upcast.levels.${index}.damage.${type}.pool.setAmount`}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  value={data?.upcast?.levels?.[index]?.damage?.[type]?.pool?.setAmount}
                  key={`${index}damage${type}PoolSetAmount`}
                  onChange={{ updateField }}
                />
              )
            }
          } else {
            headers.push(<span key={`${index}damage${type}DieCountSpan`}>{startCase(type)} Dmg. Dice Config</span>)
            inputs.push(
              <Input
                name={`upcast.levels.${index}.damage.${type}.dieConfig`}
                validation='num'
                errorMsg='Must contain only numbers'
                value={data?.upcast?.levels?.[index]?.damage?.[type]?.dieConfig}
                key={`${index}damage${type}DieValue`}
                onChange={{ updateField }}
              />
            )
          }
        })
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.DURATION) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}durationIdSpan`}>Duration</span>,
            <span key={`${index}durationAmountSpan`}>Duration Increment</span>
          )
          inputs.push(
            <Dropdown
              name={`upcast.levels.${index}.duration.id`}
              value={data?.upcast?.levels?.[index]?.duration?.id}
              options={spells.durations}
              required={true}
              errorMsg='Please select a duration.'
              key={`${index}durationId`}
              onChange={{ updateField, removeField }}
            />,
            <Input
              name={`upcast.levels.${index}.duration.amount`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={data?.upcast?.levels?.[index]?.duration?.amount}
              key={`${index}durationAmount`}
              onChange={{ updateField }}
            />
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.RANGE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}rangeSpan`}>Range</span>,
            <span key={`${index}rangeMinRangeSpan`}>Min. Range</span>,
            <span key={`${index}rangeMaxRangeSpan`}>Max Range</span>,
            <span key={`${index}rangeUnitSpan`}>UoM</span>
          )
          inputs.push(
            <Dropdown
              name={`upcast.levels.${index}.range.id`}
              value={data?.upcast?.levels?.[index]?.range?.id}
              options={spells.ranges}
              required={true}
              errorMsg='Please select a range.'
              key={`${index}rangeId`}
              onChange={{ updateField, removeField }}
            />,
            <Input
              name={`upcast.levels.${index}.range.minRange`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={data?.upcast?.levels?.[index]?.range?.minRange}
              key={`${index}rangeMinRange`}
              onChange={{ updateField }}
            />,
            <Input
              name={`upcast.levels.${index}.range.maxRange`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={data?.upcast?.levels?.[index]?.range?.maxRange}
              key={`${index}rangeMaxRange`}
              onChange={{ updateField }}
            />,
            <Dropdown
              name={`upcast.levels.${index}.range.unit`}
              value={data?.upcast?.levels?.[index]?.range?.unit}
              options={rules.measurements.imperial.length}
              required={true}
              errorMsg='Please select a range.'
              key={`${index}rangeUnit`}
              onChange={{ updateField, removeField }}
            />
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.SHAPE) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(
            <span key={`${index}shapeIdSpan`}>Shape</span>,
            <span key={`${index}shapeSizeSpan`}>Shape Size</span>,
            <span key={`${index}shapeUnitSpan`}>UoM</span>
          )
          inputs.push(
            <Dropdown
              name={`upcast.levels.${index}.shape.id`}
              value={data?.upcast?.levels?.[index]?.shape?.id}
              options={spells.shapes}
              required={true}
              errorMsg='Please select a shape.'
              key={`${index}shapeId`}
              onChange={{ updateField, removeField }}
            />,
            <Input
              name={`upcast.levels.${index}.shape.size`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={data?.upcast?.levels?.[index]?.shape?.size}
              key={`${index}shapeSize`}
              onChange={{ updateField }}
            />,
            <Dropdown
              name={`upcast.levels.${index}.shape.unit`}
              value={data?.upcast?.levels?.[index]?.shape?.unit}
              options={rules.measurements.imperial.length}
              required={true}
              errorMsg='Please select a shape.'
              key={`${index}shapeUnit`}
              onChange={{ updateField, removeField }}
            />
          )
        }
        if (
          upcastAttributes?.some((attribute) => attribute === Attributes.TARGETS) ||
          upcastAttributes?.some((attribute) => attribute === 'all')
        ) {
          headers.push(<span key={`${index}targetsSpan`}>Targets</span>)
          inputs.push(
            <Input
              name={`upcast.levels.${index}.targets`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={data?.upcast?.levels?.[index]?.targets}
              required={true}
              key={`${index}targets`}
              onChange={{ updateField }}
            />
          )
        }
      }
      return { inputs, headers }
    }

    return (
      <>
        <Divider label='Upcast Options' />
        <Grid.Col span={2}>
          <Dropdown
            name='upcast.attributes'
            label='Upcast Attribute'
            value={upcastAttributes}
            options={upcastOptions}
            multiSelect={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
        {upcastAttributes?.length && (
          <Grid.Col>
            <Collapsible defaultOpen={data.id == null}>
              <Collapsible.Trigger title='Upcast Table' />
              <Collapsible.Content>
                <Grid>
                  {upcastFields().headers.map((header, index) => (
                    <Grid.Col key={index}>{header}</Grid.Col>
                  ))}
                  {data.upcast?.levels?.map((_, index) => (
                    <Grid.Col key={index}>
                      <Grid key={index}>
                        {upcastFields(index).inputs.map((input, fIndex) => (
                          <Grid.Col key={fIndex}>{input}</Grid.Col>
                        ))}
                      </Grid>
                    </Grid.Col>
                  ))}
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
