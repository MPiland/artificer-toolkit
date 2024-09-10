import { useEffect, useState } from 'react'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import Table from '../../../Table/Table'
import { startCase } from 'lodash'
import { useForm } from '../../../../hooks/UseForm'
import { DropdownOptionType, RowHeaderType, RowInputType } from '../../../../utils/types'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetSystemsQuery } from '../../../../features/systems/systemsApi'
import { useGetSpellsQuery } from '../../../../features/spells/spellsApi'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'

const Spells = () => {
  const { formState } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetSystemsQuery()
  const { data: spells } = useGetSpellsQuery() as { data: any[] }
  const { data: classes } = useGetClassesQuery() as { data: any[] }

  const providesOptions = sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')

  const [spellsArray, setSpellsArray] = useState<DropdownOptionType[]>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = (spells as DropdownOptionType[])?.filter((spellItem) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (sectionState.classLimit?.length > 0) {
        meetsClassLimit =
          !sectionState.classLimit ||
          sectionState.classLimit?.some((limitItem: any) =>
            spellItem.classes?.some((classItem: any) => limitItem.name === classItem.name)
          )
      }

      // Check against levelLimit filter
      if (sectionState.levelLimit != null) {
        meetsLevelLimit = sectionState.levelLimit.value === spellItem.level
      }

      if (sectionState.attributeLimit?.length > 0) {
        meetsAttributeLimit = sectionState.attributeLimit?.some((limitItem: any) =>
          spellItem.attribute?.some((attributeItem: any) => attributeItem.name === limitItem.name)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, sectionState.classLimit, sectionState.levelLimit, sectionState.attributeLimit])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (
      !sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') &&
      sectionState.spellsByLevel
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
    if (
      sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') &&
      !sectionState.spellsByLevel
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
  }, [sectionState.spellsByLevel, sectionState.attribute, setSectionState, formState.category.name])

  const spellTableColumns = () => {
    const inputArray: RowInputType[] = [
      {
        name: 'level',
        value: 'Level',
        type: 'select',
        options: spells?.map((spell: any) => ({ name: spell.level, value: spell.level, _id: null })),
      },
      {
        name: 'spell',
        value: 'Spell',
        type: 'select',
        options: spells,
        multiple: true,
        filter: [
          {
            key: 'level',
            matchingKey: 'level',
            object: 'object',
            type: 'equal',
          },
        ],
      },
    ]

    if (sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'castAtLevel')) {
      inputArray.push({
        name: 'spellLevel',
        value: 'Spell Level',
        validation: 'num',
        errorMsg: 'Must not be blank. Enter whole numbers only.',
      })
    }

    const headerArray: RowHeaderType[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.spells.attribute,
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('spell')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'classLimit') && (
          <Dropdown
            name={`classLimit`}
            multiSelect={true}
            label='Class Limit'
            value={sectionState.classLimit}
            options={
              classes?.map((uClass: any) => ({
                name: uClass.name,
                value: uClass.value,
                _id: uClass._id,
              })) as DropdownOptionType[]
            }
            filter={[
              {
                value: 'subclass',
                key: 'category.name',
                type: 'notEqual',
              },
            ]}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'levelLimit') && (
          <Dropdown
            name={`levelLimit`}
            label='Level Limit'
            value={sectionState.levelLimit}
            options={(spells as DropdownOptionType[])?.map((spellItem) => ({
              value: Number(spellItem.level),
              name: Number(spellItem.level),
              _id: null,
            }))}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'attributeLimit') && (
          <Dropdown
            name={`attributeLimit`}
            multiSelect={true}
            label='Attribute'
            value={sectionState.attributeLimit}
            options={builders.spells.attribute}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={formState?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
        {!sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') && (
          <>
            <Dropdown
              name={`type`}
              multiSelect={true}
              label='Spell'
              value={sectionState.type}
              options={spellsArray}
              required={true}
              onChange={setSectionState}
            />
            {sectionState.attribute?.some(
              (attributeItem: any) =>
                attributeItem.name === 'castAtLevel' && (
                  <Input
                    validation='num'
                    name={`spellLevel`}
                    label='Spell Level'
                    autoComplete='off'
                    value={sectionState.spellLevel}
                    errorMsg='Must contain only numbers'
                    required={true}
                    onChange={setSectionState}
                  />
                )
            )}
            {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'optionalAbility') && (
              <Dropdown
                name={`ability`}
                label='Ability'
                value={sectionState.ability}
                options={builders.abilities.type}
                required={true}
                onChange={setSectionState}
              />
            )}
            {providesOptions && (
              <Input
                validation='num'
                name={`selectionCount`}
                label='# of Selections'
                autoComplete='off'
                value={sectionState.selectionCount}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={setSectionState}
              />
            )}
          </>
        )}
      </Row>
      {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') && (
        <>
          <Table
            rows={{
              inputs: spellTableColumns().inputs,
              headers: spellTableColumns().headers,
            }}
            name={`spellsByLevel`}
            value={sectionState.spellsByLevel}
            onChange={setSectionState}
            addRow={true}
          />
        </>
      )}
    </>
  )
}

export default Spells
