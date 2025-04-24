import { use, useMemo, useState } from 'react'
import { startCase } from 'lodash'
import Dropdown from '@/components/Dropdown'
import Button from '@/components/Button'
import { sprinkles } from '@/css/sprinkles.css'
import type { FeatureDataType, FormDataType, Equipment, Class, Race, DeepKeyOf } from '@/types'
import Grid from '@/components/Grid'
import Modal, { ModalContext } from '@/components/Modal'

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

  const handleOnChange = {
    updateField: ({ value, path }: { value: any; path: DeepKeyOf<typeof selection> }) => {
      return setSelection((prev) => ({ ...prev, [path]: value }))
    },
    removeField: ({ path }: { path: DeepKeyOf<typeof selection> }) => {
      return setSelection((prev) => ({ ...prev, [path]: undefined }))
    },
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

  const filterByOptions: (keyof Filters)[] = Object.keys(filters) as (keyof Filters)[]

  const filterOptions = filters[selection?.filterBy as keyof Filters] || []

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
                <Dropdown<typeof selection>
                  options={filterByOptions.map((key) => ({
                    label: key,
                    value: key,
                    id: key,
                  }))}
                  name='filterBy'
                  value={selection?.filterBy}
                  errorMsg='Must choose an option to copy'
                  boundary='app'
                  onChange={handleOnChange}
                />
              </Grid.Item>
              {selection?.filterBy && (
                <Grid.Item colSpan={6}>
                  <Dropdown<typeof selection>
                    options={filterOptions}
                    name='filter'
                    value={selection?.filter}
                    errorMsg='Must choose an option to copy'
                    boundary='app'
                    onChange={handleOnChange}
                  />
                </Grid.Item>
              )}
            </>
          )}
          <Grid.Item colSpan={8}>
            <Dropdown<typeof selection>
              options={filterData}
              name='option'
              value={selection?.option}
              className={sprinkles({ flex: '1', me: 'space-3' })}
              errorMsg='Must choose an option to copy'
              boundary='app'
              onChange={handleOnChange}
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
