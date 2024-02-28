import { useEffect, memo } from 'react'
import {
  ReducerActionType,
  DropdownOption,
  RowHeader,
  RowInput,
  FormContext,
} from '../../utils/types'
import Grid from '../Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import Dropdown from '../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  useGetItemsQuery,
  selectAllItems,
} from '../../features/items/itemsApiSlice'
import Input from '../Input/Input'
import Collapse from '../Collapse/Collapse'
import Divider from '../Divider/Divider'
import Table from '../Table/Table'
import { form_content } from './Form.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'
import RichTextEditor from '../RichTextEditor/RichTextEditor'

interface AttributeFormProps {
  context: {
    type: FormContext
    title: string
  }
  formState: any
  setFormState: (arg: ReducerActionType) => void
  handleRemove: (arg: string) => void
}

const AttributeForm = memo(
  ({ context, formState, setFormState, handleRemove }: AttributeFormProps) => {
    const isLoading = useIsLoading()

    const { data: builders } = useGetBuildersQuery(undefined)

    const { items } = useGetItemsQuery(undefined, {
      selectFromResult: ({ data }) => ({
        items: data && selectAllItems(data),
      }),
    })

    useEffect(() => {
      if (
        !formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'resource'
        ) &&
        formState.resource
      ) {
        handleRemove('resource')
      }
    }, [formState.attribute, formState.resource, setFormState, handleRemove])

    // Damage table data
    const damageTableColumns = () => {
      const upcastState = formState.upcast
      const damageState = formState.damage
      const damage =
        (upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'damage'
        ) ||
          upcastState?.upcastAttribute?.some(
            (attributeItem: any) => attributeItem.name === 'all'
          )) &&
        formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'doesDamage'
        )
      const secondary =
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'secondaryDice'
        ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'all'
        )
      const bonus =
        damage &&
        damageState?.damageAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'bonusDamage'
        ) &&
        damageState?.bonus?.bonusAttribute?.name === 'setValue'
      const range =
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'range'
        ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'all'
        )
      const shape =
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'shape'
        ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'all'
        )
      const duration =
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'duration'
        ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'all'
        )
      const inputArray: Array<RowInput> = [
        {
          name: 'level',
          value: 'Level',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
      ]
      if (damage) {
        inputArray.push(
          {
            name: 'dice.diceCount',
            value: 'Dice Count',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: 'dice.diceValue',
            value: 'Dice Value',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          }
        )
      }
      if (secondary) {
        inputArray.splice(
          3,
          0,
          {
            name: 'dice.secDiceCount',
            value: 'Secondary Dice Count',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: 'dice.secDiceValue',
            value: 'Secondary Dice Value',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          }
        )
      }
      if (bonus) {
        inputArray.push({
          name: 'bonusDamage',
          value: 'Bonus Damage',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        })
      }
      if (duration) {
        inputArray.push(
          {
            name: 'duration.durationType',
            value: 'Duration',
            type: 'select',
            options: builders.spell.duration,
          },
          {
            name: 'duration.value',
            value: 'Duration Increment',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          }
        )
      }
      if (range) {
        inputArray.push(
          {
            name: 'range.distance',
            value: 'Distance',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: 'range.unit',
            value: 'UoM',
            type: 'select',
            options: Object.values(builders.unit.imperial).flatMap(
              (item) => item
            ),
            optionalKey: 'short',
          }
        )
      }
      if (shape) {
        inputArray.push(
          {
            name: 'shape.size',
            value: 'Shape Size',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          },
          {
            name: 'shape.unit',
            value: 'UoM',
            type: 'select',
            options: Object.values(builders.unit.imperial).flatMap(
              (item) => item
            ),
            optionalKey: 'short',
          }
        )
      }

      const headerArray: Array<RowHeader> = inputArray.map((inputItem) => ({
        value: inputItem.value,
      }))

      return { inputs: inputArray, headers: headerArray }
    }

    // Class level table data
    const levelTableColumns = () => {
      const spellCaster = formState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'spellCaster'
      )
      !formState.levelAttribute &&
        setFormState({
          type: 'added',
          target: { name: 'levelAttribute' },
        })
      spellCaster &&
        formState.levelAttribute?.map(
          (levelAttributeItem: any, levelAttributeIndex: number) =>
            !levelAttributeItem?.spellSlots &&
            setFormState({
              type: 'added',
              target: {
                name: `levelAttribute.${levelAttributeIndex}.spellSlots`,
              },
            })
        )
      const resource = formState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'resource'
      )
      const inputArray: Array<RowInput> = [
        {
          name: 'level',
          value: 'Level',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          required: true,
        },
      ]
      if (formState.category?.name === 'base') {
        inputArray.push({
          name: 'proficiencyBonus',
          value: 'Prof. Bonus',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        })
      }
      if (resource) {
        inputArray.push({
          name: 'resourcePoints',
          value: `${formState.resource?.value ?? 'Resource'} Points`,
          validation: 'num',
          errorMsg: 'Must contain only numbers',
        })
      }
      if (spellCaster) {
        if (
          formState.spellcasting?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'limitKnownSpells'
          )
        ) {
          inputArray.push({
            name: 'spellsKnown',
            value: 'Spells Known',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
        }
        if (formState.spellcasting?.maxSpellLevel) {
          for (let i = 0; i <= formState.spellcasting?.maxSpellLevel; i++) {
            inputArray.push({
              name: `spellSlots.${i}.slotCount`,
              value: `${i}`,
              errorMsg: 'Must contain only numbers',
              validation: 'num',
            })
          }
        }
      }

      const headerArray: Array<RowHeader> = inputArray.map((inputItem) => ({
        value: inputItem.value,
        required: true,
      }))

      return { inputs: inputArray, headers: headerArray }
    }

    // Create/Remove Subtypes table
    useEffect(() => {
      if (
        formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypes'
        ) &&
        !formState.subtype
      ) {
        setFormState({
          type: 'added',
          target: { name: 'subtype' },
        })
      }
      if (
        !formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypes'
        ) &&
        formState.subtype != null
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'subtype' },
        })
      }
    }, [formState, setFormState])

    // Create/remove Upcast table
    useEffect(() => {
      if (
        formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'canUpcast'
        ) &&
        formState.upcast?.upcastAttribute?.length > 0 &&
        !formState.upcast?.upcastAttribute?.every(
          (attributeItem: any) => attributeItem.name === 'targets'
        ) &&
        formState.upcast?.upcastStats == null
      ) {
        setFormState({
          type: 'added',
          target: { name: 'upcast.upcastStats' },
        })
      }
      if (
        !formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'canUpcast'
        ) &&
        formState.upcast?.upcastStats != null
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'upcast.upcastStats' },
        })
      }
    }, [setFormState, formState])

    //Create/remove Limit Use table
    useEffect(() => {
      if (
        formState.limitUse?.limitBy?.name === 'level' &&
        formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'limitUse'
        ) &&
        formState.limitUse?.level == null
      ) {
        setFormState({
          type: 'added',
          target: { name: `limitUse.level` },
        })
      }
      if (
        formState.limitUse?.limitBy?.name !== 'level' &&
        formState.limitUse?.level != null
      ) {
        setFormState({
          type: 'removed',
          target: { name: `limitUse.level` },
        })
      }
    }, [formState, setFormState])

    // Renove Damage data
    useEffect(() => {
      if (
        (!formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'doesDamage'
        ) &&
          formState.category?.name !== 'weapon') ||
        formState.property?.some(
          (propertyItem: any) => propertyItem.name === 'special'
        )
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'damage' },
        })
      }
    }, [setFormState, formState])

    // Remove Spellcasting data
    useEffect(() => {
      if (
        !formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'spellCaster'
        ) &&
        formState.spellcasting != null
      ) {
        setFormState({
          type: 'removed',
          target: { name: 'spellcasting' },
        })
      }
    }, [formState, setFormState])

    return isLoading || !builders ? (
      <Spinner />
    ) : (
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <Grid className={sprinkles({ mb: 'size-3' })}>
          <Dropdown
            multiSelect={true}
            name='attribute'
            label={`${startCase(context.title)} Attributes`}
            value={formState?.attribute}
            options={builders[context.title].attribute
              .filter((attributeItem: any) =>
                formState.category?.name === 'armor' ||
                formState.category?.name === 'weapon'
                  ? attributeItem
                  : attributeItem.name !== 'maxBonus'
              )
              .filter(
                (attributeItem: any) =>
                  (formState.category?.name === 'base'
                    ? attributeItem
                    : attributeItem.name !== 'primaryAbility' &&
                      attributeItem.name !== 'secondaryAbility') &&
                  (formState.attribute?.some(
                    (attributeItem: any) =>
                      attributeItem.name === 'primaryAbility'
                  )
                    ? attributeItem
                    : attributeItem.name !== 'optionalAbility')
              )}
            onChange={setFormState}
          />
          {formState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'resource'
          ) && (
            <Dropdown
              name='resource.resetOption'
              label='Resource Reset Option'
              value={formState?.resource?.resetOption}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setFormState}
            />
          )}
          {formState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'stackable'
          ) && (
            <Input
              validation={'num'}
              type='text'
              name='maxStack'
              errorMsg='Must contain only numbers'
              label='Max Stack Size'
              autoComplete='off'
              value={formState?.maxStack}
              onChange={setFormState}
            />
          )}
          {formState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'hasRequirements'
          ) && (
            <Dropdown
              multiSelect={true}
              name='requirement.option'
              label='Requirement'
              value={formState?.requirement?.option}
              options={[].concat(
                builders.feature.requirement,
                builders.feature.item.requirement
              )}
              required={true}
              onChange={setFormState}
            />
          )}
          {formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'isAction'
          ) && (
            <Dropdown
              name={context.title === 'spell' ? 'action.actionType' : 'action'}
              label={context.title === 'spell' ? 'Casting Time' : 'Action Type'}
              value={
                context.title === 'spell'
                  ? formState?.action?.actionType
                  : formState?.action
              }
              options={builders[context.title].action}
              required={true}
              onChange={setFormState}
            />
          )}
          {context.title === 'spell' && (
            <>
              {formState?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'secondaryAction'
              ) && (
                <>
                  <Dropdown
                    name='secondaryAction.actionType'
                    label='Sec. Action'
                    value={formState?.secondaryAction?.actionType}
                    options={builders[context.title].action}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    validation={'num'}
                    name='secondaryAction.value'
                    label='Sec. Increment'
                    value={formState?.secondaryAction?.value}
                    required={true}
                    onChange={setFormState}
                  />
                </>
              )}
              {formState?.action &&
                formState.action?.actionType?.name !== 'special' && (
                  <Input
                    validation='num'
                    name='action.value'
                    label='Casting Increment'
                    value={formState?.action?.value}
                    required={true}
                    onChange={setFormState}
                  />
                )}
              <Dropdown
                name='duration.durationType'
                label='Duration'
                value={formState?.duration?.durationType}
                options={builders.spell.duration}
                required={true}
                onChange={setFormState}
              />
              {formState?.duration &&
                formState.duration?.durationType.name !== 'instantaneous' &&
                formState.duration?.durationType.name !== 'untilDispelled' &&
                formState.duration?.durationType.name !== 'special' && (
                  <Input
                    validation={'num'}
                    name='duration.value'
                    errorMsg='Must contain only numbers'
                    label='Duration Increment'
                    autoComplete='off'
                    required={true}
                    value={formState?.duration.value}
                    onChange={setFormState}
                  />
                )}
              <Dropdown
                name='range.rangeType'
                label='Range'
                value={formState?.range?.rangeType}
                options={builders.spell.range}
                required={true}
                onChange={setFormState}
              />
              {formState?.range?.rangeType?.name !== 'touch' &&
                formState.range?.rangeType?.name !== 'sight' &&
                formState.range?.rangeType?.name !== 'unlimited' &&
                formState.range?.rangeType && (
                  <>
                    <Input
                      validation={'num'}
                      name='range.distance'
                      errorMsg='Must contain only numbers'
                      label='Distance'
                      autoComplete='off'
                      required={
                        formState.range?.rangeType?.name === 'distance'
                          ? true
                          : false
                      }
                      value={formState?.range?.distance}
                      onChange={setFormState}
                    />
                    <Dropdown
                      name='range.unit'
                      label='UoM'
                      value={formState?.range?.unit}
                      options={
                        Object.values(builders.unit.imperial).flatMap(
                          (item) => item
                        ) as DropdownOption[]
                      }
                      required={
                        formState.range?.rangeType?.name === 'distance'
                          ? true
                          : false
                      }
                      optionalKey='short'
                      onChange={setFormState}
                    />
                  </>
                )}
              <Dropdown
                name='shape.shapeType'
                label='Shape'
                options={builders.spell.shape}
                value={formState?.shape?.shapeType}
                onChange={setFormState}
              />
              {formState?.shape?.shapeType?.name &&
                formState.shape?.shapeType?.name !== 'none' &&
                formState.shape?.shapeType?.name !== 'weapon' && (
                  <>
                    <Input
                      validation={'cur'}
                      name='shape.size'
                      errorMsg='Must contain only numbers'
                      label='Shape Size'
                      autoComplete='off'
                      required={true}
                      value={formState?.shape?.size}
                      onChange={setFormState}
                    />
                    <Dropdown
                      name='shape.unit'
                      label='UoM'
                      value={formState?.shape?.unit}
                      options={
                        Object.values(builders.unit.imperial).flatMap(
                          (item) => item
                        ) as DropdownOption[]
                      }
                      required={true}
                      optionalKey='short'
                      onChange={setFormState}
                    />
                  </>
                )}
              <Input
                name='targets'
                value={formState?.targets ?? 1}
                label='No. of Targets'
                required={true}
                validation='num'
                errorMsg='Must contain only numbers'
                onChange={setFormState}
              />
              {formState?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'canUpcast'
              ) && (
                <Dropdown
                  name='upcast.upcastAttribute'
                  label='Upcast Attribute'
                  value={formState?.upcast?.upcastAttribute}
                  options={builders.spell.upcastAttribute
                    .filter((upcastItem: any) =>
                      !formState.attribute?.some(
                        (attributeItem: any) =>
                          attributeItem.name === 'doesDamage'
                      )
                        ? upcastItem.name !== 'damage'
                        : upcastItem
                    )
                    .filter((upcastItem: any) =>
                      !formState.damage?.damageAttribute?.some(
                        (attributeItem: any) =>
                          attributeItem.name === 'secondaryDice'
                      )
                        ? upcastItem.name !== 'secondaryDice'
                        : upcastItem
                    )}
                  multiSelect={true}
                  onChange={setFormState}
                />
              )}
              {formState?.upcast?.upcastAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'targets'
              ) && (
                <Input
                  name='upcast.targets'
                  value={formState?.upcast?.targets}
                  label={`Add'l. Targets Per Level`}
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setFormState}
                />
              )}
              {formState?.attribute?.some(
                (attributeItem: any) =>
                  attributeItem.name === 'appliesCondition'
              ) && (
                <Dropdown
                  name='condition'
                  label='Condition'
                  value={formState?.condition}
                  options={builders.condition}
                  multiSelect={true}
                  required={true}
                  onChange={setFormState}
                />
              )}
            </>
          )}
          {formState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'requireSave'
          ) && (
            <>
              {context.title !== 'spell' && (
                <Dropdown
                  name={`saveAbility.attribute`}
                  multiSelect={true}
                  label='Save Attribute'
                  value={formState?.saveAbility?.attribute}
                  options={builders.feature.saveAttribute}
                  onChange={setFormState}
                />
              )}
              <Dropdown
                name={'saveAbility.ability'}
                label='DC Ability'
                value={formState?.saveAbility?.ability}
                options={builders.ability}
                multiSelect={context.title === 'spell'}
                required={true}
                onChange={setFormState}
              />
              {context.title !== 'spell' && (
                <>
                  <Input
                    validation='num'
                    name={`saveAbility.minValue`}
                    autoComplete='off'
                    label='Minimum Value'
                    required={true}
                    errorMsg='Must contain only numbers'
                    value={formState?.saveAbility?.minValue}
                    onChange={setFormState}
                  />
                  {formState?.saveAbility?.attribute?.some(
                    (attributeItem: any) =>
                      attributeItem.name === 'addAbilityModifier'
                  ) && (
                    <Dropdown
                      name={`saveAbility.abilityModifier`}
                      label='Modifier Ability'
                      value={formState?.saveAbility?.abilityModifier}
                      options={builders.ability}
                      required={true}
                      onChange={setFormState}
                    />
                  )}
                </>
              )}
            </>
          )}
        </Grid>
        {formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'resource'
        ) && (
          <Collapse
            startOpened={context.type === 'new'}
            title='Resource Attributes'
            className={sprinkles({ mb: 'size-3' })}
          >
            <Grid>
              <Input
                name='resource.value'
                label='Resource Name'
                autoComplete='off'
                value={formState?.resource?.value}
                required={true}
                onChange={setFormState}
              />
              <Input
                name='resource.levelAvailable'
                label='Level Available'
                autoComplete='off'
                value={formState?.resource?.levelAvailable}
                required={true}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={setFormState}
              />
            </Grid>
            <RichTextEditor
              name={'resource.desc'}
              value={formState?.resource?.desc}
              label={'Description'}
              onChange={setFormState}
            />
          </Collapse>
        )}
        {formState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'spellCaster'
        ) && (
          <Collapse
            startOpened={context.type === 'new'}
            title={'Spellcaster Attributes'}
            className={sprinkles({ mb: 'size-3' })}
          >
            <Dropdown
              name='spellcasting.ability'
              label='Spellcasting Ability'
              required={true}
              value={formState?.spellcasting?.ability}
              options={builders.ability}
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.attribute'
              label='Spell Casting Attributes'
              multiSelect={true}
              value={formState?.spellcasting?.attribute}
              options={builders.class.spell.attribute}
              onChange={setFormState}
            />
            {formState?.spellcasting?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'preparesSpells'
            ) && (
              <Dropdown
                name='spellcasting.prepareLimit.method'
                label='Prepare Limit Method'
                multiSelect={true}
                value={formState?.spellcasting?.prepareLimit?.method}
                options={builders.class.spell.prepareLimitAttribute}
                onChange={setFormState}
              />
            )}
            {formState?.spellcasting?.prepareLimit?.method?.some(
              (methodItem: any) => methodItem.name === 'classLevel'
            ) && (
              <>
                <Dropdown
                  name='spellcasting.prepareLimit.level.measurement'
                  label='Level Measurement'
                  value={
                    formState?.spellcasting?.prepareLimit?.level?.measurement
                  }
                  options={builders.system.rules.measurement}
                  onChange={setFormState}
                />
                {formState?.spellcasting?.prepareLimit?.level?.measurement
                  ?.name === 'half' && (
                  <Dropdown
                    name='spellcasting.prepareLimit.level.rounding'
                    label='Level Rounding'
                    value={
                      formState?.spellcasting?.prepareLimit?.level?.rounding
                    }
                    options={builders.system.rules.rounding}
                    onChange={setFormState}
                  />
                )}
              </>
            )}
            <Input
              name='spellcasting.maxSpellLevel'
              autoComplete='off'
              label='Max Spell Level'
              required={true}
              value={formState?.spellcasting?.maxSpellLevel}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.resetOption'
              label='Spellslot Reset Option'
              value={formState?.spellcasting?.resetOption}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setFormState}
            />
          </Collapse>
        )}
        {context.title === 'class' && formState.category.name === 'base' && (
          <Collapse
            startOpened={context.type === 'new'}
            title='Subclass Details'
            className={sprinkles({ mb: 'size-3' })}
          >
            <Grid cols={{ lg: 4, md: 4, base: 2 }}>
              <Input
                name='subclass.value'
                autoComplete='off'
                label='Subclass Feature Name'
                required={true}
                value={formState?.subclass?.value}
                onChange={setFormState}
              />
              <Input
                name='subclass.levelAcquired'
                autoComplete='off'
                label='Level Acquired'
                required={true}
                value={formState?.subclass?.levelAcquired}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={setFormState}
              />
            </Grid>
            <RichTextEditor
              name={'subclass.desc'}
              value={formState?.subclass?.desc}
              label={'Description'}
              onChange={setFormState}
            />
          </Collapse>
        )}
        {formState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'primaryAbility'
        ) && (
          <>
            <Collapse
              title={'Multiclass Ability Requirements'}
              startOpened={context.type === 'new'}
              className={sprinkles({ mb: 'size-3' })}
            >
              <Grid className={sprinkles({ mb: 'size-3' })}>
                {formState?.attribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'primaryAbility'
                ) && (
                  <>
                    <Dropdown
                      name='multiclass.primaryAbility'
                      label='Primary Ability'
                      value={formState?.multiclass?.primaryAbility}
                      options={builders.ability
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.secondaryAbility?.name
                        )
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.optionalAbility?.name
                        )}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      name='multiclass.primaryAbility.minValue'
                      autoComplete='off'
                      label='Primary Score'
                      required={true}
                      value={formState?.multiclass?.primaryAbility?.minValue}
                      validation='num'
                      errorMsg='Must contain whole numbers only'
                      onChange={setFormState}
                    />
                  </>
                )}
                {formState?.attribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'secondaryAbility'
                ) && (
                  <>
                    <Dropdown
                      name='multiclass.secondaryAbility'
                      label='Secondary Ability'
                      value={formState?.multiclass?.secondaryAbility}
                      options={builders.ability
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.primaryAbility?.name
                        )
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.optionalAbility?.name
                        )}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      name='multiclass.secondaryAbility.minValue'
                      autoComplete='off'
                      label='Secondary Score'
                      required={true}
                      value={formState?.multiclass?.secondaryAbility?.minValue}
                      validation='num'
                      errorMsg='Must contain whole numbers only'
                      onChange={setFormState}
                    />
                  </>
                )}
                {formState?.attribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'optionalAbility'
                ) && (
                  <>
                    <Dropdown
                      name='multiclass.optionalAbility'
                      label='Optional Ability'
                      value={formState?.multiclass?.optionalAbility}
                      options={builders.ability
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.primaryAbility?.name
                        )
                        .filter(
                          (abilityItem: any) =>
                            abilityItem.name !==
                            formState.multiclass?.secondaryAbility?.name
                        )}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      name='multiclass.optionalAbility.minValue'
                      autoComplete='off'
                      label='Optional Score'
                      required={true}
                      value={formState?.multiclass?.optionalAbility?.minValue}
                      validation='num'
                      errorMsg='Must contain whole numbers only'
                      onChange={setFormState}
                    />
                  </>
                )}
              </Grid>
            </Collapse>
          </>
        )}
        {(formState.category?.name === 'base' ||
          formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'spellCaster'
          ) ||
          formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'resource'
          )) &&
          context.title === 'class' && (
            <>
              <Collapse
                title={'Level Attributes'}
                startOpened={context.type === 'new'}
                className={sprinkles({ mb: 'size-3' })}
              >
                <Table
                  name='levelAttribute'
                  rows={{
                    inputs: levelTableColumns().inputs,
                    headers: levelTableColumns().headers,
                  }}
                  value={formState?.levelAttribute}
                  onChange={setFormState}
                  addRow={true}
                  scrollable={true}
                  border={false}
                />
              </Collapse>
            </>
          )}
        {formState?.subtype?.length > 0 && (
          <>
            <Collapse
              title={'Subtypes'}
              startOpened={context.type === 'new'}
              className={sprinkles({ mb: 'size-3' })}
            >
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
                      },
                    ],
                  }}
                  value={formState?.subtype}
                  addRow={true}
                  onChange={setFormState}
                />
              </>
            </Collapse>
          </>
        )}
        {(formState.category?.name === 'weapon' ||
          formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'doesDamage'
          ) ||
          formState.property?.some(
            (propertyItem: any) => propertyItem.name === 'improvisedWeapon'
          )) &&
          (!formState.property ||
            formState.property?.some(
              (propertyItem: any) => propertyItem.name !== 'special'
            )) && (
            <>
              <Divider
                label={`${
                  formState.category?.name === 'weapon' ? 'Weapon ' : ''
                }Damage Dice`}
              />
              <Grid className={sprinkles({ mb: 'size-3' })}>
                <Dropdown
                  name='damage.damageAttribute'
                  multiSelect={true}
                  label='Damage Attribute'
                  value={formState?.damage?.damageAttribute}
                  options={builders.feature.item.damageAttribute}
                  required={true}
                  onChange={setFormState}
                />
                <Dropdown
                  name='damage.damageType'
                  multiSelect={true}
                  label='Damage Type'
                  value={formState?.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  name='damage.dice.diceCount'
                  value={formState?.damage?.dice.diceCount}
                  label='Dice Count'
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setFormState}
                />
                <Input
                  name='damage.dice.diceValue'
                  value={formState?.damage?.dice.diceValue}
                  label='Dice Value'
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setFormState}
                />
                {formState?.damage?.damageAttribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'secondaryDamage'
                ) && (
                  <>
                    <Dropdown
                      name='damage.secondaryDamageType'
                      multiSelect={true}
                      label='Secondary Damage Type'
                      value={formState?.damage?.secondaryDamageType}
                      options={builders.damage}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      name='damage.dice.secDiceCount'
                      value={formState?.damage?.dice?.secDiceCount}
                      label='Secondary Dice Count'
                      required={true}
                      validation='num'
                      errorMsg='Must contain only numbers'
                      onChange={setFormState}
                    />
                    <Input
                      name='damage.dice.secDiceValue'
                      value={formState?.damage?.dice?.secDiceValue}
                      label='Secondary Dice Value'
                      required={true}
                      validation='num'
                      errorMsg='Must contain only numbers'
                      onChange={setFormState}
                    />
                  </>
                )}
                {formState?.property?.some(
                  (propertyItem: any) => propertyItem.name === 'versatile'
                ) && (
                  <>
                    <Input
                      validation='num'
                      name='damage.dice.versatileDiceCount'
                      errorMsg='Must contain only numbers'
                      label='Alt. Dmg. Dice Count'
                      value={formState?.damage?.dice?.versatileDiceCount}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      validation='num'
                      name='damage.dice.versatileDiceValue'
                      errorMsg='Must contain only numbers'
                      label='Alt. Dmg. Dice Value'
                      value={formState?.damage?.dice?.versatileDiceValue}
                      required={true}
                      onChange={setFormState}
                    />
                  </>
                )}
                {formState?.damage?.damageAttribute?.some(
                  (attributeItem: any) => attributeItem.name === 'bonusDamage'
                ) && (
                  <>
                    <Dropdown
                      name='damage.bonus.bonusAttribute'
                      label='Bonus Type'
                      value={formState?.damage?.bonus?.bonusAttribute}
                      options={builders.spell.bonusAttribute}
                      required={true}
                      onChange={setFormState}
                    />
                    {formState?.damage?.bonus?.bonusAttribute?.name ===
                      'setValue' && (
                      <Input
                        name='damage.damage.bonusDamage'
                        value={formState?.damage?.damage?.bonusDamage}
                        label='Bonus Damage'
                        required={true}
                        validation='num'
                        errorMsg='Must contain only numbers'
                        onChange={setFormState}
                      />
                    )}
                    {formState?.damage?.bonus?.bonusAttribute?.name ===
                      'abilityBonus' && (
                      <Dropdown
                        name='damage.bonus.ability'
                        label='Abilty'
                        value={formState?.bonus?.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setFormState}
                      />
                    )}
                  </>
                )}
                {(formState.category?.name === 'weapon' ||
                  formState.property?.some(
                    (propertyItem: any) =>
                      propertyItem.name === 'improvisedWeapon'
                  )) && (
                  <Dropdown
                    name='primaryAbility'
                    label='Primary Ability'
                    value={formState?.primaryAbility}
                    options={builders.ability}
                    required={true}
                    onChange={setFormState}
                  />
                )}
                {formState?.attribute?.some(
                  (attributeItem: any) => attributeItem.name === 'maxBonus'
                ) && (
                  <Input
                    validation='num'
                    name='maxBonus'
                    errorMsg='Must contain only numbers'
                    label='Max Bonus'
                    required={true}
                    value={formState?.maxBonus}
                    onChange={setFormState}
                  />
                )}
                {formState?.property?.some(
                  (propertyItem: any) => propertyItem.name === 'finesse'
                ) && (
                  <Dropdown
                    name={'secondaryAbility'}
                    label='Secondary Ability'
                    value={formState?.secondaryAbility}
                    required={true}
                    options={builders.ability?.filter(
                      (abilityItem: any) =>
                        abilityItem?.name !== formState?.primaryAbility?.name
                    )}
                    onChange={setFormState}
                  />
                )}
              </Grid>
            </>
          )}
        {formState?.category?.name === 'armor' && (
          <>
            <Divider label={'Armor Stats'} />
            <Grid className={sprinkles({ mb: 'size-3' })}>
              <Input
                validation={'num'}
                name='armorClass'
                errorMsg='Must contain only numbers'
                label='Armor Value'
                required={true}
                value={formState?.armorClass}
                onChange={setFormState}
              />
              <Dropdown
                name='primaryAbility'
                label='Primary Ability'
                value={formState?.primaryAbility}
                options={builders.ability}
                onChange={setFormState}
              />
              {formState?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'maxBonus'
              ) && (
                <Input
                  validation='num'
                  name='maxBonus'
                  errorMsg='Must contain only numbers'
                  label='Max Bonus'
                  required={true}
                  value={formState?.maxBonus}
                  onChange={setFormState}
                />
              )}
              {formState?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'hasRequirements'
              ) && (
                <Dropdown
                  multiSelect={true}
                  name='requirement.option'
                  label='Requirement'
                  value={formState?.requirement?.option}
                  options={builders.item.requirement}
                  required={true}
                  onChange={setFormState}
                />
              )}
            </Grid>
          </>
        )}
        {formState?.upcast?.upcastStats?.length > 0 && (
          <>
            <Collapse
              title='Upcast Table'
              startOpened={context.type === 'new'}
              className={sprinkles({ mb: 'size-3' })}
            >
              <Table
                rows={{
                  inputs: damageTableColumns().inputs,
                  headers: damageTableColumns().headers,
                }}
                name='upcast.upcastStats'
                value={formState?.upcast?.upcastStats}
                onChange={setFormState}
                addRow={true}
                scrollable={true}
              />
            </Collapse>
          </>
        )}
        {formState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'hasRequirements'
        ) &&
          !formState.requirement?.option?.every(
            (optionItem: any) => optionItem.name === 'notProficient'
          ) && (
            <>
              <Divider label={'Requirements'} />
              <Grid>
                {formState?.requirement?.option?.some(
                  (optionItem: any) => optionItem.name === 'skillProficiency'
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name='requirement.skillProficiency.skill'
                    value={formState?.requirement?.skillProficiency?.skill}
                    label='Skill Proficiency'
                    options={builders.skill}
                    required={true}
                    onChange={setFormState}
                  />
                )}
                {formState?.requirement?.option?.some(
                  (optionItem: any) => optionItem.name === 'abilityScore'
                ) && (
                  <>
                    <Dropdown
                      multiSelect={true}
                      name='requirement.abilityScore.ability'
                      value={formState?.requirement?.abilityScore?.ability}
                      label='Ability'
                      options={builders.ability}
                      required={true}
                      onChange={setFormState}
                    />
                    <Input
                      name='requirement.abilityScore.score'
                      value={formState?.requirement?.abilityScore?.score}
                      label='Ability Score'
                      required={true}
                      validation='num'
                      errorMsg='Must contain only numbers'
                      onChange={setFormState}
                    />
                  </>
                )}
                {formState?.requirement?.option?.some(
                  (optionItem: any) => optionItem.name === 'size'
                ) && (
                  <>
                    <Dropdown
                      multiSelect={true}
                      name='requirement.size'
                      value={formState?.requirement?.size}
                      label='Size'
                      options={builders.race.size}
                      required={true}
                      onChange={setFormState}
                    />
                  </>
                )}
              </Grid>
              {formState?.requirement?.option?.some(
                (optionItem: any) => optionItem.name === 'itemProficiency'
              ) && (
                <>
                  <Divider label={'Item Proficiency'} />
                  <Grid>
                    <Dropdown
                      multiSelect={true}
                      name='requirement.itemProficiency.category'
                      value={formState?.requirement?.itemProficiency?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      name='requirement.itemProficiency.itemType'
                      multiSelect={true}
                      label='Item type'
                      value={formState?.requirement?.itemProficiency?.itemType}
                      options={
                        items?.filter((item: any) =>
                          formState.requirement.itemProficiency?.category
                            ?.length > 0
                            ? formState.requirement.itemProficiency?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.category.name
                              )
                            : item
                        ) as unknown as DropdownOption[]
                      }
                      onChange={setFormState}
                    />
                    <Dropdown
                      name='requirement.itemProficiency.property'
                      multiSelect={true}
                      label='Item Property'
                      value={formState?.requirement?.itemProficiency?.property}
                      options={
                        items
                          ?.filter((item: any) =>
                            formState.requirement.itemProficiency?.category
                              ?.length > 0
                              ? formState.requirement.itemProficiency?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name === item.category.name
                                )
                              : item
                          )
                          .filter((item: any) =>
                            formState.requirement.itemProficiency?.itemType
                              ?.length > 0
                              ? formState.requirement.itemProficiency?.itemType?.some(
                                  (typeItem: any) => typeItem.name === item.name
                                )
                              : item
                          )
                          .map(
                            (item: any) => item.property
                          ) as unknown as DropdownOption[]
                      }
                      onChange={setFormState}
                    />
                  </Grid>
                </>
              )}
              {formState?.requirement?.option?.some(
                (optionItem: any) => optionItem.name === 'equipped'
              ) && (
                <>
                  <Divider label={'Equipped'} />
                  <Grid>
                    <Input
                      name='requirement.equipped.numberEquipped'
                      value={formState?.requirement?.equipped?.numberEquipped}
                      label='Number Equipped'
                      onChange={setFormState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Dropdown
                      multiSelect={true}
                      name='requirement.equipped.category'
                      value={formState?.requirement?.equipped?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name='requirement.equipped.itemType'
                      label='Item type'
                      value={formState?.requirement?.equipped?.itemType}
                      options={
                        items?.filter((item: any) =>
                          formState.requirement.equipped?.category?.length > 0
                            ? formState.requirement.equipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.category.name
                              )
                            : item
                        ) as unknown as DropdownOption[]
                      }
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name='requirement.equipped.property'
                      label='Item Property'
                      value={formState?.requirement?.equipped?.property}
                      options={
                        items
                          ?.filter((item: any) =>
                            formState.requirement.equipped?.category?.length
                              ? formState.requirement.equipped?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name === item.category.name
                                )
                              : item
                          )
                          .filter((item: any) =>
                            formState.requirement.equipped?.itemType?.length > 0
                              ? formState.requirement.equipped?.itemType?.some(
                                  (typeItem: any) => typeItem.name === item.name
                                )
                              : item
                          )
                          .map(
                            (item: any) => item.property
                          ) as unknown as DropdownOption[]
                      }
                      onChange={setFormState}
                    />
                  </Grid>
                </>
              )}
              {formState?.requirement?.option?.some(
                (optionItem: any) => optionItem.name === 'notEquipped'
              ) && (
                <>
                  <Divider label={'Not Equipped'} />
                  <Grid>
                    <Dropdown
                      multiSelect={true}
                      name='requirement.notEquipped.category'
                      value={formState?.requirement?.notEquipped?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name='requirement.notEquipped.itemType'
                      label='Item type'
                      value={formState?.requirement?.notEquipped?.itemType}
                      options={
                        items?.filter((item: any) =>
                          formState.requirement.notEquipped?.category?.length >
                          0
                            ? formState.requirement.notEquipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.category.name
                              )
                            : item
                        ) as unknown as DropdownOption[]
                      }
                      onChange={setFormState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name='requirement.notEquipped.property'
                      label='Item Property'
                      value={formState?.requirement?.notEquipped?.property}
                      options={items
                        ?.filter((item: any) =>
                          formState.requirement.notEquipped?.category?.length >
                          0
                            ? formState.requirement.notEquipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.category.name
                              )
                            : item
                        )
                        .filter((item: any) =>
                          formState.requirement.notEquipped?.itemType?.length >
                          0
                            ? formState.requirement.notEquipped?.itemType?.some(
                                (typeItem: any) => typeItem.name === item.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setFormState}
                    />
                  </Grid>
                </>
              )}
              {formState?.limitUse?.level?.length > 0 && (
                <>
                  <Collapse
                    title={'Limit Use Table'}
                    startOpened={context.type === 'new'}
                    className={sprinkles({ mb: 'size-3' })}
                  >
                    <Table
                      rows={{
                        inputs: [
                          {
                            name: 'value',
                            errorMsg: 'Must contain only numbers',
                            validation: 'num',
                          },
                          {
                            name: 'useNum',
                            errorMsg: 'Must contain only numbers',
                            validation: 'num',
                          },
                        ],
                        headers: [
                          {
                            value: 'Level',
                          },
                          {
                            value: 'Uses',
                          },
                        ],
                      }}
                      name={`limitUse.level`}
                      value={formState?.limitUse?.level}
                      onChange={setFormState}
                      addRow={true}
                    />
                  </Collapse>
                </>
              )}
            </>
          )}
      </ScrollArea>
    )
  }
)

AttributeForm.displayName = 'AttributeForm'

export default AttributeForm
