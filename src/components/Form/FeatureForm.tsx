import { startCase } from 'lodash'
import { memo, FC } from 'react'
import {
  selectAllFeats,
  useGetFeatsQuery,
} from '../../features/feats/featsApiSlice'
import {
  selectAllSpells,
  useGetSpellsQuery,
} from '../../features/spells/spellsApiSlice'
import {
  useGetClassesQuery,
  selectAllClasses,
} from '../../features/classes/classesApiSlice'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/items/itemsApiSlice'
import Input from '../Input/Input'
import Dropdown from '../Dropdown/Dropdown'
import TextEditor from '../RichTextEditor/TextEditor'
import Table from '../Table/Table'
import Divider from '../Divider/Divider'
import CollapseContainer from '../Collapse/Collapse'
import SectionContent, { getSectionNames } from './SectionForm'
import Spinner from '../Spinner/Spinner'
import { Option } from '../../utils/types'
import Grid from '../Grid/Grid'

interface Action {
  type?: string
  payload: {
    target: {
      name?: string | string[]
      value?: any
    }
  }
}

interface FeatureContentProps {
  stateName: string
  featureItem: any
  level?: boolean
  styleSection?: boolean
  setState: (arg: Action) => void
  state?: any
  context?: string
}

const FeatureContent: FC<FeatureContentProps> = memo(
  ({
    stateName,
    featureItem,
    level,
    styleSection,
    setState,
    state,
    context,
  }) => {
    const { data: builders } = useGetBuildersQuery('buildersList')

    const { classes } = useGetClassesQuery(undefined, {
      selectFromResult: ({ data }) => ({
        classes: data && selectAllClasses(data),
      }),
    })

    const { items } = useGetItemsQuery(undefined, {
      selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
    })

    const { feats } = useGetFeatsQuery(undefined, {
      selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
    })

    const { spells } = useGetSpellsQuery(undefined, {
      selectFromResult: ({ data }) => ({
        spells: data && selectAllSpells(data),
      }),
    })

    const damageTableColumns = (featureItem: any) => {
      const secondary = featureItem?.damageAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'secondaryDamage'
      )
      const bonus =
        featureItem?.damageAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'bonusDamage'
        ) && featureItem?.bonus?.bonusAttribute?.name === 'setValue'
      const inputArray = [
        {
          name: 'level',
          value: 'Level',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'diceCount',
          value: 'Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'diceValue',
          value: 'Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
      ]
      if (secondary) {
        inputArray.splice(
          3,
          0,
          {
            name: 'secDiceCount',
            value: 'Sec. Dice Count',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
            size: 'col',
          },
          {
            name: 'secDiceValue',
            value: 'Sec. Dice Value',
            errorMsg: 'Must contain only numbers',
            validation: 'num',
            size: 'col',
          }
        )
      }
      if (bonus) {
        inputArray.push({
          name: 'bonusDamage',
          value: 'Bonus Damage',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        })
      }

      const headerArray = inputArray.map((inputItem) => ({
        value: inputItem.value,
        readOnly: true,
        size: inputItem.size,
        required: true,
      }))

      return { inputs: inputArray, headers: headerArray }
    }

    const sectionNames = getSectionNames().filter(
      (sectionName) =>
        (styleSection === false ? sectionName !== 'style' : sectionName) &&
        (featureItem['style']?.option?.length > 0
          ? sectionName === 'style'
          : sectionName)
    )

    return !featureItem || !state ? (
      <Spinner />
    ) : (
      <>
        <Grid>
          <Input
            name={`${stateName}.value`}
            autoComplete='off'
            label='Feature Name'
            value={featureItem.value}
            onChange={setState}
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
              {sectionNames.map((sectionName, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`${stateName}.${sectionName}${
                      sectionName === 'style' ? '.option' : ''
                    }`}
                    onClick={(e: any) =>
                      setState({ type: 'added', payload: e })
                    }
                  >
                    {`${startCase(sectionName)}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Grid>
        <TextEditor
          label='Feature description'
          value={featureItem.desc}
          name={`${stateName}.desc`}
          onChange={setState}
        />
        <Grid>
          {level === true && (
            <Input
              name={`${stateName}.levelAvailable`}
              autoComplete='off'
              label='Level(s) Available'
              required={true}
              value={featureItem?.levelAvailable}
              validation='num'
              errorMsg='Must contain whole numbers and commas only'
              onChange={setState}
            />
          )}
          <Dropdown
            multiSelect={true}
            name={`${stateName}.attribute`}
            options={[]
              .concat(
                builders.feature.attribute,
                context &&
                  builders.feature[`${context}`]?.attribute?.length > 0 &&
                  builders.feature[`${context}`]?.attribute
              )
              .filter((attributeItem: any) =>
                context === 'item'
                  ? attributeItem.name !== 'providesOptions' &&
                    attributeItem.name !== 'optionGroups'
                  : attributeItem
              )}
            label='Feature Attributes'
            value={featureItem.attribute}
            onChange={setState}
          />
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'ancestrySpecific'
          ) && (
            <Dropdown
              multiSelect={true}
              name={`${stateName}.ancestry`}
              options={state.ancestry}
              label='Ancestry'
              value={featureItem.ancestry}
              required={true}
              onChange={setState}
            />
          )}
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'limitUse'
          ) && (
            <>
              <Dropdown
                name={`${stateName}.limitUse.limitBy`}
                label='Limit By Option'
                value={featureItem.limitUse?.limitBy}
                options={[].concat(
                  builders.feature.chargeLimit,
                  context &&
                    builders.feature[`${context}`]?.chargeLimit?.length > 0 &&
                    builders.feature[`${context}`]?.chargeLimit
                )}
                required={true}
                onChange={setState}
              />
              {featureItem.limitUse?.limitBy?.name === 'ability' ? (
                <>
                  <Dropdown
                    name={`${stateName}.limitUse.ability`}
                    label='Ability'
                    value={featureItem.limitUse?.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    name={`${stateName}.limitUse.minValue`}
                    autoComplete='off'
                    label='Minimal Value'
                    value={featureItem?.limitUse?.minValue}
                    onChange={setState}
                  />
                </>
              ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
                <Dropdown
                  name={`${stateName}.limitUse.skill`}
                  label='Skill'
                  value={featureItem.limitUse?.skill}
                  options={builders.skill}
                  required={true}
                  onChange={setState}
                />
              ) : (
                featureItem.limitUse?.limitBy?.name === 'setValue' && (
                  <Input
                    validation='num'
                    type='text'
                    name={`${stateName}.limitUse.setValue`}
                    errorMsg='Must contain only numbers'
                    label='Use Amount'
                    value={featureItem.limitUse?.setValue}
                    required={true}
                    onChange={setState}
                  />
                )
              )}
              {featureItem.limitUse?.limitBy?.name !== 'level' &&
                featureItem.limitUse?.limitBy?.name !== 'setValue' && (
                  <>
                    <Input
                      name={`${stateName}.limitUse.addValue`}
                      autoComplete='off'
                      label='Additional Amount'
                      value={featureItem?.limitUse?.addValue}
                      onChange={setState}
                    />
                    <Input
                      name={`${stateName}.limitUse.minValue`}
                      autoComplete='off'
                      label='Minimal Value'
                      value={featureItem?.limitUse?.minValue}
                      onChange={setState}
                    />
                  </>
                )}
              {featureItem.limitUse?.limitBy?.name !== 'setValue' && (
                <Input
                  name={`${stateName}.limitUse.multiplier`}
                  autoComplete='off'
                  validation='num'
                  errorMsg='Must contain whole numbers only'
                  label='Multiplier'
                  value={featureItem?.limitUse?.multiplier}
                  onChange={setState}
                />
              )}
              <Dropdown
                name={`${stateName}.limitUse.resetOption`}
                label='Reset Option'
                value={featureItem.limitUse?.resetOption}
                options={builders.feature.chargeReset}
                required={true}
                onChange={setState}
              />
            </>
          )}
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'isAction'
          ) && (
            <>
              <Dropdown
                name={`${stateName}.action`}
                label='Action Type'
                value={featureItem.action}
                options={builders.feature.action}
                required={true}
                onChange={setState}
              />
            </>
          )}
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'hasRange'
          ) && (
            <>
              <Input
                validation='num'
                name={`${stateName}.range.minRange`}
                autoComplete='off'
                label='Minimum Range'
                required={true}
                value={featureItem.range?.minRange}
                errorMsg='Must contain only numbers'
                onChange={setState}
              />
              <Input
                validation='num'
                name={`${stateName}.range.maxRange`}
                autoComplete='off'
                label='Max Range'
                required={true}
                errorMsg='Must contain only numbers'
                value={featureItem.range?.maxRange}
                onChange={setState}
              />
              <Dropdown
                name={`${stateName}.range.unit`}
                label='UoM'
                value={featureItem.range?.unit}
                options={[
                  ...(Object.values(builders.unit.imperial).flatMap(
                    (item) => item
                  ) as Option[]),
                ]}
                optionalKey='short'
                onChange={setState}
              />
            </>
          )}
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'requireSave'
          ) && (
            <>
              <Dropdown
                name={`${stateName}.saveAbility.attribute`}
                multiSelect={true}
                label='Save Attribute'
                value={featureItem.saveAbility?.attribute}
                options={builders.feature.saveAttribute}
                onChange={setState}
              />
              <Dropdown
                name={`${stateName}.saveAbility.ability`}
                label='DC Ability'
                value={featureItem.saveAbility?.ability}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
              <Input
                validation='num'
                name={`${stateName}.saveAbility.minValue`}
                autoComplete='off'
                label='Minimum Value'
                required={true}
                errorMsg='Must contain only numbers'
                value={featureItem.saveAbility?.minValue}
                onChange={setState}
              />
              {featureItem.saveAbility?.attribute?.some(
                (attributeItem: any) =>
                  attributeItem.name === 'addAbilityModifier'
              ) && (
                <Dropdown
                  name={`${stateName}.saveAbility.abilityModifier`}
                  label='Modifier Ability'
                  value={featureItem.saveAbility?.abilityModifier}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
              )}
            </>
          )}
          {featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'hasRequirements'
          ) && (
            <Dropdown
              multiSelect={true}
              name={`${stateName}.requirement.option`}
              label='Requirement'
              options={[].concat(
                builders.feature.requirement,
                context &&
                  builders.feature[`${context}`]?.requirement?.length > 0 &&
                  builders.feature[`${context}`]?.requirement
              )}
              value={featureItem.requirement?.option}
              required={true}
              onChange={setState}
            />
          )}
        </Grid>
        {featureItem.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'hasRequirements'
        ) &&
          !featureItem.requirement?.option?.every(
            (featureItem: any) => featureItem.name === 'notProficient'
          ) && (
            <>
              <Divider label={'Requirements'} />{' '}
              <Grid>
                {featureItem.requirement?.option?.some(
                  (featureItem: any) => featureItem.name === 'skillProficiency'
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name={`${stateName}.requirement.skillProficiency.skill`}
                    label='Skill Proficiency'
                    value={featureItem.requirement?.skillProficiency?.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {featureItem.requirement?.option?.some(
                  (featureItem: any) => featureItem.name === 'abilityScore'
                ) && (
                  <>
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.abilityScore.ability`}
                      value={featureItem.requirement?.abilityScore?.ability}
                      label='Ability'
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      name={`${stateName}.requirement.abilityScore.score`}
                      value={featureItem.requirement?.abilityScore?.score}
                      label='Score'
                      required={true}
                      validation='num'
                      errorMsg='Must contain only numbers'
                      onChange={setState}
                    />
                  </>
                )}
              </Grid>
              {featureItem.requirement?.option?.some(
                (featureItem: any) => featureItem.name === 'itemProficiency'
              ) && (
                <>
                  <Divider label={'Item Proficiency'} />{' '}
                  <Grid>
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.itemProficiency.category`}
                      value={featureItem.requirement?.itemProficiency?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setState}
                    />
                    <Dropdown
                      name={`${stateName}.requirement.itemProficiency.property`}
                      multiSelect={true}
                      label='Item Property'
                      value={featureItem.requirement?.itemProficiency?.property}
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement?.itemProficiency?.category
                            ?.length > 0
                            ? featureItem.requirement?.itemProficiency?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setState}
                    />
                    <Dropdown
                      name={`${stateName}.requirement.itemProficiency.itemType`}
                      multiSelect={true}
                      label='Item type'
                      value={featureItem.requirement?.itemProficiency?.itemType}
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement.itemProficiency?.category
                            ?.length > 0
                            ? featureItem.requirement.itemProficiency?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setState}
                    />
                  </Grid>
                </>
              )}
              {featureItem.requirement?.option?.some(
                (featureItem: any) => featureItem.name === 'equipped'
              ) && (
                <>
                  <Divider label={'Equipped'} />{' '}
                  <Grid>
                    <Input
                      name={`${stateName}.requirement.equipped.numberEquipped`}
                      value={featureItem.requirement?.equipped?.numberEquipped}
                      label='Number Equipped'
                      onChange={setState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.equipped.category`}
                      value={featureItem.requirement?.equipped?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.equipped.property`}
                      label='Item Property'
                      value={featureItem.requirement?.equipped?.property}
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement?.equipped?.category?.length >
                          0
                            ? featureItem.requirement?.equipped?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.equipped.itemType`}
                      label='Item type'
                      value={featureItem.requirement?.equipped?.itemType}
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement.equipped?.category?.length > 0
                            ? featureItem.requirement.equipped?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setState}
                    />
                  </Grid>
                </>
              )}
              {featureItem.requirement?.option?.some(
                (featureItem: any) => featureItem.name === 'notEquipped'
              ) && (
                <>
                  <Divider label={'Not Equipped'} />{' '}
                  <Grid>
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.notEquipped.category`}
                      value={featureItem.requirement?.notEquipped?.category}
                      label='Item Category'
                      options={builders.item.category}
                      onChange={setState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.notEquipped.property`}
                      value={featureItem.requirement?.notEquipped?.property}
                      label='Item Property'
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement.notEquipped?.category
                            ?.length > 0
                            ? featureItem.requirement.notEquipped?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`${stateName}.requirement.notEquipped.itemType`}
                      label='Item type'
                      value={featureItem.requirement?.notEquipped?.itemType}
                      options={items
                        ?.filter((item: any) =>
                          featureItem.requirement.notEquipped?.category
                            ?.length > 0
                            ? featureItem.requirement.notEquipped?.category?.some(
                                (category: any) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setState}
                    />
                  </Grid>
                </>
              )}
            </>
          )}
        {featureItem.limitUse?.limitBy?.name === 'level' &&
          featureItem.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'limitUse'
          ) &&
          (!featureItem.limitUse.level ? (
            setState({
              type: 'added',
              payload: {
                target: {
                  name: `${stateName}.limitUse.level`,
                },
              },
            })
          ) : (
            <>
              <CollapseContainer title={'Limit Use Table'}>
                <div className='section-content'>
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
                    name={`${stateName}.limitUse.level`}
                    value={featureItem.limitUse?.level}
                    onChange={setState}
                    addRow={true}
                  />
                </div>
              </CollapseContainer>
            </>
          ))}
        {featureItem.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'doesDamage'
        ) && (
          <>
            <Grid>
              <Dropdown
                multiSelect={true}
                name={`${stateName}.damage.damageAttribute`}
                label='Damage Attribute'
                value={featureItem.damage?.damageAttribute}
                options={builders.feature.damageAttribute}
                onChange={setState}
              />
              <Dropdown
                name={`${stateName}.damage.damageType`}
                multiSelect={true}
                label='Damage Type'
                value={featureItem.damage?.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
              {featureItem.damage?.damageAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'bonusDamage'
              ) && (
                <Dropdown
                  name={`${stateName}.damage.bonus.bonusAttribute`}
                  label='Bonus Type'
                  value={featureItem.damage?.bonus?.bonusAttribute}
                  options={builders.feature.bonusAttribute}
                  required={true}
                  onChange={setState}
                />
              )}
              {featureItem.damage?.bonus?.bonusAttribute?.name ===
                'abilityBonus' && (
                <Dropdown
                  name={`${stateName}.damage.bonus.ability`}
                  label='Abilty'
                  value={featureItem.damage?.bonus?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
              )}
              {featureItem.damage?.damageAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'damagePool'
              ) && (
                <>
                  <Dropdown
                    name={`${stateName}.damage.pool.option`}
                    label='Pool Option'
                    value={featureItem.damage?.pool?.option}
                    options={builders.feature.poolOptions}
                    required={true}
                    onChange={setState}
                  />
                  {featureItem.damage?.pool?.option.name === 'level' ? (
                    <>
                      <Input
                        name={`${stateName}.damage.pool.multiplier`}
                        value={featureItem.damage?.pool?.multiplier}
                        label='Multiplier'
                        onChange={setState}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                      <Input
                        name={`${stateName}.damage.pool.minValue`}
                        value={featureItem.damage?.pool?.minValue}
                        label='Minimum Value'
                        onChange={setState}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    </>
                  ) : featureItem.damage?.pool?.option?.name === 'ability' ? (
                    <Dropdown
                      name={`${stateName}.damage.pool.ability`}
                      label='Pool Abilty'
                      value={featureItem.damage?.pool?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    featureItem.damage?.pool?.option?.name === 'setValue' && (
                      <Input
                        name={`${stateName}.damage.pool.setValue`}
                        value={featureItem.damage?.pool?.setValue}
                        label='Pool Total'
                        onChange={setState}
                        validation='num'
                        required={true}
                        errorMsg={'Must contain only numbers'}
                      />
                    )
                  )}
                  {featureItem.damage?.damageAttribute.some(
                    (attributeItem: any) =>
                      attributeItem.name === 'secondaryDamage'
                  ) && (
                    <>
                      <Dropdown
                        name={`${stateName}.damage.secondaryPool.option`}
                        label='Secondary Pool Option'
                        value={featureItem.damage?.secondaryPool?.option}
                        options={builders.feature.poolOptions}
                        required={true}
                        onChange={setState}
                      />
                      {featureItem.damage?.secondaryPool?.option.name ===
                      'classLevel' ? (
                        <>
                          <Input
                            name={`${stateName}.damage.secondaryPool.multiplier`}
                            value={
                              featureItem.damage?.secondaryPool?.multiplier
                            }
                            label='Multiplier'
                            onChange={setState}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                          <Input
                            name={`${stateName}.damage.secondaryPool.minValue`}
                            value={featureItem.damage?.secondaryPool?.minValue}
                            label='Minimum Value'
                            onChange={setState}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                        </>
                      ) : featureItem.damage?.secondaryPool?.option?.name ===
                        'ability' ? (
                        <Dropdown
                          name={`${stateName}.damage.secondaryPool.ability`}
                          label='Pool Abilty'
                          value={featureItem.damage?.secondaryPool?.ability}
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      ) : (
                        featureItem.damage?.secondaryPool?.option?.name ===
                          'setValue' && (
                          <Input
                            name={`${stateName}.damage.secondaryPool.setValue`}
                            value={featureItem.damage?.secondaryPool?.setValue}
                            label='Pool Total'
                            onChange={setState}
                            validation='num'
                            required={true}
                            errorMsg={'Must contain only numbers'}
                          />
                        )
                      )}
                    </>
                  )}
                </>
              )}
            </Grid>
            {!featureItem.damage?.damageAttribute?.some(
              (attributeItem: any) => attributeItem.name === 'damagePool'
            ) && !featureItem.damage?.damageByLevel ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: `${stateName}.damage.damageByLevel`,
                  },
                },
              })
            ) : (
              <>
                <CollapseContainer title={'Damage Table'}>
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: damageTableColumns(featureItem.damage).inputs,
                        headers: damageTableColumns(featureItem.damage).headers,
                      }}
                      name={`${stateName}.damage.damageByLevel`}
                      value={featureItem.damage?.damageByLevel}
                      onChange={setState}
                      addRow={true}
                      scrollable={true}
                    />
                  </div>
                </CollapseContainer>
              </>
            )}
          </>
        )}
        {featureItem['style']?.option?.length > 0 && (
          <>
            <Divider label={'Style'} />
            <Grid>
              <Dropdown
                name={`${stateName}.style.attribute`}
                label='Style Attribute'
                value={featureItem.style?.attribute}
                options={builders.feature.style.attribute}
                multiSelect={true}
                onChange={setState}
              />
              {featureItem.style?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'replaceAtLevel'
              ) && (
                <Input
                  name={`${stateName}.style.replaceCount`}
                  value={featureItem.style?.replaceCount}
                  label='Replacement at Level Count'
                  onChange={setState}
                  validation='num'
                  required={true}
                  errorMsg={'Must contain only numbers'}
                />
              )}
            </Grid>
            {featureItem.style?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'providesOptions'
            ) &&
              (!(featureItem.style?.selectCountByLevel?.length > 0) ||
              featureItem.levelAvailable?.split(', ')?.length !==
                featureItem.style?.selectCountByLevel?.length ? (
                setState({
                  type: 'added',
                  payload: {
                    target: {
                      name: `${stateName}.style.selectCountByLevel`,
                      value: featureItem?.levelAvailable
                        ?.split(', ')
                        .map((levelItem: string) => ({
                          level: Number(levelItem),
                        })),
                    },
                  },
                })
              ) : (
                <>
                  <Table
                    rows={{
                      inputs: [
                        {
                          name: 'level',
                          readOnly: true,
                        },
                        {
                          name: 'selectionCount',
                          validation: 'num',
                          errorMsg: 'Must enter whole numbers',
                          required: true,
                        },
                      ],
                      headers: [
                        {
                          value: 'Level',
                        },
                        {
                          value: 'Selection Count',
                          required: true,
                        },
                      ],
                    }}
                    name={`${stateName}.style.selectCountByLevel`}
                    value={featureItem.style?.selectCountByLevel}
                    onChange={setState}
                    addRow={true}
                    scrollable={true}
                  />
                </>
              ))}
          </>
        )}
      </>
    )
  }
)

FeatureContent.displayName = 'FeatureContent'

export default FeatureContent
