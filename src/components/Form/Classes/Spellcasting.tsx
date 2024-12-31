import Collapse from '../../Collapse/Collapse'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import Row from '../../Row/Row'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { Class, ClassesEnum } from '../../../../amplify/API'
import { Attributes, Measurement } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'

const Spellcasting = ({ formData, updateFormData }: { formData: Class; updateFormData: (arg: UpdateState<Class>) => void }) => {
  const { context } = use(FormContext)

  const { data: system } = useGetSystemQuery()

  return (
    <Collapse>
      <Collapse.Header startOpened={context.type === 'new'} title={'Spellcaster Attributes'} />
      <Collapse.Body>
        <Row>
          <Dropdown
            name='spellcasting.ability'
            label='Spellcasting Ability'
            required={true}
            value={formData?.spellcasting?.ability}
            options={system.abilities}
            onChange={updateFormData}
          />
          <Dropdown
            name='spellcasting.attributes'
            label='Spell Casting Attributes'
            multiSelect={true}
            value={formData?.spellcasting?.attributes}
            options={system.attributes.filter((attributes) => attributes?.classes.includes(ClassesEnum.spellcaster))}
            onChange={updateFormData}
          />
          {formData?.spellcasting?.attributes?.some((attribute) => attribute === 'magicName') && (
            <Input
              name='spellcasting.magicName'
              autoComplete='off'
              label='Magic Type Name'
              required={true}
              value={formData?.spellcasting?.magicName}
              onChange={updateFormData}
            />
          )}
          {formData?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.preparesSpells) && (
            <Dropdown
              name='spellcasting.prepareLimit.methods'
              label='Prepare Limit Method'
              multiSelect={true}
              value={formData?.spellcasting?.prepareLimit.methods}
              options={system.attributes.filter((attributes) => attributes?.classes.includes(ClassesEnum.prepareLimit))}
              onChange={updateFormData}
            />
          )}
          {formData?.spellcasting?.prepareLimit.methods?.some((method) => method === Attributes.classLevel) && (
            <>
              <Dropdown
                name='spellcasting.prepareLimit.level.measurement'
                label='Level Measurement'
                value={formData?.spellcasting?.prepareLimit.level?.measurement}
                options={system.rules.measurements.amount}
                onChange={updateFormData}
              />
              {formData?.spellcasting?.prepareLimit.level?.measurement === Measurement.half && (
                <Dropdown
                  name='spellcasting.prepareLimit.level.rounding'
                  label='Level Rounding'
                  value={formData?.spellcasting?.prepareLimit?.level?.rounding}
                  options={system.rules.measurements.rounding}
                  onChange={updateFormData}
                />
              )}
            </>
          )}
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
          <Dropdown
            name='spellcasting.charges.reset'
            label='Spellslot Reset Option'
            value={formData?.spellcasting?.charges?.reset}
            options={system.charges.resets.filter((reset) => reset?.classes.includes(ClassesEnum.spellcaster))}
            required={true}
            onChange={updateFormData}
          />
        </Row>
      </Collapse.Body>
    </Collapse>
  )
}

export default Spellcasting
