import Collapse from '../../Collapse/Collapse'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { Class, ClassesEnum } from '../../../../amplify/gql/types'
import { Attributes, Measurement } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import Grid from '../../Grid/Grid'
import { useEnumChecks } from '../../../hooks/useEnumChecks'

const Spellcasting = ({
  formData,
  updateFormData,
}: {
  formData: Class
  updateFormData: (arg: UpdateState<Class>) => void
}) => {
  const { data: system } = useGetSystemQuery()
  const { magicName, preparesSpells } = useEnumChecks({ data: formData })

  return (
    <Collapse>
      <Collapse.Header startOpened={formData.id == null} title={'Spellcaster Attributes'} />
      <Collapse.Body>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='spellcasting.ability'
              label='Spellcasting Ability'
              required={true}
              value={formData?.spellcasting?.ability}
              options={system.abilities}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='spellcasting.attributes'
              label='Spell Casting Attributes'
              multiSelect={true}
              value={formData?.spellcasting?.attributes}
              options={system.attributes.filter((attributes) => attributes?.classes?.includes(ClassesEnum.spellcaster))}
              onChange={updateFormData}
            />
          </Grid.Item>
          {magicName && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='spellcasting.magicName'
                autoComplete='off'
                label='Magic Type Name'
                required={true}
                value={formData?.spellcasting?.magicName}
                onChange={updateFormData}
              />
            </Grid.Item>
          )}
          {preparesSpells && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='spellcasting.prepareLimit.methods'
                  label='Prepare Limit Method'
                  multiSelect={true}
                  value={formData?.spellcasting?.prepareLimit?.methods}
                  options={system.attributes.filter(
                    (attributes) =>
                      attributes?.classes?.length > 0 && attributes?.classes?.includes(ClassesEnum.prepareLimit)
                  )}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {formData?.spellcasting?.prepareLimit?.methods?.some((method) => method === Attributes.classLevel) && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='spellcasting.prepareLimit.level.measurement'
                      label='Level Measurement'
                      value={formData?.spellcasting?.prepareLimit?.level?.measurement}
                      options={system.rules.measurements.amount}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                  {formData?.spellcasting?.prepareLimit?.level?.measurement === Measurement.half && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='spellcasting.prepareLimit.level.rounding'
                        label='Level Rounding'
                        value={formData?.spellcasting?.prepareLimit?.level?.rounding}
                        options={system.rules.measurements.rounding}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                  )}
                </>
              )}
            </>
          )}
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              name='spellcasting.maxSpellLevel'
              autoComplete='off'
              label='Max Spell Level'
              required={true}
              value={formData?.spellcasting?.maxSpellLevel}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='spellcasting.charges.reset'
              label='Spellslot Reset Option'
              value={formData?.spellcasting?.charges?.reset}
              options={system.charges.resets.filter(
                (reset) => reset?.classes?.length > 0 && reset?.classes?.includes(ClassesEnum.spellcaster)
              )}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
        </Grid>
      </Collapse.Body>
    </Collapse>
  )
}

export default Spellcasting
