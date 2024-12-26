import { Fragment, useEffect } from 'react'
import Row from '../../Row/Row'
import Button from '../../Button/Button'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import {
  equipment_form_sub_group,
  equipment_sub_group_button,
  form_add_button,
  form_content,
  form_remove_button,
} from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Divider from '../../Divider/Divider'
import Spinner from '../../Spinner/Spinner'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'
import Accordion from '../../Accordion/Accordion'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'
import { Class, EquipmentEnum } from '../../../../amplify/API'
import { Attributes, EquipmentCategories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import FormContext from '../FormContext'

const StartingEquipment = () => {
  const isLoading = useIsFetching() > 0

  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (formData.equipment?.length > 0) {
      const eIndex = formData.equipment?.length - 1
      if (eIndex >= 0) {
        const optionIndex = formData.equipment[eIndex].options?.length - 1
        if (optionIndex >= 0) {
          if (!(formData.equipment[eIndex].options[optionIndex]?.groups?.length > 0)) {
            updateFormData({
              type: 'add',
              path: `equipment.${eIndex}.options.${optionIndex}.groups`,
            })
          }
        } else {
          updateFormData({
            type: 'add',
            path: `equipment.${eIndex}.options`,
          })
        }
      }
    }
  }, [formData.equipment, updateFormData])

  return isLoading || !equipment ? (
    <Spinner />
  ) : (
    <>
      <Group className={sprinkles({ mb: 'space-3', px: 'space-3' })}>
        <Button
          color='primary'
          style='outline'
          onClick={() => {
            updateFormData({
              type: 'add',
              path: 'equipment',
            })
          }}
        >
          Add Equipment Group
        </Button>
      </Group>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formData.equipment && (
          <>
            <Accordion dataArray={formData.equipment} name='equipment' onChange={updateFormData}>
              {formData.equipment?.map((equipmentItem, eIndex) => {
                return (
                  <Accordion.Wrapper key={eIndex} itemId={String(eIndex)}>
                    <Accordion.Header
                      handleRemove={() =>
                        updateFormData({
                          type: 'remove',
                          path: `equipment.${eIndex}`,
                        })
                      }
                      key={eIndex}
                    >
                      {`Equipment Group ${eIndex + 1}`}
                    </Accordion.Header>
                    <Accordion.Content>
                      <Group className={sprinkles({ mb: 'space-3' })}>
                        <Button
                          color='primary'
                          style='outline'
                          onClick={() => {
                            const optionIndex = equipmentItem.options?.length
                            updateFormData({
                              type: 'add',
                              path: `equipment.${eIndex}.options.${optionIndex}.groups`,
                            })
                          }}
                        >
                          Add Option
                        </Button>
                      </Group>
                      {equipmentItem.options?.length > 0 &&
                        equipmentItem.options?.map((option, optionIndex) => (
                          <Fragment key={optionIndex}>
                            <>
                              {option.groups?.map((group, groupIndex) => {
                                const multipleOptions = group.attributes?.some(
                                  (attribute) => attribute === Attributes.providesOptions
                                )
                                return (
                                  <Group key={groupIndex} className={equipment_form_sub_group}>
                                    <Row
                                      className={clsx({
                                        [sprinkles({ mb: 'space-3' })]: option.groups.length > 1,
                                      })}
                                      cols={{
                                        lg: group.category === EquipmentCategories.currency ? 7 : 5,
                                      }}
                                    >
                                      <Dropdown
                                        name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.attributes`}
                                        multiSelect={true}
                                        options={system.attributes.filter((attribute) =>
                                          attribute.equipment.includes(EquipmentEnum.classes)
                                        )}
                                        label='Equipment Attributes'
                                        value={group.attributes}
                                        onChange={updateFormData}
                                      />
                                      <Dropdown
                                        name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.category`}
                                        label='Equipment Category'
                                        value={group.category}
                                        options={system.equipment.categories}
                                        onChange={updateFormData}
                                      />
                                      {group.category !== EquipmentCategories.currency && (
                                        <>
                                          <Dropdown
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.properties`}
                                            multiSelect={true}
                                            label='Item Properties'
                                            value={group.properties}
                                            options={equipment.map((equipment) => ({
                                              label: equipment.label,
                                              value: equipment.value,
                                              id: equipment.id,
                                            }))}
                                            filters={[
                                              {
                                                key: 'category',
                                                dataObject: group,
                                                type: 'equal',
                                                mapKey: 'properties',
                                              },
                                            ]}
                                            onChange={updateFormData}
                                          />
                                          <Dropdown
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.equipment`}
                                            multiSelect={true}
                                            label='Item Type'
                                            value={group.equipment}
                                            options={equipment}
                                            filters={[
                                              {
                                                key: 'category',
                                                dataObject: group,
                                                type: 'equal',
                                              },
                                              {
                                                key: 'properties',
                                                dataObject: group,
                                                type: 'equal',
                                              },
                                            ]}
                                            onChange={updateFormData}
                                          />
                                          {multipleOptions ? (
                                            <Input
                                              validation='num'
                                              name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.selectionCount`}
                                              label='# of Selections'
                                              value={group.selectionCount}
                                              errorMsg='Must contain only numbers'
                                              required={true}
                                              onChange={updateFormData}
                                            />
                                          ) : (
                                            <Input
                                              validation='num'
                                              name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.quantity`}
                                              label='Quantity'
                                              value={group.quantity}
                                              errorMsg='Must contain only numbers'
                                              required={true}
                                              onChange={updateFormData}
                                            />
                                          )}
                                        </>
                                      )}
                                      {group.category === EquipmentCategories.currency && (
                                        <>
                                          <Input
                                            validation='num'
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.copper`}
                                            label='CP'
                                            value={group.copper}
                                            errorMsg='Must contain only numbers'
                                            onChange={updateFormData}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.silver`}
                                            label='SP'
                                            autoComplete='off'
                                            value={group.silver}
                                            errorMsg='Must contain only numbers'
                                            onChange={updateFormData}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.electrum`}
                                            label='EP'
                                            autoComplete='off'
                                            value={group.electrum}
                                            errorMsg='Must contain only numbers'
                                            onChange={updateFormData}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.gold`}
                                            label='GP'
                                            autoComplete='off'
                                            value={group.gold}
                                            errorMsg='Must contain only numbers'
                                            onChange={updateFormData}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}.platinum`}
                                            label='PP'
                                            autoComplete='off'
                                            value={group.platinum}
                                            errorMsg='Must contain only numbers'
                                            onChange={updateFormData}
                                          />
                                        </>
                                      )}
                                    </Row>
                                    <Button
                                      style='unstyled'
                                      className={clsx(form_remove_button, equipment_sub_group_button)}
                                      onClick={() => {
                                        if (option.groups?.length === 1) {
                                          if (equipmentItem.options.length === 1) {
                                            updateFormData({
                                              type: 'remove',
                                              path: `equipment.${eIndex}`,
                                            })
                                          } else {
                                            updateFormData({
                                              type: 'remove',
                                              path: `equipment.${eIndex}.options.${optionIndex}`,
                                            })
                                          }
                                        } else {
                                          updateFormData({
                                            type: 'remove',
                                            path: `equipment.${eIndex}.options.${optionIndex}.groups.${groupIndex}`,
                                          })
                                        }
                                      }}
                                    >
                                      <TbX />
                                    </Button>
                                    <Button
                                      style='unstyled'
                                      className={clsx(form_add_button, equipment_sub_group_button)}
                                      onClick={() =>
                                        updateFormData({
                                          type: 'add',
                                          path: `equipment.${eIndex}.options.${optionIndex}.groups`,
                                        })
                                      }
                                    >
                                      <TbPlus />
                                    </Button>
                                  </Group>
                                )
                              })}
                            </>
                            {optionIndex !== equipmentItem.options?.length - 1 && <Divider label={'OR'} />}
                          </Fragment>
                        ))}
                    </Accordion.Content>
                  </Accordion.Wrapper>
                )
              })}
            </Accordion>
          </>
        )}
      </ScrollArea>
    </>
  )
}

export default StartingEquipment
