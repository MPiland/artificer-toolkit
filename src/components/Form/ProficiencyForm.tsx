import { FC, useReducer, useState, useEffect } from 'react'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { SerializedError } from '@reduxjs/toolkit'
import formReducer from '../../hooks/useReducer'
import { useNavigate } from 'react-router-dom'
import useIsLoading from '../../hooks/useIsLoading'
import ScrollArea from '../ScrollArea/ScrollArea'
import { form_content } from './Form.css'
import FormFooter from './FormFooter'
import Accordion from '../Accordion/Accordion'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import { DropdownOption, ReducerActionType } from '../../utils/types'
import Input from '../Input/Input'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/items/itemsApiSlice'
import { isEqual } from 'lodash'
import Spinner from '../Spinner/Spinner'

interface ProficiencyFormProps {
  state: any
  setState: (arg: ReducerActionType) => void
  context: {
    type: 'edit' | 'create'
    title: string
  }
  isLastStep?: boolean
  isFirstStep?: boolean
  setStepIndex: (arg: (i: number) => number) => void
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  setErrorMessage: (arg: string) => void
}

const ProficiencyForm: FC<ProficiencyFormProps> = ({
  state,
  setState,
  context,
  isLastStep,
  isFirstStep,
  setStepIndex,
  handleSubmit,
  update,
  setErrorMessage,
}) => {
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(state)
  const [matches, setMatches] = useState<boolean>(false)
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(
    context.type === 'edit' ? null : 0
  )

  const navigate = useNavigate()
  const isLoading = useIsLoading()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(formState, oldFormState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [formState, oldFormState])

  const toggle = (index: number) => {
    if (activeDetailIndex === index) {
      return setActiveDetailIndex(null)
    }
    setActiveDetailIndex(index)
  }

  const handleReset = () => {
    setFormState({
      type: 'reset',
      target: { value: oldFormState },
    })
  }

  const handleForward = () => {
    setState({
      target: {
        value: formState,
      },
    })
    if (!isLastStep) {
      return setStepIndex((i: number) => {
        return i + 1
      })
    }
    handleSubmit()
  }

  const handleBack = () => {
    if (!matches) {
      console.log('changes made, alert!')
    }
    if (isFirstStep) {
      return navigate(-1)
    }
    if (!isFirstStep) {
      setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
  }

  const handleUpdate = async () => {
    if (matches) {
      setErrorMessage('No changes made')
    } else {
      setState({
        type: 'reset',
        target: { value: formState },
      })
      await update(formState)
      setOldFormState(formState)
    }
  }

  const handleRemove = (index: number) => {
    setFormState({ type: 'removed', target: { name: `detail.${index}` } })
  }

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
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
                      handleRemove={() => handleRemove(proficiencyIndex)}
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
                                    (categoryItem: any) => categoryItem.property
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
      <FormFooter
        handleBack={handleBack}
        forwardLabel={
          isLastStep ? (context.type === 'edit' ? 'Add New' : 'Submit') : 'Next'
        }
        handleReset={handleReset}
        handleForward={handleForward}
        backLabel={'Back'}
        handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
      />
    </>
  )
}

export default ProficiencyForm
