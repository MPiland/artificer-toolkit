import { useState, memo } from 'react'
import useIsLoading from '../../hooks/useIsLoading'
import ScrollArea from '../ScrollArea/ScrollArea'
import { form_content } from './Form.css'
import Accordion from '../Accordion/Accordion'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import {
  DropdownOption,
  FormContext,
  ReducerActionType,
} from '../../utils/types'
import Input from '../Input/Input'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/items/itemsApiSlice'
import Spinner from '../Spinner/Spinner'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Group from '../Group/Group'

interface ProficiencyFormProps {
  context: {
    type: FormContext
    title: string
  }
  formState: any
  setFormState: (arg: ReducerActionType) => void
  handleRemove: (arg: string) => void
  handleAdd: (arg: string) => void
}

const ProficiencyForm = memo(
  ({
    context,
    formState,
    setFormState,
    handleRemove,
    handleAdd,
  }: ProficiencyFormProps) => {
    const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(
      context.type !== 'new' ? null : 0
    )
    const isLoading = useIsLoading()

    const { data: builders } = useGetBuildersQuery(undefined)

    const { items } = useGetItemsQuery(undefined, {
      selectFromResult: ({ data }) => ({
        items: data && selectAllItems(data),
      }),
    })

    const toggle = (index: number) => {
      if (activeDetailIndex === index) {
        return setActiveDetailIndex(null)
      }
      setActiveDetailIndex(index)
    }

    return isLoading || !builders || !items ? (
      <Spinner />
    ) : (
      <>
        <Group>
          <Button
            variant='primary_outline'
            onClick={() => handleAdd('proficiency')}
            className={sprinkles({ ms: 'size-3', mb: 'size-2' })}
          >
            Add Proficiency
          </Button>
        </Group>

        <ScrollArea scrollDirection='vertical' className={form_content}>
          {formState.proficiency && (
            <Accordion
              dataArray={formState.proficiency}
              name='proficiency'
              setState={setFormState}
            >
              {formState.proficiency?.map(
                (proficiencyItem: any, proficiencyIndex: number) => {
                  const multipleOptions = proficiencyItem.attribute?.some(
                    (attributeItem: any) =>
                      attributeItem.name === 'providesOptions'
                  )
                  return (
                    <Accordion.Container
                      key={proficiencyIndex}
                      itemId={proficiencyItem.id}
                    >
                      <Accordion.Header
                        handleClick={() => toggle(proficiencyIndex)}
                        handleRemove={() =>
                          handleRemove(`proficiency.${proficiencyIndex}`)
                        }
                        active={activeDetailIndex === proficiencyIndex}
                      >
                        {`Proficiency ${proficiencyIndex + 1}`}
                      </Accordion.Header>
                      <Accordion.Content
                        active={activeDetailIndex === proficiencyIndex}
                      >
                        <Grid>
                          <Dropdown
                            multiSelect={true}
                            name={`proficiency.${proficiencyIndex}.attribute`}
                            options={[].concat(
                              builders.section.attribute,
                              formState.category?.name === 'subclass' &&
                                builders.section.subclass.attribute
                            )}
                            label='Proficiency Attribute'
                            value={proficiencyItem.attribute}
                            onChange={setFormState}
                          />
                          {proficiencyItem.attribute?.some(
                            (attributeItem: any) =>
                              attributeItem.name === 'subtypeSpecific'
                          ) && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.subtype`}
                              label='Subtype'
                              value={proficiencyItem.subtype}
                              options={formState.subtype}
                              required={true}
                              onChange={setFormState}
                            />
                          )}
                          {proficiencyItem.attribute?.some(
                            (attributeItem: any) =>
                              attributeItem.name === 'optionGroups'
                          ) && (
                            <Input
                              validation='num'
                              name={`proficiency.${proficiencyIndex}.optionGroup`}
                              label='Opt. Grp. #'
                              autoComplete='off'
                              value={proficiencyItem.optionGroup}
                              errorMsg='Must contain only numbers'
                              onChange={setFormState}
                            />
                          )}
                          <Dropdown
                            name={`proficiency.${proficiencyIndex}.area`}
                            label='Proficiency Area'
                            value={proficiencyItem.area}
                            options={builders.proficiency.area}
                            required={true}
                            onChange={setFormState}
                          />
                          {proficiencyItem.area?.name === 'skill' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.skill`}
                              multiSelect={true}
                              label='Skill'
                              value={proficiencyItem.skill}
                              options={builders.skill}
                              required={true}
                              onChange={setFormState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'saveAbility' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.saveAbility.ability`}
                              multiSelect={true}
                              label='Save Ability'
                              value={proficiencyItem.saveAbility.ability}
                              options={builders.ability}
                              required={true}
                              onChange={setFormState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'language' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.language`}
                              multiSelect={true}
                              label='Language'
                              value={proficiencyItem.language}
                              options={builders.language}
                              onChange={setFormState}
                            />
                          )}
                          {(proficiencyItem.area?.name === 'property' ||
                            proficiencyItem.area?.name === 'itemType') && (
                            <>
                              <Dropdown
                                name={`proficiency.${proficiencyIndex}.category`}
                                multiSelect={true}
                                label='Item Category'
                                value={proficiencyItem.category}
                                options={builders.item.category}
                                onChange={setFormState}
                              />
                              {proficiencyItem.area?.name === 'property' && (
                                <Dropdown
                                  name={`proficiency.${proficiencyIndex}.property`}
                                  multiSelect={true}
                                  label='Item Property'
                                  value={proficiencyItem.property}
                                  options={builders.item.category
                                    .filter((bCategoryItem: any) =>
                                      proficiencyItem.category?.length > 0
                                        ? proficiencyItem.category?.some(
                                            (categoryItem: any) =>
                                              categoryItem.name ===
                                              bCategoryItem.name
                                          )
                                        : bCategoryItem
                                    )
                                    .map(
                                      (categoryItem: any) =>
                                        categoryItem.property
                                    )}
                                  onChange={setFormState}
                                />
                              )}
                              {proficiencyItem.area?.name === 'itemType' && (
                                <Dropdown
                                  name={`proficiency.${proficiencyIndex}.itemType`}
                                  multiSelect={true}
                                  label='Item Type'
                                  value={proficiencyItem.itemType}
                                  options={(
                                    items as unknown as DropdownOption[]
                                  )?.filter((itemType: any) =>
                                    proficiencyItem.category?.length > 0
                                      ? proficiencyItem.category?.some(
                                          (categoryItem: any) =>
                                            categoryItem.name ===
                                            itemType.category?.name
                                        )
                                      : itemType
                                  )}
                                  onChange={setFormState}
                                />
                              )}
                            </>
                          )}
                          <Dropdown
                            name={`proficiency.${proficiencyIndex}.level`}
                            label='Proficiency Level'
                            value={proficiencyItem.level}
                            options={builders.proficiency.level}
                            required={true}
                            onChange={setFormState}
                          />
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
                }
              )}
            </Accordion>
          )}
        </ScrollArea>
      </>
    )
  }
)

ProficiencyForm.displayName = 'ProficiencyForm'

export default ProficiencyForm
