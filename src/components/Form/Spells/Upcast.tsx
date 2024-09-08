import { useMemo, useEffect } from 'react'
import { useForm } from '../../../hooks/UseForm'
import Dropdown from '../../Dropdown/Dropdown'
import Row from '../../Row/Row'
import Table from '../../Table/Table'
import Collapse from '../../Collapse/Collapse'
import { sprinkles } from '../../../css/sprinkles.css'
import Divider from '../../Divider/Divider'
import { startCase } from 'lodash'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'
import { RowHeaderType, RowInputType } from '../../../utils/types'

const Upcast = () => {
  const { setFormState, formState, context } = useForm()

  const { data: builders } = useGetBuildersQuery()

  // Add/remove Upcast table
  useEffect(() => {
    if (
      formState.attribute?.some((attributeItem: any) => attributeItem.name === 'canUpcast') &&
      formState.upcast?.attribute?.length > 0 &&
      !formState.upcast?.levelAttribute
    ) {
      setFormState({
        type: 'added',
        target: { name: 'upcast.levelAttribute' },
      })
    }
    if (
      !formState.attribute?.some((attributeItem: any) => attributeItem.name === 'canUpcast') &&
      formState.upcast?.levelAttribute != null
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'upcast.levelAttribute' },
      })
    }
  }, [setFormState, formState])

  // Set upcast types based on user selection
  const upcastTypes = useMemo(() => {
    if (formState?.upcast?.attribute?.length > 0) {
      let types: any[] = []
      // Handle primary
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('primary')) {
          types.push('primary')
        }
      } else if (types.includes('primary')) {
        types = types.filter((type) => type !== 'primary')
      }

      // Handle secondary
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('secondary')) {
          types.push('secondary')
        }
      } else if (types.includes('secondary')) {
        types = types.filter((type) => type !== 'secondary')
      }

      // Handle bonus damage
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('bonus')) {
          types.push('bonus')
        }
      } else if (types.includes('bonus')) {
        types = types.filter((type) => type !== 'bonus')
      }

      return types
    }
  }, [formState?.upcast?.attribute])

  // Set upcast options based on the upcast types
  const upcastOptions = useMemo(() => {
    const options = [...builders.spells.upcast.attribute]
    if (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage')) {
      options.filter((upcastItem: any) => upcastItem.name !== 'primaryDamage')
    }

    if (!formState.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage')) {
      options.filter((upcastItem: any) => upcastItem.name !== 'secondaryDamage')
    }

    if (!formState.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage')) {
      options.filter((upcastItem: any) => upcastItem.name !== 'bonusDamage')
    }

    if (!formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'limitedTargets')) {
      options.filter((upcastItem: any) => upcastItem.name !== 'targets')
    }

    if (!formState?.range?.type) {
      options.filter((upcastItem: any) => upcastItem.name !== 'range')
    }

    if (!formState?.shape?.type) {
      options.filter((upcastItem: any) => upcastItem.name !== 'shape')
    }

    if (!formState?.duration?.type) {
      options.filter((upcastItem: any) => upcastItem.name !== 'duration')
    }

    return options
  }, [
    formState.attribute,
    formState.shape?.type,
    formState.duration?.type,
    formState.damage?.attribute,
    formState.range?.type,
    builders.spells.upcast.attribute,
  ])

  // Spell Upcast table data
  const upcastTableColumns = useMemo(() => {
    const inputArray: RowInputType[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
    ]
    upcastTypes?.forEach((type: string) => {
      if (formState?.damage?.[type]?.attribute?.name === 'setValue') {
        inputArray.push({
          name: `damage.${type}.setValue`,
          value: `${startCase(type)} Dmg. Value`,
          errorMsg: 'Must contain only numbers',
          required: true,
          validation: 'num',
        })
      } else if (
        formState?.damage?.[type]?.attribute?.name === 'ability' ||
        formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
        formState?.damage?.[type]?.attribute?.name === 'proficiency'
      ) {
        if (formState?.damage?.[type]?.attribute?.name === 'ability') {
          inputArray.push({
            name: `damage.${type}.ability.type`,
            value: `${startCase(type)} Dmg. Ability`,
            type: 'select',
            required: true,
            options: builders.spells.damage.pool.attribute,
          })
        }
        inputArray.push(
          {
            name: `damage.${type}.minValue`,
            value: `${startCase(type)} Dmg. Min. Value`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: `damage.${type}.maxValue`,
            value: `${startCase(type)} Dmg. Max Value`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: `damage.${type}.multiplier`,
            value: `${startCase(type)} Dmg. Multiplier`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          }
        )
      } else if (formState?.damage?.[type]?.attribute?.name === 'damagePool') {
        inputArray.push({
          name: `damage.${type}.pool.option`,
          value: `${startCase(type)} Dmg. Pool Options`,
          type: 'select',
          required: true,
          options: builders.spells.damage.pool.attribute,
        })
        if (
          formState?.damage?.[type]?.pool?.attribute?.name === 'level' ||
          formState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
          formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
          formState?.damage?.[type]?.attribute?.name === 'proficiency'
        ) {
          if (
            formState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
            formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility'
          ) {
            if (formState.damage?.[type]?.pool?.attribute?.name === 'ability') {
              inputArray.push({
                name: `damage.${type}.pool.ability.type`,
                value: `${startCase(type)} Dmg. Ability`,
                type: 'select',
                required: true,
                options: builders.abilities.type,
              })
            }
            inputArray.push({
              name: `damage.${type}.pool.minValue`,
              value: `${startCase(type)} Dmg. Min Value`,
              errorMsg: 'Must contain only numbers',
              validation: 'num',
            })
          }
          inputArray.push({
            name: `damage.${type}.pool.maxValue`,
            value: `${startCase(type)} Dmg. Max Value`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
          inputArray.push({
            name: `damage.${type}.pool.multiplier`,
            value: `${startCase(type)} Dmg. Multiplier`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
        }
        if (formState?.damage?.[type]?.pool?.attribute?.name === 'setValue') {
          inputArray.push({
            name: `damage.${type}.pool.setValue`,
            value: `${startCase(type)} Dmg. Pool Total`,
            required: true,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
        }
      } else {
        inputArray.push(
          {
            name: `damage.${type}.diceCount`,
            value: `${startCase(type)} Dmg. Dice Count`,
            required: true,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: `damage.${type}.diceValue`,
            value: `${startCase(type)} Dmg. Dice Value`,
            required: true,
            type: 'select',
            options: builders.system.dice,
          }
        )
      }
    })
    if (
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'duration') ||
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
    ) {
      inputArray.push(
        {
          name: 'duration.type',
          value: 'Duration',
          type: 'select',
          options: builders.spells.duration.type,
        },
        {
          name: 'duration.value',
          value: 'Duration Increment',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }
    if (
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'range') ||
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
    ) {
      inputArray.push(
        {
          name: 'range.type',
          value: 'Duration',
          type: 'select',
          options: builders.spells.range.type,
        },
        {
          name: 'range.minRange',
          value: 'Min. Range',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'range.maxRange',
          value: 'Max Range',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'range.unit',
          value: 'UoM',
          type: 'select',
          options: Object.values(builders.unit.imperial).flatMap((item) => item),
          optionalKey: 'short',
        }
      )
    }
    if (
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'shape') ||
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
    ) {
      inputArray.push(
        {
          name: 'shape.type',
          value: 'Shape Type',
          type: 'select',
          options: builders.spells.shape.type,
        },
        {
          name: 'shape.size',
          value: 'Shape Size',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'shape.unit',
          value: 'UoM',
          type: 'select',
          options: Object.values(builders.unit.imperial).flatMap((item) => item),
          optionalKey: 'short',
        }
      )
    }
    if (
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'targets') ||
      formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
    ) {
      inputArray.push({
        name: 'targets',
        value: '# of Targets',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
        required: true,
      })
    }

    const headerArray: RowHeaderType[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
    }))

    return { inputs: inputArray, headers: headerArray }
  }, [builders, formState?.damage, formState?.upcast?.attribute, upcastTypes])

  return (
    formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'canUpcast') && (
      <>
        <Divider label='Upcast Options' />
        <Row className={sprinkles({ mb: 'space-3' })}>
          <Dropdown
            name='upcast.attribute'
            label='Upcast Attribute'
            value={formState?.upcast?.attribute}
            options={upcastOptions}
            multiSelect={true}
            onChange={setFormState}
          />
        </Row>
        {formState?.upcast?.attribute?.length > 0 && (
          <>
            <Collapse className={sprinkles({ mt: 'space-3' })}>
              <Collapse.Header title='Upcast Table' startOpened={context.type === 'new'} />
              <Collapse.Body>
                <Table
                  rows={{
                    inputs: upcastTableColumns.inputs,
                    headers: upcastTableColumns.headers,
                  }}
                  name='upcast.levelAttribute'
                  value={formState?.upcast?.levelAttribute}
                  onChange={setFormState}
                  addRow={true}
                  scrollable='horizontal'
                />
              </Collapse.Body>
            </Collapse>
          </>
        )}
      </>
    )
  )
}

export default Upcast
