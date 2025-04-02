import { use, useMemo, useState } from 'react'
import Modal from '../Modal/Modal'
import { startCase } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { FeatureDataType, FormDataType, UpdateState } from '../../types/form'
import Grid from '../Grid/Grid'
import { ModalContext } from '../Modal/ModalContext'
import { Class, Equipment, Race } from '../../../amplify/gql/types'

type Selection = {
  filter?: Race['id'] | Class['id'] | Equipment['id']
  filterBy?: keyof Filters
  option?: FeatureDataType['id'] | FormDataType['id']
}

type Filters = {
  races?: Race[]
  classes?: Class[]
  equipment?: Equipment[]
}

const Copy = () => {
  const { modalProps, hideModal } = use(ModalContext)
  const [selection, setSelection] = useState<Selection>()

  const form = modalProps.form
  const data: FormDataType[] | FeatureDataType[] = modalProps.data
  const filters: Filters = modalProps.filters

  const handleSelect = (target: UpdateState<FormDataType>) => {
    if (target.type === 'update') {
      setSelection((prev) => ({ ...prev, option: target.value }))
    }
    if (target.type === 'remove') {
      setSelection((prev) => ({ ...prev, option: undefined }))
    }
  }

  const handleFilterCategory = (target: UpdateState<FormDataType>) => {
    if (target.type === 'update') {
      setSelection((prev) => ({ ...prev, filterBy: target.value }))
    }
    if (target.type === 'remove') {
      setSelection((prev) => ({ ...prev, filterBy: undefined }))
    }
  }

  const handleFilterOption = (target: UpdateState<FormDataType>) => {
    if (target.type === 'update') {
      setSelection((prev) => ({ ...prev, filter: target.value }))
    }
    if (target.type === 'remove') {
      setSelection((prev) => ({ ...prev, filter: undefined }))
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
      modalProps.onCopy(selection?.option)
      hideModal()
    }
  }

  const filterOptions: (keyof Filters)[] = Object.keys(filters) as (keyof Filters)[]

  const filterData = useMemo(() => {
    const dataArray =
      selection?.filterBy ?
        filters[selection?.filterBy as keyof Filters]?.find((item) => item.id === selection?.filter)?.features || []
      : data
    return dataArray
      ?.filter((item) => item.label != null && item.value != null)
      ?.map((item) => ({
        id: item.id,
        label: item.label || String(item.id),
        value: item.value || item.id,
      }))
  }, [data, filters, selection])

  return (
    <Modal.Dialogue size='sm'>
      <Modal.Header title={`Copy ${startCase(form)}`} onClose={hideModal} />
      <Modal.Content>
        <Grid>
          {filters && (
            <>
              <Grid.Item colSpan={6}>
                <Dropdown
                  options={filterOptions.map((key) => ({
                    label: key,
                    value: key,
                    id: key,
                  }))}
                  onChange={handleFilterCategory}
                  name='label'
                  value={selection?.option}
                  errorMsg='Must choose an option to copy'
                  boundary='app'
                />
              </Grid.Item>
              {selection?.filterBy && (
                <Grid.Item colSpan={6}>
                  <Dropdown
                    options={filterData}
                    onChange={handleFilterOption}
                    name='label'
                    value={selection?.option}
                    errorMsg='Must choose an option to copy'
                    boundary='app'
                  />
                </Grid.Item>
              )}
            </>
          )}
          <Grid.Item colSpan={8}>
            <Dropdown
              options={filterData}
              onChange={handleSelect}
              name='label'
              value={selection?.option}
              className={sprinkles({ flex: '1', me: 'space-3' })}
              errorMsg='Must choose an option to copy'
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
  )
}

export default Copy
