import { useState, useEffect, useReducer } from 'react'
import { useAddNewItemMutation } from './itemsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
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
        name: 'modifier',
        content(featureIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                    placeholder='Modifier Type'
                    options={builders.modifier.modType}
                    onChange={setState}
                  />
                </div>
                {!!item.modType?.name && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.module`}
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
                          name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                          placeholder='Ability'
                          options={builders.ability}
                          onChange={setState}
                        />
                      </div>
                    ) : (
                      item.module?.name === 'skill' && (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.${this.name}.${index}.skill`}
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
                            name={`feature.${featureIndex}.${this.name}.${index}.method`}
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
                          name={`feature.${featureIndex}.${this.name}.${index}.condition`}
                          placeholder='Condition Type'
                          options={builders.condition}
                          onChange={setState}
                        />
                      </div>
                    ) : item.module?.name === 'speed' ? (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                          placeholder='Speed Type'
                          options={builders.speed}
                          onChange={setState}
                        />
                      </div>
                    ) : item.module?.name === 'passive' ? (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                          placeholder='Passive Type'
                          options={builders.passive}
                          onChange={setState}
                        />
                      </div>
                    ) : (
                      item.module?.name === 'damage' && (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.${this.name}.${index}.damage`}
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
                          className={`col-sm form-control ${
                            item.method?.setValue &&
                            (NUM_REGEX.test(item.method.setValue)
                              ? 'is-valid'
                              : 'is-invalid')
                          }`}
                          type='text'
                          name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                          label={true}
                          invalidText='Must contain only numbers'
                          placeholder='Set Value'
                          autoComplete='off'
                          onChange={setState}
                        />
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                            placeholder='Multiplier'
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
        name: 'proficiency',
        content(featureIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.area`}
                    placeholder='Proficiency Area'
                    options={builders.proficiency.area}
                    onChange={setState}
                  />
                </div>
                {item?.area?.name === 'skill' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.area.skill`}
                      placeholder='Skill'
                      options={builders.skill}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'saveAbility' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.area.saveAbility`}
                      placeholder='Save Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'tool' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.area.tool`}
                      placeholder='Tool'
                      options={builders.tool}
                      onChange={setState}
                    />
                  </div>
                )}
                {item?.area?.name === 'language' && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.area.language`}
                      placeholder='Language'
                      options={builders.language}
                      onChange={setState}
                    />
                  </div>
                )}
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.level`}
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
        name: 'sense',
        content(featureIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.sense`}
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
      {
        name: 'spell',
        content(featureIndex, item, index) {
          return (
            <>
              <div className='pb-3'>
                <button
                  className='btn btn-outline-primary col-auto'
                  type='button'
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  {`Remove ${startCase(this.name)}`}
                </button>
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple='true'
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.item.feature.spell.attribute}
                    placeholder='Feature Attributes'
                    onChange={setState}
                  />
                </div>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}`}
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
    ]

    const featureContent =
      state?.feature?.length !== 0 &&
      state?.feature?.map((feature, featureIndex) => (
        <div key={featureIndex} className='accordion' id='featureAccordion'>
          <div className='accordion-item'>
            <div className='accordion-header'>
              <AccordionButton
                id={`feature${featureIndex}AccordionButton`}
                target={`feature${featureIndex}AccordionBody`}
              >
                <Input
                  className='col-sm-4 border-0'
                  type='text'
                  name={`feature.${featureIndex}.value`}
                  border={false}
                  autoComplete='off'
                  placeholder='Feature Name'
                  required={true}
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
                <div className='row row-cols-lg-auto row-cols-md-3 row-cols-sm-1 justify-content-start g-2 pb-3'>
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
                  {sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className='col-auto'>
                      <button
                        key={sectionIndex}
                        className='btn btn-secondary'
                        type='button'
                        name={`feature.${featureIndex}.${section.name}`}
                        onClick={(e) => setState({ type: 'added', payload: e })}
                      >
                        {`Add ${startCase(section.name)}`}
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
                      onChange={setState}
                    />
                  </div>
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'isAction'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={'action.num'}
                        placeholder='Action Type'
                        options={builders.item.feature.action}
                        onChange={setState}
                      />
                    </div>
                  )}
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUses'
                  ) && (
                    <>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.limitBy`}
                          placeholder='Limit By Option'
                          options={builders.item.feature.chargeLimit}
                          onChange={setState}
                        />
                      </div>
                      {feature?.limitBy?.name === 'ability' ? (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.limitBy.ability`}
                            placeholder='Ability'
                            options={builders.ability}
                            onChange={setState}
                          />
                        </div>
                      ) : feature?.limitBy?.name === 'skill' ? (
                        <div className='col-sm'>
                          <Select
                            name={`feature.${featureIndex}.limitBy.skill`}
                            placeholder='Skill'
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      ) : (
                        feature?.limitBy?.name === 'setNumber' && (
                          <Input
                            className={`col-sm ${
                              feature?.limitBy?.setAmount &&
                              (NUM_REGEX.test(feature?.limitBy.setAmount)
                                ? 'is-valid'
                                : 'is-invalid')
                            }`}
                            type='text'
                            name={`feature.${featureIndex}.limitBy.setAmount`}
                            label={true}
                            invalidText='Must contain only numbers'
                            placeholder='Use Amount'
                            required={true}
                            onChange={setState}
                          />
                        )
                      )}
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.resetsOn`}
                          placeholder='Reset Option'
                          options={builders.item.feature.chargeReset}
                          onChange={setState}
                        />
                      </div>
                    </>
                  )}
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'hasRange'
                  ) && (
                    <>
                      <Input
                        type='text'
                        className='col-sm'
                        name={`feature.${featureIndex}.inRange`}
                        autoComplete='off'
                        label={true}
                        placeholder='Min Range'
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        className='col-sm'
                        type='text'
                        name={`feature.${featureIndex}.maxRange`}
                        label={true}
                        autoComplete='off'
                        placeholder='Max Range'
                        required={true}
                        onChange={setState}
                      />
                    </>
                  )}
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'requireSave'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.saveAbility`}
                        placeholder='DC Ability'
                        options={builders.ability}
                        onChange={setState}
                      />
                    </div>
                  )}
                </div>
                {feature?.limitBy?.name === 'level' &&
                  feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUses'
                  ) &&
                  (feature.limitBy.level ??
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.limitBy.level`,
                        },
                      },
                    })) && (
                    <div>
                      <Table
                        className='table-sm table-responsive'
                        headers={[{ name: 'Level' }, { name: 'Uses' }]}
                        name={`feature.${featureIndex}.limitBy.level`}
                        state={feature?.limitBy?.level}
                        onChange={setState}
                      />
                    </div>
                  )}
                {feature?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'doesDamage'
                ) &&
                  (!feature?.damage?.damageByLevel ? (
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
                          name={`feature.${featureIndex}.damage.damageByLevel`}
                          state={feature?.damage.damageByLevel}
                          onChange={setState}
                        />
                      </div>
                    </div>
                  ))}
                <div className='accordion' id='sectionAccordion'>
                  {sections.map(
                    (section, sectionIndex) =>
                      !!feature[section.name] &&
                      feature[section.name].map((item, itemIndex) => (
                        <div key={itemIndex} className='accordion-item'>
                          <div className='accordion-header'>
                            <AccordionButton
                              id={`${section.name}${itemIndex}AccordionButton`}
                              target={`${section.name}${itemIndex}AccordionBody`}
                            >
                              <h6>{`${startCase(section.name)} ${
                                itemIndex + 1
                              }`}</h6>
                            </AccordionButton>
                          </div>
                          <div
                            className='accordion-collapse collapse show'
                            id={`${section.name}${itemIndex}AccordionBody`}
                            data-bs-parent='#sectionAccordion'
                          >
                            <div className='accordion-body'>
                              {section.content(featureIndex, item, itemIndex)}
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
                type='text'
                className='col-sm'
                name='value'
                autoComplete='off'
                label={true}
                placeholder='Item Name'
                required={true}
                onChange={setState}
              />
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
                <Input
                  className={`col-sm ${
                    state?.itemRank &&
                    (NUM_REGEX.test(state?.itemRank)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  type='text'
                  name='itemRank'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Item Rank'
                  autoComplete='off'
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
                  options={builders?.item.attribute}
                  onChange={setState}
                />
              </div>
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'weight'
              ) && (
                <Input
                  className={`col-sm ${
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
                  invalidText='Must contain only numbers'
                  placeholder='Item Weight'
                  autoComplete='off'
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'container'
              ) && (
                <Input
                  className={`col-sm ${
                    state?.attribute[
                      state?.attribute?.findIndex(
                        (attributeItem) => attributeItem.name === 'container'
                      )
                    ].maxValue &&
                    (NUM_REGEX.test(
                      state?.attribute[
                        state?.attribute?.findIndex(
                          (attributeItem) => attributeItem.name === 'container'
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
                  invalidText='Must contain only numbers'
                  placeholder='Capacity Weight'
                  autoComplete='off'
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'stackable'
              ) && (
                <Input
                  className={`col-sm ${
                    state?.attribute[
                      state?.attribute?.findIndex(
                        (attributeItem) => attributeItem.name === 'stackable'
                      )
                    ].maxValue &&
                    (NUM_REGEX.test(
                      state?.attribute[
                        state?.attribute?.findIndex(
                          (attributeItem) => attributeItem.name === 'stackable'
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
                  invalidText='Must contain only numbers'
                  placeholder='Max Stack Size'
                  autoComplete='off'
                  onChange={setState}
                />
              )}
              {state?.itemCategory?.name === 'Weapon' && (
                <>
                  <Input
                    className={`col-sm ${
                      state.weaponDamage?.diceCount &&
                      (NUM_REGEX.test(state.weaponDamage?.diceCount)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='weaponDamage.diceCount'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Count'
                    onChange={setState}
                  />
                  <Input
                    className={`col-sm ${
                      state.weaponDamage?.diceValue &&
                      (NUM_REGEX.test(state.weaponDamage?.diceValue)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='weaponDamage.diceValue'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Value'
                    onChange={setState}
                  />
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
                <Input
                  className={`col-sm form-control ${
                    state.armorValue &&
                    (NUM_REGEX.test(state.armorValue)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  type='text'
                  name='armorValue'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Armor Value'
                  onChange={setState}
                />
              )}
              {state?.itemProperty?.find(
                (property) =>
                  property.name === 'Thrown' || property.name === 'Ranged'
              ) && (
                <>
                  <Input
                    className={`col-sm ${
                      state.thrown?.minRange &&
                      (NUM_REGEX.test(state.thrown?.minRange)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='thrown.minRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Thrown Min Range'
                    onChange={setState}
                  />
                  <Input
                    className={`col-sm ${
                      state.thrown?.maxRange &&
                      (NUM_REGEX.test(state.thrown?.maxRange)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='thrown.maxRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Max Range'
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
            <button className='btn btn-primary' type='submit'>
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
