import { useEffect } from 'react'
import { useForm } from '../../../hooks/UseForm'
import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'

const Resource = () => {
  const { formState, setFormState, context } = useForm()

  const { data: builders } = useGetBuildersQuery()

  // Remove Resource if not needed
  useEffect(() => {
    if (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') && formState.resource) {
      setFormState({ type: 'removed', target: { name: 'resource' } })
    }
  }, [formState.attribute, formState.resource, setFormState])

  return (
    formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') && (
      <Collapse>
        <Collapse.Header startOpened={context.type === 'new'} title='Resource Attributes' />
        <Collapse.Body>
          <Row>
            <Input
              name='resource.value'
              label='Resource Name'
              autoComplete='off'
              value={formState?.resource?.value}
              required={true}
              onChange={setFormState}
            />
            <Input
              name='resource.levelAvailable'
              label='Level Available'
              autoComplete='off'
              value={formState?.resource?.levelAvailable}
              required={true}
              validation='num'
              errorMsg='Must contain whole numbers only'
              onChange={setFormState}
            />
            <Dropdown
              name='resource.method'
              label='Resource Point Amount'
              value={formState?.resource?.method}
              options={builders.classes.resource.method}
              required={true}
              onChange={setFormState}
            />
            {formState?.resource?.method?.name === 'ability' && (
              <Dropdown
                name='resource.charge.ability.type'
                label='Ability'
                value={formState?.resource?.charge?.ability?.type}
                options={builders.abilities.type}
                required={true}
                onChange={setFormState}
              />
            )}
            {formState?.resource?.method?.name === 'setValue' && (
              <Input
                name='resource.charge.setValue'
                label='Set Value'
                value={formState?.resource?.charge?.setValue}
                required={true}
                onChange={setFormState}
                autoComplete='off'
              />
            )}
            <Dropdown
              name='resource.charge.reset'
              label='Resource Reset Option'
              value={formState?.resource?.charge?.reset}
              options={builders.features.charge.reset}
              required={true}
              onChange={setFormState}
            />
          </Row>
          <RichTextEditor
            name={'resource.desc'}
            value={formState?.resource?.desc}
            label={'Description'}
            onChange={setFormState}
          />
        </Collapse.Body>
      </Collapse>
    )
  )
}

export default Resource
