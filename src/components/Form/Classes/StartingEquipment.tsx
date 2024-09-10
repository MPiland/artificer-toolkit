import { Fragment, useEffect } from 'react'
import Row from '../../Row/Row'
import Button from '../../Button/Button'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { DropdownOptionType } from '../../../utils/types'
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
import { useForm } from '../../../hooks/UseForm'
import { useGetSystemsQuery } from '../../../features/systems/systemsApi'
import { useGetEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'

const StartingEquipment = () => {
  const isLoading = useIsFetching() > 0

  const { context, formState, setFormState } = useForm()

  const { data: builders } = useGetSystemsQuery()
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  useEffect(() => {
    if (formState.equipment?.length > 0) {
      const equipmentIndex = formState.equipment?.length - 1
      if (equipmentIndex >= 0) {
        const optionIndex = formState.equipment[equipmentIndex].options?.length - 1
        if (optionIndex >= 0) {
          if (!(formState.equipment[equipmentIndex].options[optionIndex]?.group?.length > 0)) {
            setFormState({
              type: 'added',
              target: {
                name: `equipment.${equipmentIndex}.options.${optionIndex}.group`,
              },
            })
          }
        } else {
          setFormState({
            type: 'added',
            target: {
              name: `equipment.${equipmentIndex}.options`,
            },
          })
        }
      }
    }
  }, [formState.equipment, setFormState])

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
      <Group className={sprinkles({ mb: 'space-3', px: 'space-3' })}>
        {context.title === 'classes' && (
          <Button
            color='primary'
            style='outline'
            onClick={() => {
              setFormState({
                type: 'added',
                target: { name: 'equipment' },
              })
            }}
          >
            Add Equipment Group
          </Button>
        )}
      </Group>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formState.equipment && (
          <>
            <Accordion dataArray={formState.equipment} name='equipment' setState={setFormState}>
              {formState.equipment?.map((equipmentItem: any, equipmentIndex: number) => {
                return (
                  <Accordion.Wrapper key={equipmentIndex} itemId={String(equipmentIndex)}>
                    <Accordion.Header
                      handleRemove={() =>
                        setFormState({
                          type: 'removed',
                          target: { name: `equipment.${equipmentIndex}` },
                        })
                      }
                      key={equipmentIndex}
                    >
                      {`Equipment Group ${equipmentIndex + 1}`}
                    </Accordion.Header>
                    <Accordion.Content>
                      <Group className={sprinkles({ mb: 'space-3' })}>
                        <Button
                          color='primary'
                          style='outline'
                          onClick={() => {
                            const optionIndex = equipmentItem.options?.length
                            setFormState({
                              type: 'added',
                              target: {
                                name: `equipment.${equipmentIndex}.options.${optionIndex}.group`,
                              },
                            })
                          }}
                        >
                          Add Option
                        </Button>
                      </Group>
                      {equipmentItem.options?.length > 0 &&
                        equipmentItem.options?.map((optionItem: any, optionIndex: number) => (
                          <Fragment key={optionIndex}>
                            <>
                              {optionItem.group?.map((groupItem: any, groupIndex: number) => {
                                const multipleOptions = groupItem.attribute?.some(
                                  (attributequipmentItem: any) => attributequipmentItem.name === 'providesOptions'
                                )
                                return (
                                  <Group key={groupIndex} className={equipment_form_sub_group}>
                                    <Row
                                      className={clsx({
                                        [sprinkles({ mb: 'space-3' })]: optionItem.group.length > 1,
                                      })}
                                      cols={{
                                        lg: groupItem.category?.name === 'currency' ? 7 : 5,
                                      }}
                                    >
                                      <Dropdown
                                        name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.attribute`}
                                        multiSelect={true}
                                        options={builders.section.items.attribute}
                                        label='Equipment Attributes'
                                        value={groupItem.attribute}
                                        onChange={setFormState}
                                      />
                                      <Dropdown
                                        name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.category`}
                                        label='Item Category'
                                        value={groupItem.category}
                                        options={builders.items.category}
                                        onChange={setFormState}
                                      />
                                      {groupItem.category?.name !== 'currency' && (
                                        <>
                                          <Dropdown
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.properties.type`}
                                            multiSelect={true}
                                            label='Item Properties'
                                            value={groupItem.properties?.type}
                                            options={items as DropdownOptionType[]}
                                            filter={[
                                              {
                                                key: 'category._id',
                                                object: groupItem,
                                                type: 'equal',
                                                mapKey: 'properties.type',
                                              },
                                            ]}
                                            onChange={setFormState}
                                          />
                                          <Dropdown
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.item.type`}
                                            multiSelect={true}
                                            label='Item Type'
                                            value={groupItem.item?.type}
                                            options={items as DropdownOptionType[]}
                                            filter={[
                                              {
                                                key: 'category._id',
                                                object: groupItem,
                                                type: 'equal',
                                              },
                                              {
                                                key: 'properties.type',
                                                object: groupItem,
                                                type: 'equal',
                                              },
                                            ]}
                                            onChange={setFormState}
                                          />
                                          {multipleOptions ? (
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.selectionCount`}
                                              label='# of Selections'
                                              autoComplete='off'
                                              value={groupItem.selectionCount}
                                              errorMsg='Must contain only numbers'
                                              required={true}
                                              onChange={setFormState}
                                            />
                                          ) : (
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.quantity`}
                                              label='Quantity'
                                              autoComplete='off'
                                              value={groupItem.quantity}
                                              errorMsg='Must contain only numbers'
                                              required={true}
                                              onChange={setFormState}
                                            />
                                          )}
                                        </>
                                      )}
                                      {groupItem.category?.name === 'currency' && (
                                        <>
                                          <Input
                                            validation='num'
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.copper`}
                                            label='CP'
                                            autoComplete='off'
                                            value={groupItem.copper}
                                            errorMsg='Must contain only numbers'
                                            onChange={setFormState}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.silver`}
                                            label='SP'
                                            autoComplete='off'
                                            value={groupItem.silver}
                                            errorMsg='Must contain only numbers'
                                            onChange={setFormState}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.electrum`}
                                            label='EP'
                                            autoComplete='off'
                                            value={groupItem.electrum}
                                            errorMsg='Must contain only numbers'
                                            onChange={setFormState}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.gold`}
                                            label='GP'
                                            autoComplete='off'
                                            value={groupItem.gold}
                                            errorMsg='Must contain only numbers'
                                            onChange={setFormState}
                                          />
                                          <Input
                                            validation='num'
                                            name={`equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}.platinum`}
                                            label='PP'
                                            autoComplete='off'
                                            value={groupItem.platinum}
                                            errorMsg='Must contain only numbers'
                                            onChange={setFormState}
                                          />
                                        </>
                                      )}
                                    </Row>
                                    <Button
                                      style='unstyled'
                                      className={clsx(form_remove_button, equipment_sub_group_button)}
                                      onClick={() => {
                                        if (optionItem.equipment?.length === 1) {
                                          if (equipmentItem.options.length === 1) {
                                            setFormState({
                                              type: 'removed',
                                              target: {
                                                name: `equipment.${equipmentIndex}`,
                                              },
                                            })
                                          } else {
                                            setFormState({
                                              type: 'removed',
                                              target: {
                                                name: `equipment.${equipmentIndex}.options.${optionIndex}`,
                                              },
                                            })
                                          }
                                        } else {
                                          setFormState({
                                            type: 'removed',
                                            target: {
                                              name: `equipment.${equipmentIndex}.options.${optionIndex}.group.${groupIndex}`,
                                            },
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
                                        setFormState({
                                          type: 'added',
                                          target: {
                                            name: `equipment.${equipmentIndex}.options.${optionIndex}.group`,
                                          },
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
