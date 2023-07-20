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

  console.log(builders)

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
      setSuccessMessage('Spell added successfully!')
    }
  }, [addIsSuccess, id, setState])

  let content

  if (builderLoading || spellLoading || featLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess && spellSuccess && featSuccess) {
    // Submit to databases
    const onSubmit = async () => {
      await addNewFeat(state)
    }

    const sections = [
      {
        name: 'modifier',
        content(feature, featureIndex, item, index) {
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
                {item.modType?.name && (
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
                  item.modType?.name === 'advantage' ||
                  item.modType?.name === 'disadvantage' ||
                  item.modType?.name === 'setValue') && (
                  <>
                    {item.module?.name === 'ability' ||
                    item.module?.name === 'saveAbility' ? (
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                          multiple={feature?.attribute?.some(
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
                            name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                            multiple={feature?.attribute?.some(
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
                  </>
                )}
                <>
                  {item.module?.name === 'condition' ? (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.condition`}
                        multiple={feature?.attribute?.some(
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
                        name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                        multiple={feature?.attribute?.some(
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
                        name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                        multiple={feature?.attribute?.some(
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
                          name={`feature.${featureIndex}.${this.name}.${index}.damage`}
                          multiple={feature?.attribute?.some(
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
                            name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                            id={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                            placeholder='Set Value'
                            autoComplete='off'
                            onChange={(e) => setState({ payload: e })}
                          />
                          <label
                            htmlFor={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                          >
                            Set Value
                          </label>
                          <div
                            id={`feature.${featureIndex}.${this.name}.${index}.method.setValueTooltip`}
                            className='invalid-tooltip'
                          >
                            Must contain only numbers
                          </div>
                        </div>
                      </div>
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
                      multiple={feature?.attribute?.some(
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
                      name={`feature.${featureIndex}.${this.name}.${index}.area.saveAbility`}
                      multiple={feature?.attribute?.some(
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
                      name={`feature.${featureIndex}.${this.name}.${index}.area.tool`}
                      multiple={feature?.attribute?.some(
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
                      name={`feature.${featureIndex}.${this.name}.${index}.area.language`}
                      multiple={feature?.attribute?.some(
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
        content(feature, featureIndex, item, index) {
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
                    multiple={feature?.attribute?.some(
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
      {
        name: 'spell',
        content(feature, featureIndex, item, index) {
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
                    options={builders.feat.feature.spell.attribute}
                    placeholder='Feature Attributes'
                    onChange={setState}
                  />
                </div>
                <div className='col-sm'>
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    multiple={feature?.attribute?.some(
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
    ]

    console.log(state)

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
                  className='col-4 border-0'
                  type='text'
                  border={false}
                  name={`feature.${featureIndex}.value`}
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
                <div className='row rows-col-lg rows-col-md-3 rows-col-sm-1 justify-content-start g-2 pb-3'>
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
                <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.attribute`}
                      multiple='true'
                      options={builders.feat.feature.attribute}
                      placeholder='Feature Attributes'
                      onChange={setState}
                    />
                  </div>
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'isAction'
                  ) && (
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.action`}
                        options={builders.feat.feature.action}
                        placeholder='Action Type'
                        onChange={setState}
                      />
                    </div>
                  )}
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'providesOptions'
                  ) && (
                    <Input
                      type='text'
                      className='col-sm'
                      name={`feature.${featureIndex}.maxDupValue`}
                      label={true}
                      autoComplete='off'
                      placeholder='Max Dup. Selections'
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {feature?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'limitUses'
                  ) && (
                    <>
                      <div className='col-sm'>
                        <Select
                          name={`feature.${featureIndex}.limitBy`}
                          placeholder='Limit By Option'
                          options={builders.feat.feature.chargeLimit}
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
                          options={builders.feat.feature.chargeReset}
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
                        label={true}
                        autoComplete='off'
                        placeholder='Min Range'
                        require={true}
                        onChange={setState}
                      />
                      <Input
                        type='text'
                        className='col-sm'
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
                    <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 align-items-end pb-2'>
                      <div className='col-sm'>
                        <Select
                          multiple='true'
                          name={`feature.${featureIndex}.damage.damageAttribute`}
                          placeholder='Damage Attribute'
                          options={builders.feat.feature.damageAttribute}
                          onChange={setState}
                        />
                      </div>
                      <div className='col-sm'>
                        <Select
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
                              id={`${section.name}${itemIndex}AccordionBody`}
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
                              {section.content(
                                feature,
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
        <form
          className='needs-validation'
          onSubmit={() => {
            validateForm()
            onSubmit()
          }}
          noValidate
        >
          <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
            <Input
              type='text'
              className='col-sm'
              name='name'
              autoComplete='off'
              placeholder='Feat Name'
              label={true}
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
                onChange={setState}
                placeholder={'feat Description'}
                name={'desc'}
              />
            </div>
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='attributeButton'
            target='attribute'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse show pb-2' id='attribute'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col-sm'>
                <Select
                  name='attribute'
                  multiple={true}
                  placeholder='Attributes'
                  options={builders.feat.attribute}
                  onChange={setState}
                />
              </div>
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
export default NewFeatForm
