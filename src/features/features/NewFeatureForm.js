import { useEffect, useReducer } from 'react'
import { useAddNewFeatureMutation } from './featuresApiSlice'
import TextEditor from '../../components/TextEditor'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatureQuery } from './featuresApiSlice'
import formReducer from '../../hooks/useReducer'
import { startCase } from 'lodash'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const NUM_REGEX = /^[0-9\b]+$/

const NewFeatureForm = ({ id }) => {
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
    data: feature,
    isSuccess: featureSuccess,
    isLoading: featureLoading,
  } = useGetFeatureQuery(id)

  const [addNewFeature, { isSuccess: addSuccess }] = useAddNewFeatureMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })

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

  let content

  if (builderLoading || spellLoading || featureLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess && spellSuccess && featureSuccess) {
    console.log(state)

    // Submit to databases
    const onSubmit = async () => {
      await addNewFeature(state)
    }

    const sections = [
      {
        name: 'feat',
        content(effect, effectIndex, item, index) {
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
                    name={`effect.${effectIndex}.${this.name}`}
                    multiple={effect?.attribute?.some(
                      (attribute) => attribute.name === 'providesOptions'
                    )}
                    placeholder='Feat'
                    options={feature?.filter((featureItem) =>
                      featureItem?.featureType?.some(
                        (typeItem) => typeItem.name === 'feat'
                      )
                    )}
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
        content(effect, effectIndex, item, index) {
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
                {item.modType?.name && (
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
                  item.modType?.name === 'advantage' ||
                  item.modType?.name === 'disadvantage' ||
                  item.modType?.name === 'setValue') && (
                  <>
                    {item.module?.name === 'ability' ||
                    item.module?.name === 'saveAbility' ? (
                      <div className='col-sm'>
                        <Select
                          name={`effect.${effectIndex}.${this.name}.${index}.ability`}
                          multiple={effect?.attribute?.some(
                            (attribute) => attribute.name === 'providesOptions'
                          )}
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
                            multiple={effect?.attribute?.some(
                              (attribute) =>
                                attribute.name === 'providesOptions'
                            )}
                            placeholder='Skill'
                            options={builders.skill}
                            onChange={setState}
                          />
                        </div>
                      )
                    )}
                    {item.modType?.name === 'bonus' &&
                      item.modType?.name === 'penalty' &&
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
                  </>
                )}
                <>
                  {item.module?.name === 'condition' ? (
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.${this.name}.${index}.condition`}
                        multiple={effect?.attribute?.some(
                          (attribute) => attribute.name === 'providesOptions'
                        )}
                        placeholder='Condition Type'
                        options={builders.condition}
                        onChange={setState}
                      />
                    </div>
                  ) : item.module?.name === 'speed' ? (
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.${this.name}.${index}.speed`}
                        multiple={effect?.attribute?.some(
                          (attribute) => attribute.name === 'providesOptions'
                        )}
                        placeholder='Speed Type'
                        options={builders.speed}
                        onChange={setState}
                      />
                    </div>
                  ) : item.module?.name === 'passive' ? (
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.${this.name}.${index}.speed`}
                        multiple={effect?.attribute?.some(
                          (attribute) => attribute.name === 'providesOptions'
                        )}
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
                          multiple={effect?.attribute?.some(
                            (attribute) => attribute.name === 'providesOptions'
                          )}
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
                        <div className='form-floating'>
                          <input
                            className={`form-control ${
                              item.method?.setValue &&
                              (NUM_REGEX.test(item.method.setValue)
                                ? 'is-valid'
                                : 'is-invalid')
                            }`}
                            type='text'
                            name={`effect.${effectIndex}.${this.name}.${index}.method.setValue`}
                            id={`effect.${effectIndex}.${this.name}.${index}.method.setValue`}
                            placeholder='Set Value'
                            autoComplete='off'
                            onChange={(e) => setState({ payload: e })}
                          />
                          <label
                            htmlFor={`effect.${effectIndex}.${this.name}.${index}.method.setValue`}
                          >
                            Set Value
                          </label>
                          <div
                            id={`effect.${effectIndex}.${this.name}.${index}.method.setValueTooltip`}
                            className='invalid-tooltip'
                          >
                            Must contain only numbers
                          </div>
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
              </div>
            </>
          )
        },
      },
      {
        name: 'proficiency',
        content(effect, effectIndex, item, index) {
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
                      multiple={effect?.attribute?.some(
                        (attribute) => attribute.name === 'providesOptions'
                      )}
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
                      multiple={effect?.attribute?.some(
                        (attribute) => attribute.name === 'providesOptions'
                      )}
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
                      multiple={effect?.attribute?.some(
                        (attribute) => attribute.name === 'providesOptions'
                      )}
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
                      multiple={effect?.attribute?.some(
                        (attribute) => attribute.name === 'providesOptions'
                      )}
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
        content(effect, effectIndex, item, index) {
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
                    multiple={effect?.attribute?.some(
                      (attribute) => attribute.name === 'providesOptions'
                    )}
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
        name: 'sense',
        content(effect, effectIndex, item, index) {
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
                    multiple={effect?.attribute?.some(
                      (attribute) => attribute.name === 'providesOptions'
                    )}
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
                <div className='col-4'>
                  <Input
                    className='form-control border-0'
                    type='text'
                    name={`effect.${effectIndex}.value`}
                    autoComplete='off'
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
                <div className='row rows-col-lg rows-col-md-3 rows-col-sm-1 justify-content-start g-2 pb-3'>
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
                      name={`effect.${effectIndex}.attribute`}
                      multiple='true'
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
                        name={`effect.${effectIndex}.action`}
                        options={builders.effect.action}
                        placeholder='Action Type'
                        onChange={setState}
                      />
                    </div>
                  )}
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'providesOptions'
                  ) && (
                    <div className='col-sm'>
                      <Input
                        type='text'
                        name={`effect.${effectIndex}.maxDupValue`}
                        label={true}
                        autoComplete='off'
                        placeholder='Max Dup. Selections'
                        require={true}
                        onChange={setState}
                      />
                    </div>
                  )}
                  {effect?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'conditionLimits'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.limitCondition`}
                        options={builders.effect.limitOption}
                        placeholder='Limiting Attributes'
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
                            <div
                              id={`effect.${effectIndex}.limitBy.setAmountTooltip`}
                              className='invalid-tooltip'
                            >
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
                          label={true}
                          autoComplete='off'
                          placeholder='Min Range'
                          require={true}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Input
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
                    <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 align-items-end pb-2'>
                      <div className='col-sm'>
                        <Select
                          multiple='true'
                          name={`effect.${effectIndex}.damage.damageAttribute`}
                          placeholder='Damage Attribute'
                          options={builders.effect.damageAttribute}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
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
                              {section.content(
                                effect,
                                effectIndex,
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
        <h1>Create a Feature</h1>
        <form
          className='needs-validation'
          onSubmit={() => {
            validateForm()
            onSubmit()
          }}
          noValidate
        >
          <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
            <div className='col-sm'>
              <Input
                type='text'
                name='value'
                autoComplete='off'
                placeholder='Feature Name'
                label={true}
                required={true}
                onChange={setState}
              />
            </div>
            <div className='col-sm'>
              <Select
                multiple='true'
                name='featureType'
                placeholder='Feature Type'
                options={builders.feature.featureType}
                onChange={setState}
              />
            </div>
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#description'
            aria-expanded='true'
            aria-controls='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show' id='description'>
            <div className='pb-2'>
              <TextEditor
                onChange={setState}
                placeholder={'Feature Description'}
                name={'desc'}
              />
            </div>
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
                  placeholder='Attribute'
                  options={builders.feature.attribute}
                  onChange={setState}
                />
              </div>
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
export default NewFeatureForm
