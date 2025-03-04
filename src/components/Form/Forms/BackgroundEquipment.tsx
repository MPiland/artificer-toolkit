import Button from '../../Button/Button'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { TbX } from 'react-icons/tb'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { Background, EquipmentEnum } from '../../../../amplify/gql/types'
import { Attributes } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Grid from '../../Grid/Grid'
import Divider from '../../Divider/Divider'

const BackgroundEquipment = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Background
    updateFormData: (state: UpdateState<Background>) => void
  }

  const { data: system } = useGetSystemQuery()

  const { data: equipment } = useListEquipmentQuery()

  return (
    <>
      <Group className={sprinkles({ mb: 'space-3', px: 'space-3' })}>
        <Button color='primary' style='outline' onClick={() => updateFormData({ type: 'add', path: 'equipment' })}>
          Add Equipment
        </Button>
      </Group>
      {formData?.equipment?.map((equipmentGroup, index) => {
        return (
          <Grid key={index} className={sprinkles({ mb: 'space-3' })}>
            <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
              <Dropdown
                name={`equipment.${index}.attributes`}
                value={equipmentGroup.attributes}
                label='Equipment Attribute(s)'
                options={system.attributes.filter(
                  (attribute) => attribute?.equipment?.length > 0 && attribute?.equipment?.includes(EquipmentEnum.all)
                )}
                multiSelect={true}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
              <Dropdown
                name={`equipment.${index}.category`}
                value={equipmentGroup.category}
                label='Equipment Category'
                options={system.equipment.categories
                  .filter((category) =>
                    equipment
                      .filter((equipment) => {
                        return equipmentGroup?.attributes?.length > 0
                          ? equipment?.attributes?.some((attribute) => equipmentGroup?.attributes?.includes(attribute))
                          : true
                      })
                      ?.some((equipment) => equipment.category === category.id)
                  )
                  .map((cagtegory) => ({
                    id: cagtegory.id,
                    label: cagtegory.label,
                    value: cagtegory.value,
                  }))}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
              <Dropdown
                name={`equipment.${index}.properties`}
                value={equipmentGroup.properties}
                label='Equipment Properties'
                options={equipment
                  .filter((equipment) =>
                    equipmentGroup?.category ? equipment.category === equipmentGroup.category : true
                  )
                  .flatMap((equipment) =>
                    equipment?.properties?.map((property) => {
                      const fullProperty = system.equipment.properties.find((sProperty) => sProperty.id === property)
                      if (!fullProperty) return null
                      return {
                        label: fullProperty.label,
                        value: property,
                        id: fullProperty.id,
                      }
                    })
                  )}
                multiSelect={true}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
              <Dropdown
                name={`equipment.${index}.equipment`}
                value={equipmentGroup.equipment}
                label='Equipment'
                options={equipment.filter(
                  (equipment) =>
                    (equipmentGroup?.category ? equipment.category === equipmentGroup.category : true) &&
                    (equipmentGroup?.properties?.length > 0
                      ? equipment?.properties?.some((property) => equipmentGroup?.properties?.includes(property))
                      : true)
                )}
                multiSelect={true}
                onChange={updateFormData}
              />
            </Grid.Item>
            {equipmentGroup.attributes?.some((attribute) => attribute === Attributes.providesOptions) ? (
              <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
                <Input
                  name={`equipment.${index}.selectionCount`}
                  label='Selection Count'
                  value={equipmentGroup.selectionCount}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={updateFormData}
                />
              </Grid.Item>
            ) : (
              <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
                <Input
                  name={`equipment.${index}.quantity`}
                  label='Quantity'
                  value={equipmentGroup.quantity}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={updateFormData}
                />
              </Grid.Item>
            )}
            <Grid.Item colSpan={{ sm: 6, md: 1 }} className={sprinkles({ alignContent: 'flex-end' })}>
              <Button
                color='danger'
                style='outline'
                onClick={() =>
                  updateFormData({
                    type: 'remove',
                    path: `equipment.${index}`,
                  })
                }
              >
                <TbX />
              </Button>
            </Grid.Item>
          </Grid>
        )
      })}
      <Divider label='Currency' />
      <Grid>
        <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
          <Input
            validation='num'
            name={`currency.copper`}
            label='CP'
            autoComplete='off'
            value={formData?.currency?.copper}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
          <Input
            validation='num'
            name={`currency.silver`}
            label='SP'
            autoComplete='off'
            value={formData?.currency?.silver}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
          <Input
            validation='num'
            name={`currency.electrum`}
            label='EP'
            autoComplete='off'
            value={formData?.currency?.electrum}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
          <Input
            validation='num'
            name={`currency.gold`}
            label='GP'
            autoComplete='off'
            value={formData?.currency?.gold}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 'auto' }}>
          <Input
            validation='num'
            name={`currency.platinum`}
            label='PP'
            autoComplete='off'
            value={formData?.currency?.platinum}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Grid.Item>
      </Grid>
    </>
  )
}

export default BackgroundEquipment
