import { useEffect, useReducer, useState } from 'react'
import { Button, SimpleGrid, Flex, Group } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewFeatMutation,
  useGetFeatsQuery,
  selectAllFeats,
} from './featsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { useGetItemsQuery, selectAllItems } from '../items/itemsApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../classes/classesApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../utils/form'
import SectionContent, {
  getSectionNames,
} from '../../components/Form/SectionForm'
import DraggableTabs from '../../components/DraggableTabs'
import Spinner from '../../components/Spinner/Spinner'
import formReducer from '../../hooks/useReducer'
import TextEditor from '../../components/RichTextEditor/TextEditor'
import Table from '../../components/Table/Table'
import Dropdown from '../../components/Dropdown/Dropdown'
import Input from '../../components/Input/Input'
import Divider from '../../components/Divider/Divider'
const NewFeatForm = () => {
  const navigate = useNavigate()

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { spells } = useGetSpellsQuery('spellsList', {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
  })

  const { feats } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
  })

  const { items } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const [
    addNewFeat,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewFeatMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!feats || !spells || !items || !builders || !classes) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [feats, spells, items, builders, classes])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Feat added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('error-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
      setState({
        type: 'reset',
        payload: { target: {} },
      })
    }
  }, [addIsSuccess, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.message)
    }
  }, [addIsError, addError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  useEffect(() => {
    document.addEventListener('mouseup', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('mouseup', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: {} },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewFeat(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  let content

  if (isLoading) {
    return (content = <Spinner />)
  }

  const sectionNames = getSectionNames()

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <SimpleGrid>
            <Input
              name='value'
              autoComplete='off'
              label='Feat Name'
              value={state.value}
              required={true}
              onChange={setState}
              autoFocus={true}
            />
          </SimpleGrid>
          <TextEditor
            name={'desc'}
            value={state.desc}
            label='Feat Description'
            onChange={setState}
          />
          <SimpleGrid>
            <Dropdown
              multiSelect={true}
              name='attribute'
              value={state.attribute}
              options={[].concat(
                builders.feature.attribute,
                builders.feature.feat.attribute
              )}
              label='Feat Attributes'
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'limitUse'
            ) && (
              <>
                <Dropdown
                  name={`limitUse.limitBy`}
                  label='Limit By Option'
                  value={state.limitUse?.limitBy}
                  options={builders.feature.chargeLimit}
                  required={true}
                  onChange={setState}
                />
                {state.limitUse?.limitBy?.name === 'ability' ? (
                  <>
                    <Dropdown
                      name={`limitUse.ability`}
                      label='Ability'
                      value={state.limitUse?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  </>
                ) : state.limitUse?.limitBy?.name === 'skill' ? (
                  <Dropdown
                    name={`limitUse.skill`}
                    label='Skill'
                    value={state.limitUse?.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  state.limitUse?.limitBy?.name === 'setValue' && (
                    <Input
                      validation='num'
                      type='text'
                      name={`limitUse.setValue`}
                      invalidText='Must contain only numbers'
                      label='Use Amount'
                      value={state.limitUse?.setValue}
                      required={true}
                      onChange={setState}
                    />
                  )
                )}
                {state.limitUse?.limitBy?.name !== 'level' &&
                  state.limitUse?.limitBy?.name !== 'setValue' && (
                    <>
                      <Input
                        name={`limitUse.addValue`}
                        autoComplete='off'
                        label='Additional Amount'
                        value={state?.limitUse?.addValue}
                        onChange={setState}
                      />
                      <Input
                        name={`limitUse.minValue`}
                        autoComplete='off'
                        label='Minimal Value'
                        value={state?.limitUse?.minValue}
                        onChange={setState}
                      />
                    </>
                  )}
                {state.limitUse?.limitBy?.name !== 'setValue' && (
                  <Input
                    name={`limitUse.multiplier`}
                    autoComplete='off'
                    validation='num'
                    invalidText='Must contain whole numbers only'
                    label='Multiplier'
                    value={state?.limitUse?.multiplier}
                    onChange={setState}
                  />
                )}
                <Dropdown
                  name={`limitUse.resetOption`}
                  label='Reset Option'
                  value={state.limitUse?.resetOption}
                  options={builders.feature.chargeReset}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'isAction'
            ) && (
              <>
                <Dropdown
                  name={`action`}
                  label='Action Type'
                  value={state.action}
                  options={builders.feature.action}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'hasRange'
            ) && (
              <>
                <Input
                  validation='num'
                  name={`range.minRange`}
                  autoComplete='off'
                  label='Minimum Range'
                  required={true}
                  value={state.range?.minRange}
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name={`range.maxRange`}
                  autoComplete='off'
                  label='Max Range'
                  required={true}
                  invalidText='Must contain only numbers'
                  value={state.range?.maxRange}
                  onChange={setState}
                />
                <Dropdown
                  name={`range.unit`}
                  label='UoM'
                  value={state.range?.unit}
                  options={[].concat(
                    Object.values(builders.unit.imperial).flatMap(
                      (item) => item
                    )
                  )}
                  optionalKey='short'
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Dropdown
                  name={`saveAbility.attribute`}
                  multiSelect={true}
                  label='Save Attribute'
                  value={state.saveAbility?.attribute}
                  options={builders.feature.saveAttribute}
                  onChange={setState}
                />
                <Dropdown
                  name={`saveAbility.ability`}
                  label='DC Ability'
                  value={state.saveAbility?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name={`saveAbility.minValue`}
                  autoComplete='off'
                  label='Minimum Value'
                  required={true}
                  invalidText='Must contain only numbers'
                  value={state.saveAbility?.minValue}
                  onChange={setState}
                />
                {state.saveAbility?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Dropdown
                    name={`saveAbility.abilityModifier`}
                    label='Modifier Ability'
                    value={state.saveAbility?.abilityModifier}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'hasRequirements'
            ) && (
              <Dropdown
                multiSelect={true}
                name={`requirement.option`}
                label='Requirement'
                options={builders.feature.requirement}
                value={state.requirement?.option}
                required={true}
                onChange={setState}
              />
            )}
          </SimpleGrid>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'hasRequirements'
          ) &&
            !state.requirement?.option?.every(
              (state) => state.name === 'notProficient'
            ) && (
              <>
                <Divider label={'Requirements'} />
                <SimpleGrid>
                  {state.requirement?.option?.some(
                    (state) => state.name === 'skillProficiency'
                  ) && (
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.skillProficiency.skill`}
                      label='Skill Proficiency'
                      value={state.requirement?.skillProficiency?.skill}
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {state.requirement?.option?.some(
                    (state) => state.name === 'abilityScore'
                  ) && (
                    <>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.abilityScore.ability`}
                        value={state.requirement?.abilityScore?.ability}
                        label='Ability'
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        name={`requirement.abilityScore.score`}
                        value={state.requirement?.abilityScore?.score}
                        label='Score'
                        required={true}
                        validation='num'
                        invalidText='Must contain only numbers'
                        onChange={setState}
                      />
                    </>
                  )}
                </SimpleGrid>
                {state.requirement?.option?.some(
                  (state) => state.name === 'itemProficiency'
                ) && (
                  <>
                    <Divider label={'Item Proficiency'} />
                    <SimpleGrid>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.itemProficiency.category`}
                        value={state.requirement?.itemProficiency?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        name={`requirement.itemProficiency.property`}
                        multiSelect={true}
                        label='Item Property'
                        value={state.requirement?.itemProficiency?.property}
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement?.itemProficiency?.category
                                ?.length > 0
                                ? state.requirement?.itemProficiency?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        name={`requirement.itemProficiency.itemType`}
                        multiSelect={true}
                        label='Item type'
                        value={state.requirement?.itemProficiency?.itemType}
                        options={items.filter((item) =>
                          state.requirement.itemProficiency?.category?.length >
                          0
                            ? state.requirement.itemProficiency?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
                {state.requirement?.option?.some(
                  (state) => state.name === 'equipped'
                ) && (
                  <>
                    <Divider label={'Equipped'} />
                    <SimpleGrid>
                      <Input
                        name={`requirement.equipped.numberEquipped`}
                        value={state.requirement?.equipped?.numberEquipped}
                        label='Number Equipped'
                        onChange={setState}
                        validation='num'
                        invalidText={'Must contain only numbers'}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.category`}
                        value={state.requirement?.equipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.property`}
                        label='Item Property'
                        value={state.requirement?.equipped?.property}
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement?.equipped?.category?.length > 0
                                ? state.requirement?.equipped?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.itemType`}
                        label='Item type'
                        value={state.requirement?.equipped?.itemType}
                        options={items.filter((item) =>
                          state.requirement.equipped?.category?.length > 0
                            ? state.requirement.equipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
                {state.requirement?.option?.some(
                  (state) => state.name === 'notEquipped'
                ) && (
                  <>
                    <Divider label={'Not Equipped'} />
                    <SimpleGrid>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.category`}
                        value={state.requirement?.notEquipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.property`}
                        value={state.requirement?.notEquipped?.property}
                        label='Item Property'
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement.notEquipped?.category?.length >
                              0
                                ? state.requirement.notEquipped?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.itemType`}
                        label='Item type'
                        value={state.requirement?.notEquipped?.itemType}
                        options={items.filter((item) =>
                          state.requirement.notEquipped?.category?.length > 0
                            ? state.requirement.notEquipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
              </>
            )}
          {state.limitUse?.limitBy?.name === 'level' &&
            state.attribute?.some(
              (attributeItem) => attributeItem.name === 'limitUse'
            ) &&
            (!state.limitUse.level ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: `limitUse.level`,
                  },
                },
              })
            ) : (
              <>
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='limitCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#$limitUseCollapse`}
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Limit Use Table</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show'
                  id={`limitUseCollapse`}
                >
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: [
                          {
                            name: 'value',
                            invalid: 'Must contain only numbers',
                            validation: 'num',
                            size: 'col-5',
                          },
                          {
                            name: 'useNum',
                            invalid: 'Must contain only numbers',
                            validation: 'num',
                            size: 'col-5',
                          },
                        ],
                        headers: [
                          {
                            value: 'Level',
                            readOnly: true,
                            size: 'col-5',
                          },
                          {
                            value: 'Uses',
                            readOnly: true,
                            size: 'col-5',
                          },
                        ],
                      }}
                      name={`limitUse.level`}
                      value={state.limitUse?.level}
                      onChange={setState}
                      addRow={true}
                    />
                  </div>
                </div>
              </>
            ))}
          <div className='dropdown col-auto'>
            <button
              className='btn btn-secondary dropdown-toggle btn'
              type='button'
              data-bs-toggle='dropdown'
              aria-expanded='false'
            >
              Add...
            </button>
            <ul className='dropdown-menu'>
              {sectionNames.map((sectionName, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`${sectionName}${
                      sectionName === 'style' ? '.option' : ''
                    }`}
                    onClick={(e) => setState({ type: 'added', payload: e })}
                  >
                    {`${startCase(sectionName)}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {Object.keys(state)?.length !== 0 &&
            Object.keys(state)?.some((key) => sectionNames.includes(key)) && (
              <DraggableTabs
                name={'section'}
                tabState={[].concat(
                  ...sectionNames
                    .filter(
                      (sectionName) =>
                        state[sectionName] &&
                        Object.keys(state[sectionName]).length > 0
                    )
                    .map((sectionName) => {
                      const sectionGroupItem =
                        sectionName === 'style'
                          ? state[sectionName]?.option
                          : state[sectionName]
                      return sectionGroupItem?.map(
                        (sectionItem, sectionIndex) => {
                          return {
                            value:
                              state[sectionName]?.option?.[sectionIndex]
                                ?.value ??
                              startCase(`${sectionName} ${sectionIndex + 1}`),
                            content: (
                              <SectionContent
                                key={sectionIndex}
                                stateName={'section'}
                                sectionItem={sectionItem}
                                sectionIndex={sectionIndex}
                                sectionName={sectionName}
                                featureItem={state}
                                setState={setState}
                                builders={builders}
                                items={items}
                                classes={classes}
                                feats={feats}
                                spells={spells}
                                state={state}
                              />
                            ),
                          }
                        }
                      )
                    })
                )}
                addRow={true}
                setState={setState}
              />
            )}
        </>
      ),
    },
  ]

  content = (
    <>
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify={{ base: 'space-between' }}
      >
        <h3>Create a Class</h3>
        <Group justify='space-between' gap='xs'>
          <Button type='button' onClick={onSubmit}>
            Add
          </Button>
          <Button type='button' color='yellow' onClick={onReset}>
            Reset Form
          </Button>
          <Button type='button' color='gray' onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Flex>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <DraggableTabs
          name='main'
          addRow={false}
          tabState={mainTabContent.map((content) => ({
            value: startCase(content.name),
            content: content.content,
          }))}
        />
      </form>
    </>
  )
  return (
    <div className='main-container' id='main-container'>
      {content}
    </div>
  )
}
export default NewFeatForm
