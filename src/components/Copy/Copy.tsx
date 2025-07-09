import { use, useMemo, useState } from 'react'
import { startCase } from 'lodash'
import Dropdown from '@/components/Dropdown'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import type {
  FeatureFormDataType,
  FormDataType,
  EquipmentListItem,
  ClassListItem,
  RaceListItem,
  BackgroundListItem,
  FeatListItem,
} from '@/types'
import Modal, { ModalContext, type CopyModalProps } from '@/components/Modal'
import { Grid } from '@mantine/core'
import type { DeepKeys } from '@tanstack/react-form'

type ValidFilterBy = 'races' | 'classes' | 'equipment' | 'backgrounds' | 'feats'

type DataItem = {
  id: string
  label: string
  value: string
  raceIds?: string[]
  classIds?: string[]
  equipmentIds?: string[]
  featIds?: string[]
  backgroundIds?: string[]
}

type Selection = {
  filter?:
    | RaceListItem['id']
    | ClassListItem['id']
    | EquipmentListItem['id']
    | BackgroundListItem['id']
    | FeatListItem['id']
  filterBy?: ValidFilterBy
  option?: FeatureFormDataType['id'] | FormDataType['id']
}

const Copy = () => {
  const { modalProps, hideModal } = use(ModalContext)
  const [selection, setSelection] = useState<Selection>()

  const { form, data, filters, onCopy } = modalProps as CopyModalProps

  const handleOnChange = (value: string | string[] | null | undefined, path: DeepKeys<Selection>) => {
    if (value != null) {
      return setSelection((prev) => ({ ...prev, [path]: value }))
    }
    return setSelection((prev) => ({ ...prev, [path]: undefined }))
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
      onCopy(selection?.option)
      hideModal()
    }
  }

  const filterBy = useMemo(() => selection?.filterBy, [selection])
  const filterId = useMemo(() => selection?.filter, [selection])

  const filterByOptions = useMemo(() => {
    return (filters ? Object.keys(filters) : []) as (keyof NonNullable<CopyModalProps['filters']>)[]
  }, [filters])

  const filterOptions = useMemo(() => (filterBy && filters?.[filterBy]) || [], [filters, filterBy])

  const filterMap: Record<
    ValidFilterBy,
    keyof Pick<DataItem, 'raceIds' | 'classIds' | 'equipmentIds' | 'backgroundIds' | 'featIds'>
  > = useMemo(
    () => ({
      races: 'raceIds',
      classes: 'classIds',
      equipment: 'equipmentIds',
      backgrounds: 'backgroundIds',
      feats: 'featIds',
    }),
    []
  )

  const copyData = useMemo(
    () =>
      data?.length ?
        data.filter((item) => {
          if (!filterBy) return true
          const key = filterMap[filterBy as ValidFilterBy] // filterBy is now strictly checked
          const list = item[key]
          if (!Array.isArray(list)) return false
          return filterId ? list.includes(filterId) : list.length > 0
        })
      : [],
    [data, filterBy, filterId, filterMap]
  )

  return (
    <Modal.Dialogue size='sm'>
      <Modal.Header title={`Copy ${startCase(form)}`} onClose={hideModal} />
      <Modal.Content>
        <Grid>
          {filters && (
            <>
              <Grid.Col span={6}>
                <Dropdown
                  options={filterByOptions.map((key) => ({
                    label: key,
                    value: key,
                    id: key,
                  }))}
                  name='filterBy'
                  value={selection?.filterBy}
                  errorMsg='Must choose an option to copy'
                  onChange={(value) => handleOnChange(value, 'filterBy')}
                />
              </Grid.Col>
              {selection?.filterBy && (
                <Grid.Col span={6}>
                  <Dropdown
                    options={filterOptions}
                    name='filter'
                    value={selection?.filter}
                    errorMsg='Must choose an option to copy'
                    onChange={(value) => handleOnChange(value, 'filter')}
                  />
                </Grid.Col>
              )}
            </>
          )}
          <Grid.Col span={8}>
            <Dropdown
              options={copyData}
              name='option'
              value={selection?.option}
              className={sprinkles({ flex: '1', me: 'space-3' })}
              errorMsg='Must choose an option to copy'
              onChange={(value) => handleOnChange(value, 'option')}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button onClick={handleCopy}>Copy</Button>
          </Grid.Col>
        </Grid>
      </Modal.Content>
    </Modal.Dialogue>
  )
}

export default Copy
