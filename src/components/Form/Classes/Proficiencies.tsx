import { useEffect } from 'react'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Accordion from '../../Accordion/Accordion'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Spinner from '../../Spinner/Spinner'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import Group from '../../Group/Group'
import { isEqual, set, startCase } from 'lodash'
import { useForm } from '../../../hooks/UseForm'
import { DropdownOptionType } from '../../../utils/types'
import { useGetBuildersQuery } from '../../../features/systems/systemsApi'
import { useGetEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'

const Proficiencies = () => {
  const { formState, setFormState } = useForm()

  const isLoading = useIsFetching() > 0

  const { data: builders } = useGetBuildersQuery()
  const { data: items } = useGetEquipmentQuery() as { data: any }

  useEffect(() => {
    if (formState?.proficiencies?.length > 0) {
      const formClone = JSON.parse(JSON.stringify(formState))
      formClone?.proficiencies?.forEach((proficiency: any, pIndex: number) => {
        const categoryName = proficiency?.category?.name
        if (
          !proficiency?.[categoryName]?.level ||
          proficiency?.[categoryName]?.level.name !== 'full' ||
          proficiency?.[categoryName]?.level !== 'half'
        ) {
          const proficiencyLevel = builders.proficiencies.level.find((level: any) => level.name === 'full')
          set(formClone, `proficiencies.${pIndex}.${categoryName}.level`, proficiencyLevel)
        }
      })
      if (!isEqual(formClone, formState)) {
        setFormState({
          type: 'reset',
          target: {
            value: formClone,
          },
        })
      }
    }
  }, [builders.proficiencies.level, formState, setFormState])

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
      <Group>
        <Button
          color='primary'
          style='outline'
          onClick={() => {
            setFormState({ type: 'added', target: { name: 'proficiencies' } })
          }}
          className={sprinkles({ mb: 'space-2' })}
        >
          Add Proficiency
        </Button>
      </Group>

      <ScrollArea scrollDirection='vertical'>
        {formState.proficiencies && (
          <Accordion dataArray={formState.proficiencies} name='proficiencies' setState={setFormState}>
            {formState.proficiencies?.map((proficiencyItem: any, proficiencyIndex: number) => {
              const multipleOptions = proficiencyItem.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'providesOptions'
              )
              const categoryName = proficiencyItem?.category?.name
              return (
                <Accordion.Wrapper key={proficiencyIndex} itemId={String(proficiencyIndex)}>
                  <Accordion.Header
                    handleRemove={() =>
                      setFormState({
                        type: 'removed',
                        target: { name: `proficiencies.${proficiencyIndex}` },
                      })
                    }
                  >
                    {`Proficiency ${proficiencyIndex + 1}`}
                  </Accordion.Header>
                  <Accordion.Content>
                    <Row>
                      <Dropdown
                        multiSelect={true}
                        name={`proficiencies.${proficiencyIndex}.attribute`}
                        options={[].concat(
                          builders.section.attribute,
                          formState.category?.name === 'subclass' && builders.section.subclass.attribute
                        )}
                        label='Proficiency Attribute'
                        value={proficiencyItem.attribute}
                        onChange={setFormState}
                      />
                      <Dropdown
                        name={`proficiencies.${proficiencyIndex}.category`}
                        label='Proficiency Category'
                        value={proficiencyItem.category}
                        options={builders.proficiencies.category}
                        required={true}
                        onChange={setFormState}
                      />
                      {categoryName != null &&
                        (categoryName !== 'properties' && categoryName !== 'items' ? (
                          <Dropdown
                            name={`proficiencies.${proficiencyIndex}.${categoryName}.type`}
                            multiSelect={true}
                            label={`${startCase(proficiencyItem.category.value)} Type`}
                            value={proficiencyItem[categoryName]?.type}
                            options={
                              categoryName === 'saveAbility' ? builders.abilities.type : builders[categoryName].type
                            }
                            required={true}
                            onChange={setFormState}
                          />
                        ) : (
                          <>
                            <Dropdown
                              name={`proficiencies.${proficiencyIndex}.${categoryName}.category`}
                              label='Item Category'
                              value={proficiencyItem[categoryName]?.category}
                              options={builders.items.category}
                              required={true}
                              onChange={setFormState}
                            />
                            <Dropdown
                              name={`proficiencies.${proficiencyIndex}.${categoryName}.${
                                categoryName === 'items' ? 'properties.type' : 'type'
                              }`}
                              multiSelect={true}
                              label='Item Properties'
                              value={
                                categoryName === 'items'
                                  ? proficiencyItem[categoryName]?.properties?.type
                                  : proficiencyItem[categoryName]?.type
                              }
                              options={items as DropdownOptionType[]}
                              filter={[
                                {
                                  key: 'category._id',
                                  object: proficiencyItem[categoryName],
                                  mapKey: 'properties.type',
                                  type: 'equal',
                                },
                              ]}
                              onChange={setFormState}
                              required={categoryName === 'items' ? false : true}
                            />
                            {categoryName === 'items' && (
                              <>
                                <Dropdown
                                  name={`proficiencies.${proficiencyIndex}.${categoryName}.type`}
                                  multiSelect={true}
                                  label='Item'
                                  value={proficiencyItem[categoryName]?.type}
                                  options={items as DropdownOptionType[]}
                                  filter={[
                                    {
                                      key: 'category._id',
                                      object: proficiencyItem[categoryName],
                                      type: 'equal',
                                    },
                                    {
                                      key: 'properties.type',
                                      object: proficiencyItem[categoryName],
                                      type: 'equal',
                                    },
                                  ]}
                                  onChange={setFormState}
                                  required={true}
                                />
                              </>
                            )}
                          </>
                        ))}
                      {proficiencyItem.attribute?.some(
                        (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
                      ) && (
                        <Dropdown
                          name={`proficiencies.${proficiencyIndex}.${categoryName}.subtype`}
                          label='Subtype'
                          value={proficiencyItem[categoryName]?.subtype}
                          options={formState.subtype}
                          required={true}
                          onChange={setFormState}
                        />
                      )}
                      {multipleOptions && (
                        <Input
                          validation='num'
                          name={`proficiencies.${proficiencyIndex}.selectionCount`}
                          label='# of Selections'
                          autoComplete='off'
                          value={proficiencyItem.selectionCount}
                          errorMsg='Must contain only numbers'
                          required={true}
                          onChange={setFormState}
                        />
                      )}
                    </Row>
                  </Accordion.Content>
                </Accordion.Wrapper>
              )
            })}
          </Accordion>
        )}
      </ScrollArea>
    </>
  )
}

export default Proficiencies
