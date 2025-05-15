import Collapsible from '@/components/Collapsible'
import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import { Attributes, Measurements, Classes } from '@/enums'
import { Grid } from '@mantine/core'
import { useEnumChecks, useSystemData } from '@/hooks'
import type { OnChange, Class } from '@/types'

const Spellcasting = ({
  formStore: { data, updateField, removeField },
}: {
  formStore: {
    data: Class
    updateField: OnChange<Class>['updateField']
    removeField: OnChange<Class>['removeField']
  }
}) => {
  const { charges, abilities, rules, attributes } = useSystemData()

  const { magicName, preparesSpells } = useEnumChecks({ data })

  return (
    <Grid.Col>
      <Collapsible defaultOpen={data.id == null}>
        <Collapsible.Trigger title={'Spellcaster Attributes'} />
        <Collapsible.Content>
          <Grid>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellcasting.ability'
                label='Spellcasting Ability'
                required={true}
                value={data?.spellcasting?.ability}
                options={abilities}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellcasting.attributes'
                label='Spell Casting Attributes'
                multiSelect={true}
                value={data?.spellcasting?.attributes}
                options={attributes.filter((attributes) => attributes?.classes?.includes(Classes.SPELLCASTER))}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            {magicName && (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  name='spellcasting.magicName'
                  autoComplete='off'
                  label='Magic Type Name'
                  required={true}
                  value={data?.spellcasting?.magicName}
                  onChange={{ updateField }}
                />
              </Grid.Col>
            )}
            {preparesSpells && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='spellcasting.prepareLimit.methods'
                    label='Prepare Limit Method'
                    multiSelect={true}
                    value={data?.spellcasting?.prepareLimit?.methods}
                    options={attributes.filter(
                      (attributes) =>
                        attributes?.classes?.length && attributes?.classes?.includes(Classes.PREPARE_LIMIT)
                    )}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
                {data?.spellcasting?.prepareLimit?.methods?.some((method) => method === Attributes.CLASS_LEVEL) && (
                  <>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='spellcasting.prepareLimit.level.measurement'
                        label='Level Measurement'
                        value={data?.spellcasting?.prepareLimit?.level?.measurement}
                        options={rules.measurements.amount}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Col>
                    {data?.spellcasting?.prepareLimit?.level?.measurement === Measurements.HALF && (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <Dropdown
                          name='spellcasting.prepareLimit.level.rounding'
                          label='Level Rounding'
                          value={data?.spellcasting?.prepareLimit?.level?.rounding}
                          options={rules.measurements.rounding}
                          onChange={{ updateField, removeField }}
                        />
                      </Grid.Col>
                    )}
                  </>
                )}
              </>
            )}
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='spellcasting.maxSpellLevel'
                autoComplete='off'
                label='Max Spell Level'
                required={true}
                value={data?.spellcasting?.maxSpellLevel}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={{ updateField }}
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellcasting.charges.reset'
                label='Spellslot Reset Option'
                value={data?.spellcasting?.charges?.reset}
                options={charges.resets.filter(
                  (reset) => reset?.classes?.length && reset?.classes?.includes(Classes.SPELLCASTER)
                )}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}

export default Spellcasting
