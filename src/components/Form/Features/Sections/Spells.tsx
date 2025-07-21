import { useEffect, useState } from 'react'
import { Categories, Sections } from '@/enums'
import { useEnumChecks, useSystemData, useSpellData, useClassData, useFieldUpdates } from '@/hooks'
import type { SpellListItem, SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { LimitUse, Prerequisites, useAppForm } from '@/components/Form'
import { SpellsByLevelInputSchema, FeatureSpellInputSchema } from '@/schemas'
import { useFormStore, useFeatureSpellStore } from '@/store'

type SpellsProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Spells = ({ category, subtypes }: SpellsProps) => {
  const current = useFeatureSpellStore((state) => state.current)
  const registerForm = useFeatureSpellStore((state) => state.registerForm)
  const formReset = useFeatureSpellStore((state) => state.formReset)
  const updateField = useFeatureSpellStore((state) => state.updateField)
  const removeField = useFeatureSpellStore((state) => state.removeField)
  const valid = useFeatureSpellStore((state) => state.valid)
  const upsertValid = useFeatureSpellStore((state) => state.upsertValid)
  const formAttributes = useFeatureSpellStore((state) => state.current?.attributes)
  const formClassLimit = useFeatureSpellStore((state) => state.current?.classLimit)
  const formLevelLimit = useFeatureSpellStore((state) => state.current?.levelLimit)
  const formAttributeLimit = useFeatureSpellStore((state) => state.current?.attributeLimit)
  const formSpellsByLevel = useFeatureSpellStore((state) => state.current?.spellsByLevel)

  const __kind = useFormStore((state) => state.current?.__kind)

  const form = useAppForm({
    defaultValues: FeatureSpellInputSchema.parse(current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'spell' })

  const { AppField } = form

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

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [form.reset, registerForm, formReset])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (current?.id && valid.get(current.id) !== isValid) {
        upsertValid(current.id, isValid)
      }
    })
  }, [valid, upsertValid, current?.id, form.store])

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
            updateFn={updateField}
            removeFn={removeField}
          />
        </Grid.Col>
      )}
      {limitUse && (
        <Grid.Col>
          <LimitUse
            form={form}
            fields='charges'
            __kind='FeatureSpellInput'
            updateFn={updateField}
            removeFn={removeField}
          />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Spells
