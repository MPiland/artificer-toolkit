import Button from '../../Button/Button'
import { form_content } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Spinner from '../../Spinner/Spinner'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import { Fragment } from 'react/jsx-runtime'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import { TbX } from 'react-icons/tb'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'
import { Background, EquipmentEnum } from '../../../../amplify/gql/types'
import { Attributes } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'

const BackgroundEquipment = () => {
  const isLoading = useIsFetching() > 0

  const { formData, updateFormData } = use(FormContext) as {
    formData: Background
    updateFormData: (state: UpdateState<Background>) => void
  }

  const { data: system } = useGetSystemQuery()

  const { data: equipment } = useListEquipmentQuery()

  return isLoading || !system || !equipment ? (
    <Spinner />
  ) : (
    <>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <Group className={sprinkles({ mb: 'space-3', px: 'space-3' })}>
          <Button color='primary' style='outline' onClick={() => updateFormData({ type: 'add', path: 'equipment' })}>
            Add Equipment
          </Button>
        </Group>
        {formData?.equipment?.map((equipmentGroup, index) => (
          <Fragment key={index}>
            <Row
              className={sprinkles({ mb: 'space-3', alignItems: 'flex-end' })}
              cols={{
                start: 0,
                end: 1,
              }}
            >
              <Dropdown
                name={`equipment.${index}.attributes`}
                value={equipmentGroup.attributes}
                label='Equipment Attribute(s)'
                options={system.attributes.filter((attribute) => attribute.equipment.includes(EquipmentEnum.all))}
                multiSelect={true}
                onChange={updateFormData}
              />
              <Dropdown
                name={`equipment.${index}.category`}
                value={equipmentGroup.category}
                label='Item Category'
                options={system.equipment.categories.map((category) => ({
                  label: category.label,
                  value: category.value,
                  id: category.id,
                }))}
                onChange={updateFormData}
              />
              <Dropdown
                name={`equipment.${index}.properties`}
                value={equipmentGroup.properties}
                label='Item Properties'
                options={equipment.map((equipment) => ({
                  label: equipment.label,
                  value: equipment.value,
                  id: equipment.id,
                }))}
                multiSelect={true}
                onChange={updateFormData}
              />
              <Dropdown
                name={`equipment.${index}.equipment`}
                value={equipmentGroup.equipment}
                label='Item(s)'
                options={equipment.map((equipment) => {
                  return {
                    label: equipment.label,
                    value: equipment.value,
                    id: equipment.id,
                  }
                })}
                multiSelect={true}
                onChange={updateFormData}
              />
              {equipmentGroup.attributes?.some((attribute) => attribute === Attributes.providesOptions) ? (
                <Input
                  name={`equipment.${index}.selectionCount`}
                  label='Selection Count'
                  value={equipmentGroup.selectionCount}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={updateFormData}
                />
              ) : (
                <Input
                  name={`equipment.${index}.quantity`}
                  label='Quantity'
                  value={equipmentGroup.quantity}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={updateFormData}
                />
              )}
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
            </Row>
          </Fragment>
        ))}
        <Row>
          <Input
            validation='num'
            name={`currency.copper`}
            label='CP'
            autoComplete='off'
            value={formData?.currency?.copper}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
          <Input
            validation='num'
            name={`currency.silver`}
            label='SP'
            autoComplete='off'
            value={formData?.currency?.silver}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
          <Input
            validation='num'
            name={`currency.electrum`}
            label='EP'
            autoComplete='off'
            value={formData?.currency?.electrum}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
          <Input
            validation='num'
            name={`currency.gold`}
            label='GP'
            autoComplete='off'
            value={formData?.currency?.gold}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
          <Input
            validation='num'
            name={`currency.platinum`}
            label='PP'
            autoComplete='off'
            value={formData?.currency?.platinum}
            errorMsg='Must contain only numbers'
            onChange={updateFormData}
          />
        </Row>
      </ScrollArea>
    </>
  )
}

export default BackgroundEquipment
