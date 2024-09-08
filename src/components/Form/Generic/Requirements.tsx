import { useGetBuildersQuery } from '../../../features/builders/buildersApi'
import { useForm } from '../../../hooks/UseForm'
import { sprinkles } from '../../../css/sprinkles.css'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Divider from '../../Divider/Divider'
import Input from '../../Input/Input'
import { DropdownOptionType, ReducerActionType } from '../../../utils/types'
import { useGetSpellsQuery } from '../../../features/spells/spellsApi'
import { useGetEquipmentQuery } from '../../../features/equipment/equipmentApi'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { form_add_button, equipment_sub_group_button, form_remove_button } from '../Form.css'
import clsx from 'clsx'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import { useFeature } from '../../../hooks/UseFeature'

const Requirements = ({ state, setState }: { state: any; setState: (arg: ReducerActionType) => void }) => {
  const { context, formState } = useForm()
  const { subContext } = useFeature()

  const { data: builders } = useGetBuildersQuery()
  const { data: spells } = useGetSpellsQuery() as { data: any[] }
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  // Add/Remove requirements array
  useEffect(() => {
    if (
      !(state.attribute?.length > 0) ||
      (!state.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements') &&
        state.requirements &&
        context.title !== 'spells')
    ) {
      setState({
        type: 'removed',
        target: { name: 'requirements' },
      })
    }

    if (state.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements')) {
      if (
        state.requirements?.options?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        !(state.requirements?.itemProficiency?.length > 0)
      ) {
        setState({
          type: 'added',
          target: { name: 'requirements.itemProficiency' },
        })
      }

      if (
        !state.requirements?.options?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        state.requirements?.itemProficiency?.length > 0
      ) {
        setState({
          type: 'removed',
          target: { name: 'requirements.itemProficiency' },
        })
      }

      if (
        state.requirements?.options?.some((optionItem: any) => optionItem.name === 'equipped') &&
        !(state.requirements?.equipped?.length > 0)
      ) {
        setState({
          type: 'added',
          target: { name: 'requirements.equipped' },
        })
      }

      if (
        !state.requirements?.options?.some((optionItem: any) => optionItem.name === 'equipped') &&
        state.requirements?.equipped?.length > 0
      ) {
        setState({
          type: 'removed',
          target: { name: 'requirements.equipped' },
        })
      }

      if (
        state.requirements?.options?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        !(state.requirements?.notEquipped?.length > 0)
      ) {
        setState({
          type: 'added',
          target: { name: 'requirements.notEquipped' },
        })
      }

      if (
        !state.requirements?.options?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        state.requirements?.notEquipped?.length > 0
      ) {
        setState({
          type: 'removed',
          target: { name: 'requirements.notEquipped' },
        })
      }
    }
  }, [state?.attribute, setState, state.requirements, context.title])

  return (
    state?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRequirements') && (
      <Collapse>
        <Collapse.Header title='Requirements' />
        <Collapse.Body>
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Dropdown
              multiSelect={true}
              name={`requirements.options`}
              label='Requirement'
              options={[].concat(
                builders.features.requirements,
                context.title &&
                  builders.features[context.title]?.requirements?.length > 0 &&
                  builders.features[context.title]?.requirements,
                subContext === 'option' && builders.features.options.requirements
              )}
              value={state?.requirements?.options}
              required={true}
              onChange={setState}
            />
            {state?.requirements?.options?.some((requirementItem: any) => requirementItem.name === 'spellKnown') && (
              <Dropdown
                multiSelect={true}
                name={`requirements.spellKnown.spell`}
                value={state?.requirements?.spellKnown?.spell}
                label='Spell'
                options={spells as DropdownOptionType[]}
                onChange={setState}
              />
            )}
            {state?.requirements?.options?.some((requirementItem: any) => requirementItem.name === 'featureKnown') && (
              <>
                <Dropdown
                  multiSelect={true}
                  name={`requirements.featureKnown.feature`}
                  value={state?.requirements?.featureKnown?.feature}
                  label='Feature'
                  options={formState.features as DropdownOptionType[]}
                  onChange={setState}
                />
                {state?.requirements?.featureKnown?.features?.some(
                  (featureItem: any) => featureItem.options?.length > 0
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.featureKnown.options`}
                    value={state?.requirements?.featureKnown?.options}
                    label='Feature Option'
                    options={state?.requirements?.featureKnown?.features?.flatMap(
                      (featureItem: any) => featureItem.options?.length > 0 && featureItem.options
                    )}
                    onChange={setState}
                  />
                )}
              </>
            )}
            {state?.requirements?.options?.some((state: any) => state.name === 'skillProficiency') && (
              <Dropdown
                multiSelect={true}
                name={`requirements.skillProficiency.type`}
                label='Skill Proficiency'
                value={state?.requirements?.skillProficiency?.type}
                options={builders.skills.type}
                onChange={setState}
              />
            )}
            {state?.requirements?.options?.some((state: any) => state.name === 'abilityScore') && (
              <>
                <Dropdown
                  multiSelect={true}
                  name={`requirements.abilityScore.type`}
                  value={state?.requirements?.abilityScore?.type}
                  label='Ability'
                  options={builders.abilities.type}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name={`requirements.abilityScore.score`}
                  value={state?.requirements?.abilityScore?.score}
                  label='Score'
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setState}
                />
              </>
            )}
          </Row>
          {state?.requirements?.options?.some((requirementItem: any) => requirementItem.name === 'itemProficiency') && (
            <>
              <Divider label='Item Proficiency' />
              {state?.requirements?.itemProficiency?.map((requirementItem: any, requirementIndex: number) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={requirementIndex}>
                  <Dropdown
                    name={`requirements.itemProficiency.${requirementIndex}.category`}
                    value={requirementItem?.category}
                    label='Item Category'
                    options={builders.items.category}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.itemProficiency.${requirementIndex}.properties.type`}
                    value={requirementItem?.properties?.type}
                    label='Item Property'
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                        mapKey: 'property.type',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.itemProficiency.${requirementIndex}.items.type`}
                    label='Item type'
                    value={requirementItem?.items?.type}
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                      },
                      {
                        key: 'property.type',
                        object: requirementItem,
                        type: 'equal',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
                      onClick={() =>
                        setState({
                          type: 'added',
                          target: {
                            name: `requirements.itemProficiency`,
                          },
                        })
                      }
                    >
                      <TbPlus />
                    </Button>
                    {requirementIndex !== 0 && (
                      <Button
                        style='unstyled'
                        className={clsx(form_remove_button, equipment_sub_group_button)}
                        onClick={() => {
                          setState({
                            type: 'removed',
                            target: {
                              name: `requirements.itemProficiency.${requirementIndex}`,
                            },
                          })
                        }}
                      >
                        <TbX />
                      </Button>
                    )}
                  </Group>
                </Row>
              ))}
            </>
          )}
          {state?.requirements?.options?.some((requirementItem: any) => requirementItem.name === 'equipped') && (
            <>
              <Divider label='Equipped' />
              {state?.requirements?.equipped?.map((requirementItem: any, requirementIndex: number) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={requirementIndex}>
                  <Dropdown
                    name={`requirements.equipped.${requirementIndex}.category`}
                    value={requirementItem?.category}
                    label='Item Category'
                    options={builders.items.category}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.equipped.${requirementIndex}.properties.type`}
                    value={requirementItem?.properties?.type}
                    label='Item Property'
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                        mapKey: 'property.type',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.equipped.${requirementIndex}.items.type`}
                    label='Item type'
                    value={requirementItem?.items?.type}
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                      },
                      {
                        key: 'property.type',
                        object: requirementItem,
                        type: 'equal',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Input
                    name={`requirements.equipped.${requirementIndex}.numberEquipped`}
                    label='Number Equipped'
                    value={requirementItem?.numberEquipped}
                    onChange={setState}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
                      onClick={() =>
                        setState({
                          type: 'added',
                          target: {
                            name: `requirements.equipped`,
                          },
                        })
                      }
                    >
                      <TbPlus />
                    </Button>
                    {requirementIndex !== 0 && (
                      <Button
                        style='unstyled'
                        className={clsx(form_remove_button, equipment_sub_group_button)}
                        onClick={() => {
                          setState({
                            type: 'removed',
                            target: {
                              name: `requirements.equipped.${requirementIndex}`,
                            },
                          })
                        }}
                      >
                        <TbX />
                      </Button>
                    )}
                  </Group>
                </Row>
              ))}
            </>
          )}
          {state?.requirements?.options?.some((requirementItem: any) => requirementItem.name === 'notEquipped') && (
            <>
              <Divider label={'Not Equipped'} />
              {state?.requirements?.notEquipped?.map((requirementItem: any, requirementIndex: number) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={requirementIndex}>
                  <Dropdown
                    name={`requirements.notEquipped.${requirementIndex}.category`}
                    value={requirementItem?.category}
                    label='Item Category'
                    options={builders.items.category}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.notEquipped.${requirementIndex}.properties.type`}
                    value={requirementItem?.properties?.type}
                    label='Item Property'
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                        mapKey: 'property.type',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Dropdown
                    multiSelect={true}
                    name={`requirements.notEquipped.${requirementIndex}.items.type`}
                    label='Item type'
                    value={requirementItem?.items?.type}
                    options={items as DropdownOptionType[]}
                    filter={[
                      {
                        key: 'category._id',
                        object: requirementItem,
                        type: 'equal',
                      },
                      {
                        key: 'property.type',
                        object: requirementItem,
                        type: 'equal',
                      },
                    ]}
                    onChange={setState}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
                      onClick={() =>
                        setState({
                          type: 'added',
                          target: {
                            name: `requirements.notEquipped`,
                          },
                        })
                      }
                    >
                      <TbPlus />
                    </Button>
                    {requirementIndex !== 0 && (
                      <Button
                        style='unstyled'
                        className={clsx(form_remove_button, equipment_sub_group_button)}
                        onClick={() => {
                          setState({
                            type: 'removed',
                            target: {
                              name: `requirements.notEquipped.${requirementIndex}`,
                            },
                          })
                        }}
                      >
                        <TbX />
                      </Button>
                    )}
                  </Group>
                </Row>
              ))}
            </>
          )}
        </Collapse.Body>
      </Collapse>
    )
  )
}

export default Requirements
