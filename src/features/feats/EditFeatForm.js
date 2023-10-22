import { useEffect, useReducer, useState, useRef, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAddNewFeatMutation } from './featsApiSlice'
import {
  useUpdateFeatMutation,
  useGetFeatsQuery,
  selectAllFeats,
  selectFeatById,
} from './featsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { useGetItemsQuery, selectAllItems } from '../items/itemsApiSlice'
import { startCase, isEqual } from 'lodash'
import { handleValidation } from '../../helpers/form'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import TabNavigation from '../../components/TabNavigation'

const EditFeatForm = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const id = location.state.data
  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery('buildersList')

  const { spells, isFetching: isSpellsFetching } = useGetSpellsQuery(
    'spellList',
    {
      selectFromResult: ({ data }) => ({
        spells: data && selectAllSpells(data),
      }),
    }
  )

  const {
    feats,
    feat,
    isFetching: isFeatsFetching,
  } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
      feat: data && selectFeatById(data, id),
    }),
  })

  const { items, isFetching: isItemsFetching } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const [
    addNewFeat,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewFeatMutation()

  const [
    updateFeat,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateFeatMutation()

  const [oldState, setOldState] = useState(feat)
  const [state, setState] = useReducer(formReducer, feat)
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [match, setMatch] = useState()
  const [isLoadingData, setIsLoadingData] = useState(true)
  const textRefs = useRef([])

  useEffect(() => {
    if (
      isBuildersFetching ||
      isSpellsFetching ||
      isFeatsFetching ||
      isItemsFetching
    ) {
      setIsLoadingData(true)
    } else {
      setIsLoadingData(false)
    }
  }, [isBuildersFetching, isSpellsFetching, isFeatsFetching, isItemsFetching])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Feat added successfully!')
      const successElement = document.getElementById('error-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Feat updated successfully!')
      const successElement = document.getElementById('error-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
    if (updateIsError) {
      setErrorMessage(updateError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }, [addIsError, id, updateIsError, addError, updateError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (!!successMessage || !!errorMessage) {
        setSuccessMessage()
        setErrorMessage()
        handleValidation(true)
      }
    })
    return document.removeEventListener('keypress', () => {
      if (!!successMessage || !!errorMessage) {
        setSuccessMessage()
        setErrorMessage()
        handleValidation(true)
      }
    })
  })

  useEffect(() => {
    if (isEqual(oldState, state)) {
      setMatch(true)
    } else {
      setMatch(false)
    }
  }, [state, oldState])

  const addToTextRefs = (ref) => {
    if (ref && !textRefs.current.includes(ref)) {
      textRefs.current.push(ref)
    }
  }

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: oldState },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
    textRefs.current.forEach((textRef) => {
      textRef.revertState()
    })
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

  const onUpdate = async () => {
    const isValid = handleValidation()
    if (isValid) {
      if (match) {
        setErrorMessage('No changes made')
      } else {
        await updateFeat(state)
        setOldState(state)
      }
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  const onBackClick = () => {
    navigate(-1, {
      state: {
        data: id,
        background: location.state.previous.state.background,
        title: match ? state.value : oldState.value,
        context: 'itemCard',
        size: 'lg',
      },
    })
  }

  let content

  if (isLoadingData) {
    return (content = <Spinner />)
  }
  const damageTableInputs = (secondary) => {
    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'damage-col',
      },
      {
        name: 'diceCount',
        value: 'Dice Count',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'damage-col',
      },
      {
        name: 'diceValue',
        value: 'Dice Value',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'damage-col',
      },
      {
        name: 'bonusDamage',
        value: 'Bonus Damage',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'damage-col',
      },
    ]
    if (secondary) {
      inputArray.push(
        {
          name: 'secDiceCount',
          value: 'Sec. Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'damage-col',
        },
        {
          name: 'secDiceValue',
          value: 'Sec. Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'damage-col',
        }
      )
    }

    return inputArray
  }

  const sectionTabContent = (feature, featureIndex) => {
    const tabContent = [
      {
        name: 'feat',
        content() {
          return feature[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.sectionAttribute}
                    placeholder='Feature Attributes'
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label={true}
                      placeholder='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Feat'
                    value={multipleOptions ? item?.options : item?.setSelection}
                    options={feats}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'modifier',
        content() {
          return feature[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.sectionAttribute}
                    placeholder='Feature Attributes'
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label={true}
                      placeholder='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}

                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                    placeholder='Modifier Type'
                    value={item.modType}
                    options={builders.modifier.modType}
                    required={true}
                    onChange={setState}
                  />
                  {item.modType?.name && (
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.module`}
                      placeholder='Modifier Category'
                      value={item.module}
                      options={builders.modifier.module?.filter((moduleItem) =>
                        builders.modifier.modType
                          .find(
                            (typeItem) => typeItem.name === item.modType?.name
                          )
                          ?.module.map((m) => m.id)
                          ?.some((moduleID) => moduleID === moduleItem._id)
                      )}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {(item.modType?.name === 'bonus' ||
                    item.modType?.name === 'penalty' ||
                    item.modType?.name === 'advantage' ||
                    item.modType?.name === 'disadvantage' ||
                    item.modType?.name === 'setValue') && (
                    <>
                      {item.module?.name === 'ability' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.ability${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Ability'
                          value={
                            multipleOptions
                              ? item.ability?.options
                              : item.ability?.setSelection
                          }
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'saveAbility' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.saveAbility${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Save Ability'
                          value={
                            multipleOptions
                              ? item.saveAbility?.options
                              : item.saveAbility?.setSelection
                          }
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'skill' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.skill${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Skill'
                          value={
                            multipleOptions
                              ? item.skill?.options
                              : item.skill?.setSelection
                          }
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'damageSave' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.damageSave${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Damage'
                          value={
                            multipleOptions
                              ? item.damageSave?.options
                              : item.damageSave?.setSelection
                          }
                          options={builders.damage}
                          require={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'conditionSave' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.conditionSave${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Condition'
                          value={
                            multipleOptions
                              ? item.conditionSave?.options
                              : item.conditionSave?.setSelection
                          }
                          options={builders.condition}
                          required={true}
                          onChange={setState}
                        />
                      )}
                    </>
                  )}
                  {(item.modType?.name === 'bonus' ||
                    item.modType?.name === 'penalty') &&
                    item.modType?.name !== 'setValue' && (
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method`}
                        placeholder='Method'
                        value={item.method}
                        options={builders.modifier.method.filter((methodItem) =>
                          methodItem.module?.some(
                            (moduleItem) => moduleItem.id === item.module?.id
                          )
                        )}
                        required={true}
                        onChange={setState}
                      />
                    )}
                  {item.module?.name === 'condition' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.condition${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Condition Type'
                      value={
                        multipleOptions
                          ? item.condition?.options
                          : item.condition?.setSelection
                      }
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.speed${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      value={
                        multipleOptions
                          ? item.speed?.options
                          : item.speed?.setSelection
                      }
                      placeholder='Speed Type'
                      options={builders.speed}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.passive${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Passive Type'
                      value={
                        multipleOptions
                          ? item.passive?.options
                          : item.passive?.setSelection
                      }
                      options={builders.passive}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    item.module?.name === 'damage' && (
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.damage${
                          multipleOptions ? '.options' : '.setSelection'
                        }`}
                        multiple={true}
                        placeholder='Damage Type'
                        value={
                          multipleOptions
                            ? item.damage?.options
                            : item.damage?.setSelection
                        }
                        options={builders.damage}
                        required={true}
                        onChange={setState}
                      />
                    )
                  )}
                  {item.method?.name === 'setValue' ||
                  item.modType?.name === 'setValue' ? (
                    <>
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.method.setSelectionValue`}
                        placeholder='Set Value'
                        label={true}
                        invalidText='Must contain only numbers'
                        autoComplete='off'
                        value={item.method?.setSelectionValue}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  ) : item.method?.name === 'ability' ? (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method.ability`}
                        placeholder='Method Ability'
                        value={item.method.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                        placeholder='Multiplier'
                        label={true}
                        invalidText='Must contain only whole numbers'
                        autoComplete='off'
                        value={item.multiplier}
                        onChange={setState}
                      />
                    </>
                  ) : (
                    item.method?.name === 'skill' && (
                      <>
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.method.skill`}
                          placeholder='Method Skill'
                          value={item.method.skill}
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                        <Input
                          validation='num'
                          name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                          placeholder='Multiplier'
                          label={true}
                          invalidText='Must contain only whole numbers'
                          autoComplete='off'
                          value={item.multiplier}
                          onChange={setState}
                        />
                      </>
                    )
                  )}
                  {(item.modType?.name === 'bonus' ||
                    item.modType?.name === 'setValue') &&
                    item.module?.name === 'ability' && (
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.maxValue`}
                        label={true}
                        placeholder='Max Value'
                        autoComplete='off'
                        value={item.maxValue}
                        invalidText='Must contain only numbers'
                        required={true}
                        onChange={setState}
                      />
                    )}
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
                <div className='row'>
                  {item.method?.name === 'addPerLevel' &&
                    (!item?.addPerLevel ? (
                      setState({
                        type: 'added',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.${this.name}.${index}.addPerLevel`,
                          },
                        },
                      })
                    ) : (
                      <Table
                        name={`feature.${featureIndex}.${this.name}.${index}.addPerLevel`}
                        inputs={[
                          {
                            name: 'level',
                            value: 'Level',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            label: true,
                            size: 'col-5',
                          },
                          {
                            name: 'amount',
                            value: 'Level',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            label: true,
                            size: 'col-5',
                          },
                        ]}
                        value={item.addPerLevel}
                        dynamic={true}
                        onChange={setState}
                      />
                    ))}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'proficiency',
        content() {
          return feature[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.sectionAttribute}
                    placeholder='Feature Attributes'
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label={true}
                      placeholder='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.area`}
                    placeholder='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    required={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'skill' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.skill${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Skill'
                      value={
                        multipleOptions
                          ? item.skill?.options
                          : item.skill?.setSelection
                      }
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'saveAbility' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.saveAbility${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Save Ability'
                      value={
                        multipleOptions
                          ? item.saveAbility?.options
                          : item.saveAbility?.setSelection
                      }
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'language' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.language${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Language'
                      value={
                        multipleOptions
                          ? item.language?.options
                          : item.language?.setSelection
                      }
                      options={builders.language}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {(item.area?.name === 'property' ||
                    item.area?.name === 'itemType') && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.category${
                          multipleOptions ? '.options' : '.setSelection'
                        }`}
                        multiple={true}
                        placeholder='Item Category'
                        value={
                          multipleOptions
                            ? item.category?.options
                            : item.category?.setSelection
                        }
                        options={builders.item.category}
                        onChange={setState}
                      />
                      {item.area?.name === 'property' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.property${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Item Property'
                          value={
                            multipleOptions
                              ? item.property?.options
                              : item.property?.setSelection
                          }
                          options={[].concat(
                            ...builders.item.category
                              .filter((bCategoryItem) =>
                                multipleOptions
                                  ? item.category?.options?.length > 0
                                    ? item.category?.options?.some(
                                        (categoryItem) =>
                                          categoryItem.name ===
                                          bCategoryItem.name
                                      )
                                    : bCategoryItem
                                  : item.category?.setSelection?.length > 0
                                  ? item.category?.setSelection?.some(
                                      (categoryItem) =>
                                        categoryItem.name === bCategoryItem.name
                                    )
                                  : bCategoryItem
                              )
                              .map((category) => category.property)
                          )}
                          onChange={setState}
                        />
                      )}
                      {item.area?.name === 'itemType' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.itemType${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          placeholder='Item Type'
                          value={
                            multipleOptions
                              ? item.itemType?.options
                              : item.itemType?.setSelection
                          }
                          options={items.filter((itemType) =>
                            multipleOptions
                              ? item.category?.options?.length > 0
                                ? item.category?.options?.some(
                                    (category) =>
                                      category.name === itemType.category.name
                                  )
                                : itemType
                              : item.category?.setSelection?.length > 0
                              ? item.category?.setSelection?.some(
                                  (category) =>
                                    category.name === itemType.category.name
                                )
                              : itemType
                          )}
                          onChange={setState}
                        />
                      )}
                    </>
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.level`}
                    placeholder='Proficiency Level'
                    value={item.level}
                    options={builders.proficiency.level}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'sense',
        content() {
          return feature[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.sectionAttribute}
                    placeholder='Feature Attributes'
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label={true}
                      placeholder='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Sense'
                    value={multipleOptions ? item?.options : item?.setSelection}
                    options={builders.sense}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'spell',
        content() {
          return feature[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.sectionAttribute}
                    placeholder='Feature Attributes'
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label={true}
                      placeholder='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    value={item.attribute}
                    required={true}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Spell'
                    value={
                      multipleOptions
                        ? item.saveAbility?.options
                        : item.saveAbility?.setSelection
                    }
                    options={spells}
                    required={true}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionalAbility'
                  ) && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.ability${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      placeholder='Ability'
                      value={
                        multipleOptions
                          ? item.ability?.options
                          : item.ability?.setSelection
                      }
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
    ]
    return tabContent
  }

  const featureTabContent = (featureItem, featureIndex) => (
    <Fragment key={featureIndex}>
      <div className='row justify-content-between g-2 pb-2'>
        <Input
          size='col-sm-4'
          name={`feature.${featureIndex}.value`}
          border={false}
          autoComplete='off'
          placeholder='Feature Name'
          value={featureItem.value}
          clickable={false}
          onChange={setState}
          onClick={(e) => e.stopPropagation()}
        />
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
            {sectionTabContent(featureItem, featureIndex).map(
              (sectionItem, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`feature.${featureIndex}.${sectionItem.name}`}
                    onClick={(e) => setState({ type: 'added', payload: e })}
                  >
                    {`${startCase(sectionItem.name)}`}
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
      <TextEditor
        ref={addToTextRefs}
        className='pb-2'
        placeholder='Feature description'
        value={featureItem.desc}
        name={`feature.${featureIndex}.desc`}
        onChange={setState}
      />
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
        <Select
          multiple={true}
          name={`feature.${featureIndex}.attribute`}
          value={featureItem.attribute}
          options={builders.feature.attribute.filter((attributeItem) =>
            !featureItem.attribute?.some((item) => item.name === 'doesDamage')
              ? attributeItem.name !== 'secondaryDamage'
              : attributeItem
          )}
          placeholder='Feature Attributes'
          onChange={setState}
        />
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.limitUse.limitBy`}
              placeholder='Limit By Option'
              value={featureItem.limitUse?.limitBy}
              options={builders.feature.chargeLimit}
              required={true}
              onChange={setState}
            />
            {featureItem.limitUse?.limitBy?.name === 'ability' ? (
              <>
                <Select
                  name={`feature.${featureIndex}.limitUse.ability`}
                  placeholder='Ability'
                  value={featureItem.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name={`feature.${featureIndex}.limitUse.minValue`}
                  autoComplete='off'
                  placeholder='Min. Value'
                  label={true}
                  value={featureItem?.limitUse?.minValue}
                  onChange={setState}
                />
              </>
            ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
              <Select
                name={`feature.${featureIndex}.limitUse.skill`}
                placeholder='Skill'
                value={featureItem.limitUse?.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            ) : (
              featureItem.limitUse?.limitBy?.name === 'setNumber' && (
                <Input
                  validation='num'
                  name={`feature.${featureIndex}.limitUse.setSelectionAmount`}
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Use Amount'
                  required={true}
                  value={featureItem.limitUse.setSelectionAmount}
                  onChange={setState}
                />
              )
            )}
            <Select
              name={`feature.${featureIndex}.limitUse.resetsOn`}
              placeholder='Reset Option'
              value={featureItem.limitUse?.resetsOn}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'isAction'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.action`}
              placeholder='Action Type'
              value={featureItem.action}
              options={builders.feature.action}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'hasRange'
        ) && (
          <>
            <Input
              validation='num'
              name={`feature.${featureIndex}.range.minRange`}
              autoComplete='off'
              label={true}
              placeholder='Min Range'
              required={true}
              value={featureItem.range.minRange}
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            <Input
              validation={'num'}
              name={`feature.${featureIndex}.range.maxRange`}
              label={true}
              autoComplete='off'
              placeholder='Max Range'
              invalidText='Must contain only numbers'
              required={true}
              value={featureItem.range.maxRange}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'requireSave'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.saveAbility.attribute`}
              multiple={true}
              placeholder='Save Attribute'
              value={featureItem.saveAbility?.attribute}
              options={builders.feature.saveAttribute}
              required={true}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.saveAbility.ability`}
              placeholder='DC Ability'
              value={featureItem.saveAbility?.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`feature.${featureIndex}.saveAbility.minValue`}
              label={true}
              autoComplete='off'
              placeholder='Min. Value'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.saveAbility?.minValue}
              onChange={setState}
            />
            {featureItem.saveAbility?.attribute?.some(
              (attributeItem) => attributeItem.name === 'addAbilityModifier'
            ) && (
              <Select
                name={`feature.${featureIndex}.saveAbility.abilityModifier`}
                placeholder='Modifier Ability'
                value={featureItem.saveAbility?.abilityModifier}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
            )}
          </>
        )}
      </div>
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'hasRequirements'
      ) && (
        <>
          <div className='d-flex'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Requirements</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.option`}
              value={featureItem.requirement?.option}
              placeholder='Requirement'
              options={builders.feature.requirement}
              required={true}
              onChange={setState}
            />
          </div>
          {featureItem.requirement?.option?.some(
            (optionItem) => optionItem.name === 'skillProficiency'
          ) && (
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.skillProficiency.skill`}
              value={featureItem.requirement?.skillProficiency?.skill}
              placeholder='Skill Proficiency'
              options={builders.skill}
              required={true}
              onChange={setState}
            />
          )}
          {featureItem.requirement?.option?.some(
            (optionItem) => optionItem.name === 'abilityScore'
          ) && (
            <>
              <Select
                multiple={true}
                name={`feature.${featureIndex}.requirement.abilityScore.ability`}
                value={featureItem.requirement?.abilityScore?.ability}
                placeholder='Ability'
                options={builders.ability}
                required={true}
                onChange={setState}
              />
              <Input
                name={`feature.${featureIndex}.requirement.abilityScore.score`}
                value={featureItem.requirement?.abilityScore?.score}
                placeholder='Score'
                required={true}
                label={true}
                validation='num'
                invalidText='Must contain only numbers'
                onChange={setState}
              />
            </>
          )}
        </>
      )}
      {featureItem.requirement?.option?.some(
        (optionItem) => optionItem.name === 'itemProficiency'
      ) && (
        <>
          <div className='d-flex mx-5'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Item Proficiency</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row g-2 pb-3 mx-5 justify-contents-center'>
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.itemProficiency.category`}
              value={featureItem.requirement?.itemProficiency?.category}
              placeholder='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.requirement.itemProficiency.property`}
              multiple={true}
              placeholder='Item Property'
              value={featureItem.requirement?.itemProficiency?.property}
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement?.itemProficiency?.category?.length >
                    0
                      ? featureItem.requirement?.itemProficiency?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.requirement.itemProficiency.itemType`}
              multiple={true}
              placeholder='Item type'
              value={featureItem.requirement?.itemProficiency?.itemType}
              options={items.filter((item) =>
                featureItem.requirement.itemProficiency?.category?.length > 0
                  ? featureItem.requirement.itemProficiency?.category?.some(
                      (category) => category.name === item.category.name
                    )
                  : item
              )}
              onChange={setState}
            />
          </div>
        </>
      )}
      {featureItem.requirement?.option?.some(
        (optionItem) => optionItem.name === 'equipped'
      ) && (
        <>
          <div className='d-flex mx-5'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Equipped</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row g-2 pb-3 mx-5 justify-contents-center'>
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.equipped.category`}
              value={featureItem.requirement?.equipped?.category}
              placeholder='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.equipped.property`}
              placeholder='Item Property'
              value={featureItem.requirement?.equipped?.property}
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement?.equipped?.category?.length > 0
                      ? featureItem.requirement?.equipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.equipped.itemType`}
              placeholder='Item type'
              value={featureItem.requirement?.equipped?.itemType}
              options={items.filter((item) =>
                featureItem.requirement.equipped?.category?.length > 0
                  ? featureItem.requirement.equipped?.category?.some(
                      (category) => category.name === item.category.name
                    )
                  : item
              )}
              onChange={setState}
            />
          </div>
        </>
      )}
      {featureItem.requirement?.option?.some(
        (optionItem) => optionItem.name === 'notEquipped'
      ) && (
        <>
          <div className='d-flex mx-5'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Not Equipped</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.notEquipped.category`}
              value={featureItem.requirement?.notEquipped?.category}
              placeholder='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.notEquipped.property`}
              value={featureItem.requirement?.notEquipped?.property}
              placeholder='Item Property'
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement.notEquipped?.category?.length > 0
                      ? featureItem.requirement.notEquipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
              placeholder='Item type'
              value={featureItem.requirement?.notEquipped?.itemType}
              options={items.filter((item) =>
                featureItem.requirement.notEquipped?.category?.length > 0
                  ? featureItem.requirement.notEquipped?.category?.some(
                      (category) => category.name === item.category.name
                    )
                  : item
              )}
              onChange={setState}
            />
          </div>
        </>
      )}
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'limitUse'
      ) &&
        featureItem.limitUse?.limitBy?.name === 'level' &&
        (!featureItem.limitUse.level ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.limitUse.level`,
              },
            },
          })
        ) : (
          <>
            <div
              className='btn btn-section-collapse justify-content-between align-items-center'
              id='sectionCollapseButton'
              type='button'
              role='button'
              data-bs-toggle='collapse'
              data-bs-target={`#limitUse${featureIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Limit Use Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`limitUse${featureIndex}Collapse`}
            >
              <div className='section-content'>
                <Table
                  inputs={[
                    {
                      name: 'value',
                      value: 'Level',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                      size: 'col-5',
                    },
                    {
                      name: 'useNum',
                      value: 'Uses',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                      size: 'col-5',
                    },
                  ]}
                  name={`feature.${featureIndex}.limitUse.level`}
                  value={featureItem.limitUse?.level}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            </div>
          </>
        ))}
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'doesDamage'
      ) ? (
        !featureItem.damage?.diceByLevel ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.damage.diceByLevel`,
              },
            },
          })
        ) : (
          <>
            <div className='row g-2 align-items-end pb-2'>
              <Select
                multiple={true}
                name={`feature.${featureIndex}.damage.damageAttribute`}
                placeholder='Damage Attribute'
                value={featureItem.damage?.damageAttribute}
                options={builders.feature.damageAttribute}
                required={true}
                onChange={setState}
              />
              <Select
                name={`feature.${featureIndex}.damage.damageType`}
                multiple={true}
                placeholder='Damage Type'
                value={featureItem.damage?.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
            </div>
            <div
              className='btn btn-section-collapse justify-content-between align-items-center'
              id='sectionCollapseButton'
              type='button'
              role='button'
              data-bs-toggle='collapse'
              data-bs-target={`#section${featureIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Damage Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`section${featureIndex}Collapse`}
            >
              <div className='section-content'>
                <Table
                  inputs={damageTableInputs(
                    featureItem.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'secondaryDamage'
                    )
                  )}
                  name={`feature.${featureIndex}.damage.diceByLevel`}
                  value={featureItem.damage?.diceByLevel}
                  onChange={setState}
                  dynamic={true}
                  scrollable={true}
                />
              </div>
            </div>
          </>
        )
      ) : (
        featureItem.damage != null &&
        Object.keys(featureItem.damage).length !== 0 &&
        setState({
          type: 'removed',
          payload: { target: { name: `feature.${featureIndex}.damage` } },
        })
      )}
      {Object.keys(featureItem)?.length !== 0 &&
        Object.keys(featureItem)?.some(
          (key) => featureItem[key]?.length !== 0
        ) && (
          <TabNavigation
            id={`section${featureIndex}`}
            tabState={[].concat(
              ...sectionTabContent(featureItem, featureIndex)
                .filter(
                  (sectionItem) => featureItem[sectionItem.name]?.length > 0
                )
                ?.map((sectionItem) =>
                  sectionItem.content().map((contentItem, contentIndex) => ({
                    value: `${sectionItem.name} ${contentIndex + 1}`,
                    name: `feature.${featureIndex}.${sectionItem.name}.${contentIndex}`,
                    content: contentItem,
                  }))
                )
            )}
            dynamic={true}
            onDelete={setState}
          />
        )}
    </Fragment>
  )

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <Fragment>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Input
              name='value'
              autoComplete='off'
              placeholder='Feat Name'
              label={true}
              value={state.value}
              required={true}
              onChange={setState}
            />
          </div>
          <div className='pb-2'>
            <TextEditor
              ref={addToTextRefs}
              name={'desc'}
              value={state.desc}
              placeholder={'Feat Description'}
              onChange={setState}
            />
          </div>
        </Fragment>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
            <Select
              multiple={true}
              name='attribute'
              value={state.attribute}
              options={builders.feature.attribute.filter((attributeItem) =>
                !state.attribute?.some((item) => item.name === 'doesDamage')
                  ? attributeItem.name !== 'secondaryDamage'
                  : attributeItem
              )}
              placeholder='Feat Attributes'
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'limitUse'
            ) && (
              <>
                <Select
                  name='limitUse.limitBy'
                  placeholder='Limit By Option'
                  value={state.limitUse?.limitBy}
                  options={builders.feature.chargeLimit}
                  required={true}
                  onChange={setState}
                />
                {state.limitUse?.limitBy?.name === 'ability' ? (
                  <>
                    <Select
                      name='limitUse.ability'
                      placeholder='Ability'
                      value={state.limitUse?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      name='limitUse.minValue'
                      autoComplete='off'
                      placeholder='Min. Value'
                      label={true}
                      value={state.limitUse?.minValue}
                      onChange={setState}
                    />
                  </>
                ) : state.limitUse?.limitBy?.name === 'skill' ? (
                  <Select
                    name='limitUse.skill'
                    placeholder='Skill'
                    value={state.limitUse?.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  state.limitUse?.limitBy?.name === 'setNumber' && (
                    <Input
                      validation='num'
                      name='limitUse.setSelectionAmount'
                      label={true}
                      invalidText='Must contain only numbers'
                      placeholder='Use Amount'
                      required={true}
                      value={state.limitUse.setSelectionAmount}
                      onChange={setState}
                    />
                  )
                )}
                <Select
                  name='limitUse.resetsOn'
                  placeholder='Reset Option'
                  value={state.limitUse?.resetsOn}
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
                <Select
                  name='action'
                  placeholder='Action Type'
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
                  name='range.minRange'
                  autoComplete='off'
                  label={true}
                  placeholder='Min Range'
                  required={true}
                  value={state.range.minRange}
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
                <Input
                  validation={'num'}
                  name='range.maxRange'
                  label={true}
                  autoComplete='off'
                  placeholder='Max Range'
                  invalidText='Must contain only numbers'
                  required={true}
                  value={state.range.maxRange}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Select
                  name='saveAbility.attribute'
                  multiple={true}
                  placeholder='Save Attribute'
                  value={state.saveAbility?.attribute}
                  options={builders.feature.saveAttribute}
                  required={true}
                  onChange={setState}
                />
                <Select
                  name='saveAbility.ability'
                  placeholder='DC Ability'
                  value={state.saveAbility?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='saveAbility.minValue'
                  label={true}
                  autoComplete='off'
                  placeholder='Min. Value'
                  required={true}
                  invalidText='Must contain only numbers'
                  value={state.saveAbility?.minValue}
                  onChange={setState}
                />
                {state.saveAbility?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Select
                    name='saveAbility.abilityModifier'
                    placeholder='Modifier Ability'
                    value={state.saveAbility?.abilityModifier}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
              </>
            )}
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'hasRequirements'
          ) && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Requirements</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <Select
                multiple={true}
                name='requirement.option'
                value={state.requirement?.option}
                placeholder='Requirement'
                options={builders.feature.requirement}
                required={true}
                onChange={setState}
              />
              {state.requirement?.option?.some(
                (optionItem) => optionItem.name === 'skillProficiency'
              ) && (
                <Select
                  multiple={true}
                  name='requirement.skillProficiency.skill'
                  value={state.requirement?.skillProficiency?.skill}
                  placeholder='Skill Proficiency'
                  options={builders.skill}
                  required={true}
                  onChange={setState}
                />
              )}
              {state.requirement?.option?.some(
                (optionItem) => optionItem.name === 'abilityScore'
              ) && (
                <>
                  <Select
                    multiple={true}
                    name='requirement.abilityScore.ability'
                    value={state.requirement?.abilityScore?.ability}
                    placeholder='Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    name='requirement.abilityScore.score'
                    value={state.requirement?.abilityScore?.score}
                    placeholder='Score'
                    required={true}
                    label={true}
                    validation='num'
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                </>
              )}
            </>
          )}
          {state.requirement?.option?.some(
            (optionItem) => optionItem.name === 'itemProficiency'
          ) && (
            <>
              <div className='d-flex mx-5'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Item Proficiency</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                <Select
                  multiple={true}
                  name='requirement.itemProficiency.category'
                  value={state.requirement?.itemProficiency?.category}
                  placeholder='Item Category'
                  options={builders.item.category}
                  onChange={setState}
                />
                <Select
                  name='requirement.itemProficiency.itemType'
                  placeholder='Item type'
                  value={state.requirement?.itemProficiency?.itemType}
                  options={items.filter((item) =>
                    state.requirement.itemProficiency?.category?.length > 0
                      ? state.requirement.itemProficiency?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )}
                  onChange={setState}
                />
                <Select
                  name='requirement.itemProficiency.property'
                  placeholder='Item Property'
                  value={state.requirement?.itemProficiency?.property}
                  options={[].concat(
                    ...items
                      .filter((item) =>
                        state.requirement.itemProficiency?.category?.length > 0
                          ? state.requirement.itemProficiency?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        state.requirement.itemProficiency?.itemType?.length > 0
                          ? state.requirement.itemProficiency?.itemType?.some(
                              (type) => type.name === item.name
                            )
                          : item
                      )
                      .map((item) => item.property)
                  )}
                  onChange={setState}
                />
              </div>
            </>
          )}
          {state.requirement?.option?.some(
            (optionItem) => optionItem.name === 'equipped'
          ) && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Equipped</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                <Select
                  multiple={true}
                  name='requirement.equipped.category'
                  value={state.requirement?.equipped?.category}
                  placeholder='Item Category'
                  options={builders.item.category}
                  onChange={setState}
                />
                <Select
                  multiple={true}
                  name='requirement.equipped.itemType'
                  placeholder='Item type'
                  value={state.requirement?.equipped?.itemType}
                  options={items.filter((item) =>
                    state.requirement.equipped?.category?.length > 0
                      ? state.requirement.equipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )}
                  onChange={setState}
                />
                <Select
                  multiple={true}
                  name='requirement.equipped.property'
                  placeholder='Item Property'
                  value={state.requirement?.equipped?.property}
                  options={[].concat(
                    ...items
                      .filter((item) =>
                        state.requirement.equipped?.category?.length > 0
                          ? state.requirement.equipped?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        state.requirement.equipped?.itemType?.length > 0
                          ? state.requirement.equipped?.itemType?.some(
                              (type) => type.name === item.name
                            )
                          : item
                      )
                      .map((item) => item.property)
                  )}
                  onChange={setState}
                />
              </div>
            </>
          )}
          {state.requirement?.option?.some(
            (optionItem) => optionItem.name === 'notEquipped'
          ) && (
            <>
              <div className='d-flex mx-5'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Not Equipped</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                <Select
                  multiple={true}
                  name='requirement.notEquipped.category'
                  value={state.requirement?.notEquipped?.category}
                  placeholder='Item Category'
                  options={builders.item.category}
                  onChange={setState}
                />
                <Select
                  multiple={true}
                  name='requirement.notEquipped.itemType'
                  placeholder='Item type'
                  value={state.requirement?.notEquipped?.itemType}
                  options={items.filter((item) =>
                    state.requirement.notEquipped?.category?.length > 0
                      ? state.requirement.notEquipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )}
                  onChange={setState}
                />
                <Select
                  multiple={true}
                  name='requirement.notEquipped.property'
                  placeholder='Item Property'
                  value={state.requirement?.notEquipped?.property}
                  options={[].concat(
                    ...items
                      .filter((item) =>
                        state.requirement.notEquipped?.category?.length > 0
                          ? state.requirement.notEquipped?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        state.requirement.notEquipped?.itemType?.length > 0
                          ? state.requirement.notEquipped?.itemType?.some(
                              (type) => type.name === item.name
                            )
                          : item
                      )
                      .map((item) => item.property)
                  )}
                  onChange={setState}
                />
              </div>
            </>
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'limitUse'
          ) &&
            state.limitUse?.limitBy?.name === 'level' &&
            (!state.limitUse.level ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'limitUse.level',
                  },
                },
              })
            ) : (
              <div>
                <Table
                  inputs={[
                    {
                      name: 'value',
                      value: 'Level',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                    },
                    {
                      name: 'useNum',
                      value: 'Uses',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                    },
                  ]}
                  name='limitUse.level'
                  value={state.limitUse?.level}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            ))}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) ? (
            !state.damage?.diceByLevel ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'damage.diceByLevel',
                  },
                },
              })
            ) : (
              <div className='row g-2 align-items-end pb-2'>
                <Select
                  multiple={true}
                  name='damage.damageAttribute'
                  value={state.damage?.damageAttribute}
                  placeholder='Damage Attribute'
                  options={builders.feature.damageAttribute}
                  required={true}
                  onChange={setState}
                />
                <Select
                  name='damage.damageType'
                  multiple={true}
                  placeholder='Damage Type'
                  value={state.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setState}
                />
              </div>
            )
          ) : (
            state.damage != null &&
            Object.keys(state.damage).length !== 0 &&
            setState({
              type: 'removed',
              payload: { target: { name: 'damage ' } },
            })
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) &&
            Object.keys(state.damage).length !== 0 && (
              <>
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='sectionCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target='#sectionCollapse'
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Damage Table</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show'
                  id='sectionCollapse'
                >
                  <div className='section-content'>
                    <Table
                      inputs={damageTableInputs(
                        state.attribute?.some(
                          (attributeItem) =>
                            attributeItem.name === 'secondaryDamage'
                        )
                      )}
                      name='damage.diceByLevel'
                      value={state.damage?.diceByLevel}
                      onChange={setState}
                      dynamic={true}
                      scrollable={true}
                    />
                  </div>
                </div>
              </>
            )}
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Edit a Feat</h3>
        </div>
        <div className='col-auto d-flex justify-content-end'>
          <button
            className='btn btn-success me-2'
            type='button'
            onClick={() => {
              onUpdate()
            }}
          >
            Update
          </button>
          <button
            className='btn btn-primary me-2'
            type='button'
            onClick={() => {
              onSubmit()
            }}
          >
            Add
          </button>
          <button className='btn btn-warning me-2' onClick={onReset}>
            Reset Form
          </button>
          <button className='btn btn-secondary' onClick={onBackClick}>
            Back
          </button>
        </div>
      </div>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form className='needs-validation' noValidate>
        <TabNavigation
          id='main'
          dynamic={false}
          tabState={mainTabContent.map((content) => ({
            value: content.name,
            name: content.name,
            content: content.content,
          }))}
        />
        <TabNavigation
          id='feature'
          tabState={
            state.feature?.length > 0 &&
            state.feature?.map((featureItem, featureIndex) => ({
              value:
                featureItem.name == null || featureItem.name === ''
                  ? `feature ${featureIndex + 1}`
                  : featureItem.name,
              name: `feature.${featureIndex}`,
              content: featureTabContent(featureItem, featureIndex),
            }))
          }
          onDelete={setState}
          onAdd={setState}
          dynamic={true}
        />
      </form>
    </>
  )
  return <div className='main-container'>{content}</div>
}
export default EditFeatForm
