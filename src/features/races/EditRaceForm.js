import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  selectAllRaces,
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useGetRacesQuery,
  selectRaceById,
} from './racesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import { selectAllItems, useGetItemsQuery } from '../items/itemsApiSlice'
import { startCase, isEqual } from 'lodash'
import { handleValidation } from '../../helpers/form'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const EditRaceForm = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const id = location.state.data

  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery('buildersList')

  const {
    races,
    race,
    isFetching: isRacesFetching,
  } = useGetRacesQuery('racesList', {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
      race: data && selectRaceById(data, id),
    }),
  })

  const { spells, isFetching: isSpellsFetching } = useGetSpellsQuery(
    'spellList',
    {
      selectFromResult: ({ data }) => ({
        spells: data && selectAllSpells(data),
      }),
    }
  )

  const { feats, isFetching: isFeatsFetching } = useGetFeatsQuery(
    'featsList',
    {
      selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
    }
  )

  const { items, isFetching: isItemsFetching } = useGetItemsQuery(
    'itemsList',
    {
      selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
    }
  )
  const [
    addNewRace,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewRaceMutation()

  const [
    updateRace,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateRaceMutation()

  const [oldState, setOldState] = useState(race)
  const [state, setState] = useReducer(formReducer, race)
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [match, setMatch] = useState()
  const [isLoadingData, setIsLoadingData] = useState(true)
  const textRefs = useRef([])

  useEffect(() => {
    if (
      isSpellsFetching ||
      isBuildersFetching ||
      isFeatsFetching ||
      isItemsFetching ||
      isRacesFetching
    ) {
      setIsLoadingData(true)
    } else {
      setIsLoadingData(false)
    }
  }, [
    isSpellsFetching,
    isBuildersFetching,
    isFeatsFetching,
    isItemsFetching,
    isRacesFetching,
  ])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Race added successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Race updated successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.data.message)
    }
    if (updateIsError) {
      setErrorMessage(updateError.data.message)
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
      await addNewRace(state)
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
        await updateRace(state)
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
        size: 'xl',
      },
    })
  }

  const onSubrace = () => {
    if (state.category?.name === 'subrace' && state.lineage && !state.feature) {
      setState({
        payload: {
          target: {
            name: 'feature',
            value: races.find((race) => race._id === state.lineage?.id).feature,
          },
        },
      })
    }
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
                    name={`feature.${featureIndex}.${this.name}.${index}.feat${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Feat'
                    value={
                      multipleOptions
                        ? item.feat?.options
                        : item.feat?.setSelection
                    }
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
                          require={true}
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
                        require={true}
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
                      require={true}
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
                      require={true}
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
                      require={true}
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
                  {item.method?.name !== 'setValue' &&
                  item.modType?.name !== 'setValue' ? (
                    <>
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.method.setSelectionValue`}
                        placeholder='Set Value'
                        label={true}
                        invalidText='Must contain only numbers'
                        autoComplete='off'
                        value={item.method?.setSelectionValue}
                        require={true}
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
                        require={true}
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
                          require={true}
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
                    require={true}
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
                      require={true}
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
                      require={true}
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
                      require={true}
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
                    require={true}
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
                  {feature.attribute?.some(
                    (item) => item.name === 'optionGroups'
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
                    name={`feature.${featureIndex}.${this.name}.${index}.sense${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Sense'
                    value={
                      multipleOptions
                        ? item.sense?.options
                        : item.sense?.setSelection
                    }
                    options={builders.sense}
                    require={true}
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
                    multiple='true'
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    value={item.attribute}
                    require={true}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    placeholder='Spell'
                    value={multipleOptions ? item?.options : item?.setSelection}
                    options={spells}
                    require={true}
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
                      require={true}
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
          size='col-sm-3'
          name={`feature.${featureIndex}.value`}
          label={true}
          autoComplete='off'
          placeholder='Feature Name'
          value={featureItem.value}
          onChange={setState}
          clickable={false}
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
          options={[].concat(
            builders.feature.attribute.filter((attributeItem) =>
              !featureItem.attribute?.some((item) => item.name === 'doesDamage')
                ? attributeItem.name !== 'secondaryDamage'
                : attributeItem
            ),
            builders.feature.race.attribute
          )}
          placeholder='Feature Attributes'
          value={featureItem.attribute}
          onChange={setState}
        />
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'ancestrySpecific'
        ) && (
          <Select
            multiple={true}
            name={`feature.${featureIndex}.ancestry`}
            options={state.ancestry}
            placeholder='Ancestry'
            value={featureItem.ancestry}
            required={true}
            onChange={setState}
          />
        )}
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
                  type='text'
                  name={`feature.${featureIndex}.limitUse.setSelectionAmount`}
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Use Amount'
                  value={featureItem.limitUse?.setSelectionAmount}
                  required={true}
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
              value={featureItem.range?.minRange}
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            <Input
              validation='num'
              name={`feature.${featureIndex}.range.maxRange`}
              label={true}
              autoComplete='off'
              placeholder='Max Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range?.maxRange}
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
        {featureItem.attribute?.some(
          (attributItem) => attributItem.name === 'hasRequirements'
        ) && (
          <Select
            multiple={true}
            name={`feature.${featureIndex}.requirement.option`}
            placeholder='Requirement'
            options={builders.feature.requirement}
            value={featureItem.requirement?.option}
            required={true}
            onChange={setState}
          />
        )}
      </div>
      {featureItem.attribute?.some(
        (attributItem) => attributItem.name === 'hasRequirements'
      ) && (
        <>
          {featureItem.requirement?.option?.length > 0 && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Requirements</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
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
                      placeholder='Ability Score'
                      required={true}
                      label={true}
                      validation='num'
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  </>
                )}
                {featureItem.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'size'
                ) && (
                  <>
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.requirement.size`}
                      value={featureItem.requirement?.size}
                      placeholder='Size'
                      options={builders.race.size}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
              </div>
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
                        featureItem.requirement?.itemProficiency?.category
                          ?.length > 0
                          ? featureItem.requirement?.itemProficiency?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        featureItem.requirement?.itemProficiency?.itemType
                          ?.length > 0
                          ? featureItem.requirement?.itemProficiency?.itemType?.some(
                              (type) => type.name === item.name
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
                    featureItem.requirement.itemProficiency?.category?.length >
                    0
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
              <div className='row g-2 pb-3 mx-5 justify-contents-center'>
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
                        featureItem.requirement.notEquipped?.category?.length >
                        0
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
        </>
      )}
      {featureItem.limitUse?.limitBy?.name === 'level' &&
        featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) &&
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
        !featureItem.damage?.damageByLevel ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.damage.damageByLevel`,
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
                  name={`feature.${featureIndex}.damage.damageByLevel`}
                  value={featureItem.damage?.damageByLevel}
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
        <>
          <div className='row g-2 pb-2'>
            <Input
              name='value'
              label={true}
              autoComplete='off'
              placeholder='Race Name'
              required={true}
              value={state.value}
              onChange={setState}
            />
            <Select
              name='category'
              placeholder='Race Category'
              value={state?.category}
              options={builders.race?.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name && state.category?.name !== 'base' && (
              <Select
                multiple={state.category.name === 'variant' && true}
                name='lineage'
                placeholder='Race Lineage'
                value={state?.lineage}
                options={races}
                required={true}
                onChange={setState}
              />
            )}
            {state.category?.name === 'subrace' &&
              state?.lineage &&
              onSubrace()}
          </div>
          <TextEditor
            ref={addToTextRefs}
            name={'quote'}
            value={state?.quote}
            placeholder={'Opening Quote'}
            onChange={setState}
          />
        </>
      ),
    },
    {
      name: 'traits',
      content: (
        <>
          <TextEditor
            ref={addToTextRefs}
            name='traits.desc'
            value={state.traits?.desc}
            placeholder={'Traits Description'}
            onChange={setState}
          />
          <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
            <Select
              multiple={true}
              name='attribute'
              placeholder='Attributes'
              value={state.attribute}
              options={builders.race.attribute}
              required={true}
              onChange={setState}
            />
            <Select
              name='traits.size'
              placeholder='Size'
              value={state.traits?.size}
              options={builders.race.size}
              required={true}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'walking'
            ) && (
              <Input
                validation='num'
                name='traits.speed.walking'
                placeholder='Walking Speed'
                label={true}
                invalidText='Must contain only numbers'
                value={state.traits?.speed?.walking}
                required={true}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'climbing'
            ) && (
              <Input
                validation='num'
                name='traits.speed.climbing'
                placeholder='Climbing Speed'
                label={true}
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.climbing}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'swimming'
            ) && (
              <Input
                validation='num'
                name='traits.speed.swimming'
                placeholder='Swimming Speed'
                label={true}
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.swimming}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'flying'
            ) && (
              <Input
                validation='num'
                name='traits.speed.flying'
                placeholder='Flying Speed'
                label={true}
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.flying}
                onChange={setState}
              />
            )}
          </div>
        </>
      ),
    },
    {
      name: 'ancestry',
      content:
        state.attribute?.some(
          (attributeItem) => attributeItem.name === 'ancestryOptions'
        ) &&
        (!state.ancestry ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: 'ancestry',
              },
            },
          })
        ) : (
          <>
            <Table
              inputs={[
                {
                  name: 'ancestry',
                  value: 'Ancestry',
                  size: 'col-lg-3 col-md-4 col-sm-12',
                  label: true,
                },
                {
                  name: 'description',
                  value: 'Description',
                  label: true,
                  size: 'col-sm',
                },
              ]}
              name='ancestry'
              value={state?.ancestry}
              onChange={setState}
              dynamic={true}
            />
          </>
        )),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Edit a Race</h3>
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
      <form>
        <TabNavigation
          id='main'
          dynamic={false}
          tabState={mainTabContent
            .filter((content) =>
              state.attribute?.some(
                (attributeItem) => attributeItem.name === 'ancestryOptions'
              )
                ? content
                : content.name !== 'ancestry'
            )
            .map((content) => ({
              value: content.name,
              name: content.name,
              content: content.content,
            }))}
        />
        <TabNavigation
          id='details'
          tabState={state.details?.map((detailItem, detailIndex) => ({
            value:
              detailItem.name == null || detailItem.name === ''
                ? `detail ${detailIndex + 1}`
                : detailItem.name,
            name: `details.${detailIndex}`,
            content: (
              <div key={detailIndex}>
                <div className='col-auto pb-3'>
                  <Input
                    size='col-sm-3'
                    name={`details.${detailIndex}.value`}
                    label={true}
                    autoComplete='off'
                    placeholder='Detail Name'
                    value={detailItem.value}
                    onChange={setState}
                    clickable={false}
                  />
                </div>
                <TextEditor
                  ref={addToTextRefs}
                  name={`details.${detailIndex}.desc`}
                  value={detailItem.desc}
                  placeholder={'Section Description'}
                  onChange={setState}
                />
              </div>
            ),
          }))}
          onDelete={setState}
          onAdd={setState}
          dynamic={true}
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
export default EditRaceForm
