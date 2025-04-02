import { Fragment } from 'react'
import Button from '../../../Button/Button'
import { TbPlus, TbX } from 'react-icons/tb'
import Grid from '../../../Grid/Grid'
import { row_button } from '../../Form.css'
import { UpdateState } from '../../../../types/form'
import { Background, Class } from '../../../../../amplify/gql/types'
import { FormContext } from '../../FormContext'
import { use } from 'react'
import { useGetSystemQuery } from '../../../../apis/systemsApi'
import { useListEquipmentQuery } from '../../../../apis/equipmentApi'
import { Attributes } from '../../../../types/enums'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { EquipmentEnum } from '../../../../../amplify/gql/types'
import { ClassEquipment, BackgroundEquipment } from '../../../../../amplify/gql/types'

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
  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Class | Background
    updateFormData: (state: UpdateState<Class | Background>) => void
  }

  const multipleOptions = group.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  const renderCurrencyInputs = () => {
    return (
      <Grid.Item>
        <Grid>
          {system.currencies.map((currency, cIndex) => (
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
                onChange={updateFormData}
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
          options={system.equipment.properties.filter((property) => {
            if (group.category != null) {
              return system.equipment.categoryProperties.some(
                (bridge) => bridge.categoryId === group.category && bridge.propertyId === property.id
              )
            }
            return true
          })}
          onChange={updateFormData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
        <Dropdown
          name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.equipment`}
          multiSelect={true}
          label='Equipment'
          value={group.equipment}
          options={equipment
            .filter((sEquipment) => {
              if (group.category != null) {
                return sEquipment.category === group.category
              }
              return true
            })
            .filter((sEquipment) => {
              if (group.properties?.length) {
                return group.properties?.every((property) => sEquipment.properties?.includes(property))
              }
              return true
            })}
          onChange={updateFormData}
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
            onChange={updateFormData}
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
            onChange={updateFormData}
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
              options={system.attributes.filter(
                (attribute) =>
                  attribute?.equipment?.length &&
                  ((formData?.__typename === 'Class' && attribute?.equipment?.includes(EquipmentEnum.classes)) ||
                    (formData?.__typename === 'Background' &&
                      attribute?.equipment?.includes(EquipmentEnum.backgrounds)))
              )}
              label='Equipment Attributes'
              value={group.attributes}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
            <Dropdown
              name={`equipment.${equipmentIndex}.${optionIndex}.${groupIndex}.category`}
              label='Equipment Category'
              value={group.category}
              options={system.equipment.categories.filter((sCategory) => {
                if (group.properties?.length) {
                  return system.equipment.categoryProperties.some(
                    (bridge) =>
                      bridge.categoryId === sCategory.id &&
                      group.properties?.length &&
                      group.properties.includes(bridge.propertyId)
                  )
                }
                return true
              })}
              onChange={updateFormData}
            />
          </Grid.Item>
          {renderEquipmentInputs()}
          {group?.attributes?.some((attribute) => attribute === Attributes?.containsCurrency) && renderCurrencyInputs()}
        </Grid>
      </Grid.Item>
      <Grid.Item colSpan={'auto'} justify='start'>
        <Button
          style='unstyled'
          className={row_button}
          onClick={() =>
            updateFormData({
              type: 'add',
              path: `equipment.${equipmentIndex}.${optionIndex}`,
            })
          }
        >
          <TbPlus />
        </Button>
        <Button
          style='unstyled'
          className={row_button}
          onClick={() => {
            if (optionLength === 1) {
              if (equipmentLength === 1) {
                updateFormData({
                  type: 'remove',
                  path: `equipment.${equipmentIndex}`,
                })
              } else {
                updateFormData({
                  type: 'remove',
                  path: `equipment.${equipmentIndex}.${optionIndex}`,
                })
              }
            } else {
              updateFormData({
                type: 'remove',
                path: `equipment.${equipmentIndex}.${optionIndex}.${groupIndex}`,
              })
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
