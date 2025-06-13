import { z } from 'zod/v4'
import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Categories, EquipCats, EquipProps, SpellReqs } from '@/enums'
import { useSystemData, useClassData, useRaceData } from '@/hooks'
import { Grid, Divider } from '@mantine/core'
import { withForm } from '../utils/factory'
import { discriminatedDomainInputSchema, DetailInputSchema } from '@/schemas'
import { DIE_REGEX } from '../utils/utils'

const defaultValues: z.input<typeof discriminatedDomainInputSchema> = discriminatedDomainInputSchema.parse({})

const DetailsStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const { categories, characters, equipment, currencies, rules, abilities, spells } = useSystemData()
    const { baseClasses, classes } = useClassData()
    const { races } = useRaceData()
    const { AppField, Subscribe } = form
    return (
      <Subscribe
        selector={(state) => ({
          __kind: state.values.__kind,
          category:
            (
              state.values.__kind === 'RaceInput' ||
              state.values.__kind === 'ClassInput' ||
              state.values.__kind === 'EquipmentInput'
            ) ?
              state.values.category
            : null,
          properties: state.values.__kind === 'EquipmentInput' ? state.values.properties : null,
          requirements: state.values.__kind === 'SpellInput' ? state.values.requirements : null,
          details:
            (
              state.values.__kind === 'RaceInput' ||
              state.values.__kind === 'ClassInput' ||
              state.values.__kind === 'BackgroundInput'
            ) ?
              state.values.details
            : null,
        })}
      >
        {({ __kind, category, properties, requirements, details }) => (
          <Grid>
            <AppField
              name='label'
              validators={{
                onSubmit: ({ value }) => !value && 'Please enter a name',
              }}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='Name' required={true} />
                </Grid.Col>
              )}
            </AppField>
            {__kind === 'CharacterInput' && (
              <>
                <AppField
                  name='advancement'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please select a level advancement method',
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        label='Advancement Type'
                        options={characters.advancementMethods.all}
                        required={true}
                      />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='hitpoint.method'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please select a hitpoint calculation method',
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        label='Hit Point Type'
                        options={characters.hitpointCalcMethods.all}
                        required={true}
                      />
                    </Grid.Col>
                  )}
                </AppField>
              </>
            )}
            {(__kind === 'RaceInput' || __kind === 'ClassInput' || __kind === 'EquipmentInput') && (
              <>
                <AppField
                  name='category'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please select a category',
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        label='Category'
                        options={
                          __kind !== 'EquipmentInput' ?
                            categories.filter(
                              (category) =>
                                (__kind === 'RaceInput' && category?.races) ||
                                (__kind === 'ClassInput' && category?.classes)
                            )
                          : equipment.categories.all
                        }
                        required={true}
                      />
                    </Grid.Col>
                  )}
                </AppField>
                {__kind === 'RaceInput' && category === Categories.BASE && (
                  <AppField
                    name='playable'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Choose whether this race is playable or not',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          label='Playable'
                          options={[
                            {
                              value: 'true',
                              label: 'Yes',
                              id: 'true',
                            },
                            {
                              value: 'false',
                              label: 'No',
                              id: 'false',
                            },
                          ]}
                          required={true}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {__kind === 'EquipmentInput' && (
                  <>
                    <AppField name='properties'>
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            label='properties'
                            options={equipment.properties.filterByCategory(category)}
                            multiselect={true}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='rarity'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please select a rarity',
                      }}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Rarity' options={equipment.rarities} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='cost.amount'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please enter a cost amount',
                        onChange: z.number('Cost amount must be an number'),
                      }}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label='Cost' required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='cost.currency'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please select a currency',
                      }}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Currency' options={currencies} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='weight.amount'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please enter a weight amount',
                        onChange: z.number('Weight').gt(0, 'Weight must be greater than 0'),
                      }}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label='Weight' required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='weight.unit'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please select a weight unit of measurement',
                      }}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='UoM' options={rules.measurements.imperial.weight} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  </>
                )}
              </>
            )}
            {__kind === 'ClassInput' && (
              <>
                {category === Categories.SUBCLASS ?
                  <AppField
                    name='parentClass'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please select a parent class',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Parent Class' options={baseClasses} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                : <>
                    <AppField
                      name='hitpoint.dieConfig'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please enter a hitpoint die configuration',
                        onChange: z
                          .string()
                          .regex(DIE_REGEX, 'Hitpoint die configuration must be a valid die configuration (ex: 1d8'),
                      }}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label='HP Die Value' required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='hitpoint.ability'
                      validators={{
                        onSubmit: ({ value }) => !value && 'Please select a hitpoint ability',
                      }}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='HP Modifier Ability' options={abilities} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  </>
                }
              </>
            )}
            {__kind === 'RaceInput' && (category === Categories.SUBRACE || category === Categories.VARIANT) && (
              <AppField
                name='lineages'
                validators={{
                  onSubmit: ({ value }) => !value && 'Please select a race lineage',
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Race Linage' options={races} required={true} multiselect={true} />
                  </Grid.Col>
                )}
              </AppField>
            )}
            {__kind === 'EquipmentInput' &&
              (category === EquipCats.WATER_VEHICLE || category === EquipCats.MOUNT ?
                <>
                  <AppField
                    name='speed.amount'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a speed value',
                      onChange: z
                        .int('Speed amount must be a whole number')
                        .gte(1, 'Speed amount must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='HP Die Value' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='speed.unit'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please select a speed unit of measurement',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='UoM' options={rules.measurements.imperial.length} />
                      </Grid.Col>
                    )}
                  </AppField>
                </>
              : (category === EquipCats.WEAPON || category === EquipCats.ARMOR) && (
                  <AppField
                    name='rank'
                    validators={{
                      onChange: z.int('Rank must be a whole number').gte(1, 'Rank must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Item Rank' />
                      </Grid.Col>
                    )}
                  </AppField>
                )) &&
              (properties?.some((property) => property === EquipProps.CONTAINER) || category === EquipCats.MOUNT) && (
                <>
                  <AppField
                    name='capacity.amount'
                    validators={{
                      onChange: z
                        .number('Capacity amount must be a number')
                        .gt(0, 'Speed amount must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Capacity Amount' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='capacity.unit'
                    validators={{
                      onSubmit: ({ value, fieldApi }) =>
                        fieldApi.form.getFieldValue('capacity.amount') != null &&
                        !value &&
                        'Please select a capacity unit of measurement',
                    }}
                  >
                    {({ DropdownField, form }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          label='UoM'
                          options={[...rules.measurements.imperial.volume, ...rules.measurements.imperial.weight]}
                          required={form.getFieldValue('capacity.amount') != null}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                </>
              )}
            {__kind === 'EquipmentInput' && (category === EquipProps.THROWN || category === EquipProps.RANGED) && (
              <>
                <AppField
                  name='range.minRange'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please enter a min range value',
                    onChange: z.int('Min range must be a whole number').gte(1, 'Min range must be greater than 0'),
                  }}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Min. Range' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='range.maxRange'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please enter a max range value',
                    onChange: z.int('Min range must be a whole number').gte(1, 'Min range must be greater than 0'),
                  }}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Max Range' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
              </>
            )}
            {__kind === 'EquipmentInput' && (
              <AppField
                name='quantity'
                validators={{
                  onChange: z.int('Quantity must be a whole number').gte(1, 'Quantity must be greater than 0'),
                }}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='Quantity' />
                  </Grid.Col>
                )}
              </AppField>
            )}
            {__kind === 'SpellInput' && (
              <>
                <AppField
                  name='level'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please enter a spell level',
                    onChange: z.int('Spell level must be a whole number').gte(0, 'Spell level must be at least 0'),
                  }}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Level' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='school'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please select a spell school',
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField label='School' required={true} options={spells.schools} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField name='requirements'>
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField label='Requirements' options={spells.requirements} multiselect={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='classes'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Please select at least one class',
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField label='Class(es)' options={classes} multiselect={true} required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                {requirements?.some((requirement) => requirement === SpellReqs.MATERIAL) && (
                  <AppField
                    name='materialDesc'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a material requirement description',
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Material Desc.' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
              </>
            )}
            {__kind === 'ClassInput' && category === Categories.BASE && (
              <Grid.Col>
                <Divider label='Starting Gold' />
                <Grid>
                  <AppField
                    name='startingGold.dieConfig'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a gold die configuration',
                      onChange: z.string().regex(DIE_REGEX, 'Please enter a valid die configuration (ex: 2d4)'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField label='Gold Die Config.' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='startingGold.multiplier'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a gold die configuration',
                      onChange: z
                        .number('Multiplier must be a number')
                        .gt(0, 'Multiplier must be a number greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField label='Gold Multiplier' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='startingGold.currency'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please select a currency',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col>
                        <DropdownField label='Currency' options={currencies} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                </Grid>
              </Grid.Col>
            )}
            {__kind === 'EquipmentInput' && (
              <AppField name='quote'>
                {({ RichTextEditorField }) => (
                  <Grid.Col>
                    <RichTextEditorField label='Quote' />
                  </Grid.Col>
                )}
              </AppField>
            )}
            {(__kind === 'CharacterInput' || __kind === 'SpellInput' || __kind === 'EquipmentInput') && (
              <AppField name='desc'>
                {({ RichTextEditorField }) => (
                  <Grid.Col>
                    <RichTextEditorField label='Description' />
                  </Grid.Col>
                )}
              </AppField>
            )}
            {(__kind === 'RaceInput' || __kind === 'ClassInput' || __kind === 'BackgroundInput') && (
              <>
                <AppField name='details' mode='array'>
                  {({ pushValue, removeValue, AccordionField }) => (
                    <>
                      <Grid.Col span={2} className={sprinkles({ alignContent: 'flex-end' })}>
                        <Button type='button' onClick={() => pushValue(DetailInputSchema.parse({}))}>
                          Add Detail
                        </Button>
                      </Grid.Col>
                      {details?.length && (
                        <Grid.Col>
                          <AccordionField name='details'>
                            {details.map((detail, i) => (
                              <Accordion.Item key={`${i}-details`} itemId={String(i)} value={detail.label ?? ''}>
                                <Accordion.Trigger removeFn={() => removeValue(i)}>
                                  {detail.label != null && detail.label !== '' ? detail.label : `Detail ${i + 1}`}
                                </Accordion.Trigger>
                                <Accordion.Content>
                                  <Grid>
                                    <AppField name={`details[${i}].label`}>
                                      {({ TextField }) => (
                                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                          <TextField label='Detail Name' />
                                        </Grid.Col>
                                      )}
                                    </AppField>

                                    <AppField name={`details[${i}].desc`}>
                                      {({ RichTextEditorField }) => (
                                        <Grid.Col>
                                          <RichTextEditorField label='Section Description' />
                                        </Grid.Col>
                                      )}
                                    </AppField>
                                  </Grid>
                                </Accordion.Content>
                              </Accordion.Item>
                            ))}
                          </AccordionField>
                        </Grid.Col>
                      )}
                    </>
                  )}
                </AppField>
              </>
            )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default DetailsStep
