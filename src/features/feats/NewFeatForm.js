import { useEffect, useReducer, useState } from 'react'
import { useAddNewFeatMutation } from './featsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatQuery } from './featsApiSlice'
import { startCase } from 'lodash'
import formReducer from '../../hooks/useReducer'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import AccordionButton from '../../components/AccordionButton'

const NUM_REGEX = /^[0-9\b]+$/

const NewFeatForm = () => {
  const { id } = useAuth()

  const {
    data: builders,
    isSuccess: builderSuccess,
    isLoading: builderLoading,
  } = useGetBuilderQuery(id)

  const {
    data: spells,
    isSuccess: spellSuccess,
    isLoading: spellLoading,
  } = useGetSpellQuery(id)

  const {
    data: feats,
    isSuccess: featSuccess,
    isLoading: featLoading,
  } = useGetFeatQuery(id)

  const [addNewFeat, { isSuccess: addIsSuccess }] = useAddNewFeatMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })
  const [successMessage, setSuccessMessage] = useState()

  useEffect(() => {
    const forms = document.querySelectorAll('.needs-validation')
    Array.from(forms).forEach(function (form) {
      form.addEventListener(
        'submit',
        function (event) {
          if (!form.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
          }
          form.classList.add('was-validated')
        },
        false
      )
    })
  })

  function validateForm() {}

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Feat added successfully!')
      setState({
        type: 'reset',
        payload: { target: { userId: id } },
      })
    }
  }, [addIsSuccess, id, setState])

  const onSubmit = async () => {
    await addNewFeat(state)
  }

  let content

  if (builderLoading || spellLoading || featLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess && spellSuccess && featSuccess) {
    // Submit to databases

    const sections = [
      {
        name: 'feat',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    size='col-sm-2'
                    className={`${
                      item?.optionGroup &&
                      (NUM_REGEX.test(item?.optionGroup)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup ?? ''}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.feat${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    placeholder='Feat'
                    state={item.feat}
                    options={feats}
                    onChange={setState}
                  />
                </div>
              </div>
            </>
          )
        },
      },
      {
        name: 'modifier',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    size='col-sm-2'
                    className={`${
                      item?.optionGroup &&
                      (NUM_REGEX.test(item?.optionGroup)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup ?? ''}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                    placeholder='Modifier Type'
                    state={item.modType}
                    options={builders.modifier.modType}
                    onChange={setState}
                  />
                </div>
                {item.modType?.name && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.module`}
                      placeholder='Modifier Category'
                      state={item.module}
                      options={builders.modifier.module?.filter((moduleItem) =>
                        builders.modifier.modType
                          .find(
                            (typeItem) => typeItem.name === item.modType?.name
                          )
                          ?.module.map((m) => m.id)
                          .some((moduleID) => moduleID === moduleItem._id)
                      )}
                      onChange={setState}
                    />
                  </div>
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'penalty' ||
                  item.modType?.name === 'advantage' ||
                  item.modType?.name === 'disadvantage' ||
                  item.modType?.name === 'setValue') && (
                  <>
                    {item.module?.name === 'ability' && (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.ability${multipleOptions && '.options'}`}
                          multiple={multipleOptions}
                          placeholder='Ability'
                          state={item.ability}
                          options={builders.ability}
                          onChange={setState}
                        />
                      </div>
                    )}
                    {item.module?.name === 'saveAbility' && (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.saveAbility${
                            multipleOptions && '.options'
                          }`}
                          multiple={multipleOptions}
                          placeholder='Save Ability'
                          state={item.saveAbility}
                          options={builders.ability}
                          onChange={setState}
                        />
                      </div>
                    )}
                    {item.module?.name === 'skill' && (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.skill${multipleOptions && '.options'}`}
                          multiple={multipleOptions}
                          placeholder='Skill'
                          state={item.skill}
                          options={builders.skill}
                          onChange={setState}
                        />
                      </div>
                    )}
                  </>
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'penalty') &&
                  item.modType?.name !== 'setValue' && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method`}
                        placeholder='Method'
                        state={item.method}
                        options={builders.modifier.method.filter((methodItem) =>
                          methodItem.module.some(
                            (moduleItem) => moduleItem.id === item.module?.id
                          )
                        )}
                        onChange={setState}
                      />
                    </div>
                  )}
                {item.module?.name === 'condition' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.condition${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Condition Type'
                      state={item.condition}
                      options={builders.condition}
                      onChange={setState}
                    />
                  </div>
                ) : item.module?.name === 'speed' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.speed${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      state={item.speed}
                      placeholder='Speed Type'
                      options={builders.speed}
                      onChange={setState}
                    />
                  </div>
                ) : item.module?.name === 'passive' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.passive${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Passive Type'
                      state={item.passive}
                      options={builders.passive}
                      onChange={setState}
                    />
                  </div>
                ) : (
                  item.module?.name === 'damage' && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.damage${multipleOptions && '.options'}`}
                        multiple={multipleOptions}
                        placeholder='Damage Type'
                        state={item.damage.damageType}
                        options={builders.damage}
                        onChange={setState}
                      />
                    </div>
                  )
                )}
                {item.method?.name === 'setValue' ||
                item.modType?.name === 'setValue' ? (
                  <>
                    <Input
                      className={`${
                        item.method?.setValue &&
                        (NUM_REGEX.test(item.method.setValue)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                      placeholder='Set Value'
                      label={true}
                      invalidText='Must contain only numbers'
                      autoComplete='off'
                      value={item.method?.setValue ?? ''}
                      onChange={setState}
                    />
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                        placeholder='Multiplier'
                        state={item.multiplier}
                        options={builders.modifier.multiplier}
                        onChange={setState}
                      />
                    </div>
                  </>
                ) : item.method?.name === 'ability' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.method.ability`}
                      placeholder='Method Ability'
                      state={item.method.ability}
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                ) : (
                  item.method?.name === 'skill' && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method.skill`}
                        placeholder='Method Skill'
                        state={item.method.skill}
                        options={builders.skill}
                        onChange={setState}
                      />
                    </div>
                  )
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'setValue') && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.exceedMax`}
                      placeholder='Exceeds Max'
                      state={item.exceedMax}
                      options={[
                        { name: true, value: 'Yes' },
                        { name: false, value: 'No' },
                      ]}
                      onChange={setState}
                    />
                  </div>
                )}
              </div>
            </>
          )
        },
      },
      {
        name: 'proficiency',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    size='col-sm-2'
                    className={`${
                      item.optionGroup &&
                      (NUM_REGEX.test(item?.optionGroup)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup ?? ''}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.area`}
                    placeholder='Proficiency Area'
                    state={item.area}
                    options={builders.proficiency.area}
                    onChange={setState}
                  />
                </div>
                {item?.area?.name === 'skill' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.skill${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Skill'
                      state={item.skill}
                      options={builders.skill}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'saveAbility' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.saveAbility${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Save Ability'
                      state={item.saveAbility}
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'tool' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.tool${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Tool'
                      state={item.tool}
                      options={builders.tool}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'language' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.language${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Language'
                      state={item.language}
                      options={builders.language}
                      onChange={setState}
                    />
                  </div>
                )}
                {item.area?.name === 'itemType' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.itemType${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Item Type'
                      state={item.itemType}
                      options={[].concat(
                        ...builders.item.itemCategory.map(
                          (categoryItem) => categoryItem.itemType
                        )
                      )}
                      onChange={setState}
                    />
                  </div>
                )}
                {item.area?.name === 'itemProperty' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.itemProperty${multipleOptions && '.options'}`}
                      multiple={multipleOptions}
                      placeholder='Item Property'
                      state={item.itemProperty}
                      options={[].concat(
                        ...builders.item.itemCategory.map(
                          (categoryItem) => categoryItem.itemProperty
                        )
                      )}
                      onChange={setState}
                    />
                  </div>
                )}
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.level`}
                    placeholder='Proficiency Level'
                    state={item.level}
                    options={builders.proficiency.level}
                    onChange={setState}
                  />
                </div>
              </div>
            </>
          )
        },
      },
      {
        name: 'sense',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionGroups'
                ) && (
                  <Input
                    size='col-sm-2'
                    className={`${
                      item?.optionGroup &&
                      (NUM_REGEX.test(item?.optionGroup)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup ?? ''}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.sense${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    placeholder='Sense'
                    state={item.sense}
                    options={builders.sense}
                    onChange={setState}
                  />
                </div>
              </div>
            </>
          )
        },
      },
      {
        name: 'spell',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionGroups'
                ) && (
                  <Input
                    size='col-sm-2'
                    className={`${
                      item?.optionGroup &&
                      (NUM_REGEX.test(item?.optionGroup)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup ?? ''}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple='true'
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feat.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    state={item.attribute}
                    onChange={setState}
                  />
                </div>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    placeholder='Spell'
                    state={item}
                    options={spells}
                    onChange={setState}
                  />
                </div>
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionalAbility'
                ) && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.ability${multipleOptions && 'options'}`}
                      multiple={multipleOptions}
                      placeholder='Ability'
                      state={item.ability}
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
              </div>
            </>
          )
        },
      },
    ]

    const featureContent =
      state.feature?.length !== 0 &&
      state.feature?.map((featureItem, featureIndex) => (
        <div key={featureIndex} className='accordion' id='featureAccordion'>
          <div className='accordion-item'>
            <div className='accordion-header'>
              <AccordionButton
                id={`feature${featureIndex}AccordionButton`}
                target={`feature${featureIndex}AccordionBody`}
              >
                <Input
                  size='col-sm-4'
                  name={`feature.${featureIndex}.value`}
                  border={false}
                  autoComplete='off'
                  placeholder='Feature Name'
                  value={featureItem.value ?? ''}
                  onChange={setState}
                  onClick={(e) => e.stopPropagation()}
                />
              </AccordionButton>
            </div>
            <div
              className='accordion-collapse collapse show'
              id={`feature${featureIndex}AccordionBody`}
              data-bs-parent='#featureAccordion'
            >
              <div className='accordion-body'>
                <div className='row justify-content-start g-2 pb-3'>
                  <div className='col-auto'>
                    <button
                      className='btn btn-outline-primary overflow-hidden text-nowrap'
                      type='button'
                      name={`feature.${featureIndex}`}
                      onClick={(e) => setState({ type: 'removed', payload: e })}
                    >
                      Remove Feature
                    </button>
                  </div>
                  {sections.map((sectionItem, sectionIndex) => (
                    <div key={sectionIndex} className='col-auto'>
                      <button
                        key={sectionIndex}
                        className='btn btn-secondary'
                        type='button'
                        name={`feature.${featureIndex}.${sectionItem.name}`}
                        onClick={(e) => setState({ type: 'added', payload: e })}
                      >
                        {`Add ${startCase(sectionItem.name)}`}
                      </button>
                    </div>
                  ))}
                </div>
                <div className='pb-3'>
                  <TextEditor
                    placeholder='Feature description'
                    state={featureItem.desc}
                    name={`feature.${featureIndex}.desc`}
                    onChange={setState}
                  />
                </div>
                <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                  <div className='col-sm'>
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.attribute`}
                      state={featureItem.attribute}
                      options={builders.feat.feature.attribute}
                      placeholder='Feature Attributes'
                      onChange={setState}
                    />
                  </div>
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'hasRequirements'
                  ) ? (
                    <div className='col-sm'>
                      <Select
                        multiple={true}
                        name={`feature.${featureIndex}.requirement.option`}
                        state={featureItem.requirement.option}
                        placeholder='Requirement'
                        options={builders.feat.feature.requirements}
                        onChange={setState}
                      />
                    </div>
                  ) : (
                    !!featureItem.requirement &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.requirement`,
                        },
                      },
                    })
                  )}
                  {featureItem.requirement?.option.some(
                    (optionItem) => optionItem.name === 'skillProficiency'
                  ) ? (
                    <div className='col-sm'>
                      <Select
                        multiple={true}
                        name={`feature.${featureIndex}.requirement.skillProficiency.skill`}
                        state={featureItem.requirement.skillProficiency.skill}
                        placeholder='Skill Proficiency'
                        options={builders.skill}
                        onChange={setState}
                      />
                    </div>
                  ) : (
                    !!featureItem.requirement?.skillProficiency &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.requirement.skillProficiency`,
                        },
                      },
                    })
                  )}
                  {featureItem.requirement?.option.some(
                    (optionItem) => optionItem.name === 'itemProficiency'
                  ) ? (
                    <>
                      <div className='col-sm'>
                        <Select
                          multiple={true}
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemCategory`}
                          state={
                            featureItem.requirement.itemProficiency.itemCategory
                          }
                          placeholder='Item Category'
                          options={builders.item.itemCategory}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemType`}
                          placeholder='Item type'
                          state={
                            featureItem.requirement.itemProficiency.itemType
                          }
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((itemCategory) =>
                                featureItem.requirement?.itemCategory?.some(
                                  (categoryItem) =>
                                    itemCategory._id.includes(categoryItem.id)
                                )
                              )
                              .map((filteredItem) => filteredItem.itemType)
                          )}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemProperty`}
                          placeholder='Item Property'
                          state={
                            featureItem.requirement.itemProficiency.itemProperty
                          }
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((itemCategory) =>
                                featureItem.requirement?.itemCategory?.some(
                                  (categoryItem) =>
                                    itemCategory._id.includes(categoryItem.id)
                                )
                              )
                              .map((filteredItem) => filteredItem.itemProperty)
                          )}
                          onChange={setState}
                        />
                      </div>
                    </>
                  ) : (
                    !!featureItem.requirement?.itemProficiency &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.requirement.itemProficiency`,
                        },
                      },
                    })
                  )}
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUse'
                  ) ? (
                    <>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.limitUse.limitBy`}
                          placeholder='Limit By Option'
                          state={featureItem.limitUse.limitBy}
                          options={builders.feat.feature.chargeLimit}
                          onChange={setState}
                        />
                      </div>
                      {featureItem.limitUse?.limitBy?.name === 'ability' ? (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.limitUse.ability`}
                            placeholder='Ability'
                            state={featureItem.limitUse.ability}
                            options={builders.ability}
                            onChange={setState}
                          />
                        </div>
                      ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.limitUse.skill`}
                            placeholder='Skill'
                            state={featureItem.limitUse.skill}
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      ) : (
                        featureItem.limitUse?.limitBy?.name === 'setNumber' && (
                          <Input
                            className={`${
                              featureItem.limitUse?.setAmount &&
                              (NUM_REGEX.test(featureItem.limitUse?.setAmount)
                                ? 'is-valid'
                                : 'is-invalid')
                            }`}
                            name={`feature.${featureIndex}.limitUse.setAmount`}
                            label={true}
                            invalidText='Must contain only numbers'
                            placeholder='Use Amount'
                            required={true}
                            value={featureItem.limitUse.setAmount ?? ''}
                            onChange={setState}
                          />
                        )
                      )}
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.limitUse.resetsOn`}
                          placeholder='Reset Option'
                          state={featureItem.limitUse.resetsOn}
                          options={builders.feat.feature.chargeReset}
                          onChange={setState}
                        />
                      </div>
                    </>
                  ) : (
                    !!featureItem.limitUse &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.limitUse`,
                        },
                      },
                    })
                  )}
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'isAction'
                  ) ? (
                    <>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.action`}
                          placeholder='Action Type'
                          state={featureItem.action}
                          options={builders.feat.feature.action}
                          onChange={setState}
                        />
                      </div>
                    </>
                  ) : (
                    !!featureItem.action &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.action`,
                        },
                      },
                    })
                  )}
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'hasRange'
                  ) ? (
                    <>
                      <Input
                        className={`${
                          featureItem.range?.minRange &&
                          (NUM_REGEX.test(featureItem.range?.minRange)
                            ? 'is-valid'
                            : 'is-invalid')
                        }`}
                        name={`feature.${featureIndex}.range.minRange`}
                        autoComplete='off'
                        label={true}
                        placeholder='Min Range'
                        required={true}
                        onChange={setState}
                        value={featureItem.range.minRange ?? ''}
                        invalidText='Must contain only numbers'
                      />
                      <Input
                        className={`${
                          featureItem.range?.maxRange &&
                          (NUM_REGEX.test(featureItem.range?.maxRange)
                            ? 'is-valid'
                            : 'is-invalid')
                        }`}
                        name={`feature.${featureIndex}.range.maxRange`}
                        label={true}
                        autoComplete='off'
                        placeholder='Max Range'
                        invalidText='Must contain only numbers'
                        required={true}
                        value={featureItem.range.maxRange ?? ''}
                        onChange={setState}
                      />
                    </>
                  ) : (
                    !!featureItem.saveAbility &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.range`,
                        },
                      },
                    })
                  )}
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'requireSave'
                  ) ? (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.saveAbility`}
                        placeholder='DC Ability'
                        state={featureItem.saveAbility}
                        options={builders.ability}
                        onChange={setState}
                      />
                    </div>
                  ) : (
                    !!featureItem.saveAbility &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.saveAbility`,
                        },
                      },
                    })
                  )}
                </div>
                {featureItem.requirement?.option.some(
                  (optionItem) => optionItem.name === 'equipped'
                ) ? (
                  <>
                    <AccordionButton
                      className='accordion feature-attribute-divider justify-content-between align-items-center'
                      id='featureEquippedButton'
                      target='featureEquipped'
                    >
                      <span className='me-3'>Equipped</span>
                      <hr className='flex-grow-1 me-3' />
                    </AccordionButton>
                    <div
                      className='accordion-collapse collapse show'
                      id='featureEquipped'
                    >
                      <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemCategory`}
                            state={
                              featureItem.requirement.equipped.itemCategory
                            }
                            placeholder='Item Category'
                            options={builders.item.itemCategory}
                            onChange={setState}
                          />
                        </div>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemType`}
                            placeholder='Item type'
                            state={featureItem.requirement.equipped.itemType}
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.equipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map((filteredItem) => filteredItem.itemType)
                            )}
                            onChange={setState}
                          />
                        </div>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemProperty`}
                            placeholder='Item Property'
                            state={
                              featureItem.requirement.equipped.itemProperty
                            }
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.equipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map(
                                  (filteredItem) => filteredItem.itemProperty
                                )
                            )}
                            onChange={setState}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  !!featureItem.requirement?.equipped &&
                  setState({
                    action: 'removed',
                    payload: {
                      target: {
                        name: `feature.${featureIndex}.requirement.equipped`,
                      },
                    },
                  })
                )}
                {featureItem.requirement?.option.some(
                  (optionItem) => optionItem.name === 'notEquipped'
                ) ? (
                  <>
                    <AccordionButton
                      className='accordion feature-attribute-divider justify-content-between align-items-center'
                      id='featureNotEquippedButton'
                      target='featureNotEquipped'
                    >
                      <span className='me-3'>Not Equipped</span>
                      <hr className='flex-grow-1 me-3' />
                    </AccordionButton>
                    <div
                      className='accordion-collapse collapse show'
                      id='featureNotEquipped'
                    >
                      <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemCategory`}
                            state={
                              featureItem.requirement.notEquipped.itemCategory
                            }
                            placeholder='Item Category'
                            options={builders.item.itemCategory}
                            onChange={setState}
                          />
                        </div>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
                            placeholder='Item type'
                            state={featureItem.requirement.notEquipped.itemType}
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.notEquipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map((filteredItem) => filteredItem.itemType)
                            )}
                            onChange={setState}
                          />
                        </div>
                        <div className='col-sm'>
                          <Select
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemProperty`}
                            state={
                              featureItem.requirement.notEquipped.itemProperty
                            }
                            placeholder='Item Property'
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.notEquipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map(
                                  (filteredItem) => filteredItem.itemProperty
                                )
                            )}
                            onChange={setState}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  !!featureItem.requirement?.notEquipped &&
                  setState({
                    action: 'removed',
                    payload: {
                      target: {
                        name: `feature.${featureIndex}.requirement.notEquipped`,
                      },
                    },
                  })
                )}
                {featureItem.limitUse?.limitBy?.name === 'level' &&
                  featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUse'
                  ) &&
                  (featureItem.limitUse.level ??
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.limitUse.level`,
                        },
                      },
                    })) && (
                    <div>
                      <Table
                        headers={[
                          {
                            name: 'level',
                            value: 'Level',
                            size: 5,
                            invalid: 'Must contain only numbers',
                            label: true,
                          },
                          {
                            name: 'uses',
                            value: 'Uses',
                            invalid: 'Must contain only numbers',
                            label: true,
                          },
                        ]}
                        name={`feature.${featureIndex}.limitUse.level`}
                        state={featureItem.limitUse?.level}
                        onChange={setState}
                      />
                    </div>
                  )}
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
                    <div className='row g-2 align-items-end pb-2'>
                      <div className='col-sm'>
                        <Select
                          multiple={true}
                          name={`feature.${featureIndex}.damage.damageAttribute`}
                          state={featureItem.damage.damageAttribute}
                          placeholder='Damage Attribute'
                          options={builders.feat.feature.damageAttribute}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
                          className='pb-1'
                          name={`feature.${featureIndex}.damage.damageType`}
                          multiple={true}
                          placeholder='Damage Type'
                          state={featureItem.damage.damageType}
                          options={builders.damage}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-lg-6 col-md-12'>
                        <Table
                          headers={[
                            {
                              name: 'level',
                              value: 'Level',
                              invalid: 'Must contain only numbers',
                              label: true,
                            },
                            {
                              name: 'diceCount',
                              value: 'Dice Count',
                              size: 3,
                              invalid: 'Must contain only numbers',
                              label: true,
                            },
                            {
                              name: 'diceValue',
                              value: 'Dice Value',
                              size: 3,
                              invalid: 'Must contain only numbers',
                              label: true,
                            },
                          ]}
                          name={`feature.${featureIndex}.damage.damageByLevel`}
                          state={featureItem.damage?.damageByLevel}
                          onChange={setState}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  !!featureItem.damage &&
                  setState({
                    action: 'removed',
                    payload: {
                      target: {
                        name: `feature.${featureIndex}.damage`,
                      },
                    },
                  })
                )}
                <div className='accordion' id='sectionAccordion'>
                  {sections.map(
                    (sectionItem, sectionIndex) =>
                      !!featureItem[sectionItem.name] &&
                      featureItem[sectionItem.name].map((item, itemIndex) => (
                        <div key={itemIndex} className='accordion-item'>
                          <div className='accordion-header'>
                            <AccordionButton
                              id={`${sectionItem.name}${itemIndex}AccordionButton`}
                              target={`${sectionItem.name}${itemIndex}AccordionBody`}
                            >
                              <h6>{`${startCase(sectionItem.name)} ${
                                itemIndex + 1
                              }`}</h6>
                            </AccordionButton>
                          </div>
                          <div
                            className='accordion-collapse collapse show'
                            id={`${sectionItem.name}${itemIndex}AccordionBody`}
                            data-bs-parent='#sectionAccordion'
                          >
                            <div className='accordion-body'>
                              {sectionItem.content(
                                featureItem,
                                featureIndex,
                                item,
                                itemIndex
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))

    content = (
      <div className='builder-form'>
        {successMessage && (
          <h3 className='add-success-message'>{successMessage}</h3>
        )}
        <h1>Create a Feat</h1>
        <form className='needs-validation' noValidate>
          <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
            <Input
              name='value'
              autoComplete='off'
              placeholder='Feat Name'
              label={true}
              value={state.value ?? ''}
              required={true}
              onChange={setState}
            />
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='descriptionButton'
            target='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='description'>
            <div className='pb-2'>
              <TextEditor
                name={'desc'}
                state={state.desc}
                placeholder={'feat Description'}
                onChange={setState}
              />
            </div>
          </div>
          <div className='pb-3'>
            <button
              className='btn btn-secondary me-2'
              name='feature'
              type='button'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Feature
            </button>
            <button
              className='btn btn-primary'
              type='button'
              onClick={() => {
                validateForm()
                onSubmit()
              }}
            >
              Add Feat
            </button>
          </div>
          {featureContent}
        </form>
      </div>
    )
    return content
  }
}
export default NewFeatForm
