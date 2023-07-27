import { useState, useEffect, useReducer } from 'react'
import { useAddNewItemMutation } from './itemsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatQuery } from '../feats/featsApiSlice'
import { startCase } from 'lodash'
import formReducer from '../../hooks/useReducer'
import AccordionButton from '../../components/AccordionButton'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'

const NUM_REGEX = /^[0-9\b]+$/

const NewItemForm = () => {
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

  const [addNewItem, { isSuccess: addSuccess }] = useAddNewItemMutation()

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

  useEffect(() => {
    if (addSuccess) {
      setSuccessMessage('Item added successfully!')
      setState({
        type: 'reset',
        payload: { target: { name: 'userId', value: id } },
      })
    }
  }, [addSuccess, id])

  function validateForm() {}

  const onSubmit = async () => {
    await addNewItem(state)
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.sense`}
                    placeholder='Feat'
                    state={item.sense}
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
                          name={`feature.${featureIndex}.${this.name}.${index}.ability`}
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
                          name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
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
                          name={`feature.${featureIndex}.${this.name}.${index}.skill`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.condition`}
                      placeholder='Condition Type'
                      state={item.condition}
                      options={builders.condition}
                      onChange={setState}
                    />
                  </div>
                ) : item.module?.name === 'speed' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                      placeholder='Speed Type'
                      state={item.speed}
                      options={builders.speed}
                      onChange={setState}
                    />
                  </div>
                ) : item.module?.name === 'passive' ? (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                      state={item.passive}
                      placeholder='Passive Type'
                      options={builders.passive}
                      onChange={setState}
                    />
                  </div>
                ) : (
                  item.module?.name === 'damage' && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.damage.damageType`}
                        placeholder='Damage Type'
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
                {item.area?.name === 'skill' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                      state={item.skill}
                      placeholder='Skill'
                      options={builders.skill}
                      onChange={setState}
                    />
                  </div>
                )}
                {item.area?.name === 'saveAbility' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
                      state={item.saveAbility}
                      placeholder='Save Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'tool' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.tool`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.language`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.itemType`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.itemProperty`}
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.sense`}
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    state={item.attribute}
                    options={builders.feat.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    onChange={setState}
                  />
                </div>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.ability`}
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
                    name={`feature.${featureIndex}.desc`}
                    onChange={setState}
                  />
                </div>
                <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                  <div className='col-sm'>
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.attribute`}
                      options={builders.item.feature.attribute}
                      placeholder='Feature Attributes'
                      state={featureItem.attribute}
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
                        placeholder='Requirement'
                        state={featureItem.requirement.option}
                        options={builders.item.feature.requirements}
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
                          placeholder='Item Category'
                          state={
                            featureItem.requirement.itemProficiency.itemCategory
                          }
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
                          options={builders.item.feature.chargeLimit}
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
                          options={builders.item.feature.chargeReset}
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
                          options={builders.item.feature.action}
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
                        invalidText='Must contain only numbers'
                        value={featureItem.range.minRange ?? ''}
                        onChange={setState}
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
                        required={true}
                        invalidText='Must contain only numbers'
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
                            placeholder='Item Category'
                            state={
                              featureItem.requirement.equipped.itemCategory
                            }
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
                            placeholder='Item Property'
                            state={
                              featureItem.requirement.notEquipped.itemProperty
                            }
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
                        className='pb-2'
                        headers={[
                          {
                            name: 'level',
                            value: 'Level',
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
                          options={builders.item.feature.damageAttribute}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
                          className='pb-1'
                          name={`feature.${featureIndex}.damage`}
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
                              invalid: 'Must contain only numbers',
                              label: true,
                            },
                            {
                              name: 'diceValue',
                              value: 'Dice Value',
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
        <h1>Create an Item</h1>
        {successMessage && (
          <h3 className='add-success-message'>{successMessage}</h3>
        )}

        <form className='needs-validation' noValidate>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='detailsButton'
            target='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='details'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <Input
                name='value'
                autoComplete='off'
                label={true}
                placeholder='Item Name'
                required={true}
                value={state.value ?? ''}
                onChange={setState}
              />
              <div className='col-sm'>
                <Select
                  name='itemCategory'
                  placeholder='Item category'
                  state={state.itemCategory}
                  options={builders?.item.itemCategory}
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='itemType'
                  placeholder='Item type'
                  state={state.itemType}
                  options={
                    builders?.item.itemCategory.find(
                      (itemCategory) =>
                        itemCategory._id === state?.itemCategory?.id
                    )?.itemType
                  }
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='itemProperty'
                  multiple={true}
                  placeholder='Properties'
                  state={state.itemProperty}
                  options={
                    builders?.item.itemCategory.find(
                      (itemCategory) =>
                        itemCategory._id === state?.itemCategory?.id
                    )?.itemProperty
                  }
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='rarity'
                  placeholder='Rarity'
                  state={state.rarity}
                  options={builders?.item.rarity}
                  onChange={setState}
                />
              </div>
              {state?.itemCategory && state?.itemCategory?.name !== 'item' && (
                <Input
                  className={`${
                    state?.itemRank &&
                    (NUM_REGEX.test(state?.itemRank)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  name='itemRank'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Item Rank'
                  autoComplete='off'
                  value={state.itemRank ?? ''}
                  onChange={setState}
                />
              )}
            </div>
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='descriptionButton'
            target='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div
            className='accordion-collapse collapse show pb-2'
            id='description'
          >
            <TextEditor
              onChange={setState}
              placeholder={'Item description'}
              name={'desc'}
            />
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='attributeButton'
            target='attribute'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show pb-2' id='attribute'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col-sm'>
                <Select
                  name='attribute'
                  multiple={true}
                  placeholder='Attributes'
                  state={state.attribute}
                  options={builders?.item.attribute}
                  onChange={setState}
                />
              </div>
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'weight'
              ) && (
                <Input
                  className={`${
                    state.itemWeight &&
                    (NUM_REGEX.test(state.itemWeight)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  name='itemWeight'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Item Weight'
                  autoComplete='off'
                  value={state.itemWeight ?? ''}
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'container'
              ) && (
                <Input
                  className={`${
                    state.capacityWeight &&
                    (NUM_REGEX.test(state.capacityWeight)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  name='capacityWeight'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Capacity Weight'
                  autoComplete='off'
                  value={state.capacityWeight ?? ''}
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'stackable'
              ) && (
                <Input
                  className={`${
                    state.maxStack &&
                    (NUM_REGEX.test(state.maxStack) ? 'is-valid' : 'is-invalid')
                  }`}
                  type='text'
                  name='maxStack'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Max Stack Size'
                  autoComplete='off'
                  value={state.maxStack ?? ''}
                  onChange={setState}
                />
              )}
              {state.itemCategory?.name === 'weapon' && (
                <>
                  <Input
                    className={`${
                      state.damage?.diceCount &&
                      (NUM_REGEX.test(state.damage?.diceCount)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name='damage.diceCount'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Count'
                    value={state.damage?.diceCount ?? ''}
                    onChange={setState}
                  />
                  <Input
                    className={`${
                      state.damage?.diceValue &&
                      (NUM_REGEX.test(state.damage?.diceValue)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name='damage.diceValue'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Value'
                    value={state.damage?.diceValue ?? ''}
                    onChange={setState}
                  />
                  <div className='col-sm'>
                    <Select
                      name='damage.damageType'
                      multiple={true}
                      placeholder='Damage Type'
                      state={state.damage?.damageType}
                      options={builders.damage}
                      onChange={setState}
                    />
                  </div>
                  <div className='col-sm'>
                    <Select
                      name='primaryAbility'
                      placeholder='Primary Ability'
                      state={state.primaryAbility}
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                  {state?.itemProperty?.find((property) => {
                    return property.name === 'versatile'
                  }) && (
                    <div className='col-sm'>
                      <Select
                        name={'secondaryAbility'}
                        placeholder='Secondary Ability'
                        state={state.secondaryAbility}
                        options={builders.ability?.filter(
                          (abilityItem) =>
                            abilityItem?._id !== state?.primaryAbility?.id
                        )}
                        onChange={setState}
                      />
                    </div>
                  )}
                </>
              )}
              {state.itemCategory?.name === 'armor' && (
                <Input
                  className={`${
                    state.armorValue &&
                    (NUM_REGEX.test(state.armorValue)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  name='armorValue'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Armor Value'
                  value={state.armorValue ?? ''}
                  onChange={setState}
                />
              )}
              {state.itemProperty?.find(
                (property) =>
                  property.name === 'thrown' || property.name === 'ranged'
              ) && (
                <>
                  <Input
                    className={`${
                      state.thrown?.minRange &&
                      (NUM_REGEX.test(state.thrown?.minRange)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name='thrown.minRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Thrown Min Range'
                    value={state.thrown?.minRange ?? ''}
                    onChange={setState}
                  />
                  <Input
                    className={`${
                      state.thrown?.maxRange &&
                      (NUM_REGEX.test(state.thrown?.maxRange)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name='thrown.maxRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Thrown Max Range'
                    value={state.thrown?.maxRange ?? ''}
                    onChange={setState}
                  />
                </>
              )}
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
              Add Item
            </button>
          </div>
          {featureContent}
        </form>
      </div>
    )
    return content
  }
}
export default NewItemForm
