import { useEffect, useState } from 'react'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListSpellsQuery } from '../../../../features/spells/spellsApi'
import { useListClassesQuery } from '../../../../features/classes/classesApi'
import { FeatureContext } from '../FeatureContext'
import { Attributes, Categories } from '../../../../types/enums'
import { Class, FeatureSpell, SectionEnum, Spell } from '../../../../../amplify/API'
import { UpdateState } from '../../../../types/form'

const Spells = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureSpell
    updateSectionData: (arg: UpdateState<FeatureSpell>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: classes } = useListClassesQuery()

  const providesOptions = sectionData.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  const [spellsArray, setSpellsArray] = useState<Array<Spell>>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (sectionData.classLimit?.length > 0) {
        meetsClassLimit =
          !sectionData.classLimit ||
          sectionData.classLimit?.some((limit) => spell.classes?.some((sClass) => limit === sClass))
      }

      // Check against levelLimit filter
      if (sectionData.levelLimit != null) {
        meetsLevelLimit = sectionData.levelLimit === spell.level
      }

      if (sectionData.attributeLimit?.length > 0) {
        meetsAttributeLimit = sectionData.attributeLimit?.some((limitItem) =>
          spell.attributes?.some((attribute) => attribute === limitItem)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, sectionData.classLimit, sectionData.levelLimit, sectionData.attributeLimit])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (
      !sectionData.attributes?.some((attribute) => attribute === Attributes.spellsByLevel) &&
      sectionData.spellsByLevel
    ) {
      updateSectionData({
        type: 'remove',
        path: `spellsByLevel`,
      })
    }
    if (
      sectionData.attributes?.some((attribute) => attribute === Attributes.spellsByLevel) &&
      !sectionData.spellsByLevel
    ) {
      updateSectionData({
        type: 'add',
        path: `spellsByLevel`,
      })
    }
  }, [sectionData.spellsByLevel, sectionData.attributes, updateSectionData])

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              attribute.sections.includes(SectionEnum.spells) ||
              attribute.sections.includes(SectionEnum.all) ||
              ((formData as Class).category === Categories.subclass &&
                attribute.sections.includes(SectionEnum.subclasses))
          )}
          label='Spell Attributes'
          value={sectionData.attributes}
          onChange={updateSectionData}
        />
        {sectionData.attributes?.some((attribute) => attribute === Attributes.classLimit) && (
          <Dropdown
            name='classLimit'
            multiSelect={true}
            label='Class Limit'
            value={sectionData.classLimit}
            options={classes}
            filters={[
              {
                matchingKey: 'subclass',
                key: 'category',
                type: 'notEqual',
              },
            ]}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {sectionData.attributes?.some((attribute) => attribute === Attributes.levelLimit) && (
          <Dropdown
            name='levelLimit'
            label='Level Limit'
            value={String(sectionData.levelLimit)}
            options={spells}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {sectionData.attributes?.some((attribute) => attribute === Attributes.attributeLimit) && (
          <Dropdown
            name='attributeLimit'
            multiSelect={true}
            label='Attribute'
            value={sectionData.attributeLimit}
            options={system.attributes.filter((attribute) => attribute.sections.includes(SectionEnum.spells))}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {sectionData.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) &&
          formData.__typename === 'Class' && (
            <Dropdown
              name='subtype'
              label='Subtype'
              value={sectionData.subtype}
              options={formData?.subtypes}
              required={true}
              onChange={updateSectionData}
            />
          )}
        {!sectionData.attributes?.some((attribute) => attribute === Attributes.spellsByLevel) && (
          <>
            <Dropdown
              name='spells'
              multiSelect={true}
              label='Spell'
              value={sectionData.spells}
              options={spellsArray}
              required={true}
              onChange={updateSectionData}
            />
            {sectionData.attributes?.some(
              (attribute) =>
                attribute === Attributes.castAtLevel && (
                  <Input
                    validation='num'
                    name='spellLevel'
                    label='Spell Level'
                    autoComplete='off'
                    value={sectionData.spellLevel}
                    errorMsg='Must contain only numbers'
                    required={true}
                    onChange={updateSectionData}
                  />
                )
            )}
            {sectionData.attributes?.some((attribute) => attribute === Attributes.optionalAbility) && (
              <Dropdown
                name='ability'
                label='Ability'
                value={sectionData.ability}
                options={system.abilities}
                required={true}
                onChange={updateSectionData}
              />
            )}
            {providesOptions && (
              <Input
                validation='num'
                name={`selectionCount`}
                label='# of Selections'
                autoComplete='off'
                value={sectionData.selectionCount}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={updateSectionData}
              />
            )}
          </>
        )}
      </Row>
      {sectionData.attributes?.some((attribute) => attribute === Attributes.spellsByLevel) && (
        <>
          <Row spacing='spaceBetween' cellSize='auto'>
            <span>Level</span>
            <span>Spell</span>
            {sectionData.attributes?.some((attribute) => attribute === Attributes.castAtLevel) && (
              <span>Die Value</span>
            )}
          </Row>
          {sectionData?.spellsByLevel?.map((setLevel, index) => (
            <Row key={index} spacing='spaceBetween' cellSize='auto'>
              <Dropdown
                name={`spellsByLevel.${index}.level`}
                value={String(setLevel.level)}
                options={spells?.map((spell) => ({
                  value: String(spell.level),
                  label: String(spell.level),
                  id: String(spell.level),
                }))}
                errorMsg='Please enter a whole number'
                onChange={updateSectionData}
                required={true}
              />
              <Dropdown
                name={`spellsByLevel.${index}.spells`}
                value={setLevel.spells}
                options={spells}
                errorMsg='Please enter a whole number'
                onChange={updateSectionData}
                required={true}
                multiSelect={true}
              />
              {sectionData.attributes?.some((attribute) => attribute === Attributes.castAtLevel) && (
                <Dropdown
                  name={`spellsByLevel.${index}.spellLevel`}
                  value={String(setLevel.spellLevel)}
                  options={spells?.map((spell) => ({
                    value: String(spell.level),
                    label: String(spell.level),
                    id: String(spell.level),
                  }))}
                  errorMsg='Please enter a valid die value'
                  onChange={updateSectionData}
                  required={true}
                />
              )}
            </Row>
          ))}
        </>
      )}
    </>
  )
}

export default Spells
