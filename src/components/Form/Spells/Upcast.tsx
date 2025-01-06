import { useMemo, useEffect, ReactNode } from 'react'
import Dropdown from '../../Dropdown/Dropdown'
import Row from '../../Row/Row'
import Collapse from '../../Collapse/Collapse'
import { sprinkles } from '../../../css/sprinkles.css'
import Divider from '../../Divider/Divider'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { DamageEnum, SpellEnum, Spell } from '../../../../amplify/API'
import { Attributes } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import Input from '../../Input/Input'

const Upcast = ({
  formData,
  updateFormData,
}: {
  formData: Spell
  updateFormData: (arg: UpdateState<Spell>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  // Add/remove Upcast table
  useEffect(() => {
    if (formData.upcast?.attributes?.length > 0 && !formData.upcast?.levels) {
      updateFormData({
        type: 'add',
        path: 'upcast.levels',
      })
    }
  }, [updateFormData, formData])

  // Set upcast types based on user selection
  const upcastTypes = useMemo(() => {
    if (formData?.upcast?.attributes?.length > 0) {
      let types: ('primary' | 'secondary' | 'bonus')[] = []
      // Handle primary
      if (
        formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.primaryDamage) ||
        formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
      ) {
        if (!types.includes('primary')) {
          types.push('primary')
        }
      } else if (types.includes('primary')) {
        types = types.filter((type) => type !== 'primary')
      }

      // Handle secondary
      if (
        formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.secondaryDamage) ||
        formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
      ) {
        if (!types.includes('secondary')) {
          types.push('secondary')
        }
      } else if (types.includes('secondary')) {
        types = types.filter((type) => type !== 'secondary')
      }

      // Handle bonus damage
      if (
        formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.bonusDamage) ||
        formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
      ) {
        if (!types.includes('bonus')) {
          types.push('bonus')
        }
      } else if (types.includes('bonus')) {
        types = types.filter((type) => type !== 'bonus')
      }

      return types
    }
  }, [formData?.upcast?.attributes])

  // Set upcast options based on the upcast types
  const upcastOptions = useMemo(() => {
    const options = [
      ...system.attributes.filter((attribute) =>
        attribute.spells ? attribute?.spells.includes(SpellEnum.upcast) : attribute
      ),
    ]
    if (!formData.attributes?.some((attribute) => attribute === Attributes.doesDamage)) {
      options.filter((option) => option.id !== Attributes.primaryDamage)
    }

    if (!formData.damage?.attributes?.some((attribute) => attribute === Attributes.secondaryDamage)) {
      options.filter((option) => option.id !== Attributes.secondaryDamage)
    }

    if (!formData.damage?.attributes?.some((attribute) => attribute === Attributes.bonusDamage)) {
      options.filter((option) => option.id !== Attributes.bonusDamage)
    }

    if (!formData?.attributes?.some((attribute) => attribute === Attributes.limitTargets)) {
      options.filter((option) => option.id !== Attributes.targets)
    }

    if (!formData?.range) {
      options.filter((option) => option.id !== Attributes.range)
    }

    if (!formData?.shape) {
      options.filter((option) => option.id !== Attributes.shape)
    }

    if (!formData?.duration) {
      options.filter((option) => option.id !== Attributes.duration)
    }

    return options
  }, [
    formData.attributes,
    formData.shape,
    formData.duration,
    formData.damage?.attributes,
    formData.range,
    system.attributes,
  ])

  // Spell Upcast table formData
  const upcastFields = (index?: number) => {
    const headers: Array<ReactNode> = [<span key={`${index}levelSpan`}>Level</span>]
    const inputs: Array<ReactNode> = [
      <Input
        name={`upcast.levels.${index}.level`}
        validation='num'
        errorMsg='Must contain only numbers'
        value={formData?.upcast?.levels[index]?.level}
        onChange={updateFormData}
        key={`${index}level`}
      />,
    ]
    upcastTypes?.forEach((type) => {
      if (formData?.damage?.[type]?.attribute === Attributes.setAmount) {
        headers.push(`${startCase(type)} Dmg. Value`)
        inputs.push(
          <Input
            name={`upcast.levels.${index}.damage.${type}.setAmount`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.setAmount}
            onChange={updateFormData}
            key={`${index}damageSetAmount`}
          />
        )
      } else if (
        formData?.damage?.[type]?.attribute === Attributes.ability ||
        formData?.damage?.[type]?.attribute === Attributes.spellcastingAbility ||
        formData?.damage?.[type]?.attribute === Attributes.proficiency
      ) {
        headers.push(
          <span key={`${index}damage${type}MinAmountSpan`}> {startCase(type)} Dmg. Min. Value</span>,
          <span key={`${index}damage${type}MaxAmountSpan`}>{startCase(type)} Dmg. Max Value</span>,
          <span key={`${index}damage${type}MultiplierSpan`}>{startCase(type)} Dmg. Multiplier</span>
        )
        if (formData?.damage?.[type]?.attribute === Attributes.ability) {
          headers.push(<span key={`${index}damage${type}AbilitySpan`}>{startCase(type)} Dmg. Ability</span>)
          inputs.push(
            <Dropdown
              name={`upcast.levels.${index}.damage.${type}.ability`}
              value={formData?.upcast?.levels[index]?.damage[type]?.ability}
              options={system.attributes.filter((attribute) => attribute.damage.includes(DamageEnum.pool))}
              required={true}
              errorMsg='Please select an ability.'
              key={`${index}damage${type}Ability`}
              onChange={updateFormData}
            />
          )
        }
        inputs.push(
          <Input
            name={`upcast.levels.${index}.damage.${type}.minAmount`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.minAmount}
            key={`${index}damage${type}MinAmount`}
            onChange={updateFormData}
          />,
          <Input
            name={`upcast.levels.${index}.damage.${type}.maxAmount`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.maxAmount}
            key={`${index}damage${type}MaxAmount`}
            onChange={updateFormData}
          />,
          <Input
            name={`upcast.levels.${index}.damage.${type}.multiplier`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.multiplier}
            key={`${index}damage${type}Multiplier`}
            onChange={updateFormData}
          />
        )
      } else if (formData?.damage?.[type]?.attribute === Attributes.damagePool) {
        headers.push(<span key={`${index}damage${type}PoolOptionSpan`}>`${startCase(type)} Dmg. Pool Options`</span>)
        inputs.push(
          <Dropdown
            name={`upcast.levels.${index}.damage.${type}.pool.option`}
            value={formData?.upcast?.levels[index]?.damage[type]?.pool.option}
            options={system.attributes.filter((attribute) => attribute.damage.includes(DamageEnum.pool))}
            required={true}
            errorMsg='Please select an ability.'
            key={`${index}damage${type}PoolOption`}
            onChange={updateFormData}
          />
        )
        if (
          formData?.damage?.[type]?.pool?.attribute === Attributes.level ||
          formData.damage?.[type]?.pool?.attribute === Attributes.ability ||
          formData?.damage?.[type]?.pool?.attribute === Attributes.spellcastingAbility ||
          formData?.damage?.[type]?.pool?.attribute === Attributes.proficiency
        ) {
          if (
            formData.damage?.[type]?.pool?.attribute === Attributes.ability ||
            formData?.damage?.[type]?.pool?.attribute === Attributes.spellcastingAbility
          ) {
            if (formData.damage?.[type]?.pool?.attribute === Attributes.ability) {
              headers.push(<span key={`${index}damage${type}PoolAbilitySpan`}>`${startCase(type)} Dmg. Ability`</span>)
              inputs.push(
                <Dropdown
                  name={`upcast.levels.${index}.damage.${type}.pool.ability`}
                  value={formData?.upcast?.levels[index]?.damage[type]?.pool.ability}
                  options={system.abilities}
                  required={true}
                  errorMsg='Please select an ability.'
                  key={`${index}damage${type}PoolAbility`}
                  onChange={updateFormData}
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
                value={formData?.upcast?.levels[index]?.damage[type]?.pool.minAmount}
                key={`${index}damage${type}PoolMinAmount`}
                onChange={updateFormData}
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
              value={formData?.upcast?.levels[index]?.damage[type]?.pool.maxAmount}
              key={`${index}damage${type}PoolMaxAmount`}
              onChange={updateFormData}
            />,
            <Input
              name={`upcast.levels.${index}.damage.${type}.pool.multiplier`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={formData?.upcast?.levels[index]?.damage[type]?.pool.multiplier}
              key={`${index}damage${type}PoolMultiplier`}
              onChange={updateFormData}
            />
          )
        }
        if (formData?.damage?.[type]?.pool?.attribute === Attributes.setAmount) {
          headers.push(<span key={`${index}damage${type}PoolSetAmountSpan`}>{startCase(type)} Dmg. Pool Total</span>)
          inputs.push(
            <Input
              name={`upcast.levels.${index}.damage.${type}.pool.setAmount`}
              validation='num'
              errorMsg='Must contain only numbers'
              value={formData?.upcast?.levels[index]?.damage[type]?.pool.setAmount}
              key={`${index}damage${type}PoolSetAmount`}
              onChange={updateFormData}
            />
          )
        }
      } else {
        headers.push(
          <span key={`${index}damage${type}DieCountSpan`}>{startCase(type)} Dmg. Dice Count</span>,
          <span key={`${index}damage${type}DieValueSpan`}>{startCase(type)} Dmg. Dice Value</span>
        )
        inputs.push(
          <Input
            name={`upcast.levels.${index}.damage.${type}.dieCount`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.dieCount}
            key={`${index}damage${type}DieCount`}
            onChange={updateFormData}
          />,
          <Input
            name={`upcast.levels.${index}.damage.${type}.dieValue`}
            validation='num'
            errorMsg='Must contain only numbers'
            value={formData?.upcast?.levels[index]?.damage[type]?.dieValue}
            key={`${index}damage${type}DieValue`}
            onChange={updateFormData}
          />
        )
      }
    })
    if (
      formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.duration) ||
      formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
    ) {
      headers.push(
        <span key={`${index}durationIdSpan`}>Duration</span>,
        <span key={`${index}durationAmountSpan`}>Duration Increment</span>
      )
      inputs.push(
        <Dropdown
          name={`upcast.levels.${index}.duration.id`}
          value={formData?.upcast?.levels[index]?.duration.id}
          options={system.spells.durations}
          required={true}
          errorMsg='Please select a duration.'
          key={`${index}durationId`}
          onChange={updateFormData}
        />,
        <Input
          name={`upcast.levels.${index}.duration.amount`}
          validation='num'
          errorMsg='Must contain only numbers'
          value={formData?.upcast?.levels[index]?.duration.amount}
          key={`${index}durationAmount`}
          onChange={updateFormData}
        />
      )
    }
    if (
      formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.range) ||
      formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
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
          value={formData?.upcast?.levels[index]?.range.id}
          options={system.spells.ranges}
          required={true}
          errorMsg='Please select a range.'
          key={`${index}rangeId`}
          onChange={updateFormData}
        />,
        <Input
          name={`upcast.levels.${index}.range.minRange`}
          validation='num'
          errorMsg='Must contain only numbers'
          value={formData?.upcast?.levels[index]?.range.minRange}
          key={`${index}rangeMinRange`}
          onChange={updateFormData}
        />,
        <Input
          name={`upcast.levels.${index}.range.maxRange`}
          validation='num'
          errorMsg='Must contain only numbers'
          value={formData?.upcast?.levels[index]?.range.maxRange}
          key={`${index}rangeMaxRange`}
          onChange={updateFormData}
        />,
        <Dropdown
          name={`upcast.levels.${index}.range.unit`}
          value={formData?.upcast?.levels[index]?.range.unit}
          options={Object.values(system.rules.measurements.imperial).flatMap((rule) => Array.isArray(rule) && rule)}
          required={true}
          errorMsg='Please select a range.'
          key={`${index}rangeUnit`}
          onChange={updateFormData}
        />
      )
    }
    if (
      formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.shape) ||
      formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
    ) {
      headers.push(
        <span key={`${index}shapeIdSpan`}>Shape</span>,
        <span key={`${index}shapeSizeSpan`}>Shape Size</span>,
        <span key={`${index}shapeUnitSpan`}>UoM</span>
      )
      inputs.push(
        <Dropdown
          name={`upcast.levels.${index}.shape.id`}
          value={formData?.upcast?.levels[index]?.shape.id}
          options={system.spells.shapes}
          required={true}
          errorMsg='Please select a shape.'
          key={`${index}shapeId`}
          onChange={updateFormData}
        />,
        <Input
          name={`upcast.levels.${index}.shape.size`}
          validation='num'
          errorMsg='Must contain only numbers'
          value={formData?.upcast?.levels[index]?.shape.size}
          key={`${index}shapeSize`}
          onChange={updateFormData}
        />,
        <Dropdown
          name={`upcast.levels.${index}.shape.unit`}
          value={formData?.upcast?.levels[index]?.shape.unit}
          options={Object.values(system.rules.measurements.imperial).flatMap((rule) => Array.isArray(rule) && rule)}
          required={true}
          errorMsg='Please select a shape.'
          key={`${index}shapeUnit`}
          onChange={updateFormData}
        />
      )
    }
    if (
      formData?.upcast?.attributes?.some((attribute) => attribute === Attributes.targets) ||
      formData?.upcast?.attributes?.some((attribute) => attribute === 'all')
    ) {
      headers.push(<span key={`${index}targetsSpan`}>Targets</span>)
      inputs.push(
        <Input
          name={`upcast.levels.${index}.targets`}
          validation='num'
          errorMsg='Must contain only numbers'
          value={formData?.upcast?.levels[index]?.targets}
          required={true}
          key={`${index}targets`}
          onChange={updateFormData}
        />
      )
    }
    return { inputs, headers }
  }

  return (
    <>
      <Divider label='Upcast Options' />
      <Row className={sprinkles({ mb: 'space-3' })}>
        <Dropdown
          name='upcast.attributes'
          label='Upcast Attribute'
          value={formData?.upcast?.attributes}
          options={upcastOptions}
          multiSelect={true}
          onChange={updateFormData}
        />
      </Row>
      {formData?.upcast?.attributes?.length > 0 && (
        <>
          <Collapse className={sprinkles({ mt: 'space-3' })}>
            <Collapse.Header title='Upcast Table' startOpened={formData.id == null} />
            <Collapse.Body>
              <Row>{upcastFields().headers.map((header) => header)}</Row>
              {formData.upcast?.levels?.map((_, index) => (
                <Row key={index}>{upcastFields(index).inputs.map((input) => input)}</Row>
              ))}
            </Collapse.Body>
          </Collapse>
        </>
      )}
    </>
  )
}

export default Upcast
