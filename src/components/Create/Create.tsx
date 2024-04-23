import { useState } from 'react'
import Modal from '../Modal/Modal'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { startCase } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Divider from '../Divider/Divider'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'

const Create = () => {
  const { type } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isLoading = useIsLoading()

  const [selection, setSelection] = useState<any>()

  const handleSelect = ({ target }: any) => {
    setSelection(target.value)
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
      const item = location.state.items.find((item: any) => item._id === selection._id)
      navigate(`/${location.state.form}/new`, {
        state: {
          item: item,
          formType: 'new',
        },
      })
    }
  }

  const handleNew = () => {
    navigate(`/${location.state.form}/new`, {
      state: {
        defaultCategory: location.state.defaultCategory,
        formType: 'new',
      },
    })
  }

  return isLoading ? (
    <Spinner />
  ) : (
    <>
      <Modal.Header title={`Create ${startCase(type)}`} />
      <Modal.Body>
        <Group directionVariant='row' alignItemsVariant='end'>
          <Dropdown
            options={location.state.items}
            label={`Copy Existing ${startCase(type)}`}
            onChange={handleSelect}
            name='copy'
            value={selection}
            className={sprinkles({ flex: '1', me: 'size-3' })}
            id='create_dropdown'
            errorMsg='Select a spell to copy'
          />
          <Button variant='primary' onClick={handleCopy}>
            Go
          </Button>
        </Group>
        <Divider label='OR' />
        <Button variant='update' onClick={handleNew}>
          Create From Scratch
        </Button>
      </Modal.Body>
    </>
  )
}

export default Create
