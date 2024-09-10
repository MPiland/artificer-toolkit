import { useState } from 'react'
import Modal from '../Modal/Modal'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { set, startCase } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Divider from '../Divider/Divider'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Spinner from '../Spinner/Spinner'
import { useForm } from '../../hooks/UseForm'
import { useGetSystemsQuery } from '../../features/systems/systemsApi'
import { ContextType } from '../../utils/types'
import { useIsFetching } from '@tanstack/react-query'

const Create = () => {
  const { type } = useParams()
  const { setFormState, setOldFormState, setContext, stateReset } = useForm()
  const navigate = useNavigate()
  const location = useLocation()
  const isLoading = useIsFetching() > 0

  const [selection, setSelection] = useState<any>()

  const { data: builders } = useGetSystemsQuery()

  const form: ContextType['title'] = location.state.form

  const handleSelect = ({ target }: any) => {
    setSelection(target.value)
  }

  const handleCopy = async () => {
    try {
      await stateReset()
    } catch {
      console.log('error resetting state')
    } finally {
      setContext({ title: form, type: 'new' as string })
      const item = location.state.items.find((item: any) => item._id === selection._id)
      const formClone = JSON.parse(JSON.stringify(item))
      delete formClone.value
      delete formClone.name
      delete formClone._id
      delete formClone.id
      setFormState({ type: 'reset', target: { value: formClone } })
      setOldFormState(formClone)

      const dropdown = document.getElementById('create_dropdown')
      if (dropdown?.getAttribute('data-atapp-options') === 'false') {
        dropdown.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: true,
          })
        )
      } else {
        navigate(`/${form}/new`)
      }
    }
  }

  const handleNew = async () => {
    try {
      await stateReset()
    } catch {
      console.log('error resetting state')
    } finally {
      const stateObject: any = {}
      if (form === 'classes' || form === 'races') {
        const category = builders?.[form]?.category.find(
          (category: any) => category.name === location.state.defaultCategory
        )
        set(stateObject, 'category', category)
      }
      if (form === 'characters') {
        const abilityScores: any[] = []
        builders.abilities.type
          .filter((ability: any) => ability.name !== 'spellAbility')
          .forEach((ability: any) =>
            abilityScores.push({
              name: ability.name,
              value: ability.value,
              _id: ability._id,
              baseScore: 0,
              calculatedScore: 0,
              raceScore: 0,
              classScore: 0,
            })
          )
        set(stateObject, 'abilities.scores', abilityScores)
      }
      setContext({ title: form, type: 'new' as string })
      setFormState({
        type: 'reset',
        target: { value: stateObject },
      })
      setOldFormState(stateObject)
      navigate(`/${form}/new`)
    }
  }

  return isLoading ? (
    <Spinner />
  ) : (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title={`Create ${startCase(type)}`} />
        <Modal.Content>
          {location.state.items?.length > 0 && (
            <>
              <Group directionVariant='row' alignItemsVariant='end'>
                <Dropdown
                  options={location.state.items}
                  label={`Copy Existing ${startCase(type)}`}
                  onChange={handleSelect}
                  name='copy'
                  value={selection}
                  className={sprinkles({ flex: '1', me: 'space-3' })}
                  id='create_dropdown'
                  errorMsg='Select a spell to copy'
                />
                <Button color='primary' onClick={handleCopy}>
                  Go
                </Button>
              </Group>
              <Divider label='OR' />
            </>
          )}
          <Button color='update' onClick={handleNew}>
            Create From Scratch
          </Button>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Create
