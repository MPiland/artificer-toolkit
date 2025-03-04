import { Fragment, useEffect } from 'react'
import Button from '../../Button/Button'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { row_button } from '../Form.css'
import Divider from '../../Divider/Divider'
import { sprinkles } from '../../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import Accordion from '../../Accordion/Accordion'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { Class, EquipmentEnum } from '../../../../amplify/gql/types'
import { Attributes, EquipmentCategories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Grid from '../../Grid/Grid'

const StartingEquipment = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (formData.equipment?.length > 0) {
      formData.equipment?.forEach((option, oIndex) => {
        if (!(option.length > 0)) {
          updateFormData({
            type: 'add',
            path: `equipment.${oIndex}`,
            value: [[]],
          })
        }
      })
    }
  }, [formData.equipment, updateFormData])

  return (
    <Grid>
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={2}>
            <Button
              color='primary'
              style='outline'
              onClick={() => {
                updateFormData({
                  type: 'add',
                  path: 'equipment',
                  value: [[]],
                })
              }}
            >
              Add Equipment Group
            </Button>
          </Grid.Item>
        </Grid>
      </Grid.Item>
      {formData.equipment && (
        <Grid.Item>
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
                    <Grid>
                      <Grid.Item colSpan={2}>
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
                      </Grid.Item>
                      <Grid.Item>
                        {equipmentItem?.length > 0 &&
                          equipmentItem?.map((option, optionIndex) => {
                            return (
                              <Fragment key={optionIndex}>
                                <Grid>
                                  {option?.length > 0 &&
                                    option?.map((group, groupIndex) => {
                                      const multipleOptions = group.attributes?.some(
                                        (attribute) => attribute === Attributes.providesOptions
                                      )
                                      return (
                                        <Fragment key={groupIndex}>
                                          <Grid.Item colSpan={11}>
                                            <Grid>
                                              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
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
                                              </Grid.Item>
                                              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
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
                                              </Grid.Item>
                                              {group.category !== EquipmentCategories.currency && (
                                                <>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
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
                                                  </Grid.Item>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
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
                                                  </Grid.Item>
                                                  {multipleOptions ? (
                                                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                      <Input
                                                        validation='num'
                                                        name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.selectionCount`}
                                                        label='# of Selections'
                                                        value={group.selectionCount}
                                                        errorMsg='Must contain only numbers'
                                                        required={true}
                                                        onChange={updateFormData}
                                                      />
                                                    </Grid.Item>
                                                  ) : (
                                                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                      <Input
                                                        validation='num'
                                                        name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.quantity`}
                                                        label='Quantity'
                                                        value={group.quantity}
                                                        errorMsg='Must contain only numbers'
                                                        required={true}
                                                        onChange={updateFormData}
                                                      />
                                                    </Grid.Item>
                                                  )}
                                                </>
                                              )}
                                              {group.category === EquipmentCategories.currency && (
                                                <>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.copper`}
                                                      label='CP'
                                                      value={group.copper}
                                                      errorMsg='Must contain only numbers'
                                                      onChange={updateFormData}
                                                    />
                                                  </Grid.Item>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.silver`}
                                                      label='SP'
                                                      autoComplete='off'
                                                      value={group.silver}
                                                      errorMsg='Must contain only numbers'
                                                      onChange={updateFormData}
                                                    />
                                                  </Grid.Item>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.electrum`}
                                                      label='EP'
                                                      autoComplete='off'
                                                      value={group.electrum}
                                                      errorMsg='Must contain only numbers'
                                                      onChange={updateFormData}
                                                    />
                                                  </Grid.Item>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.gold`}
                                                      label='GP'
                                                      autoComplete='off'
                                                      value={group.gold}
                                                      errorMsg='Must contain only numbers'
                                                      onChange={updateFormData}
                                                    />
                                                  </Grid.Item>
                                                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${eIndex}.${optionIndex}.${groupIndex}.platinum`}
                                                      label='PP'
                                                      autoComplete='off'
                                                      value={group.platinum}
                                                      errorMsg='Must contain only numbers'
                                                      onChange={updateFormData}
                                                    />
                                                  </Grid.Item>
                                                </>
                                              )}
                                            </Grid>
                                          </Grid.Item>
                                          <Grid.Item colSpan={1} className={sprinkles({ display: 'flex' })}>
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
                                          </Grid.Item>
                                        </Fragment>
                                      )
                                    })}
                                </Grid>
                                {optionIndex !== equipmentItem?.length - 1 && <Divider label={'OR'} />}
                              </Fragment>
                            )
                          })}
                      </Grid.Item>
                    </Grid>
                  </Accordion.Content>
                </Accordion.Wrapper>
              )
            })}
          </Accordion>
        </Grid.Item>
      )}
    </Grid>
  )
}

export default StartingEquipment
