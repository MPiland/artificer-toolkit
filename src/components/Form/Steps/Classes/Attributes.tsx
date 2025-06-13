import { z } from 'zod/v4'
import { useEffect, Fragment, useMemo, type ReactNode } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import Collapsible from '@/components/Collapsible'
import LevelAttributes from '../../Substeps/Class/LevelAttributes'
import Spellcasting from '../../Substeps/Class/Spellcasting'
import Resource from '../../Substeps/Class/Resource'
import Multiclass from '../../Substeps/Class/Multiclass'
import { Attributes as AttributesEnum, Categories, Classes } from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import { TbPlus, TbX } from 'react-icons/tb'
import { row_button } from '../../Form.css'
import { Grid, Group, Button } from '@mantine/core'
import { withForm } from '../../utils/factory'
import { ClassInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof ClassInputSchema> = ClassInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const { formAttributes, resourceMethod, spellcasting, levelAttributes, category, subtypes, maxSpellLevel } =
      useStore(form.store, (state) => ({
        formAttributes: state.values.attributes,
        resourceMethod: state.values.resource?.method,
        spellcasting: state.values.spellcasting,
        levelAttributes: state.values.levelAttributes,
        category: state.values.category,
        subtypes: state.values.subtypes,
        maxSpellLevel: state.values.spellcasting?.maxSpellLevel,
      }))
    const { AppField, Subscribe, setFieldValue } = form

    const { attributes } = useSystemData()

    const { getAttributes, getResourceMethods } = useEnumChecks()

    const {
      isSpellcaster,
      canUpcast,
      primaryAbility,
      secondaryAbility,
      optionalAbility,
      hasSubtypes,
      hasResourcePoints,
      limitKnownSpells,
      magicName,
      preparesSpells,
    } = getAttributes({ attributes: formAttributes })

    const { resourceSetPerLevel } = getResourceMethods({ method: resourceMethod })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        return [
          {
            condition: !isSpellcaster && spellcasting != null,
            cleanup: () => {
              setFieldValue('spellcasting', undefined)
              levelAttributes?.map((_, index) => {
                setFieldValue(`levelAttributes[${index}].spellSlots`, undefined)
              })
            },
          },
          {
            condition: (category !== Categories.SUBCLASS || !hasSubtypes) && subtypes?.length,
            cleanup: () => {
              setFieldValue('subtypes', undefined)
            },
          },
        ]
      }

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [category, levelAttributes, spellcasting, subtypes, setFieldValue, canUpcast, isSpellcaster, hasSubtypes])

    // Add Subtypes to Class as necessary
    useEffect(() => {
      if (category !== Categories.SUBCLASS && hasSubtypes && !subtypes?.length)
        setFieldValue('subtypes', [{ __kind: 'SubtypeInput', id: uuidv4(), label: '' }])
    }, [category, hasSubtypes, subtypes, setFieldValue])

    // Memoize spell slot labels
    const spellSlotLabels = useMemo(() => {
      const spellLabels: ReactNode[] = []
      if (maxSpellLevel) {
        for (let i = 0; i < maxSpellLevel; i++) {
          spellLabels.push(
            <Grid.Col key={`spell-label-${i}`}>
              <span>{i + 1}</span>
            </Grid.Col>
          )
        }
      }
      return spellLabels
    }, [maxSpellLevel])

    return (
      <Subscribe
        selector={(state) => ({
          category: state.values.category,
          maxSpellLevel: state.values.spellcasting?.maxSpellLevel,
          resourceLabel: state.values.resource?.label,
        })}
      >
        {({ category, maxSpellLevel, resourceLabel }) => (
          <Grid>
            <Grid.Col>
              <Grid>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='attributes'>
                    {({ DropdownField }) => (
                      <DropdownField
                        multiselect={true}
                        options={attributes
                          .filter(
                            (attribute) =>
                              attribute.classes?.length &&
                              (attribute.classes.includes(Classes.BASE) ||
                                (category === Categories.SUBCLASS && attribute.classes.includes(Classes.SUBCLASS)) ||
                                attribute.classes.includes(Classes.ALL))
                          )
                          .filter((attribute) =>
                            primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                          )}
                        label='Character Attributes'
                      />
                    )}
                  </AppField>
                </Grid.Col>
              </Grid>
            </Grid.Col>
            {primaryAbility && (
                <Multiclass
                  fields='multiclass'
                  form={form}
                  primaryAbility={primaryAbility}
                  secondaryAbility={secondaryAbility ?? false}
                  optionalAbility={optionalAbility ?? false}
                />
              ) &&
              isSpellcaster && (
                <Spellcasting
                  fields='spellcasting'
                  form={form}
                  magicName={magicName ?? false}
                  preparesSpells={preparesSpells ?? false}
                />
              ) &&
              (isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
                <Grid.Col>
                  <Collapsible>
                    <Collapsible.Trigger title={'Level Attributes'} />
                    <Collapsible.Content>
                      <Grid>
                        <Grid.Col>
                          <Grid>
                            <Grid.Col>Level</Grid.Col>
                            {hasResourcePoints && <Grid.Col>{resourceLabel ?? 'Resource'} Points</Grid.Col>}
                            {isSpellcaster && (
                              <>
                                <Grid.Col>Cantrips Known</Grid.Col>
                                {limitKnownSpells && <Grid.Col>Spells Known</Grid.Col>}
                                {spellSlotLabels}
                              </>
                            )}
                          </Grid>
                        </Grid.Col>
                        <AppField name='levelAttributes' mode='array'>
                          {(field) =>
                            field.state.value?.map((_, i) => (
                              <LevelAttributes
                                key={`${i}-levelAttributes`}
                                form={form}
                                fields={`levelAttributes[${i}]`}
                                hasResourcePoints={hasResourcePoints ?? false}
                                isSpellcaster={isSpellcaster ?? false}
                                limitKnownSpells={limitKnownSpells ?? false}
                                maxSpellLevel={maxSpellLevel ?? 0}
                                index={i}
                              />
                            ))
                          }
                        </AppField>
                      </Grid>
                    </Collapsible.Content>
                  </Collapsible>
                </Grid.Col>
              ) &&
              hasResourcePoints && <Resource form={form} fields='resource' /> &&
              hasSubtypes && (
                <AppField name='subtypes' mode='array'>
                  {(field) =>
                    field.state.value?.length && (
                      <Collapsible>
                        <Collapsible.Trigger title={'Subtypes'} />
                        <Collapsible.Content>
                          <Grid>
                            <Grid.Col>Name</Grid.Col>
                            {field.state.value?.map((_, i) => (
                              <Fragment key={i}>
                                <Grid.Col span={6}>
                                  <AppField
                                    name={`subtypes[${i}].label`}
                                    validators={{
                                      onSubmit: ({ value }) => !value && 'Please enter a subtype name',
                                    }}
                                  >
                                    {({ TextField }) => <TextField label='Name' />}
                                  </AppField>
                                </Grid.Col>
                                <Grid.Col
                                  span={{ base: 6, md: 4, lg: 2 }}
                                  className={sprinkles({ alignContent: 'center' })}
                                >
                                  <Group justify='flex-start' grow>
                                    <Button
                                      variant='unstyled'
                                      className={row_button}
                                      onClick={() =>
                                        field.pushValue({
                                          __kind: 'SubtypeInput',
                                          id: uuidv4(),
                                          label: '',
                                        })
                                      }
                                    >
                                      <TbPlus />
                                    </Button>
                                    {i !== 0 && (
                                      <Button
                                        variant='unstyled'
                                        className={row_button}
                                        onClick={() => field.removeValue(i)}
                                      >
                                        <TbX />
                                      </Button>
                                    )}
                                  </Group>
                                </Grid.Col>
                              </Fragment>
                            ))}
                          </Grid>
                        </Collapsible.Content>
                      </Collapsible>
                    )
                  }
                </AppField>
              )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default AttributesStep
