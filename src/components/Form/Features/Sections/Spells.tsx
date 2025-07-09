import { useEffect, useState } from 'react'
import { Categories, Sections } from '@/enums'
import { useEnumChecks, useSystemData, useSpellData, useClassData, useFieldUpdates } from '@/hooks'
import type { SpellListItem, SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { LimitUse, Prerequisites, useAppForm } from '@/components/Form'
import { SpellsByLevelInputSchema, FeatureSpellInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useFormStore, useSpellStore } from '@/store'

type SpellsProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Spells = ({ category, subtypes }: SpellsProps) => {
  const spellStore = useSpellStore()

  const form = useAppForm({
    defaultValues: FeatureSpellInputSchema.parse(spellStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'spell' })

  const formStore = useFormStore()

  const __kind = formStore.current?.__kind as
    | 'ClassInput'
    | 'RaceInput'
    | 'EquipmentInput'
    | 'BackgroundInput'
    | 'FeatInput'

  const { AppField } = form

  const { formAttributes, formClassLimit, formLevelLimit, formAttributeLimit, formSpellsByLevel } = useStore(
    form.store,
    (state) => ({
      formAttributes: state.values.attributes,
      formClassLimit: state.values.classLimit,
      formLevelLimit: state.values.levelLimit,
      formAttributeLimit: state.values.attributeLimit,
      formSpellsByLevel: state.values.spellsByLevel,
    })
  )

  const { attributes, abilities } = useSystemData()
  const { spells, metaData: spellMetaData } = useSpellData()
  const { classes } = useClassData()

  const { getAttributes } = useEnumChecks()

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
  } = getAttributes({
    attributes: formAttributes ?? [],
  })

  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (formClassLimit?.length) {
        meetsClassLimit =
          !formClassLimit ||
          formClassLimit?.some((limit) =>
            spellMetaData.classes.find((c) => c.id === limit)?.spellIds?.includes(spell.id)
          )
      }

      // Check against levelLimit filter
      if (formLevelLimit?.length) {
        meetsLevelLimit = formLevelLimit?.includes(
          String(spellMetaData.levels?.find((level) => level.spellIds?.includes(spell.id))?.id)
        )
      }

      if (formAttributeLimit?.length) {
        meetsAttributeLimit = formAttributeLimit?.some((limitItem) =>
          spellMetaData.attributes?.find((a) => a.id === limitItem)?.spellIds?.includes(spell.id)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, formClassLimit, formLevelLimit, formAttributeLimit, spellMetaData])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (!spellsByLevel && formSpellsByLevel) {
      form.setFieldValue('spellsByLevel', undefined)
    }
    if (spellsByLevel && !formSpellsByLevel) {
      const spellsByLevelObject = SpellsByLevelInputSchema.parse({})
      form.setFieldValue('spellsByLevel', [spellsByLevelObject])
    }
  }, [formSpellsByLevel, spellsByLevel, form])

  return (
    <Grid>
      <AppField name='attributes' listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField
              multiselect={true}
              options={attributes.filter(
                (attribute) =>
                  attribute?.sections?.length &&
                  (attribute.sections.includes(Sections.SPELL) ||
                    attribute.sections.includes(Sections.ALL) ||
                    (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
              )}
              label='Spell Attributes'
            />
          </Grid.Col>
        )}
      </AppField>
      {classLimit && (
        <AppField
          name='classLimit'
          validators={fieldValidators({
            onBlur: 'Select a class limit',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField multiselect={true} options={classes} label='Class Limit' required={true} />
            </Grid.Col>
          )}
        </AppField>
      )}
      {levelLimit && (
        <AppField
          name='levelLimit'
          validators={fieldValidators({
            onBlur: 'Select a level limit',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField
                multiselect={true}
                options={spellMetaData?.levels.map((l) => ({
                  id: String(l.id),
                  label: l.id,
                  value: l.id,
                }))}
                label='Level Limit'
                required={true}
              />
            </Grid.Col>
          )}
        </AppField>
      )}
      {attributeLimit && (
        <AppField
          name='attributeLimit'
          validators={fieldValidators({
            onBlur: 'Select an attribute limit',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField
                multiselect={true}
                options={attributes.filter(
                  (attribute) => attribute?.sections?.length && attribute.sections.includes(Sections.SPELL)
                )}
                label='Attribute Limit'
                required={true}
              />
            </Grid.Col>
          )}
        </AppField>
      )}
      {subtypeSpecific && __kind === 'ClassInput' && subtypes?.length && (
        <AppField
          name='subtype'
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField options={subtypes} label='Subtype' required={true} />
            </Grid.Col>
          )}
        </AppField>
      )}
      {!spellsByLevel && (
        <>
          <AppField
            name='ids'
            validators={fieldValidators({
              onBlur: 'Select at least one spell',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField multiselect={true} options={spellsArray} label='Spells' required={true} />
              </Grid.Col>
            )}
          </AppField>
          {castAtLevel && (
            <AppField
              name='spellLevel'
              validators={fieldValidators({
                onBlur: 'Please set a spell level to cast the spell at',
                onChange: { type: 'integer', name: 'Spell level', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='Spell Level' required={true} />
                </Grid.Col>
              )}
            </AppField>
          )}
          {optionalAbility && (
            <AppField
              name='ability'
              validators={fieldValidators({
                onBlur: 'Select the optional ability',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField options={abilities} label='Ability' required={true} />
                </Grid.Col>
              )}
            </AppField>
          )}
          {providesOptions && (
            <AppField
              name='selectionCount'
              validators={fieldValidators({
                onBlur: 'Please set an amount of allowed selections',
                onChange: { type: 'integer', name: 'Selection count', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='# of Selections' required={true} />
                </Grid.Col>
              )}
            </AppField>
          )}
        </>
      )}
      {spellsByLevel && (
        <>
          <Grid.Col>
            <Grid>
              <Grid.Col>Level</Grid.Col>
              <Grid.Col>Spell</Grid.Col>
              {castAtLevel && <Grid.Col>Die Value</Grid.Col>}
            </Grid>
          </Grid.Col>
          <AppField name='spellsByLevel' mode='array'>
            {({ state }) =>
              state.value?.map((_, i) => (
                <Grid.Col key={`${i}-spellsByLevel`}>
                  <Grid>
                    <AppField
                      name={`spellsByLevel[${i}].level`}
                      validators={fieldValidators({
                        onBlur: 'Select a spell level',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col>
                          <DropdownField options={spells} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name={`spellsByLevel[${i}].ids`}
                      validators={fieldValidators({
                        onBlur: 'Select at least one spell',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col>
                          <DropdownField multiselect={true} options={spells} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    {castAtLevel && (
                      <AppField
                        name={`spellsByLevel[${i}].spellLevel`}
                        validators={fieldValidators({
                          onBlur: 'Please set a spell level to cast the spell at',
                          onChange: { type: 'integer', name: 'Spell level', min: 1 },
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField label='Spell Level' required={true} />
                          </Grid.Col>
                        )}
                      </AppField>
                    )}
                  </Grid>
                </Grid.Col>
              ))
            }
          </AppField>
        </>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites
            form={form}
            fields='prerequisites'
            __kind='FeatureSpellInput'
            updateFn={spellStore.updateField}
            removeFn={spellStore.removeField}
          />
        </Grid.Col>
      )}
      {limitUse && (
        <Grid.Col>
          <LimitUse
            form={form}
            fields='charges'
            __kind='FeatureSpellInput'
            updateFn={spellStore.updateField}
            removeFn={spellStore.removeField}
          />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Spells
