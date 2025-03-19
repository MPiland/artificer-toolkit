import { use, useState } from 'react'
import Modal from '../../Modal/Modal'
import { useLocation, useNavigate } from 'react-router-dom'
import { startCase } from 'lodash'
import Dropdown from '../../Dropdown/Dropdown'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import { FormContext } from '../../Form/FormContext'
import { FormDataType, UpdateState } from '../../../types/form'
import Grid from '../../Grid/Grid'

const Copy = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [selection, setSelection] = useState<any>()
  const { updateFormData, fullReset } = use(FormContext)

  const form = location?.pathname?.split('/')[1]

  const data = location?.state?.items

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
          <Grid>
            <Grid.Item colSpan={8}>
              <Dropdown
                options={data}
                onChange={handleSelect}
                name='label'
                value={selection}
                className={sprinkles({ flex: '1', me: 'space-3' })}
                errorMsg='Select a spell to copy'
                boundary='app'
              />
            </Grid.Item>
            <Grid.Item colSpan={2}>
              <Button color='primary' onClick={handleCopy}>
                Copy
              </Button>
            </Grid.Item>
          </Grid>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Copy
