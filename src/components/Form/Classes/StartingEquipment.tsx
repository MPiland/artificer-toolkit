import { Fragment, useEffect } from 'react'
import Row from '../../Row/Row'
import Button from '../../Button/Button'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { row_button, form_content } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Divider from '../../Divider/Divider'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'
import Accordion from '../../Accordion/Accordion'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { Class, EquipmentEnum } from '../../../../amplify/gql/types'
import { Attributes, EquipmentCategories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'

const StartingEquipment = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (formData.equipment?.length > 0) {
      const optionIndex = formData.equipment?.length - 1
      console.log({ optionIndex })
      if (optionIndex >= 0) {
        const groupIndex = formData.equipment[optionIndex]?.length - 1
        if (!(groupIndex >= 0)) {
          updateFormData({
            type: 'add',
            path: `equipment.${optionIndex}`,
          })
        }
      } else {
        updateFormData({
          type: 'add',
          path: 'equipment',
        })
      }
    }
  }, [formData.equipment, updateFormData])

  console.log({ formData })

  return (
    <>
      <div className={sprinkles({ mb: 'space-3' })}>
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
      </div>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formData.equipment && (
          <>
            <Accordion dataArray={formData.equipment} name='equipment' onChange={updateFormData}>
              {formData.equipment?.map((equipmentItem, eIndex) => {
                const optionIndex = equipmentItem?.length
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
                      <div className={sprinkles({ mb: 'space-3' })}>
                        <Button
                          color='primary'
                          style='outline'
                          onClick={() => {
                            updateFormData({
                              type: 'add',
                              path: `equipment.${eIndex}.${optionIndex}`,
                            })
                          }}
                        >
                          Add Option
                        </Button>
                      </div>
                      {equipmentItem?.length > 0 &&
                        equipmentItem?.map((option, optionIndex) => {
                          return (
                            <Fragment key={optionIndex}>
                              <>
                                {option?.length > 0 &&
                                  option?.map((group, groupIndex) => {
                                    const multipleOptions = group.attributes?.some(
                                      (attribute) => attribute === Attributes.providesOptions
                                    )
                                    return (
                                      <Group
                                        key={groupIndex}
                                        directionVariant='row'
                                        justifyContentVariant='end'
                                        alignItemsVariant='center'
                                        flexWrapVariant='noWrap'
                                      >
                                        <Row
                                          className={clsx({
                                            [sprinkles({ mb: 'space-3' })]: option.length > 1,
                                          })}
                                          cols={{
                                            lg: group.category === EquipmentCategories.currency ? 7 : 5,
                                          }}
                                          cellSize='default'
                                        >
                                          <Dropdown
                                            name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.attributes`}
                                            multiSelect={true}
                                            options={system.attributes.filter(
                                              (attribute) =>
                                                attribute?.equipment?.length > 0 &&
                                                attribute?.equipment?.includes(EquipmentEnum.classes)
                                            )}
                                            label='Equipment Attributes'
                                            value={group.attributes}
                                            onChange={updateFormData}
                                          />
                                          <Dropdown
                                            name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.category`}
                                            label='Equipment Category'
                                            value={group.category}
                                            options={system.equipment.categories.filter((sCategory) => {
                                              if (group.properties?.length > 0) {
                                                return system.equipment.categoryProperties.some(
                                                  (bridge) =>
                                                    bridge.categoryId === sCategory.id &&
                                                    group.properties.includes(bridge.propertyId)
                                                )
                                              }
                                              return true
                                            })}
                                            onChange={updateFormData}
                                          />
                                          {group.category !== EquipmentCategories.currency && (
                                            <>
                                              <Dropdown
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.properties`}
                                                multiSelect={true}
                                                label='Equipment Properties'
                                                value={group.properties}
                                                options={system.equipment.properties.filter((property) => {
                                                  if (group.category != null) {
                                                    return system.equipment.categoryProperties.some(
                                                      (bridge) =>
                                                        bridge.categoryId === group.category &&
                                                        bridge.propertyId === property.id
                                                    )
                                                  }
                                                  return true
                                                })}
                                                onChange={updateFormData}
                                              />
                                              <Dropdown
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.equipment`}
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
                                                    if (group.properties?.length > 0) {
                                                      return group.properties?.every((property) =>
                                                        sEquipment.properties?.includes(property)
                                                      )
                                                    }
                                                    return true
                                                  })}
                                                onChange={updateFormData}
                                              />
                                              {multipleOptions ? (
                                                <Input
                                                  validation='num'
                                                  name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.selectionCount`}
                                                  label='# of Selections'
                                                  value={group.selectionCount}
                                                  errorMsg='Must contain only numbers'
                                                  required={true}
                                                  onChange={updateFormData}
                                                />
                                              ) : (
                                                <Input
                                                  validation='num'
                                                  name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.quantity`}
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
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.copper`}
                                                label='CP'
                                                value={group.copper}
                                                errorMsg='Must contain only numbers'
                                                onChange={updateFormData}
                                              />
                                              <Input
                                                validation='num'
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.silver`}
                                                label='SP'
                                                autoComplete='off'
                                                value={group.silver}
                                                errorMsg='Must contain only numbers'
                                                onChange={updateFormData}
                                              />
                                              <Input
                                                validation='num'
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.electrum`}
                                                label='EP'
                                                autoComplete='off'
                                                value={group.electrum}
                                                errorMsg='Must contain only numbers'
                                                onChange={updateFormData}
                                              />
                                              <Input
                                                validation='num'
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.gold`}
                                                label='GP'
                                                autoComplete='off'
                                                value={group.gold}
                                                errorMsg='Must contain only numbers'
                                                onChange={updateFormData}
                                              />
                                              <Input
                                                validation='num'
                                                name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.platinum`}
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
                                          className={row_button}
                                          onClick={() => {
                                            if (option?.length === 1) {
                                              if (equipmentItem.length === 1) {
                                                updateFormData({
                                                  type: 'remove',
                                                  path: `equipment.${eIndex}`,
                                                })
                                              } else {
                                                updateFormData({
                                                  type: 'remove',
                                                  path: `equipment.${eIndex}.${optionIndex}`,
                                                })
                                              }
                                            } else {
                                              updateFormData({
                                                type: 'remove',
                                                path: `equipment.${eIndex}.${optionIndex}.${groupIndex}`,
                                              })
                                            }
                                          }}
                                        >
                                          <TbX />
                                        </Button>
                                        <Button
                                          style='unstyled'
                                          className={row_button}
                                          onClick={() =>
                                            updateFormData({
                                              type: 'add',
                                              path: `equipment.${eIndex}.${optionIndex}`,
                                            })
                                          }
                                        >
                                          <TbPlus />
                                        </Button>
                                      </Group>
                                    )
                                  })}
                              </>
                              {optionIndex !== equipmentItem?.length - 1 && <Divider label={'OR'} />}
                            </Fragment>
                          )
                        })}
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
