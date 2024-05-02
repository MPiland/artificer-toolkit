import { useState, useContext } from 'react'
import useIsLoading from '../../../hooks/useIsLoading'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { form_content } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import Grid from '../../Grid/Grid'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { selectAllItems, useGetItemsQuery } from '../../../features/item/itemApiSlice'
import Spinner from '../../Spinner/Spinner'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import Group from '../../Group/Group'
import { startCase } from 'lodash'
import { FormStepsContext } from '../FormStepsContext'

const ProficiencyFormTest = () => {
  const { context, formState, setFormState } = useContext(FormStepsContext)

  const [activeIndex, setActiveIndex] = useState<number | null>(context.type !== 'new' ? null : 0)
  const isLoading = useIsLoading()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
      <Group>
        <Button
          variant='primary_outline'
          onClick={() => {
            setActiveIndex(formState?.proficiency?.length)
            setFormState({ type: 'added', target: { name: 'proficiency' } })
          }}
          className={sprinkles({ ms: 'size-3', mb: 'size-2' })}
        >
          Add Proficiency
        </Button>
      </Group>

      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formState.proficiency && (
          <Accordion dataArray={formState.proficiency} name='proficiency' setState={setFormState}>
            {formState.proficiency?.map((proficiencyItem: any, proficiencyIndex: number) => {
              const multipleOptions = proficiencyItem.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'providesOptions'
              )
              const categoryName = proficiencyItem?.category?.name
              return (
                <Accordion.Container key={proficiencyIndex} itemId={String(proficiencyIndex)}>
                  <Accordion.Header
                    handleClick={() => toggle(proficiencyIndex)}
                    handleRemove={() =>
                      setFormState({
                        type: 'removed',
                        target: { name: `proficiency.${proficiencyIndex}` },
                      })
                    }
                    active={activeIndex === proficiencyIndex}
                  >
                    {`Proficiency ${proficiencyIndex + 1}`}
                  </Accordion.Header>
                  <Accordion.Content active={activeIndex === proficiencyIndex}>
                    <Grid>
                      <Dropdown
                        multiSelect={true}
                        name={`proficiency.${proficiencyIndex}.attribute`}
                        options={[].concat(
                          builders.section.attribute,
                          formState.category?.name === 'subclass' && builders.section.subclass.attribute
                        )}
                        label='Proficiency Attribute'
                        value={proficiencyItem.attribute}
                        onChange={setFormState}
                      />
                      <Dropdown
                        name={`proficiency.${proficiencyIndex}.category`}
                        label='Proficiency Category'
                        value={proficiencyItem.category}
                        options={builders.proficiency.category}
                        required={true}
                        onChange={setFormState}
                      />
                      {categoryName != null &&
                        (categoryName !== 'property' && categoryName !== 'item' ? (
                          <Dropdown
                            name={`proficiency.${proficiencyIndex}.${categoryName}.type`}
                            multiSelect={true}
                            label={`${startCase(proficiencyItem.category.value)} Type`}
                            value={proficiencyItem[categoryName]?.type}
                            options={
                              categoryName === 'saveAbility' ? builders.ability.type : builders[categoryName].type
                            }
                            required={true}
                            onChange={setFormState}
                          />
                        ) : (
                          <>
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.${categoryName}.category`}
                              multiSelect={true}
                              label='Item Category'
                              value={proficiencyItem[categoryName]?.category}
                              options={builders.item.category}
                              onChange={setFormState}
                            />
                            {categoryName === 'property' && (
                              <Dropdown
                                name={`proficiency.${proficiencyIndex}.${categoryName}.type`}
                                multiSelect={true}
                                label='Item Property'
                                value={proficiencyItem[categoryName]?.type}
                                options={items
                                  ?.filter((item: any) =>
                                    proficiencyItem[categoryName]?.category?.length > 0
                                      ? proficiencyItem[categoryName]?.category?.some(
                                          (categoryItem: any) => categoryItem._id === item.category._id
                                        )
                                      : item
                                  )
                                  .flatMap((item: any) => item.property?.type)}
                                onChange={setFormState}
                                required={true}
                              />
                            )}
                            {categoryName === 'item' && (
                              <Dropdown
                                name={`proficiency.${proficiencyIndex}.${categoryName}.type`}
                                multiSelect={true}
                                label='Item'
                                value={proficiencyItem[categoryName]?.type}
                                options={
                                  items
                                    ?.filter((item: any) =>
                                      proficiencyItem[categoryName]?.category?.length > 0
                                        ? proficiencyItem[categoryName]?.category?.some(
                                            (categoryItem: any) => categoryItem._id === item.category._id
                                          )
                                        : item
                                    )
                                    .map((item) => item) as any[]
                                }
                                required={true}
                                onChange={setFormState}
                              />
                            )}
                          </>
                        ))}
                      <Dropdown
                        name={`proficiency.${proficiencyIndex}.${categoryName}.level`}
                        label='Proficiency Level'
                        value={proficiencyItem[categoryName]?.level}
                        options={builders.proficiency.level}
                        required={true}
                        onChange={setFormState}
                      />
                      {proficiencyItem.attribute?.some(
                        (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
                      ) && (
                        <Dropdown
                          name={`proficiency.${proficiencyIndex}.${categoryName}.subtype`}
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
                          name={`proficiency.${proficiencyIndex}.selectionCount`}
                          label='# of Selections'
                          autoComplete='off'
                          value={proficiencyItem.selectionCount}
                          errorMsg='Must contain only numbers'
                          required={true}
                          onChange={setFormState}
                        />
                      )}
                    </Grid>
                  </Accordion.Content>
                </Accordion.Container>
              )
            })}
          </Accordion>
        )}
      </ScrollArea>
    </>
  )
}

export default ProficiencyFormTest
