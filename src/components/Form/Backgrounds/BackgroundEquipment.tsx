import Button from '../../Button/Button'
import { form_content } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Spinner from '../../Spinner/Spinner'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import { useForm } from '../../../hooks/UseForm'
import Dropdown from '../../Dropdown/Dropdown'
import { Fragment } from 'react/jsx-runtime'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import { TbX } from 'react-icons/tb'
import { useGetSystemsQuery } from '../../../features/systems/systemsApi'
import { useGetEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'

const BackgroundEquipment = () => {
  const isLoading = useIsFetching() > 0

  const { formState, setFormState } = useForm()

  const { data: builders } = useGetSystemsQuery()

  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <Group className={sprinkles({ mb: 'space-3', px: 'space-3' })}>
          <Button
            color='primary'
            style='outline'
            onClick={() =>
              setFormState({
                type: 'added',
                target: {
                  name: 'equipment',
                },
              })
            }
          >
            Add Equipment
          </Button>
        </Group>
        {formState?.equipment?.map((equipment: any, index: any) => (
          <Fragment key={index}>
            <Row
              className={sprinkles({ mb: 'space-3', alignItems: 'flex-end' })}
              cols={{
                start: 0,
                end: 1,
              }}
            >
              <Dropdown
                name={`equipment.${index}.attribute`}
                value={equipment.attribute}
                label='Equipment Attribute(s)'
                options={builders.section.items.attribute}
                multiSelect={true}
                onChange={setFormState}
              />
              <Dropdown
                name={`equipment.${index}.category`}
                value={equipment.category}
                label='Item Category'
                options={builders.items.category.map((category: any) => ({
                  name: category.name,
                  value: category.value,
                  _id: category._id,
                }))}
                onChange={setFormState}
              />
              <Dropdown
                name={`equipment.${index}.properties.type`}
                value={equipment.properties?.type}
                label='Item Properties'
                options={items}
                multiSelect={true}
                filter={[
                  {
                    key: 'category._id',
                    object: equipment,
                    type: 'equal',
                    mapKey: 'properties.type',
                  },
                ]}
                onChange={setFormState}
              />
              <Dropdown
                name={`equipment.${index}.item.type`}
                value={equipment.item?.type}
                label='Item(s)'
                options={items}
                multiSelect={true}
                filter={[
                  {
                    key: 'category._id',
                    object: equipment,
                    type: 'equal',
                  },
                  {
                    key: 'properties.type',
                    object: equipment,
                    type: 'equal',
                  },
                ]}
                onChange={setFormState}
              />
              {equipment.attribute?.some((attribute: any) => attribute.name === 'providesOptions') ? (
                <Input
                  name={`equipment.${index}.selectionCount`}
                  label='Selection Count'
                  value={equipment.selectionCount}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={setFormState}
                />
              ) : (
                <Input
                  name={`equipment.${index}.quantity`}
                  label='Quantity'
                  value={equipment.quantity}
                  errorMsg='Please enter numbers only'
                  validation='num'
                  onChange={setFormState}
                />
              )}
              <Button
                color='danger'
                style='outline'
                onClick={() =>
                  setFormState({
                    type: 'removed',
                    target: {
                      name: `equipment.${index}`,
                    },
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
            value={formState?.currency?.copper}
            errorMsg='Must contain only numbers'
            onChange={setFormState}
          />
          <Input
            validation='num'
            name={`currency.silver`}
            label='SP'
            autoComplete='off'
            value={formState?.currency?.silver}
            errorMsg='Must contain only numbers'
            onChange={setFormState}
          />
          <Input
            validation='num'
            name={`currency.electrum`}
            label='EP'
            autoComplete='off'
            value={formState?.currency?.electrum}
            errorMsg='Must contain only numbers'
            onChange={setFormState}
          />
          <Input
            validation='num'
            name={`currency.gold`}
            label='GP'
            autoComplete='off'
            value={formState?.currency?.gold}
            errorMsg='Must contain only numbers'
            onChange={setFormState}
          />
          <Input
            validation='num'
            name={`currency.platinum`}
            label='PP'
            autoComplete='off'
            value={formState?.currency?.platinum}
            errorMsg='Must contain only numbers'
            onChange={setFormState}
          />
        </Row>
      </ScrollArea>
    </>
  )
}

export default BackgroundEquipment
