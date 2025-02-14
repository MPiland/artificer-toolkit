import { use, useState } from 'react'
import Modal from '../../Modal/Modal'
import { useLocation, useNavigate } from 'react-router-dom'
import { startCase } from 'lodash'
import Dropdown from '../../Dropdown/Dropdown'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import { FormContext } from '../../Form/FormContext'
import { FormDataType, UpdateState } from '../../../types/form'

const Copy = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [selection, setSelection] = useState<any>()
  const { updateFormData, fullReset } = use(FormContext)

  const form = location?.pathname?.split('/')[1]

  const handleSelect = (target: UpdateState<FormDataType>) => {
    if (target.type === 'update') {
      setSelection(target.value)
    }
  }

  const handleCopy = () => {
    const dropdown = document.getElementById('create_dropdown')
    if (dropdown?.getAttribute('data-atapp-options') === 'false') {
      dropdown.dispatchEvent(
        new CustomEvent('setErrorState', {
          detail: true,
        })
      )
    } else {
      const item = location.state.items.find((item: FormDataType) => item.id === selection)
      console.log({ item })
      const data: FormDataType = JSON.parse(JSON.stringify(item))
      data.id = null
      if (data.__typename !== 'Character') {
        data.masterId = null
      }
      data.value = null
      data.label = null
      fullReset()
      updateFormData({
        type: 'reset',
        value: data,
      })
      updateFormData({
        type: 'initialReset',
        value: data,
      })
      navigate('../new')
    }
  }

  return (
    <Modal>
      <Modal.Dialogue size='sm'>
        <Modal.Header title={`Copy ${startCase(form)}`} />
        <Modal.Content>
          <Group directionVariant='row' alignItemsVariant='end'>
            <Dropdown
              options={location.state.items}
              onChange={handleSelect}
              name='label'
              value={selection}
              className={sprinkles({ flex: '1', me: 'space-3' })}
              id='create_dropdown'
              errorMsg='Select a spell to copy'
            />
            <Button color='primary' onClick={handleCopy}>
              Copy
            </Button>
          </Group>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Copy
