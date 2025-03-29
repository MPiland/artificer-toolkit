import { useEffect, useState } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../apis/systemsApi'
import { useListSpellsQuery } from '../../../../apis/spellsApi'
import { useListClassesQuery } from '../../../../apis/classesApi'
import { FeatureContext } from '../FeatureContext'
import { Categories } from '../../../../types/enums'
import { Class, FeatureSpell, SectionEnum, Spell } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Requirements'
import LimitUse from '../../Subforms/LimitUse'
import Grid from '../../../Grid/Grid'

const Spells = () => {
  const { formData } = use(FormContext)

  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureSpell
    updateSectionData: (arg: UpdateState<FeatureSpell>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: classes } = useListClassesQuery()

  const {
    spellsByLevel,
    classLimit,
    levelLimit,
    attributeLimit,
    subtypeSpecific,
    castAtLevel,
    optionalAbility,
    hasPrerequisites,
    limitUse,
    providesOptions,
  } = useEnumChecks({
    data: sectionData,
  })

  const [spellsArray, setSpellsArray] = useState<Spell[]>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (sectionData?.classLimit?.length) {
        meetsClassLimit =
          !sectionData?.classLimit ||
          sectionData?.classLimit?.some((limit) => spell.classes?.some((sClass) => limit === sClass))
      }

      // Check against levelLimit filter
      if (sectionData?.levelLimit?.length) {
        meetsLevelLimit = sectionData?.levelLimit?.includes(String(spell.level))
      }

      if (sectionData?.attributeLimit?.length) {
        meetsAttributeLimit = sectionData?.attributeLimit?.some((limitItem) =>
          spell.attributes?.some((attribute) => attribute === limitItem)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, sectionData?.classLimit, sectionData?.levelLimit, sectionData?.attributeLimit])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (!spellsByLevel && sectionData?.spellsByLevel) {
      updateSectionData({
        type: 'remove',
        path: `spellsByLevel`,
      })
    }
    if (spellsByLevel && !sectionData?.spellsByLevel) {
      updateSectionData({
        type: 'add',
        path: `spellsByLevel`,
      })
    }
  }, [sectionData?.spellsByLevel, updateSectionData, spellsByLevel])

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              attribute?.sections?.length &&
              (attribute.sections.includes(SectionEnum.spells) ||
                attribute.sections.includes(SectionEnum.all) ||
                ((formData as Class)?.category === Categories.subclass &&
                  attribute.sections.includes(SectionEnum.subclasses)))
          )}
          label='Spell Attributes'
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {classLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='classLimit'
            multiSelect={true}
            label='Class Limit'
            value={sectionData?.classLimit}
            options={classes}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
      )}
      {levelLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='levelLimit'
            label='Level Limit'
            multiSelect={true}
            value={sectionData?.levelLimit}
            options={spellsArray.map((spell) => ({
              id: String(spell.level),
              label: spell.level,
              value: spell.level,
            }))}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
      )}
      {attributeLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='attributeLimit'
            multiSelect={true}
            label='Attribute'
            value={sectionData?.attributeLimit}
            options={system.attributes.filter(
              (attribute) => attribute?.sections?.length && attribute.sections.includes(SectionEnum.spells)
            )}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
      )}
      {subtypeSpecific && formData.__typename === 'Class' && formData?.subtypes?.length && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='subtype'
            label='Subtype'
            value={sectionData?.subtype}
            options={formData?.subtypes}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
      )}
      {!spellsByLevel && (
        <>
          {' '}
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='ids'
              multiSelect={true}
              label='Spell'
              value={sectionData?.ids}
              options={spellsArray}
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
          {castAtLevel && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='spellLevel'
                label='Spell Level'
                autoComplete='off'
                value={sectionData?.spellLevel}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
          )}
          {optionalAbility && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='ability'
                label='Ability'
                value={sectionData?.ability}
                options={system.abilities}
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
          )}
          {providesOptions && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name={`selectionCount`}
                label='# of Selections'
                autoComplete='off'
                value={sectionData?.selectionCount}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
          )}
        </>
      )}
      {spellsByLevel && (
        <>
          <Grid.Item>
            <Grid>
              <Grid.Item colSpan={'auto'}>Level</Grid.Item>
              <Grid.Item colSpan={'auto'}>Spell</Grid.Item>
              {castAtLevel && <Grid.Item colSpan={'auto'}>Die Value</Grid.Item>}
            </Grid>
          </Grid.Item>
          {sectionData?.spellsByLevel?.map((setLevel, index) => (
            <Grid.Item key={index}>
              <Grid>
                <Grid.Item colSpan={'auto'}>
                  <Dropdown
                    name={`spellsByLevel.${index}.level`}
                    value={String(setLevel.level)}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={updateSectionData}
                    required={true}
                  />
                </Grid.Item>
                <Grid.Item colSpan={'auto'}>
                  <Dropdown
                    name={`spellsByLevel.${index}.spells`}
                    value={setLevel.spells}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={updateSectionData}
                    required={true}
                    multiSelect={true}
                  />
                </Grid.Item>
                {castAtLevel && (
                  <Grid.Item colSpan={'auto'}>
                    <Dropdown
                      name={`spellsByLevel.${index}.spellLevel`}
                      value={String(setLevel.spellLevel)}
                      options={spells}
                      errorMsg='Please enter a valid die value'
                      onChange={updateSectionData}
                      required={true}
                    />
                  </Grid.Item>
                )}
              </Grid>
            </Grid.Item>
          ))}
        </>
      )}
      {hasPrerequisites && (
        <Grid.Item>
          <Prerequisites formData={sectionData} updateFormData={updateSectionData} />
        </Grid.Item>
      )}
      {limitUse && (
        <Grid.Item>
          <LimitUse formData={sectionData} updateFormData={updateSectionData} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Spells
