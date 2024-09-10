import { useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import Row from '../../Row/Row'
import { useForm } from '../../../hooks/UseForm'
import { useGetSystemsQuery } from '../../../features/systems/systemsApi'

const Spellcasting = () => {
  const { formState, setFormState, context } = useForm()

  const { data: builders } = useGetSystemsQuery()

  // Remove Spellcasting data
  useEffect(() => {
    if (
      !formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') &&
      formState.spellcasting != null
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'spellcasting' },
      })
      formState.levelAttribute?.map((_: any, index: number) => {
        setFormState({
          type: 'removed',
          target: { name: `levelAttribute.${index}.spellSlots` },
        })
      })
    }
  }, [formState?.attribute, formState?.spellcasting, formState?.levelAttribute, setFormState])

  return (
    formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') && (
      <Collapse>
        <Collapse.Header startOpened={context.type === 'new'} title={'Spellcaster Attributes'} />
        <Collapse.Body>
          <Row>
            <Dropdown
              name='spellcasting.ability.type'
              label='Spellcasting Ability'
              required={true}
              value={formState?.spellcasting?.ability?.type}
              options={builders.abilities.type}
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.attribute'
              label='Spell Casting Attributes'
              multiSelect={true}
              value={formState?.spellcasting?.attribute}
              options={builders.classes.spells.attribute}
              onChange={setFormState}
            />
            {formState?.spellcasting?.attribute?.some((attributeItem: any) => attributeItem.name === 'magicName') && (
              <Input
                name='spellcasting.magicName'
                autoComplete='off'
                label='Magic Type Name'
                required={true}
                value={formState?.spellcasting?.magicName}
                onChange={setFormState}
              />
            )}
            {formState?.spellcasting?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'preparesSpells'
            ) && (
              <Dropdown
                name='spellcasting.prepareLimitMethod'
                label='Prepare Limit Method'
                multiSelect={true}
                value={formState?.spellcasting?.prepareLimitMethod}
                options={builders.classes.spells.prepareLimit}
                onChange={setFormState}
              />
            )}
            {formState?.spellcasting?.prepareLimitMethod?.some(
              (methodItem: any) => methodItem.name === 'classLevel'
            ) && (
              <>
                <Dropdown
                  name='spellcasting.prepareLimitLevel.measurement'
                  label='Level Measurement'
                  value={formState?.spellcasting?.prepareLimitLevel?.measurement}
                  options={builders.system.rules.measurement}
                  onChange={setFormState}
                />
                {formState?.spellcasting?.prepareLimitLevel?.measurement?.name === 'half' && (
                  <Dropdown
                    name='spellcasting.prepareLimit.level.rounding'
                    label='Level Rounding'
                    value={formState?.spellcasting?.prepareLimit?.level?.rounding}
                    options={builders.system.rules.rounding}
                    onChange={setFormState}
                  />
                )}
              </>
            )}
            <Input
              name='spellcasting.maxSpellLevel'
              autoComplete='off'
              label='Max Spell Level'
              required={true}
              value={formState?.spellcasting?.maxSpellLevel}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
            <Dropdown
              name='spellcasting.charge.reset'
              label='Spellslot Reset Option'
              value={formState?.spellcasting?.charge?.reset}
              options={builders.features.charge.reset}
              required={true}
              onChange={setFormState}
            />
          </Row>
        </Collapse.Body>
      </Collapse>
    )
  )
}

export default Spellcasting
