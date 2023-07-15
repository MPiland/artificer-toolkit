import { useState, useEffect, useReducer } from 'react'
import { useAddNewItemMutation } from './itemsApiSlice'
import TextEditor from '../../components/TextEditor'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import formReducer from '../../hooks/useReducer'
import { startCase } from 'lodash'
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
      setState({
        userId: id,
      })
      setSuccessMessage('Item added successfully!')
    }
  }, [addSuccess, id])

  function validateForm() {}

  let content

  if (builderLoading || spellLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess && spellSuccess) {
    // Submit to databases
    const onSubmit = async () => {
      await addNewItem(state)
    }

    const sections = [
      {
        name: 'proficiency',
        content(effectIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`effect.${effectIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`effect.${effectIndex}.${this.name}.${index}.area`}
                    placeholder='Proficiency Area'
                    options={builders.proficiency.area}
                    onChange={setState}
                  />
                </div>
                {item?.area?.name === 'skill' && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.${this.name}.${index}.area.skill`}
                      placeholder='Skill'
                      options={builders.skill}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'saveAbility' && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.${this.name}.${index}.area.saveAbility`}
                      placeholder='Save Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'tool' && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.${this.name}.${index}.area.tool`}
                      placeholder='Tool'
                      options={builders.tool}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'language' && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.${this.name}.${index}.area.language`}
                      placeholder='Language'
                      options={builders.language}
                      onChange={setState}
                    />
                  </div>
                )}
                <div className='col-sm'>
                  <Select
                    name={`effect.${effectIndex}.${this.name}.${index}.level`}
                    placeholder='Proficiency Level'
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
        name: 'spell',
        content(effectIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`effect.${effectIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple='true'
                    name={`effect.${effectIndex}.${this.name}.${index}.attribute`}
                    options={builders.effect.spell.attribute}
                    placeholder='Effect Attributes'
                    onChange={setState}
                  />
                </div>
                <div className='col-sm'>
                  <Select
                    name={`effect.${effectIndex}.${this.name}.${index}`}
                    placeholder='Spell'
                    options={spells}
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
        content(effectIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`effect.${effectIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`effect.${effectIndex}.${this.name}.${index}.modType`}
                    placeholder='Modifier Type'
                    options={builders.modifier.modType}
                    onChange={setState}
                  />
                </div>
                {!!item.modType?.name && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.${this.name}.${index}.module`}
                      placeholder='Modifier Category'
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
                  item.modType?.name === 'setValue') && (
                  <>
                    {item.module?.name === 'ability' ||
                    item.module?.name === 'saveAbility' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.ability`}
                          placeholder='Ability'
                          options={builders.ability}
                          onChange={setState}
                        />
                      </div>
                    ) : (
                      item.module?.name === 'skill' && (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.${this.name}.${index}.skill`}
                            placeholder='Skill'
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      )
                    )}
                    {!!item.module?.name &&
                      item.modType?.name !== 'setValue' && (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.${this.name}.${index}.method`}
                            placeholder='Method'
                            options={builders.modifier.method.filter(
                              (methodItem) =>
                                methodItem.module.some(
                                  (moduleItem) =>
                                    moduleItem.id === item.module?.id
                                )
                            )}
                            onChange={setState}
                          />
                        </div>
                      )}
                    {item.module?.name === 'condition' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.condition`}
                          placeholder='Condition Type'
                          options={builders.condition}
                          onChange={setState}
                        />
                      </div>
                    ) : item.module?.name === 'speed' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.speed`}
                          placeholder='Speed Type'
                          options={builders.speed}
                          onChange={setState}
                        />
                      </div>
                    ) : item.module?.name === 'passive' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.speed`}
                          placeholder='Passive Type'
                          options={builders.passive}
                          onChange={setState}
                        />
                      </div>
                    ) : (
                      item.module?.name === 'damage' && (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.${this.name}.${index}.damage`}
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
                        <div className='position-relative col-sm'>
                          <Input
                            className={`form-control ${
                              item.method?.setValue &&
                              (NUM_REGEX.test(item.method.setValue)
                                ? 'is-valid'
                                : 'is-invalid')
                            }`}
                            type='text'
                            name={`effect.${effectIndex}.${this.name}.${index}.method.setValue`}
                            label={true}
                            placeholder='Set Value'
                            autoComplete='off'
                            onChange={setState}
                          />
                          <div
                            id={`effect.${effectIndex}.${this.name}.${index}.method.setValueTooltip`}
                            className='invalid-tooltip'
                          >
                            Must contain only numbers
                          </div>
                        </div>
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.${this.name}.${index}.multiplier`}
                            placeholder='Multiplier'
                            options={builders.modifier.multiplier}
                            onChange={setState}
                          />
                        </div>
                      </>
                    ) : item.method?.name === 'ability' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.method.ability`}
                          placeholder='Method Ability'
                          options={builders.ability}
                          onChange={setState}
                        />
                      </div>
                    ) : (
                      item.method?.name === 'skill' && (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.${this.name}.${index}.method.skill`}
                            placeholder='Method Skill'
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </>
          )
        },
      },
      {
        name: 'sense',
        content(effectIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`effect.${effectIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`effect.${effectIndex}.${this.name}.${index}.sense`}
                    multiple={item?.sectionAttribute?.name === 'hasOptions'}
                    placeholder='Sense'
                    options={builders.sense}
                    onChange={setState}
                  />
                </div>
              </div>
            </>
          )
        },
      },
    ]

    const effectContent =
      state?.effect?.length !== 0 &&
      state?.effect?.map((effect, effectIndex) => (
        <div key={effectIndex} className='accordion' id={`effectAccordion`}>
          <div className='accordion-item'>
            <div className='accordion-header'>
              <button
                className='accordion-button details-section'
                type='button'
                data-bs-toggle='collapse'
                data-bs-target={`#effect${effectIndex}AccordionBody`}
                aria-expanded='true'
                aria-controls={`effect${effectIndex}AccordionBody`}
              >
                <div className='col-sm-4'>
                  <Input
                    className='border-0'
                    type='text'
                    name={`effect.${effectIndex}.value`}
                    autoComplete='off'
                    label={true}
                    placeholder='Effect Name'
                    required={true}
                    onChange={setState}
                  />
                </div>
              </button>
            </div>
            <div
              className='accordion-collapse collapse show'
              id={`effect${effectIndex}AccordionBody`}
              data-bs-parent={`#effectAccordion`}
            >
              <div className='accordion-body'>
                <div className='row row-cols-lg-auto row-cols-md-3 row-cols-sm-1 justify-content-start g-2 pb-3'>
                  <div className='col-auto'>
                    <button
                      className='btn btn-outline-primary overflow-hidden text-nowrap'
                      type='button'
                      name={`effect.${effectIndex}`}
                      onClick={(e) => setState({ type: 'removed', payload: e })}
                    >
                      Remove Effect
                    </button>
                  </div>
                  {sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className='col-auto'>
                      <button
                        key={sectionIndex}
                        className='btn btn-secondary'
                        type='button'
                        name={`effect.${effectIndex}.${section.name}`}
                        onClick={(e) => setState({ type: 'added', payload: e })}
                      >
                        {`Add ${startCase(section.name)}`}
                      </button>
                    </div>
                  ))}
                </div>
                <TextEditor
                  className='mb-3'
                  placeholder='Effect description'
                  name={`effect.${effectIndex}.desc`}
                  onChange={setState}
                />
                <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                  <div className='col-sm'>
                    <Select
                      multiple={true}
                      name={`effect.${effectIndex}.attribute`}
                      options={builders.effect.attribute}
                      placeholder='Effect Attributes'
                      onChange={setState}
                    />
                  </div>
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'isAction'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={'action.num'}
                        placeholder='Action Type'
                        options={builders.effect.action}
                        onChange={setState}
                      />
                    </div>
                  )}
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUses'
                  ) && (
                    <>
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.limitBy`}
                          placeholder='Limit By Option'
                          options={builders.effect.chargeLimit}
                          onChange={setState}
                        />
                      </div>
                      {effect?.limitBy?.name === 'ability' ? (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.limitBy.ability`}
                            placeholder='Ability'
                            options={builders.ability}
                            onChange={setState}
                          />
                        </div>
                      ) : effect?.limitBy?.name === 'skill' ? (
                        <div className='col-sm'>
                          <Select
                            name={`effect.${effectIndex}.limitBy.skill`}
                            placeholder='Skill'
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      ) : (
                        effect?.limitBy?.name === 'setNumber' && (
                          <div className='col-sm position-relative'>
                            <Input
                              className={`${
                                effect?.limitBy?.setAmount &&
                                (NUM_REGEX.test(effect?.limitBy.setAmount)
                                  ? 'is-valid'
                                  : 'is-invalid')
                              }`}
                              type='text'
                              name={`effect.${effectIndex}.limitBy.setAmount`}
                              label={true}
                              placeholder='Use Amount'
                              required={true}
                              onChange={setState}
                            />
                            <div id='levelTooltip' className='invalid-tooltip'>
                              Must contain only numbers
                            </div>
                          </div>
                        )
                      )}
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.resetsOn`}
                          placeholder='Reset Option'
                          options={builders.effect.chargeReset}
                          onChange={setState}
                        />
                      </div>
                    </>
                  )}
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'hasRange'
                  ) && (
                    <>
                      <div className='col-sm'>
                        <Input
                          type='text'
                          name={`effect.${effectIndex}.inRange`}
                          autoComplete='off'
                          label={true}
                          placeholder='Min Range'
                          required={true}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Input
                          className='form-control'
                          type='text'
                          name={`effect.${effectIndex}.maxRange`}
                          label={true}
                          autoComplete='off'
                          placeholder='Max Range'
                          required={true}
                          onChange={setState}
                        />
                      </div>
                    </>
                  )}
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'requireSave'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.saveAbility`}
                        placeholder='DC Ability'
                        options={builders.ability}
                        onChange={setState}
                      />
                    </div>
                  )}
                </div>
                {effect?.limitBy?.name === 'level' &&
                  effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUses'
                  ) &&
                  (effect.limitBy.level ??
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `effect.${effectIndex}.limitBy.level`,
                        },
                      },
                    })) && (
                    <div>
                      <Table
                        className='table-sm table-responsive'
                        headers={[{ name: 'Level' }, { name: 'Uses' }]}
                        name={`effect.${effectIndex}.limitBy.level`}
                        state={effect?.limitBy?.level}
                        onChange={setState}
                      />
                    </div>
                  )}
                {effect?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'doesDamage'
                ) &&
                  (!effect?.damage?.damageByLevel ? (
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `effect.${effectIndex}.damage.damageByLevel`,
                        },
                      },
                    })
                  ) : (
                    <div className='row g-2 align-items-end pb-2'>
                      <div className='col-sm'>
                        <Select
                          multiple={true}
                          name={`effect.${effectIndex}.damage.damageAttribute`}
                          placeholder='Damage Attribute'
                          options={builders.effect.damageAttribute}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
                          className='pb-1'
                          name={`effect.${effectIndex}.damage`}
                          placeholder='Damage Type'
                          options={builders.damage}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-lg-6 col-md-12'>
                        <Table
                          className='table-sm table-responsive'
                          headers={[
                            { name: 'Level' },
                            { name: 'Dice Count' },
                            { name: 'Dice Value' },
                          ]}
                          name={`effect.${effectIndex}.damage.damageByLevel`}
                          state={effect?.damage.damageByLevel}
                          onChange={setState}
                        />
                      </div>
                    </div>
                  ))}
                <div className='accordion' id='sectionAccordion'>
                  {sections.map(
                    (section, sectionIndex) =>
                      !!effect[section.name] &&
                      effect[section.name].map((item, itemIndex) => (
                        <div key={sectionIndex} className='accordion-item'>
                          <div className='accordion-header'>
                            <button
                              className='accordion-button'
                              type='button'
                              data-bs-toggle='collapse'
                              data-bs-target={`#${section.name}${itemIndex}AccordionBody`}
                              aria-expanded='true'
                              aria-controls={`${section.name}${itemIndex}AccordionBody`}
                            >
                              <h6>{`${startCase(section.name)} ${
                                itemIndex + 1
                              }`}</h6>
                            </button>
                          </div>
                          <div
                            className='accordion-collapse collapse show'
                            id={`${section.name}${itemIndex}AccordionBody`}
                            data-bs-parent='#sectionAccordion'
                          >
                            <div className='accordion-body'>
                              {section.content(effectIndex, item, itemIndex)}
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

        <form
          className='needs-validation'
          onSubmit={() => {
            validateForm()
            onSubmit()
          }}
          noValidate
        >
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#details'
            aria-expanded='false'
            aria-controls='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show' id='details'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col-sm'>
                <Input
                  type='text'
                  name='value'
                  autoComplete='off'
                  label={true}
                  placeholder='Item Name'
                  required={true}
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='itemCategory'
                  placeholder='Item category'
                  options={builders?.item.itemCategory}
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='itemType'
                  placeholder='Item type'
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
                  options={builders?.item.rarity}
                  onChange={setState}
                />
              </div>
              {state?.itemCategory && state?.itemCategory?.name !== 'Item' && (
                <div className='position-relative col-sm'>
                  <Input
                    className={`${
                      state?.itemRank &&
                      (NUM_REGEX.test(state?.itemRank)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='itemRank'
                    label={true}
                    placeholder='Item Rank'
                    autoComplete='off'
                    onChange={setState}
                  />
                  <div id='itemRankTooltip' className='invalid-tooltip'>
                    Must contain only numbers
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#description'
            aria-expanded='false'
            aria-controls='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show pb-2' id='description'>
            <TextEditor
              onChange={setState}
              placeholder={'Item description'}
              name={'desc'}
            />
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#attribute'
            aria-expanded='false'
            aria-controls='attribute'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show pb-2' id='attribute'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col-sm'>
                <Select
                  name='attribute'
                  multiple={true}
                  placeholder='Attributes'
                  options={builders?.item.attribute}
                  onChange={setState}
                />
              </div>
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'weight'
              ) && (
                <div className='position-relative col-sm'>
                  <Input
                    className={`${
                      state?.attribute[
                        state?.attribute?.findIndex(
                          (attributeItem) => attributeItem.name === 'weight'
                        )
                      ].maxValue &&
                      (NUM_REGEX.test(
                        state?.attribute[
                          state?.attribute?.findIndex(
                            (attributeItem) => attributeItem.name === 'weight'
                          )
                        ].maxValue
                      )
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'weight'
                    )}.maxValue`}
                    label={true}
                    placeholder='Item Weight'
                    autoComplete='off'
                    onChange={setState}
                  />
                  <div
                    id={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'weight'
                    )}.maxValueTooltip`}
                    className='invalid-tooltip'
                  >
                    Must contain only numbers
                  </div>
                </div>
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'container'
              ) && (
                <div className='position-relative col-sm'>
                  <Input
                    className={`${
                      state?.attribute[
                        state?.attribute?.findIndex(
                          (attributeItem) => attributeItem.name === 'container'
                        )
                      ].maxValue &&
                      (NUM_REGEX.test(
                        state?.attribute[
                          state?.attribute?.findIndex(
                            (attributeItem) =>
                              attributeItem.name === 'container'
                          )
                        ].maxValue
                      )
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'container'
                    )}.maxValue`}
                    label={true}
                    placeholder='Capacity Weight'
                    autoComplete='off'
                    onChange={setState}
                  />
                  <div
                    id={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'container'
                    )}.maxValueTooltip`}
                    className='invalid-tooltip'
                  >
                    Must contain only numbers
                  </div>
                </div>
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'stackable'
              ) && (
                <div className='position-relative col-sm'>
                  <Input
                    className={`${
                      state?.attribute[
                        state?.attribute?.findIndex(
                          (attributeItem) => attributeItem.name === 'stackable'
                        )
                      ].maxValue &&
                      (NUM_REGEX.test(
                        state?.attribute[
                          state?.attribute?.findIndex(
                            (attributeItem) =>
                              attributeItem.name === 'stackable'
                          )
                        ].maxValue
                      )
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'stackable'
                    )}.maxValue`}
                    label={true}
                    placeholder='Max Stack Size'
                    autoComplete='off'
                    onChange={setState}
                  />
                  <div
                    id={`attribute.${state?.attribute?.findIndex(
                      (attributeItem) => attributeItem.name === 'stackable'
                    )}.maxValueTooltip`}
                    className='invalid-tooltip'
                  >
                    Must contain only numbers
                  </div>
                </div>
              )}
              {state?.itemCategory?.name === 'Weapon' && (
                <>
                  <div className='col-sm position-relative'>
                    <Input
                      className={`${
                        state.weaponDamage?.diceCount &&
                        (NUM_REGEX.test(state.weaponDamage?.diceCount)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='weaponDamage.diceCount'
                      label={true}
                      placeholder='Damage Dice Count'
                      onChange={setState}
                    />
                    <div
                      id='weaponDamage.diceCountTooltip'
                      className='invalid-tooltip'
                    >
                      Must contain only numbers
                    </div>
                  </div>
                  <div className='col-sm position-relative'>
                    <Input
                      className={`${
                        state.weaponDamage?.diceValue &&
                        (NUM_REGEX.test(state.weaponDamage?.diceValue)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='weaponDamage.diceValue'
                      label={true}
                      placeholder='Damage Dice Value'
                      onChange={setState}
                    />
                    <div
                      id='weaponDamage.diceValueTooltip'
                      className='invalid-tooltip'
                    >
                      Must contain only numbers
                    </div>
                  </div>
                  <div className='col-sm'>
                    <Select
                      name={'primaryAbility'}
                      placeholder='Primary Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                  {state?.itemProperty?.find((property) => {
                    return property.name === 'Versatile'
                  }) && (
                    <div className='col-sm'>
                      <Select
                        name={'secondaryAbility'}
                        placeholder='Secondary Ability'
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
              {state?.itemCategory?.name === 'armor' && (
                <div className='position-relative col-sm'>
                  <Input
                    className={`form-control ${
                      state.armorValue &&
                      (NUM_REGEX.test(state.armorValue)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='armorValue'
                    label={true}
                    placeholder='Armor Value'
                    onChange={setState}
                  />
                  <div id='armorValueTooltip' className='invalid-tooltip'>
                    Must contain only numbers
                  </div>
                </div>
              )}
              {state?.itemProperty?.find(
                (property) =>
                  property.name === 'Thrown' || property.name === 'Ranged'
              ) && (
                <>
                  <div className='position-relative col-sm'>
                    <Input
                      className={`${
                        state.thrown?.minRange &&
                        (NUM_REGEX.test(state.thrown?.minRange)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='thrown.minRange'
                      label={true}
                      placeholder='Thrown Min Range'
                      onChange={setState}
                    />
                    <div
                      id='thrown.minRangeTooltip'
                      className='invalid-tooltip'
                    >
                      Must contain only numbers
                    </div>
                  </div>
                  <div className='position-relative col-sm'>
                    <Input
                      className={`${
                        state.thrown?.maxRange &&
                        (NUM_REGEX.test(state.thrown?.maxRange)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='thrown.maxRange'
                      label={true}
                      placeholder='Max Range'
                      onChange={setState}
                    />
                    <div
                      id='thrown.maxRangeTooltip'
                      className='invalid-tooltip'
                    >
                      Must contain only numbers
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className='pb-3'>
            <button
              className='btn btn-secondary me-2'
              name='effect'
              type='button'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Effect
            </button>
            <button className='btn btn-primary' type='submit'>
              Add Item
            </button>
          </div>
          {effectContent}
        </form>
      </div>
    )
    return content
  }
}
export default NewItemForm
