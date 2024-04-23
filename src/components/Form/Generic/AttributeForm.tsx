import { useEffect, memo, useState } from 'react'
import { ReducerActionType, DropdownOption, RowHeader, RowInput, FormContext } from '../../../utils/types'
import Grid from '../../Grid/Grid'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { useGetItemsQuery, selectAllItems } from '../../../features/item/itemApiSlice'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import Divider from '../../Divider/Divider'
import Table from '../../Table/Table'
import { equipment_sub_group_button, form_add_button, form_content, form_remove_button } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import useIsLoading from '../../../hooks/useIsLoading'
import Spinner from '../../Spinner/Spinner'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Button from '../../Button/Button'
import Group from '../../Group/Group'
import clsx from 'clsx'
import { TbPlus, TbX } from 'react-icons/tb'

interface AttributeFormProps {
  context: FormContext
  formState: any
  setFormState: (arg: ReducerActionType) => void
}

const AttributeForm = memo(({ context, formState, setFormState }: AttributeFormProps) => {
  const isLoading = useIsLoading()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const [damageTypes, setDamageTypes] = useState<Array<string>>(['primary'])
  const [upcastTypes, setUpcastTypes] = useState<Array<string>>([])
  const [upcastOptions, setUpcastOptions] = useState<Array<any>>(builders.spell.upcast.attribute)

  // Set upcast options
  useEffect(() => {
    const options = [...builders.spell.upcast.attribute]
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

    setUpcastOptions(options)
  }, [
    formState?.range?.type,
    formState?.shape?.type,
    formState?.duration?.type,
    builders.spell.upcast.attribute,
    formState.attribute,
    formState.damage?.attribute,
  ])

  // Set Damage Types (Bonus/Secondary) Array
  useEffect(() => {
    let types = [...damageTypes] // Create a copy of damageTypes array
    if (formState?.damage?.attribute?.length > 0) {
      // Handle secondary
      if (formState?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage')) {
        if (!types.includes('secondary')) {
          types.push('secondary')

          setDamageTypes(types)
        }
      } else if (types.includes('secondary')) {
        types = types.filter((type) => type !== 'secondary')

        setDamageTypes(types)
      }

      // Handle bonus damage
      if (formState?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage')) {
        if (!types.includes('bonus')) {
          types.push('bonus')

          setDamageTypes(types)
        }
      } else if (types.includes('bonus')) {
        types = types.filter((type) => type !== 'bonus')

        setDamageTypes(types)
      }

      if (formState.property?.some((propertyItem: any) => propertyItem.name === 'versatile')) {
        if (!types.includes('versatile')) {
          types.push('versatile')

          setDamageTypes(types)
        }
      } else if (types.includes('versatile')) {
        types = types.filter((type) => type !== 'versatile')

        setDamageTypes(types)
      }

      if (
        !formState?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage') &&
        formState.damage?.secondary
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'damage.secondary' },
        })
      }
      if (
        !formState?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage') &&
        formState.damage?.bonus
      ) {
        setFormState({ type: 'removed', target: { name: 'damage.bonus' } })
      }
    } else {
      if (!damageTypes.every((type) => type === 'primary')) {
        types = types.filter((type) => type === 'primary')

        setDamageTypes(types)
      }
    }
  }, [
    formState?.damage?.attribute,
    formState.property,
    damageTypes,
    formState?.damage?.bonus,
    formState?.damage?.secondary,
    setFormState,
  ])

  // Set Upcast Types (Bonus/Secondary) Array
  useEffect(() => {
    if (formState?.upcast?.attribute?.length > 0) {
      let types = [...upcastTypes] // Create a copy of damageTypes array
      // Handle primary
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('primary')) {
          types.push('primary')
          setUpcastTypes(types)
        }
      } else if (types.includes('primary')) {
        types = types.filter((type) => type !== 'primary')

        setUpcastTypes(types)
      }

      // Handle secondary
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('secondary')) {
          types.push('secondary')

          setUpcastTypes(types)
        }
      } else if (types.includes('secondary')) {
        types = types.filter((type) => type !== 'secondary')

        setUpcastTypes(types)
      }

      // Handle bonus damage
      if (
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage') ||
        formState?.upcast?.attribute?.some((attributeItem: any) => attributeItem.name === 'all')
      ) {
        if (!types.includes('bonus')) {
          types.push('bonus')

          setUpcastTypes(types)
        }
      } else if (types.includes('bonus')) {
        types = types.filter((type) => type !== 'bonus')

        setUpcastTypes(types)
      }
    }
  }, [formState?.upcast?.attribute, upcastTypes])

  // Add/remove Die Per Level table
  useEffect(() => {
    const diePerLevel =
      formState?.damage?.primary?.attribute?.name === 'diePerLevel' ||
      formState?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
      formState?.damage?.bonus?.attribute?.name === 'diePerLevel'

    if (diePerLevel && !formState.damage?.diePerLevel) {
      setFormState({
        type: 'added',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
    if (!diePerLevel && formState.damage?.diePerLevel) {
      setFormState({
        type: 'removed',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
  }, [setFormState, formState.attribute, formState.damage, damageTypes])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel =
      formState?.damage?.primary?.attribute?.name === 'setPerLevel' ||
      formState?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
      formState?.damage?.bonus?.attribute?.name === 'setPerLevel'

    if (setPerLevel && !formState.damage?.setPerLevel) {
      setFormState({
        type: 'added',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
    if (!setPerLevel && formState.damage?.setPerLevel) {
      setFormState({
        type: 'removed',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
  }, [setFormState, formState.attribute, formState.damage])

  // Remove Resource if not needed
  useEffect(() => {
    if (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') && formState.resource) {
      setFormState({ type: 'removed', target: { name: 'resource' } })
    }
  }, [formState.attribute, formState.resource, setFormState])

  // Add level attribute table
  useEffect(() => {
    if (!formState.levelAttribute && context.title === 'class' && formState.category?.name === 'base') {
      setFormState({
        type: 'added',
        target: { name: 'levelAttribute' },
      })
    }
  }, [formState.levelAttribute, setFormState, context.title, formState.category?.name])

  // Add/Remove Subtypes table
  useEffect(() => {
    if (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypes') && !formState.subtype) {
      setFormState({
        type: 'added',
        target: { name: 'subtype' },
      })
    }
    if (
      !formState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypes') &&
      formState.subtype != null
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'subtype' },
      })
    }
  }, [formState, setFormState])

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

  //Add/remove Limit Use table
  useEffect(() => {
    if (
      !formState.charge?.level &&
      formState?.charge?.limit?.name === 'level' &&
      formState.attribute?.some((attributeItem: any) => attributeItem.name === 'limitUse')
    ) {
      setFormState({
        type: 'added',
        target: { name: `charge.level` },
      })
    }
    if (!(formState.charge?.limit?.name === 'level') && formState.charge?.level) {
      setFormState({
        type: 'removed',
        target: { name: `charge.level` },
      })
    }
  }, [formState, setFormState])

  // Remove Damage data
  useEffect(() => {
    if (
      ((!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage') &&
        formState.category?.name !== 'weapon') ||
        formState.property?.some((propertyItem: any) => propertyItem.name === 'special')) &&
      formState.damage
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'damage' },
      })
    }
    if (
      formState.damage?.secondary &&
      !formState.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage')
    ) {
      setFormState({ type: 'removed', target: { name: 'damage.secondary' } })
    }
    if (
      formState.damage?.bonus &&
      !formState.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage')
    ) {
      setFormState({ type: 'removed', target: { name: 'damage.bonus' } })
    }
    if (
      formState.damage?.versatile &&
      !formState.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'versatileDamage')
    ) {
      setFormState({ type: 'removed', target: { name: 'damage.versatile' } })
    }
  }, [setFormState, formState.damage, formState.property, formState.category, formState.attribute])

  // Remove Spellcasting data
  useEffect(() => {
    if (
      !formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') &&
      formState.spellcasting != null
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'spellcasting' },
      })
      formState.levelAttribute?.map((_: any, index: number) => {
        setFormState({
          type: 'removed',
          target: { name: `levelAttribute.${index}.spellSlots` },
        })
      })
    }
  }, [formState.attribute, formState.spellcasting, formState.levelAttribute, setFormState])

  // Add/Remove requirements array
  useEffect(() => {
    if (
      !(formState.attribute?.length > 0) ||
      (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements') &&
        formState.requirement)
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'requirement' },
      })
    }

    if (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements')) {
      if (
        formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        !(formState.requirement?.itemProficiency?.length > 0)
      ) {
        setFormState({
          type: 'added',
          target: { name: 'requirement.itemProficiency' },
        })
      }

      if (
        !formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        formState.requirement?.itemProficiency?.length > 0
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'requirement.itemProficiency' },
        })
      }

      if (
        formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'equipped') &&
        !(formState.requirement?.equipped?.length > 0)
      ) {
        setFormState({
          type: 'added',
          target: { name: 'requirement.equipped' },
        })
      }

      if (
        !formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'equipped') &&
        formState.requirement?.equipped?.length > 0
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'requirement.equipped' },
        })
      }

      if (
        formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        !(formState.requirement?.notEquipped?.length > 0)
      ) {
        setFormState({
          type: 'added',
          target: { name: 'requirement.notEquipped' },
        })
      }

      if (
        !formState.requirement?.option?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        formState.requirement?.notEquipped?.length > 0
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'requirement.notEquipped' },
        })
      }
    }
  }, [formState.attribute, setFormState, formState.requirement])

  // Spell Upcast table data
  const upcastTableColumns = () => {
    const inputArray: Array<RowInput> = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
    ]
    upcastTypes.forEach((type: string) => {
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
            options: builders.spell.damage.pool.attribute,
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
          options: builders.spell.damage.pool.attribute,
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
                options: builders.ability.type,
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
            errorMsg: 'Must contain only numbers',
            validation: 'num',
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
          options: builders.spell.duration.type,
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
          options: builders.spell.range.type,
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
          options: builders.spell.shape.type,
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

    const headerArray: Array<RowHeader> = inputArray.map((inputItem) => ({
      value: inputItem.value,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  // Class level table data
  const levelTableColumns = () => {
    const spellCaster = formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster')

    const resource =
      formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') &&
      formState?.resource?.method?.name === 'setPerLevel'
    const inputArray: Array<RowInput> = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
        required: true,
      },
    ]
    if (formState.category?.name === 'base') {
      inputArray.push({
        name: 'proficiency',
        value: 'Prof. Bonus',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }
    if (resource) {
      inputArray.push({
        name: 'resourcePoints',
        value: `${formState.resource?.value ?? 'Resource'} Points`,
        validation: 'num',
        errorMsg: 'Must contain only numbers',
      })
    }
    if (spellCaster) {
      if (formState.spellcasting?.attribute?.some((attributeItem: any) => attributeItem.name === 'limitKnownSpells')) {
        inputArray.push({
          name: 'spellsKnown',
          value: 'Spells Known',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        })
      }
      if (formState.spellcasting?.maxSpellLevel) {
        for (let i = 0; i <= formState.spellcasting?.maxSpellLevel; i++) {
          inputArray.push({
            name: `spellSlots.${i}.slotCount`,
            value: `${i}`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
        }
      }
    }

    const headerArray: Array<RowHeader> = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  // Die Per Level table data
  const diePerLevelTableColumns = () => {
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (formState?.damage?.primary?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'primary.diceCount',
          value: 'Main Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'primary.diceValue',
          value: 'Main Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    if (formState?.damage?.secondary?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'secondary.diceCount',
          value: 'Sec. Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'secondary.diceValue',
          value: 'Sec. Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    if (formState?.damage?.bonus?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'bonus.diceCount',
          value: 'Bonus Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'bonus.diceValue',
          value: 'Bonus Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    const headerArray: RowHeader[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  // Set Per Level table data
  const setPerLevelTableColumns = () => {
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (formState?.damage?.primary?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'primary',
        value: 'Main Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (formState?.damage?.secondary?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'secondary',
        value: 'Sec. Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (formState?.damage?.bonus?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'bonus',
        value: 'Bonus Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    const headerArray: RowHeader[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  return isLoading || !builders ? (
    <Spinner />
  ) : (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      <Grid className={sprinkles({ mb: 'size-3' })}>
        {context.title && (
          <Dropdown
            multiSelect={true}
            name='attribute'
            label={`${startCase(context.title)} Attributes`}
            value={formState?.attribute}
            options={builders[context.title].attribute
              .filter((attributeItem: any) =>
                formState.category?.name === 'armor' || formState.category?.name === 'weapon'
                  ? attributeItem.name !== 'doesDamage'
                  : attributeItem.name !== 'maxBonus'
              )
              .filter(
                (attributeItem: any) =>
                  (formState.category?.name === 'base'
                    ? attributeItem
                    : attributeItem.name !== 'primaryAbility' && attributeItem.name !== 'secondaryAbility') &&
                  (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility')
                    ? attributeItem
                    : attributeItem.name !== 'optionalAbility')
              )}
            onChange={setFormState}
          />
        )}
        {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'stackable') && (
          <Input
            validation={'num'}
            type='text'
            name='maxStack'
            errorMsg='Must contain only numbers'
            label='Max Stack Size'
            autoComplete='off'
            value={formState?.maxStack}
            onChange={setFormState}
          />
        )}
        {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements') && (
          <Dropdown
            multiSelect={true}
            name='requirement.option'
            label='Requirement'
            value={formState?.requirement?.option}
            options={[].concat(builders.feature.requirement, builders.feature.item.requirement)}
            required={true}
            onChange={setFormState}
          />
        )}
        {formState.attribute?.some((attributeItem: any) => attributeItem.name === 'isAction') ||
          (context.title === 'spell' && (
            <Dropdown
              name={'action.type'}
              label={context.title === 'spell' ? 'Casting Time' : 'Action Type'}
              value={formState?.action?.type}
              options={[].concat(builders.action.type, builders[context.title].action.type)}
              required={true}
              onChange={setFormState}
            />
          ))}
        {context.title === 'spell' && (
          <>
            {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryAction') && (
              <>
                <Dropdown
                  name='secondaryAction.type'
                  label='Sec. Action'
                  value={formState?.secondaryAction?.type}
                  options={[].concat(builders.action.type, builders[context.title].action.type)}
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  validation={'num'}
                  name='secondaryAction.value'
                  label='Sec. Increment'
                  value={formState?.secondaryAction?.value}
                  required={true}
                  onChange={setFormState}
                />
              </>
            )}
            {formState?.action && formState.action?.type?.name !== 'special' && (
              <Input
                validation='num'
                name='action.value'
                label='Casting Increment'
                value={formState?.action?.value}
                required={true}
                onChange={setFormState}
              />
            )}
            <Dropdown
              name='duration.type'
              label='Duration'
              value={formState?.duration?.type}
              options={builders.spell.duration.type}
              required={true}
              onChange={setFormState}
            />
            {formState?.duration &&
              formState.duration?.type?.name !== 'instantaneous' &&
              formState.duration?.type?.name !== 'untilDispelled' &&
              formState.duration?.type?.name !== 'special' && (
                <Input
                  validation={'num'}
                  name='duration.value'
                  errorMsg='Must contain only numbers'
                  label='Duration Increment'
                  autoComplete='off'
                  required={true}
                  value={formState?.duration?.value}
                  onChange={setFormState}
                />
              )}
            <Dropdown
              name='range.type'
              label='Range'
              value={formState?.range?.type}
              options={builders.spell.range.type}
              required={true}
              onChange={setFormState}
            />
            {formState?.range?.type?.name !== 'touch' &&
              formState.range?.type?.name !== 'sight' &&
              formState.range?.type?.name !== 'unlimited' &&
              formState.range?.type && (
                <>
                  <Input
                    validation={'num'}
                    name='range.minRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Min. Range'
                    autoComplete='off'
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    value={formState?.range?.minRange}
                    onChange={setFormState}
                  />
                  <Input
                    validation={'num'}
                    name='range.maxRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Max Range'
                    autoComplete='off'
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    value={formState?.range?.maxRange}
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='range.unit'
                    label='UoM'
                    value={formState?.range?.unit}
                    options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    optionalKey='short'
                    onChange={setFormState}
                  />
                </>
              )}
            <Dropdown
              name='shape.type'
              label='Shape'
              options={builders.spell.shape.type}
              value={formState?.shape?.type}
              onChange={setFormState}
            />
            {formState?.shape?.type?.name &&
              formState.shape?.type?.name !== 'none' &&
              formState.shape?.type?.name !== 'weapon' && (
                <>
                  <Input
                    validation={'cur'}
                    name='shape.size'
                    errorMsg='Please enter a valid number (can inlude decimals)'
                    label='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={formState?.shape?.size}
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='shape.unit'
                    label='UoM'
                    value={formState?.shape?.unit}
                    options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                    required={true}
                    optionalKey='short'
                    onChange={setFormState}
                  />
                </>
              )}
            {context.title === 'spell' && (
              <Input
                name='targets'
                value={formState?.targets}
                label='# of Targets'
                validation='num'
                errorMsg='Enter a valid number greater than 0'
                onChange={setFormState}
                placeholder='1'
              />
            )}
            {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'appliesCondition') && (
              <Dropdown
                name='condition.type'
                label='Condition'
                value={formState?.condition?.type}
                options={builders.condition.type}
                multiSelect={true}
                required={true}
                onChange={setFormState}
              />
            )}
          </>
        )}
        {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'requireSave') && (
          <>
            {context.title !== 'spell' && (
              <Dropdown
                name={`saveAbility.attribute`}
                multiSelect={true}
                label='Save Attribute'
                value={formState?.saveAbility?.attribute}
                options={builders.feature.saveAbility.attribute}
                onChange={setFormState}
              />
            )}
            <Dropdown
              name={'saveAbility.type'}
              label='DC Ability'
              value={formState?.saveAbility?.type}
              options={builders.ability.type}
              required={true}
              onChange={setFormState}
            />
            {context.title !== 'spell' && (
              <>
                {formState?.saveAbility?.attribute?.some(
                  (attributeItem: any) => attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Dropdown
                    name={`saveAbility.abilityModifier.type`}
                    label='Modifier Ability'
                    value={formState?.saveAbility?.abilityModifier?.type}
                    options={builders.ability.type}
                    required={true}
                    onChange={setFormState}
                  />
                )}
                <Input
                  validation='num'
                  name={`saveAbility.minValue`}
                  autoComplete='off'
                  label='Base Value'
                  required={true}
                  errorMsg='Must contain only numbers'
                  value={formState?.saveAbility?.minValue}
                  onChange={setFormState}
                />
              </>
            )}
          </>
        )}
      </Grid>
      {formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') && (
        <Collapse
          startOpened={context.type === 'new'}
          title='Resource Attributes'
          className={sprinkles({ mb: 'size-3' })}
        >
          <Grid>
            <Input
              name='resource.value'
              label='Resource Name'
              autoComplete='off'
              value={formState?.resource?.value}
              required={true}
              onChange={setFormState}
            />
            <Input
              name='resource.levelAvailable'
              label='Level Available'
              autoComplete='off'
              value={formState?.resource?.levelAvailable}
              required={true}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
            <Dropdown
              name='resource.method'
              label='Resource Point Amount'
              value={formState?.resource?.method}
              options={builders.class.resource.method}
              required={true}
              onChange={setFormState}
            />
            {formState?.resource?.method?.name === 'ability' && (
              <Dropdown
                name='resource.charge.ability.type'
                label='Ability'
                value={formState?.resource?.charge?.ability?.type}
                options={builders.ability.type}
                required={true}
                onChange={setFormState}
              />
            )}
            {formState?.resource?.method?.name === 'setValue' && (
              <Input
                name='resource.charge.setValue'
                label='Set Value'
                value={formState?.resource?.charge?.setValue}
                required={true}
                onChange={setFormState}
                autoComplete='off'
              />
            )}
            <Dropdown
              name='resource.charge.reset'
              label='Resource Reset Option'
              value={formState?.resource?.charge?.reset}
              options={builders.feature.charge.reset}
              required={true}
              onChange={setFormState}
            />
          </Grid>
          <RichTextEditor
            name={'resource.desc'}
            value={formState?.resource?.desc}
            label={'Description'}
            onChange={setFormState}
          />
        </Collapse>
      )}
      {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') && (
        <Collapse
          startOpened={context.type === 'new'}
          title={'Spellcaster Attributes'}
          className={sprinkles({ mb: 'size-3' })}
        >
          <Grid>
            <Dropdown
              name='spellcasting.ability.type'
              label='Spellcasting Ability'
              required={true}
              value={formState?.spellcasting?.ability?.type}
              options={builders.ability.type}
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.attribute'
              label='Spell Casting Attributes'
              multiSelect={true}
              value={formState?.spellcasting?.attribute}
              options={builders.class.spell.attribute}
              onChange={setFormState}
            />
            {formState?.spellcasting?.attribute?.some((attributeItem: any) => attributeItem.name === 'magicName') && (
              <Input
                name='spellcasting.magicName'
                autoComplete='off'
                label='Magic Type Name'
                required={true}
                value={formState?.spellcasting?.magicName}
                onChange={setFormState}
              />
            )}
            {formState?.spellcasting?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'preparesSpells'
            ) && (
              <Dropdown
                name='spellcasting.prepareLimitMethod'
                label='Prepare Limit Method'
                multiSelect={true}
                value={formState?.spellcasting?.prepareLimitMethod}
                options={builders.class.spell.prepareLimitAttribute}
                onChange={setFormState}
              />
            )}
            {formState?.spellcasting?.prepareLimitMethod?.some(
              (methodItem: any) => methodItem.name === 'classLevel'
            ) && (
              <>
                <Dropdown
                  name='spellcasting.prepareLimitLevel.measurement'
                  label='Level Measurement'
                  value={formState?.spellcasting?.prepareLimitLevel?.measurement}
                  options={builders.system.rules.measurement}
                  onChange={setFormState}
                />
                {formState?.spellcasting?.prepareLimitLevel?.measurement?.name === 'half' && (
                  <Dropdown
                    name='spellcasting.prepareLimit.level.rounding'
                    label='Level Rounding'
                    value={formState?.spellcasting?.prepareLimit?.level?.rounding}
                    options={builders.system.rules.rounding}
                    onChange={setFormState}
                  />
                )}
              </>
            )}
            <Input
              name='spellcasting.maxSpellLevel'
              autoComplete='off'
              label='Max Spell Level'
              required={true}
              value={formState?.spellcasting?.maxSpellLevel}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.charge.reset'
              label='Spellslot Reset Option'
              value={formState?.spellcasting?.charge?.reset}
              options={builders.feature.charge.reset}
              required={true}
              onChange={setFormState}
            />
          </Grid>
        </Collapse>
      )}
      {context.title === 'class' && formState.category?.name === 'base' && (
        <Collapse startOpened={context.type === 'new'} title='Subclass Details' className={sprinkles({ mb: 'size-3' })}>
          <Grid cols={{ lg: 4, md: 4, base: 2 }}>
            <Input
              name='subclass.value'
              autoComplete='off'
              label='Subclass Feature Name'
              required={true}
              value={formState?.subclass?.value}
              onChange={setFormState}
            />
            <Input
              name='subclass.levelAcquired'
              autoComplete='off'
              label='Level Acquired'
              required={true}
              value={formState?.subclass?.levelAcquired}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
          </Grid>
          <RichTextEditor
            name={'subclass.desc'}
            value={formState?.subclass?.desc}
            label={'Description'}
            onChange={setFormState}
          />
        </Collapse>
      )}
      {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility') && (
        <>
          <Collapse
            title={'Multiclass Ability Requirements'}
            startOpened={context.type === 'new'}
            className={sprinkles({ mb: 'size-3' })}
          >
            <Grid className={sprinkles({ mb: 'size-3' })}>
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility') && (
                <>
                  <Dropdown
                    name='multiclass.primaryAbility.type'
                    label='Primary Ability'
                    value={formState?.multiclass?.primaryAbility?.type}
                    options={builders.ability.type
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.secondaryAbility?.type?._id
                      )
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.optionalAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.primaryAbility.minValue'
                    autoComplete='off'
                    label='Primary Score'
                    required={true}
                    value={formState?.multiclass?.primaryAbility?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryAbility') && (
                <>
                  <Dropdown
                    name='multiclass.secondaryAbility.type'
                    label='Secondary Ability'
                    value={formState?.multiclass?.secondaryAbility?.type}
                    options={builders.ability.type
                      .filter((abilityItem: any) => abilityItem._id !== formState.multiclass?.primaryAbility?.type?._id)
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.optionalAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.secondaryAbility.minValue'
                    autoComplete='off'
                    label='Secondary Score'
                    required={true}
                    value={formState?.multiclass?.secondaryAbility?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'optionalAbility') && (
                <>
                  <Dropdown
                    name='multiclass.optionalAbility.type'
                    label='Optional Ability'
                    value={formState?.multiclass?.optionalAbility?.type}
                    options={builders.ability.type
                      .filter((abilityItem: any) => abilityItem._id !== formState.multiclass?.primaryAbility?.type?._id)
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.secondaryAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.optional.ability.minValue'
                    autoComplete='off'
                    label='Optional Score'
                    required={true}
                    value={formState?.multiclass?.optional.ability?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
            </Grid>
          </Collapse>
        </>
      )}
      {(formState.category?.name === 'base' ||
        formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') ||
        (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') &&
          formState.resource?.method?.name === 'setPerLevel')) &&
        context.title === 'class' && (
          <>
            <Collapse
              title={'Level Attributes'}
              startOpened={context.type === 'new'}
              className={sprinkles({ mb: 'size-3' })}
            >
              <Table
                name='levelAttribute'
                rows={{
                  inputs: levelTableColumns().inputs,
                  headers: levelTableColumns().headers,
                }}
                value={formState?.levelAttribute}
                onChange={setFormState}
                addRow={true}
                scrollable='horizontal'
                border={false}
              />
            </Collapse>
          </>
        )}
      {formState?.subtype?.length > 0 && (
        <>
          <Collapse title={'Subtypes'} startOpened={context.type === 'new'} className={sprinkles({ mb: 'size-3' })}>
            <>
              <Table
                name='subtype'
                rows={{
                  inputs: [
                    {
                      name: 'value',
                    },
                  ],
                  headers: [
                    {
                      value: 'Name',
                    },
                  ],
                }}
                value={formState?.subtype}
                addRow={true}
                onChange={setFormState}
              />
            </>
          </Collapse>
        </>
      )}
      {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'canUpcast') && (
        <Grid className={sprinkles({ mb: 'size-3' })}>
          <Dropdown
            name='upcast.attribute'
            label='Upcast Attribute'
            value={formState?.upcast?.attribute}
            options={upcastOptions}
            multiSelect={true}
            onChange={setFormState}
          />
        </Grid>
      )}
      {(formState.category?.name === 'weapon' ||
        formState.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage') ||
        formState.property?.some((propertyItem: any) => propertyItem.name === 'improvisedWeapon')) &&
        !formState.property?.some((propertyItem: any) => propertyItem.name === 'special') && (
          <>
            <Grid className={sprinkles({ mb: 'size-3' })}>
              <Dropdown
                multiSelect={true}
                name={`damage.attribute`}
                label={`Damage Attribute`}
                value={formState?.damage?.attribute}
                options={builders.damage.attribute.filter((attributeItem: any) =>
                  context.title === 'item'
                    ? attributeItem.name !== 'showAsAttack' &&
                      attributeItem.name !== 'addToWeaponAttack' &&
                      formState?.category?.name === 'weapon' &&
                      attributeItem.name !== 'secondaryDamage'
                    : attributeItem
                )}
                onChange={setFormState}
              />
            </Grid>
            {damageTypes.map((type: string, index: number) => {
              return (
                <Grid key={index}>
                  {type !== 'versatile' && (
                    <>
                      <Dropdown
                        name={`damage.${type}.attribute`}
                        label={`${startCase(type)} Dmg. Attribute`}
                        value={formState?.damage?.[type]?.attribute}
                        options={[].concat(
                          builders.damage.main.attribute.filter((attributeItem: any) =>
                            context.title === 'spell' || context.title === 'item'
                              ? attributeItem.name !== 'diePerLevel' && attributeItem.name !== 'setPerLevel'
                              : attributeItem
                          ),
                          type === 'bonus' && builders.damage.bonus.attribute
                        )}
                        onChange={setFormState}
                      />
                      <Dropdown
                        name={`damage.${type}.type`}
                        label={`${startCase(type)} Dmg. Type`}
                        value={formState?.damage?.[type]?.type}
                        options={[
                          ...builders.damage.type,
                          {
                            id: null,
                            _id: null,
                            name: 'matchWeapon',
                            value: 'Match Weapon',
                          },
                        ]}
                        required={true}
                        onChange={setFormState}
                      />
                    </>
                  )}
                  {formState?.damage?.[type]?.attribute?.name !== 'diePerLevel' &&
                    formState?.damage?.[type]?.attribute?.name !== 'setPerLevel' &&
                    (formState?.damage?.[type]?.attribute?.name === 'setValue' ? (
                      <Input
                        name={`damage.${type}.setValue`}
                        value={formState?.damage?.[type]?.setValue}
                        label={`Set ${startCase(type)} Value`}
                        onChange={setFormState}
                        required={true}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    ) : formState?.damage?.[type]?.attribute?.name === 'ability' ||
                      formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
                      formState?.damage?.[type]?.attribute?.name === 'proficiency' ? (
                      <>
                        {formState?.damage?.[type]?.attribute?.name === 'ability' && (
                          <Dropdown
                            name={`damage.${type}.ability.type`}
                            label={`${startCase(type)} Ability`}
                            value={formState?.damage?.[type]?.ability?.type}
                            options={builders.ability.type}
                            required={true}
                            onChange={setFormState}
                          />
                        )}
                        <Input
                          name={`damage.${type}.minValue`}
                          value={formState?.damage?.[type]?.minValue}
                          label={`${startCase(type)} Min. Value`}
                          onChange={setFormState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.maxValue`}
                          value={formState?.damage?.[type]?.maxValue}
                          label={`${startCase(type)} Max Value`}
                          onChange={setFormState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.multiplier`}
                          value={formState?.damage?.[type]?.multiplier}
                          label={`${startCase(type)} Dmg. Multiplier`}
                          onChange={setFormState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ) : formState?.damage?.[type]?.attribute?.name === 'damagePool' ? (
                      <>
                        <Dropdown
                          name={`damage.${type}.pool.attribute`}
                          label={`${startCase(type)} Dmg. Pool Attribute`}
                          value={formState?.damage?.[type]?.pool?.attribute}
                          options={[].concat(
                            builders.damage.pool.attribute,
                            type === 'bonus' && builders.damage.bonus.attribute
                          )}
                          required={true}
                          onChange={setFormState}
                        />
                        {formState?.damage?.[type]?.pool?.attribute?.name === 'level' ||
                        formState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                        formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
                        formState?.damage?.[type]?.attribute?.name === 'proficiency' ? (
                          <>
                            {(formState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                              formState?.damage?.[type]?.attribute?.name === 'spellcastingAbility') && (
                              <>
                                {formState.damage?.[type]?.pool?.attribute?.name === 'ability' && (
                                  <Dropdown
                                    name={`damage.${type}.pool.ability.type`}
                                    label='Pool Abilty'
                                    value={formState?.damage?.[type]?.pool?.ability?.type}
                                    options={builders.ability.type}
                                    required={true}
                                    onChange={setFormState}
                                  />
                                )}
                                <Input
                                  name={`damage.${type}.pool.minValue`}
                                  value={formState?.damage?.[type]?.pool?.minValue}
                                  label={`${startCase(type)} Dmg. Min. Value`}
                                  onChange={setFormState}
                                  validation='num'
                                  errorMsg={'Must contain only numbers'}
                                />
                              </>
                            )}
                            <Input
                              name={`damage.${type}.pool.maxValue`}
                              value={formState?.damage?.[type].pool?.maxValue}
                              label={`${startCase(type)} Dmg. Max Value`}
                              onChange={setFormState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                            <Input
                              name={`damage.${type}.pool.multiplier`}
                              value={formState?.damage?.[type]?.pool?.multiplier}
                              label={`${startCase(type)} Dmg. Multiplier`}
                              onChange={setFormState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                          </>
                        ) : (
                          formState.damage?.[type]?.pool?.attribute?.name === 'setValue' && (
                            <Input
                              name={`damage.${type}.pool.setValue`}
                              value={formState?.damage?.[type]?.pool?.setValue}
                              label='Pool Total'
                              onChange={setFormState}
                              validation='num'
                              required={true}
                              errorMsg={'Must contain only numbers'}
                            />
                          )
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          name={`damage.${type}.diceCount`}
                          value={formState?.damage?.[type]?.diceCount}
                          label={`${startCase(type)} Dice Count`}
                          onChange={setFormState}
                          required={type === 'primary' ? true : false}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.diceValue`}
                          value={formState?.damage?.[type]?.diceValue}
                          label={`${startCase(type)} Dice Value`}
                          onChange={setFormState}
                          required={type === 'primary' ? true : false}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ))}
                </Grid>
              )
            })}
            {(formState?.damage?.primary?.attribute?.name === 'diePerLevel' ||
              formState?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
              formState?.damage?.bonus?.attribute?.name === 'diePerLevel') && (
              <Collapse title={`Damage Die By Level`} className={sprinkles({ my: 'size-3' })}>
                <Table
                  name={`damage.diePerLevel`}
                  rows={{
                    inputs: diePerLevelTableColumns().inputs,
                    headers: diePerLevelTableColumns().headers,
                  }}
                  value={formState?.damage?.diePerLevel}
                  addRow={true}
                  onChange={setFormState}
                />
              </Collapse>
            )}
            {(formState?.damage?.primary?.attribute?.name === 'setPerLevel' ||
              formState?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
              formState?.damage?.bonus?.attribute?.name === 'setPerLevel') && (
              <Collapse title={`Set By Level`} className={sprinkles({ my: 'size-3' })}>
                <Table
                  name={`damage.setPerLevel`}
                  rows={{
                    inputs: setPerLevelTableColumns().inputs,
                    headers: setPerLevelTableColumns().headers,
                  }}
                  value={formState?.damage?.setPerLevel}
                  addRow={true}
                  onChange={setFormState}
                />
              </Collapse>
            )}
          </>
        )}
      {formState?.category?.name === 'armor' && (
        <>
          <Divider label={'Armor Stats'} />
          <Grid className={sprinkles({ mb: 'size-3' })}>
            <Input
              validation={'num'}
              name='armorClass'
              errorMsg='Must contain only numbers'
              label='Armor Value'
              required={true}
              value={formState?.armorClass}
              onChange={setFormState}
            />
            <Dropdown
              name='primaryAbility.type'
              label='Primary Ability'
              value={formState?.primaryAbility.type}
              options={builders.ability.type}
              onChange={setFormState}
            />
            {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'maxBonus') && (
              <Input
                validation='num'
                name='maxBonus'
                errorMsg='Must contain only numbers'
                label='Max Bonus'
                required={true}
                value={formState?.maxBonus}
                onChange={setFormState}
              />
            )}
          </Grid>
        </>
      )}
      {formState?.upcast?.attribute?.length > 0 && (
        <>
          <Collapse title='Upcast Table' startOpened={context.type === 'new'} className={sprinkles({ my: 'size-3' })}>
            <Table
              rows={{
                inputs: upcastTableColumns().inputs,
                headers: upcastTableColumns().headers,
              }}
              name='upcast.levelAttribute'
              value={formState?.upcast?.levelAttribute}
              onChange={setFormState}
              addRow={true}
              scrollable='horizontal'
            />
          </Collapse>
        </>
      )}
      {formState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRequirements') &&
        !formState.requirement?.option?.every(
          (formState: any) =>
            formState.name === 'notProficient' ||
            formState.name === 'spellKnown' ||
            formState.name === 'featureKnown' ||
            formState.name === 'optionNotAcquired'
        ) &&
        formState.requirement?.option?.length > 0 && (
          <>
            <Divider label={'Requirements'} />
            <Grid>
              {formState?.requirement?.option?.some((formState: any) => formState.name === 'skillProficiency') && (
                <Dropdown
                  multiSelect={true}
                  name={`requirement.skillProficiency.type`}
                  label='Skill Proficiency'
                  value={formState?.requirement?.skillProficiency?.type}
                  options={builders.skill.type}
                  required={true}
                  onChange={setFormState}
                />
              )}
              {formState?.requirement?.option?.some((formState: any) => formState.name === 'abilityScore') && (
                <>
                  <Dropdown
                    multiSelect={true}
                    name={`requirement.abilityScore.type`}
                    value={formState?.requirement?.abilityScore?.type}
                    label='Ability'
                    options={builders.ability.type}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name={`requirement.abilityScore.score`}
                    value={formState?.requirement?.abilityScore?.score}
                    label='Score'
                    required={true}
                    validation='num'
                    errorMsg='Must contain only numbers'
                    onChange={setFormState}
                  />
                </>
              )}
            </Grid>
            {formState?.requirement?.option?.some(
              (requirementItem: any) => requirementItem.name === 'itemProficiency'
            ) && (
              <>
                <Divider label='Item Proficiency' />
                {formState?.requirement?.itemProficiency?.map((requirementItem: any, requirementIndex: number) => (
                  <Grid className={sprinkles({ mb: 'size-2' })} key={requirementIndex}>
                    <Dropdown
                      name={`requirement.itemProficiency.${requirementIndex}.category`}
                      value={requirementItem?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.itemProficiency.${requirementIndex}.property.type`}
                      value={requirementItem?.property?.type}
                      label='Item Property'
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .flatMap((item: any) => item.property?.type)}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.itemProficiency.${requirementIndex}.item.type`}
                      label='Item type'
                      value={requirementItem?.item?.type}
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .filter((item: any) =>
                          requirementItem?.property?.type?.length > 0
                            ? item.property?.type?.length > 0 &&
                              requirementItem?.property?.type.every((requirementProperty: any) =>
                                item?.property?.type?.some(
                                  (itemProperty: any) => itemProperty._id === requirementProperty._id
                                )
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFormState}
                    />
                    <Group
                      className={sprinkles({ height: 'full' })}
                      alignItemsVariant='center'
                      justifyContentVariant='start'
                    >
                      <Button
                        variant='unstyled'
                        className={clsx(form_add_button, equipment_sub_group_button)}
                        onClick={() =>
                          setFormState({
                            type: 'added',
                            target: {
                              name: `requirement.itemProficiency`,
                            },
                          })
                        }
                      >
                        <TbPlus />
                      </Button>
                      {requirementIndex !== 0 && (
                        <Button
                          variant='unstyled'
                          className={clsx(form_remove_button, equipment_sub_group_button)}
                          onClick={() => {
                            setFormState({
                              type: 'removed',
                              target: {
                                name: `requirement.itemProficiency.${requirementIndex}`,
                              },
                            })
                          }}
                        >
                          <TbX />
                        </Button>
                      )}
                    </Group>
                  </Grid>
                ))}
              </>
            )}
            {formState?.requirement?.option?.some((requirementItem: any) => requirementItem.name === 'equipped') && (
              <>
                <Divider label='Equipped' />
                {formState?.requirement?.equipped?.map((requirementItem: any, requirementIndex: number) => (
                  <Grid className={sprinkles({ mb: 'size-2' })} key={requirementIndex}>
                    <Dropdown
                      name={`requirement.equipped.${requirementIndex}.category`}
                      value={requirementItem?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.equipped.${requirementIndex}.property.type`}
                      value={requirementItem?.property?.type}
                      label='Item Property'
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .flatMap((item: any) => item.property?.type)}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.equipped.${requirementIndex}.item.type`}
                      label='Item type'
                      value={requirementItem?.item?.type}
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .filter((item: any) =>
                          requirementItem?.property?.type?.length > 0
                            ? item.property?.type?.length > 0 &&
                              requirementItem?.property?.type.every((requirementProperty: any) =>
                                item?.property?.type?.some(
                                  (itemProperty: any) => itemProperty._id === requirementProperty._id
                                )
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFormState}
                    />
                    <Input
                      name={`requirement.equipped.${requirementIndex}.numberEquipped`}
                      label='Number Equipped'
                      value={requirementItem?.numberEquipped}
                      onChange={setFormState}
                    />
                    <Group
                      className={sprinkles({ height: 'full' })}
                      alignItemsVariant='center'
                      justifyContentVariant='start'
                    >
                      <Button
                        variant='unstyled'
                        className={clsx(form_add_button, equipment_sub_group_button)}
                        onClick={() =>
                          setFormState({
                            type: 'added',
                            target: {
                              name: `requirement.equipped`,
                            },
                          })
                        }
                      >
                        <TbPlus />
                      </Button>
                      {requirementIndex !== 0 && (
                        <Button
                          variant='unstyled'
                          className={clsx(form_remove_button, equipment_sub_group_button)}
                          onClick={() => {
                            setFormState({
                              type: 'removed',
                              target: {
                                name: `requirement.equipped.${requirementIndex}`,
                              },
                            })
                          }}
                        >
                          <TbX />
                        </Button>
                      )}
                    </Group>
                  </Grid>
                ))}
              </>
            )}
            {formState?.requirement?.option?.some((requirementItem: any) => requirementItem.name === 'notEquipped') && (
              <>
                <Divider label={'Not Equipped'} />
                {formState?.requirement?.notEquipped?.map((requirementItem: any, requirementIndex: number) => (
                  <Grid className={sprinkles({ mb: 'size-2' })} key={requirementIndex}>
                    <Dropdown
                      name={`requirement.notEquipped.${requirementIndex}.category`}
                      value={requirementItem?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.notEquipped.${requirementIndex}.property.type`}
                      value={requirementItem?.property?.type}
                      label='Item Property'
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .flatMap((item: any) => item.property?.type)}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.notEquipped.${requirementIndex}.item.type`}
                      label='Item type'
                      value={requirementItem?.item?.type}
                      options={items
                        ?.filter((item: any) =>
                          requirementItem?.category?._id ? requirementItem?.category?._id === item.category?._id : item
                        )
                        .filter((item: any) =>
                          requirementItem?.property?.type?.length > 0
                            ? item.property?.type?.length > 0 &&
                              requirementItem?.property?.type.every((requirementProperty: any) =>
                                item?.property?.type?.some(
                                  (itemProperty: any) => itemProperty._id === requirementProperty._id
                                )
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFormState}
                    />
                    <Group
                      className={sprinkles({ height: 'full' })}
                      alignItemsVariant='center'
                      justifyContentVariant='start'
                    >
                      <Button
                        variant='unstyled'
                        className={clsx(form_add_button, equipment_sub_group_button)}
                        onClick={() =>
                          setFormState({
                            type: 'added',
                            target: {
                              name: `requirement.notEquipped`,
                            },
                          })
                        }
                      >
                        <TbPlus />
                      </Button>
                      {requirementIndex !== 0 && (
                        <Button
                          variant='unstyled'
                          className={clsx(form_remove_button, equipment_sub_group_button)}
                          onClick={() => {
                            setFormState({
                              type: 'removed',
                              target: {
                                name: `requirement.notEquipped.${requirementIndex}`,
                              },
                            })
                          }}
                        >
                          <TbX />
                        </Button>
                      )}
                    </Group>
                  </Grid>
                ))}
              </>
            )}
          </>
        )}
    </ScrollArea>
  )
})

AttributeForm.displayName = 'AttributeForm'

export default AttributeForm
