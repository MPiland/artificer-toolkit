import { useEffect, useState } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Categories } from '../../../../types/enums'
import type { Class, FeatureSpell, SpellListItem } from '../../../../../amplify/gql/types'
import { SectionEnum } from '../../../../../amplify/gql/types'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Prerequisites'
import LimitUse from '../../Subforms/LimitUse'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import useSpellData from '../../../../hooks/useSpellData'
import useClassData from '../../../../hooks/useClassData'
import type { SectionStore } from '../../../../store/sectionStore'
import type { OnChange } from '../../../../types/form'

const Spells = () => {
  const { formStore } = use(FormContext)

  const { sectionStore } = use(FeatureContext) as {
    sectionStore: SectionStore<FeatureSpell>
  }

  const {
    data,
    updateField,
    removeField,
    addField,
  }: {
    data: FeatureSpell
    updateField: OnChange<FeatureSpell>['updateField']
    removeField: OnChange<FeatureSpell>['removeField']
    addField: OnChange<FeatureSpell>['addField']
  } = sectionStore

  const { attributes, abilities } = useSystemData()
  const { spells, metaData: spellMetaData } = useSpellData()
  const { classes } = useClassData()

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
    data: data,
  })

  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (data?.classLimit?.length) {
        meetsClassLimit =
          !data?.classLimit ||
          data?.classLimit?.some((limit) =>
            spellMetaData.classes.find((c) => c.id === limit)?.spellIds?.includes(spell.id)
          )
      }

      // Check against levelLimit filter
      if (data?.levelLimit?.length) {
        meetsLevelLimit = data?.levelLimit?.includes(
          String(spellMetaData.levels?.find((level) => level.spellIds?.includes(spell.id))?.id)
        )
      }

      if (data?.attributeLimit?.length) {
        meetsAttributeLimit = data?.attributeLimit?.some((limitItem) =>
          spellMetaData.attributes?.find((a) => a.id === limitItem)?.spellIds?.includes(spell.id)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, data?.classLimit, data?.levelLimit, data?.attributeLimit, spellMetaData])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (!spellsByLevel && data?.spellsByLevel) {
      removeField({ path: 'spellsByLevel' })
    }
    if (spellsByLevel && !data?.spellsByLevel) {
      addField({ path: 'spellsByLevel' })
    }
  }, [data?.spellsByLevel, sectionStore, spellsByLevel])

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute?.sections?.length &&
              (attribute.sections.includes(SectionEnum.spells) ||
                attribute.sections.includes(SectionEnum.all) ||
                ((formStore.data as Class)?.category === Categories.subclass &&
                  attribute.sections.includes(SectionEnum.subclasses)))
          )}
          label='Spell Attributes'
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {classLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='classLimit'
            multiSelect={true}
            label='Class Limit'
            value={data?.classLimit}
            options={classes}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
      )}
      {levelLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='levelLimit'
            label='Level Limit'
            multiSelect={true}
            value={data?.levelLimit}
            options={spellMetaData?.levels.map((l) => ({
              id: String(l.id),
              label: l.id,
              value: l.id,
            }))}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
      )}
      {attributeLimit && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='attributeLimit'
            multiSelect={true}
            label='Attribute'
            value={data?.attributeLimit}
            options={attributes.filter(
              (attribute) => attribute?.sections?.length && attribute.sections.includes(SectionEnum.spells)
            )}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
      )}
      {subtypeSpecific && formStore.data.__typename === 'Class' && formStore.data?.subtypes?.length && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='subtype'
            label='Subtype'
            value={data?.subtype}
            options={formStore.data?.subtypes}
            required={true}
            onChange={{ updateField, removeField }}
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
              value={data?.ids}
              options={spellsArray}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {castAtLevel && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='spellLevel'
                label='Spell Level'
                autoComplete='off'
                value={data?.spellLevel}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Item>
          )}
          {optionalAbility && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='ability'
                label='Ability'
                value={data?.ability}
                options={abilities}
                required={true}
                onChange={{ updateField, removeField }}
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
                value={data?.selectionCount}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={{ updateField }}
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
          {data?.spellsByLevel?.map((setLevel, index) => (
            <Grid.Item key={index}>
              <Grid>
                <Grid.Item colSpan={'auto'}>
                  <Dropdown
                    name={`spellsByLevel.${index}.level`}
                    value={String(setLevel.level)}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField, removeField }}
                    required={true}
                  />
                </Grid.Item>
                <Grid.Item colSpan={'auto'}>
                  <Dropdown
                    name={`spellsByLevel.${index}.spells`}
                    value={setLevel.spells}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField, removeField }}
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
                      onChange={{ updateField, removeField }}
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
          <Prerequisites formStore={sectionStore} />
        </Grid.Item>
      )}
      {limitUse && (
        <Grid.Item>
          <LimitUse formStore={sectionStore} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Spells
