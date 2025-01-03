import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { Class, ClassesEnum } from '../../../../amplify/API'

import { Attributes } from '../../../types/enums'
import { UpdateState } from '../../../types/form'

const Resource = ({ formData, updateFormData }: { formData: Class; updateFormData: (arg: UpdateState<Class>) => void }) => {

  const { data: system } = useGetSystemQuery()

  return (
    <Collapse>
      <Collapse.Header startOpened={formData.id == null} title='Resource Attributes' />
      <Collapse.Body>
        <Row>
          <Input
            name='resource.value'
            label='Resource Name'
            autoComplete='off'
            value={formData?.resource.value}
            required={true}
            onChange={updateFormData}
          />
          <Input
            name='resource.levelAvailable'
            label='Level Available'
            autoComplete='off'
            value={formData?.resource?.levelAvailable}
            required={true}
            validation='num'
            errorMsg='Must contain whole numbers only'
            onChange={updateFormData}
          />
          <Dropdown
            name='resource.method'
            label='Resource Point Amount'
            value={formData?.resource?.method}
            options={system.charges.limits.filter((limit) => limit?.classes.includes(ClassesEnum.resources))}
            required={true}
            onChange={updateFormData}
          />
          {formData?.resource?.method === Attributes.ability && (
            <Dropdown
              name='resource.charges.ability'
              label='Ability'
              value={formData?.resource?.charges?.ability}
              options={system.abilities}
              required={true}
              onChange={updateFormData}
            />
          )}
          {formData?.resource?.method === Attributes.setAmount && (
            <Input
              name='resource.charges.setAmount'
              label='Set Value'
              validation='num'
              errorMsg='Must contain whole numbers only'
              value={formData?.resource?.charges?.setAmount}
              required={true}
              onChange={updateFormData}
              autoComplete='off'
            />
          )}
          <Dropdown
            name='resource.charges.reset'
            label='Resource Reset Option'
            value={formData?.resource?.charges?.reset}
            options={system.charges.resets}
            required={true}
            onChange={updateFormData}
          />
        </Row>
        <RichTextEditor
          name={'resource.desc'}
          value={formData?.resource?.desc}
          label={'Description'}
          onChange={updateFormData}
        />
      </Collapse.Body>
    </Collapse>
  )
}

export default Resource
