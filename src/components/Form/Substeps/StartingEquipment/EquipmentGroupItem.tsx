import { Fragment } from 'react'
import Button from '@/components/Button'
import { TbPlus, TbX } from 'react-icons/tb'
import Grid from '@/components/Grid'
import { row_button } from '../../Form.css'
import { FormContext } from '../../FormContext'
import { use } from 'react'
import { Attributes, Equipments } from '@/enums'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { useSystemData, useEquipmentData } from '@/hooks'
import type { OnChange, Background, Class, ClassEquipment, BackgroundEquipment } from '@/types'

// Add more specific typing for the group object
type EquipmentGroupItemProps = {
  group: ClassEquipment | BackgroundEquipment
  equipmentIndex: number
  optionIndex: number
  groupIndex: number
  optionLength: number
  equipmentLength: number
}

const EquipmentGroupItem = ({
  group,
  equipmentIndex,
  optionIndex,
  groupIndex,
  optionLength,
  equipmentLength,
}: EquipmentGroupItemProps) => {
  const { attributes, equipment, currencies } = useSystemData()
  const {
    equipment: { filterByCategory },
  } = useEquipmentData()

  const {
    formStore: { data, updateField, removeField, addField },
  } = use(FormContext) as {
    formStore: {
      data: Class | Background
      updateField: OnChange<Class | Background>['updateField']
      removeField: OnChange<Class | Background>['removeField']
      addField: OnChange<Class | Background>['addField']
    }
  }

  const multipleOptions = group.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)

  const renderCurrencyInputs = () => {
    return (
      <Grid.Item>
        <Grid>
          {currencies.map((currency, cIndex) => (
            <Grid.Item
              key={`${equipmentIndex}-${optionIndex}-${groupIndex}-${cIndex}`}
              colSpan={{ sm: 6, md: 4, lg: 'auto' }}
            >
              <Input
                validation='num'
                name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.currencies.${cIndex}.amount`}
                label={currency.label}
                value={group?.currencies?.[cIndex]?.amount}
                errorMsg='Must contain only numbers'
                onChange={{ updateField }}
              />
            </Grid.Item>
          ))}
        </Grid>
      </Grid.Item>
    )
  }

  const renderEquipmentInputs = () => (
    <>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
        <Dropdown
          name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.properties`}
          multiSelect={true}
          label='Equipment Properties'
          value={group.properties}
          options={equipment.properties.filterByCategory(group.category)}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
        <Dropdown
          name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.equipment`}
          multiSelect={true}
          label='Equipment'
          value={group.equipment}
          options={filterByCategory(group.category).filterByEveryProperty(group.properties)}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {multipleOptions ?
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
          <Input
            validation='num'
            name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.selectionCount`}
            label='# of Selections'
            value={group.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={{ updateField }}
          />
        </Grid.Item>
      : <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
          <Input
            validation='num'
            name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.quantity`}
            label='Quantity'
            value={group.quantity}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={{ updateField }}
          />
        </Grid.Item>
      }
    </>
  )

  return (
    <Fragment>
      <Grid.Item colSpan={11}>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
            <Dropdown
              name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.attributes`}
              multiSelect={true}
              options={attributes.filter(
                (attribute) =>
                  attribute?.equipment?.length &&
                  ((data?.__typename === 'Class' && attribute?.equipment?.includes(Equipments.CLASS)) ||
                    (data?.__typename === 'Background' && attribute?.equipment?.includes(Equipments.BACKGROUND)))
              )}
              label='Equipment Attributes'
              value={group.attributes}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
            <Dropdown
              name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.category`}
              label='Equipment Category'
              value={group.category}
              options={equipment.categories}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {renderEquipmentInputs()}
          {group?.attributes?.some((attribute) => attribute === Attributes?.CONTAINS_CURRENCY) &&
            renderCurrencyInputs()}
        </Grid>
      </Grid.Item>
      <Grid.Item colSpan={'auto'} justify='start'>
        <Button
          style='unstyled'
          className={row_button}
          onClick={() => addField({ path: `equipment.${equipmentIndex}.${optionIndex}` })}
        >
          <TbPlus />
        </Button>
        <Button
          style='unstyled'
          className={row_button}
          onClick={() => {
            if (optionLength === 1) {
              if (equipmentLength === 1) {
                removeField({ path: `equipment.${equipmentIndex}` })
              } else {
                removeField({ path: `equipment.${equipmentIndex}.${optionIndex}` })
              }
            } else {
              removeField({ path: `equipment.${equipmentIndex}.${optionIndex}.${groupIndex}` })
            }
          }}
        >
          <TbX />
        </Button>
      </Grid.Item>
    </Fragment>
  )
}

export default EquipmentGroupItem
