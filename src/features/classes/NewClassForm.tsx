import style from '../../components/Form/Form.module.css'
import { useState, useEffect, useReducer, Fragment } from 'react'
import { CloseButton, Paper, SimpleGrid, Flex, Group } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewClassMutation,
  useGetClassesQuery,
  selectAllClasses,
} from './classesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllItems, useGetItemsQuery } from '../items/itemsApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../utils/form'
import ButtonTest from '../../components/Button/Button'
import Spinner from '../../components/Spinner/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import DraggableTabs from '../../components/DraggableTabs'
import TextEditor from '../../components/RichTextEditor/TextEditor'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import Dropdown from '../../components/Dropdown/Dropdown'
import Grid from '../../components/Grid/Grid'
import Divider from '../../components/Divider/Divider'
import CollapseContainer from '../../components/Collapse/Collapse'
import FeatureContent from '../../components/Form/FeatureForm'

const NewClassForm = () => {
  const navigate = useNavigate()

  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { items } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const [
    addNewClass,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewClassMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [levelTableColumns, setLevelTableColumns] = useState()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!items || !builders || !classes) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [items, builders, classes, state])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Class added successfully!')
      const successElement = document.getElementById('success-message')
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
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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

  useEffect(() => {
    const spellCaster = state.attribute?.some(
      (attributeItem) => attributeItem.name === 'spellCaster'
    )
    !state.levelAttribute &&
      setState({
        type: 'added',
        payload: { target: { name: 'levelAttribute' } },
      })
    spellCaster &&
      state.levelAttribute?.map(
        (levelAttributeItem, levelAttributeIndex) =>
          !levelAttributeItem?.spellSlots &&
          setState({
            type: 'added',
            payload: {
              target: {
                name: `levelAttribute.${levelAttributeIndex}.spellSlots`,
              },
            },
          })
      )

    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: spellCaster
          ? is1000
            ? 'col-1'
            : is600
            ? 'col-2'
            : 'col'
          : 'col',
        required: true,
      },
    ]
    if (state.category?.name === 'base') {
      inputArray.push({
        name: 'proficiencyBonus',
        value: 'Prof. Bonus',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: spellCaster
          ? is1000
            ? 'col-1'
            : is600
            ? 'col-2'
            : 'col'
          : 'col',
      })
    }
    if (spellCaster) {
      if (
        state.spellcasting?.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitKnownSpells'
        )
      ) {
        inputArray.push({
          name: 'spellsKnown',
          value: 'Spells Known',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: spellCaster
            ? is1000
              ? 'col-1'
              : is600
              ? 'col-2'
              : 'col'
            : 'col',
        })
      }
      if (state.spellcasting?.maxSpellLevel) {
        for (let i = 0; i <= state.spellcasting?.maxSpellLevel; i++) {
          inputArray.push({
            name: `spellSlots.${i}.slotCount`,
            value: `${i}`,
            invalid: 'Must contain only numbers',
            validation: 'num',
            size: spellCaster
              ? is1000
                ? 'col-1'
                : is600
                ? 'col-2'
                : 'col'
              : 'col',
          })
        }
      }
    }

    const headerArray = inputArray.map((inputItem) => ({
      value: inputItem.value,
      readOnly: true,
      size: inputItem.size,
      required: true,
    }))

    setLevelTableColumns({ inputs: inputArray, headers: headerArray })
  }, [is1000, is600, state])

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
      await addNewClass(state)
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

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <Grid>
            <Input
              name='value'
              autoComplete='off'
              label='Class Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Dropdown
              name='category'
              label='Class Category'
              value={state.category}
              options={builders.class.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name === 'subclass' && (
              <Dropdown
                name='parentClass'
                label='Parent Class'
                value={state.parentClass}
                options={classes.filter(
                  (classItem) => classItem.category.name !== 'subclass'
                )}
                required={true}
                onChange={setState}
              />
            )}
            {state.category?.name !== 'subclass' && (
              <>
                <Input
                  name='hitPoint.diceCount'
                  autoComplete='off'
                  label='HP Dice Count'
                  required={true}
                  value={state.hitPoint?.diceCount}
                  validation='num'
                  error='Must contain whole numbers only'
                  onChange={setState}
                />
                <Input
                  name='hitPoint.diceValue'
                  autoComplete='off'
                  label='HP Dice Value'
                  required={true}
                  value={state.hitPoint?.diceValue}
                  validation='num'
                  error='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
          </Grid>
          <TextEditor
            name={'desc'}
            value={state.desc}
            label={'Description'}
            onChange={setState}
          />
          <ButtonTest
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'details' } },
              })
            }
          >
            Add Detail
          </ButtonTest>
          {/* <DraggableTabs
            name='details'
            tabState={state.details?.map((detailItem, detailIndex) => ({
              value:
                detailItem.value == null || detailItem.value === ''
                  ? startCase(`detail ${detailIndex + 1}`)
                  : detailItem.value,
              content: (
                <Fragment key={detailIndex}>
                  <SimpleGrid>
                    <Input
                      name={`details.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setState}
                    />
                  </SimpleGrid>
                  <TextEditor
                    name={`details.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setState}
                  />
                </Fragment>
              ),
            }))}
            setState={setState}
            addRow={true}
          /> */}
        </>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <SimpleGrid>
            <>
              <Dropdown
                name='attribute'
                label='Attributes'
                multiSelect={true}
                value={state.attribute}
                options={builders.class.attribute.filter(
                  (attributeItem) =>
                    (state.category?.name === 'base'
                      ? attributeItem
                      : attributeItem.name !== 'primaryAbility' &&
                        attributeItem.name !== 'secondaryAbility') &&
                    (state.attribute?.some(
                      (item) => item.name === 'primaryAbility'
                    )
                      ? attributeItem
                      : attributeItem.name !== 'optionalAbility')
                )}
                onChange={setState}
              />
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'resourceFeature'
              ) && (
                <Dropdown
                  name='resourceFeature.resetOption'
                  label='Resource Feature Reset Option'
                  value={state.resourceFeature?.resetOption}
                  options={builders.feature.chargeReset}
                  required={true}
                  onChange={setState}
                />
              )}
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'spellCaster'
              ) ? (
                <>
                  <Dropdown
                    name='spellcasting.ability'
                    label='Spellcasting Ability'
                    required={true}
                    value={state.spellcasting?.ability}
                    options={builders.ability}
                    onChange={setState}
                  />
                  <Dropdown
                    name='spellcasting.attribute'
                    label='Spell Casting Attributes'
                    multiSelect={true}
                    value={state.spellcasting?.attribute}
                    options={builders.class.spell.attribute}
                    onChange={setState}
                  />
                  {state.spellcasting?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'preparesSpells'
                  ) && (
                    <Dropdown
                      name='spellcasting.prepareLimit.method'
                      label='Prepare Limit Method'
                      multiSelect={true}
                      value={state.spellcasting?.prepareLimit?.method}
                      options={builders.class.spell.prepareLimitAttribute}
                      onChange={setState}
                    />
                  )}
                  {state.spellcasting?.prepareLimit?.method?.some(
                    (methodItem) => methodItem.name === 'classLevel'
                  ) && (
                    <>
                      <Dropdown
                        name='spellcasting.prepareLimit.level.measurement'
                        label='Level Measurement'
                        value={
                          state.spellcasting?.prepareLimit?.level?.measurement
                        }
                        options={builders.system.rules.measurement}
                        onChange={setState}
                      />
                      {state.spellcasting?.prepareLimit?.level?.measurement
                        ?.name === 'half' && (
                        <Dropdown
                          name='spellcasting.prepareLimit.level.rounding'
                          label='Level Rounding'
                          value={
                            state.spellcasting?.prepareLimit?.level?.rounding
                          }
                          options={builders.system.rules.rounding}
                          onChange={setState}
                        />
                      )}
                    </>
                  )}
                  <Input
                    name='spellcasting.maxSpellLevel'
                    autoComplete='off'
                    label='Max Spell Level'
                    required={true}
                    value={state.spellcasting?.maxSpellLevel}
                    validation='num'
                    error='Must contain whole numbers only'
                    onChange={setState}
                  />
                  <Dropdown
                    name='spellcasting.resetOption'
                    label='Spellslot Reset Option'
                    value={state.spellcasting?.resetOption}
                    options={builders.feature.chargeReset}
                    required={true}
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.spellcasting &&
                setState({
                  type: 'removed',
                  payload: { target: { name: 'spellcasting' } },
                })
              )}
            </>
          </SimpleGrid>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'primaryAbility'
          ) && <h6 className='pb-2'>Multiclass Ability Requirements</h6>}
          <SimpleGrid>
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'primaryAbility'
            ) && (
              <>
                <Dropdown
                  name='multiclass.primaryAbility'
                  label='Primary Ability'
                  value={state.multiclass?.primaryAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.secondaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.optionalAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.primaryAbility.minValue'
                  autoComplete='off'
                  label='Primary Score'
                  required={true}
                  value={state.multiclass?.primaryAbility?.minValue}
                  validation='num'
                  error='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'secondaryAbility'
            ) && (
              <>
                <Dropdown
                  name='multiclass.secondaryAbility'
                  label='Secondary Ability'
                  value={state.multiclass?.secondaryAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.primaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.optionalAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.secondaryAbility.minValue'
                  autoComplete='off'
                  label='Secondary Score'
                  required={true}
                  value={state.multiclass?.secondaryAbility?.minValue}
                  validation='num'
                  error='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'optionalAbility'
            ) && (
              <>
                <Dropdown
                  name='multiclass.optionalAbility'
                  label='Optional Ability'
                  value={state.multiclass?.optionalAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.primaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.secondaryAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.optionalAbility.minValue'
                  autoComplete='off'
                  label='Optional Score'
                  required={true}
                  value={state.multiclass?.optionalAbility?.minValue}
                  validation='num'
                  error='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
          </SimpleGrid>
          {(state.category?.name === 'base' ||
            state.attribute?.some(
              (attributeItem) => attributeItem.name === 'spellCaster'
            )) && (
            <>
              <CollapseContainer startOpened={true} title={'Attributes'}>
                <Table
                  name='levelAttribute'
                  rows={{
                    inputs: levelTableColumns?.inputs,
                    headers: levelTableColumns?.headers,
                  }}
                  value={state.levelAttribute}
                  onChange={setState}
                  addRow={true}
                  scrollable={true}
                />
              </CollapseContainer>
            </>
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'subtypes'
          ) ? (
            !state.subtype ? (
              setState({
                type: 'added',
                payload: { target: { name: 'subtype' } },
              })
            ) : (
              <>
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='sectionCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target='#subtypeCollapse'
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Subtypes</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show mb-2'
                  id='subtypeCollapse'
                >
                  <div className='section-content'>
                    <>
                      <Table
                        name='subtype'
                        rows={{
                          inputs: [
                            {
                              name: 'value',
                            },
                          ],
                          headers: [
                            {
                              value: 'Name',
                              readOnly: true,
                            },
                          ],
                        }}
                        value={state.subtype}
                        addRow={true}
                        onChange={setState}
                      />
                    </>
                  </div>
                </div>
              </>
            )
          ) : (
            !!state.subtype &&
            setState({
              type: 'removed',
              payload: { target: { name: 'subtype' } },
            })
          )}
        </>
      ),
    },
    {
      name: 'proficiencies',
      content: (
        <>
          {/* {state.proficiency?.length > 0 && (
            <DraggableTabs
              name='proficiency'
              tabState={state.proficiency?.map(
                (proficiencyItem, proficiencyIndex) => {
                  const multipleOptions = proficiencyItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'providesOptions'
                  )
                  return {
                    value:
                      proficiencyItem.value == null ||
                      proficiencyItem.value === ''
                        ? `Proficiency ${proficiencyIndex + 1}`
                        : proficiencyItem.value,
                    content: (
                      <Fragment key={proficiencyIndex}>
                        <SimpleGrid>
                          <Dropdown
                            multiSelect={true}
                            name={`proficiency.${proficiencyIndex}.attribute`}
                            options={[].concat(
                              builders.section.attribute,
                              state.category?.name === 'subclass' &&
                                builders.section.subclass.attribute
                            )}
                            label='Proficiency Attribute'
                            value={proficiencyItem.attribute}
                            onChange={setState}
                          />
                          {proficiencyItem.attribute?.some(
                            (attributeItem) =>
                              attributeItem.name === 'subtypeSpecific'
                          ) && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.subtype`}
                              label='Subtype'
                              value={proficiencyItem.subtype}
                              options={state.subtype}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.attribute?.some(
                            (attributeItem) =>
                              attributeItem.name === 'optionGroups'
                          ) && (
                            <Input
                              size='col-sm-2'
                              validation='num'
                              name={`proficiency.${proficiencyIndex}.optionGroup`}
                              label='Opt. Grp. #'
                              autoComplete='off'
                              value={proficiencyItem.optionGroup}
                              error='Must contain only numbers'
                              onChange={setState}
                            />
                          )}
                          <Dropdown
                            name={`proficiency.${proficiencyIndex}.area`}
                            label='Proficiency Area'
                            value={proficiencyItem.area}
                            options={builders.proficiency.area}
                            required={true}
                            onChange={setState}
                          />
                          {proficiencyItem.area?.name === 'skill' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.skill`}
                              multiSelect={true}
                              label='Skill'
                              value={proficiencyItem.skill}
                              options={builders.skill}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'saveAbility' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.saveAbility`}
                              multiSelect={true}
                              label='Save Ability'
                              value={proficiencyItem.saveAbility}
                              options={builders.ability}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'language' && (
                            <Dropdown
                              name={`proficiency.${proficiencyIndex}.language`}
                              multiSelect={true}
                              label='Language'
                              value={proficiencyItem.language}
                              options={builders.language}
                              onChange={setState}
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
                                onChange={setState}
                              />
                              {proficiencyItem.area?.name === 'property' && (
                                <Dropdown
                                  name={`proficiency.${proficiencyIndex}.property`}
                                  multiSelect={true}
                                  label='Item Property'
                                  value={proficiencyItem.property}
                                  options={[].concat(
                                    ...builders.item.category
                                      .filter((bCategoryItem) =>
                                        proficiencyItem.category?.length > 0
                                          ? proficiencyItem.category?.some(
                                              (categoryItem) =>
                                                categoryItem.name ===
                                                bCategoryItem.name
                                            )
                                          : bCategoryItem
                                      )
                                      .map((category) => category.property)
                                  )}
                                  onChange={setState}
                                />
                              )}
                              {proficiencyItem.area?.name === 'itemType' && (
                                <Dropdown
                                  name={`proficiency.${proficiencyIndex}.itemType`}
                                  multiSelect={true}
                                  label='Item Type'
                                  value={proficiencyItem.itemType}
                                  options={items.filter((itemType) =>
                                    proficiencyItem.category?.length > 0
                                      ? proficiencyItem.category?.some(
                                          (categoryItem) =>
                                            categoryItem.name ===
                                            itemType.category.name
                                        )
                                      : itemType
                                  )}
                                  onChange={setState}
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
                            onChange={setState}
                          />
                          {multipleOptions && (
                            <Input
                              validation='num'
                              name={`proficiency.${proficiencyIndex}.selectionCount`}
                              label='# of Selections'
                              autoComplete='off'
                              value={proficiencyItem.selectionCount}
                              error='Must contain only numbers'
                              required={true}
                              onChange={setState}
                            />
                          )}
                        </SimpleGrid>
                      </Fragment>
                    ),
                  }
                }
              )}
              addButtonOptions={[
                { name: 'proficiency', label: 'Add Proficiency' },
              ]}
              setState={setState}
              addRow={true}
            />
          )} */}
        </>
      ),
    },
    // {
    //   name: 'startingEquipment',
    //   content: (
    //     <>
    //       <DraggableTabs
    //         name='startingEquipment'
    //         tabState={state.startingEquipment?.map((groupItem, groupIndex) => {
    //           return {
    //             value: `Group ${groupIndex + 1}`,
    //             content: (
    //               <>
    //                 <ButtonTest
    //                   variant='outline'
    //                   onClick={() =>
    //                     setState({
    //                       type: 'added',
    //                       payload: {
    //                         target: {
    //                           name: `startingEquipment.${groupIndex}.option`,
    //                         },
    //                       },
    //                     })
    //                   }
    //                 >
    //                   Add Option
    //                 </ButtonTest>
    //                 {groupItem.option?.length > 0 &&
    //                   groupItem.option?.map((optionItem, optionIndex) => (
    //                     <Fragment key={optionIndex}>
    //                       {!optionItem.equipment?.length > 0 ? (
    //                         setState({
    //                           type: 'added',
    //                           payload: {
    //                             target: {
    //                               name: `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`,
    //                             },
    //                           },
    //                         })
    //                       ) : (
    //                         <Paper
    //                           shadow='sm'
    //                           p='md'
    //                           key={optionIndex}
    //                           className={style['equipment-option']}
    //                         >
    //                           <CloseButton
    //                             className={style['card-close-button']}
    //                             aria-label='close option'
    //                             onClick={() => {
    //                               setState({
    //                                 type: 'removed',
    //                                 payload: {
    //                                   target: {
    //                                     name: `startingEquipment.${groupIndex}.option.${optionIndex}`,
    //                                   },
    //                                 },
    //                               })
    //                             }}
    //                           />
    //                           <DraggableTabs
    //                             name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment`}
    //                             addRow={true}
    //                             tabState={optionItem.equipment?.map(
    //                               (equipmentItem, equipmentIndex) => {
    //                                 const multipleOptions =
    //                                   equipmentItem.attribute?.some(
    //                                     (attributeItem) =>
    //                                       attributeItem.name ===
    //                                       'providesOptions'
    //                                   )
    //                                 return {
    //                                   value: `Equipment ${equipmentIndex + 1}`,
    //                                   content: (
    //                                     <SimpleGrid key={equipmentIndex}>
    //                                       <Dropdown
    //                                         name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.attribute`}
    //                                         multiSelect={true}
    //                                         options={
    //                                           builders.section.item.attribute
    //                                         }
    //                                         label='Option Attributes'
    //                                         value={equipmentItem.attribute}
    //                                         onChange={setState}
    //                                       />
    //                                       <Dropdown
    //                                         name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.category`}
    //                                         multiSelect={true}
    //                                         label='Item Category'
    //                                         value={equipmentItem.category}
    //                                         options={builders.item.category}
    //                                         onChange={setState}
    //                                       />

    //                                       <Dropdown
    //                                         name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.property`}
    //                                         multiSelect={true}
    //                                         label='Item Property'
    //                                         value={equipmentItem.property}
    //                                         options={[].concat(
    //                                           ...builders.item.category
    //                                             .filter((bCategoryItem) =>
    //                                               equipmentItem.category
    //                                                 ?.length > 0
    //                                                 ? equipmentItem.category?.some(
    //                                                     (categoryItem) =>
    //                                                       categoryItem.name ===
    //                                                       bCategoryItem.name
    //                                                   )
    //                                                 : bCategoryItem
    //                                             )
    //                                             .map(
    //                                               (category) =>
    //                                                 category.property
    //                                             )
    //                                         )}
    //                                         onChange={setState}
    //                                       />
    //                                       <Dropdown
    //                                         name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.itemType`}
    //                                         multiSelect={true}
    //                                         label='Item Type'
    //                                         value={equipmentItem.itemType}
    //                                         options={items.filter(
    //                                           (itemType) =>
    //                                             (!equipmentItem.category ||
    //                                               equipmentItem.category
    //                                                 .length === 0 ||
    //                                               (equipmentItem.category
    //                                                 ?.length > 0 &&
    //                                                 equipmentItem.category.some(
    //                                                   (categoryItem) =>
    //                                                     categoryItem.name ===
    //                                                     itemType.category?.name
    //                                                 ))) &&
    //                                             (!equipmentItem.property ||
    //                                               equipmentItem.property
    //                                                 .length === 0 ||
    //                                               (equipmentItem.property
    //                                                 ?.length > 0 &&
    //                                                 itemType.property?.length >
    //                                                   0 &&
    //                                                 itemType.property.some(
    //                                                   (propertyItem) =>
    //                                                     equipmentItem.property.some(
    //                                                       (equipmentProperty) =>
    //                                                         equipmentProperty.name ===
    //                                                         propertyItem.name
    //                                                     )
    //                                                 )))
    //                                         )}
    //                                         onChange={setState}
    //                                       />
    //                                       {multipleOptions ? (
    //                                         <Input
    //                                           validation='num'
    //                                           name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.selectionCount`}
    //                                           label='# of Selections'
    //                                           autoComplete='off'
    //                                           value={
    //                                             equipmentItem.selectionCount
    //                                           }
    //                                           error='Must contain only numbers'
    //                                           required={true}
    //                                           onChange={setState}
    //                                         />
    //                                       ) : (
    //                                         <Input
    //                                           size='col-sm-2'
    //                                           validation='num'
    //                                           name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.quantity`}
    //                                           label='Quantity'
    //                                           autoComplete='off'
    //                                           value={equipmentItem.quantity}
    //                                           error='Must contain only numbers'
    //                                           required={true}
    //                                           onChange={setState}
    //                                         />
    //                                       )}
    //                                     </SimpleGrid>
    //                                   ),
    //                                 }
    //                               }
    //                             )}
    //                             setState={setState}
    //                             addButtonOptions={[
    //                               {
    //                                 name: `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`,
    //                                 label: 'Add Equipment',
    //                               },
    //                             ]}
    //                           />
    //                         </Paper>
    //                       )}
    //                       {optionIndex !== groupItem.option?.length - 1 && (
    //                         <Divider label={'OR'} />
    //                       )}
    //                     </Fragment>
    //                   ))}
    //               </>
    //             ),
    //           }
    //         })}
    //         setState={setState}
    //         addRow={true}
    //         addButtonOptions={[
    //           { name: 'startingEquipment', label: 'Add Equipment Group' },
    //         ]}
    //       />
    //     </>
    //   ),
    // },
    {
      name: 'features',
      content: (
        <>
          {/* {state.feature?.length > 0 && (
            <DraggableTabs
              name='feature'
              tabState={state.feature?.map((featureItem, featureIndex) => {
                const level = true
                const stateName = `feature.${featureIndex}`
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? `Feature ${featureIndex + 1}`
                      : featureItem.value,
                  content: (
                    <FeatureContent
                      stateName={stateName}
                      featureItem={featureItem}
                      level={level}
                      setState={setState}
                      state={state}
                      context={'class'}
                    />
                  ),
                }
              })}
              state={state.feature}
              addRow={true}
              reorder={true}
              addButtonOptions={[{ name: 'feature', label: 'feature' }]}
              setState={setState}
            />
          )} */}
        </>
      ),
    },
    {
      name: 'resourceFeature',
      content: (
        <>
          <SimpleGrid>
            <Input
              name='resourceFeature.value'
              label='Resource Name'
              autoComplete='off'
              value={state.resourceFeature?.value}
              required={true}
              onChange={setState}
            />
            <Input
              name='resourceFeature.levelAvailable'
              label='Level Available'
              autoComplete='off'
              value={state.resourceFeature?.levelAvailable}
              required={true}
              validation='num'
              error='Must contain whole numbers only'
              onChange={setState}
            />
            <TextEditor
              name={'resourceFeature.desc'}
              value={state.resourceFeature?.desc}
              label={'Description'}
              onChange={setState}
            />
          </SimpleGrid>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'resourceFeature.feature' } },
              })
            }
          >
            Add Feature
          </button>
          {/* {state.resourceFeature?.feature?.length > 0 && (
            <DraggableTabs
              name='resourceFeature'
              tabState={state.resourceFeature?.feature?.map(
                (featureItem, optionIndex) => {
                  const level = true
                  const stateName = 'resourceFeature.feature'
                  return {
                    value:
                      featureItem.value == null || featureItem.value === ''
                        ? startCase(`Feature ${optionIndex + 1}`)
                        : featureItem.value,
                    content: (
                      <FeatureContent
                        stateName={stateName}
                        featureItem={featureItem}
                        level={level}
                        setState={setState}
                        state={state}
                        context={'class'}
                      />
                    ),
                  }
                }
              )}
              setState={setState}
              addRow={true}
              addButtonOptions={[
                { name: 'resourceFeature.feature', label: 'Add Feature' },
              ]}
            />
          )} */}
          {!state.attribute?.some(
            (attributeItem) => attributeItem.name === 'resourceFeature'
          ) &&
            !!state.resourceFeature &&
            setState({
              type: 'removed',
              payload: { target: { name: 'resourceFeature' } },
            })}
        </>
      ),
    },
    {
      name: 'subclassDetails',
      content: (
        <>
          <SimpleGrid>
            <Input
              name='subclass.value'
              autoComplete='off'
              label='Subclass Feature Name'
              required={true}
              value={state.subclass?.value}
              onChange={setState}
            />
            <Input
              name='subclass.levelAcquired'
              autoComplete='off'
              label='Level Acquired'
              required={true}
              value={state.subclass?.levelAcquired}
              validation='num'
              error='Must contain whole numbers only'
              onChange={setState}
            />
          </SimpleGrid>
          <TextEditor
            name={'subclass.desc'}
            value={state.subclass?.desc}
            label={'Description'}
            onChange={setState}
          />
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
          <ButtonTest type='button' variant='primary' onClick={onSubmit}>
            Add
          </ButtonTest>
          <ButtonTest type='button' variant='warning' onClick={onReset}>
            Reset Form
          </ButtonTest>
          <ButtonTest
            type='button'
            variant='default'
            onClick={() => navigate(-1)}
          >
            Back
          </ButtonTest>
        </Group>
      </Flex>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <DraggableTabs
          name='main'
          addRow={false}
          tabState={mainTabContent
            .filter(
              (tabItem) =>
                (state.category?.name === 'subclass'
                  ? tabItem.name !== 'subclassDetails' &&
                    tabItem.name !== 'startingEquipment'
                  : tabItem) &&
                (state.attribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'resourceFeature'
                )
                  ? tabItem
                  : tabItem.name !== 'resourceFeature')
            )
            .map((content) => ({
              value: state[content.name]?.value ?? startCase(content.name),
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

export default NewClassForm
