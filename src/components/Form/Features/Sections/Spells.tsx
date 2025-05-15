import { useEffect, useState } from 'react'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Categories, Sections } from '@/enums'
import { useEnumChecks, useSystemData, useSpellData, useClassData } from '@/hooks'
import Prerequisites from '../../Substeps/Prerequisites'
import LimitUse from '../../Substeps/LimitUse'
import type { SectionStore } from '@/store'
import type { OnChange, Class, FeatureSpell, SpellListItem } from '@/types'
import { Grid } from '@mantine/core'

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
  }, [data?.spellsByLevel, sectionStore, spellsByLevel, addField, removeField])

  return (
    <Grid>
      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute?.sections?.length &&
              (attribute.sections.includes(Sections.SPELL) ||
                attribute.sections.includes(Sections.ALL) ||
                ((formStore.data as Class)?.category === Categories.SUBCLASS &&
                  attribute.sections.includes(Sections.SUBCLASS)))
          )}
          label='Spell Attributes'
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Col>
      {classLimit && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='classLimit'
            multiSelect={true}
            label='Class Limit'
            value={data?.classLimit}
            options={classes}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
      )}
      {levelLimit && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
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
        </Grid.Col>
      )}
      {attributeLimit && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='attributeLimit'
            multiSelect={true}
            label='Attribute'
            value={data?.attributeLimit}
            options={attributes.filter(
              (attribute) => attribute?.sections?.length && attribute.sections.includes(Sections.SPELL)
            )}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
      )}
      {subtypeSpecific && formStore.data.__typename === 'Class' && formStore.data?.subtypes?.length && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='subtype'
            label='Subtype'
            value={data?.subtype}
            options={formStore.data?.subtypes}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
      )}
      {!spellsByLevel && (
        <>
          {' '}
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='ids'
              multiSelect={true}
              label='Spell'
              value={data?.ids}
              options={spellsArray}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
          {castAtLevel && (
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
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
            </Grid.Col>
          )}
          {optionalAbility && (
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='ability'
                label='Ability'
                value={data?.ability}
                options={abilities}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          )}
          {providesOptions && (
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
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
            </Grid.Col>
          )}
        </>
      )}
      {spellsByLevel && (
        <>
          <Grid.Col>
            <Grid>
              <Grid.Col >Level</Grid.Col>
              <Grid.Col >Spell</Grid.Col>
              {castAtLevel && <Grid.Col >Die Value</Grid.Col>}
            </Grid>
          </Grid.Col>
          {data?.spellsByLevel?.map((setLevel, index) => (
            <Grid.Col key={index}>
              <Grid>
                <Grid.Col >
                  <Dropdown
                    name={`spellsByLevel.${index}.level`}
                    value={String(setLevel.level)}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField, removeField }}
                    required={true}
                  />
                </Grid.Col>
                <Grid.Col >
                  <Dropdown
                    name={`spellsByLevel.${index}.spells`}
                    value={setLevel.spells}
                    options={spells}
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField, removeField }}
                    required={true}
                    multiSelect={true}
                  />
                </Grid.Col>
                {castAtLevel && (
                  <Grid.Col >
                    <Dropdown
                      name={`spellsByLevel.${index}.spellLevel`}
                      value={String(setLevel.spellLevel)}
                      options={spells}
                      errorMsg='Please enter a valid die value'
                      onChange={{ updateField, removeField }}
                      required={true}
                    />
                  </Grid.Col>
                )}
              </Grid>
            </Grid.Col>
          ))}
        </>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites formStore={sectionStore} />
        </Grid.Col>
      )}
      {limitUse && (
        <Grid.Col>
          <LimitUse formStore={sectionStore} />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Spells
