import { useGetRacesQuery } from '../../features/races/racesApi'
import { useGetClassesQuery } from '../../features/classes/classesApi'
import { useGetEquipmentQuery } from '../../features/equipment/equipmentApi'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal/Modal'
import { useEffect, useReducer, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Row from '../Row/Row'
import Dropdown from '../Dropdown/Dropdown'
import { DropdownOptionType } from '../../utils/types'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { useForm } from '../../hooks/UseForm'

const Copy = () => {
  const { formState, setFormState } = useForm()
  const navigate = useNavigate()

  const [selection, setSelection] = useReducer(formReducer, {})

  const [features, setFeatures] = useState<any[]>([])

  const [selectedFeature, setSelectedFeature] = useState<any>()

  const { data: races } = useGetRacesQuery() as { data: any[] }
  const { data: classes } = useGetClassesQuery() as { data: any[] }
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  useEffect(() => {
    if (races && classes && items && !features) {
      const racesFeatures: any[] = races.flatMap((race: any) => race.feature.map((featureItem: any) => featureItem))
      const classesFeatures: any[] = classes.flatMap((uClass: any) =>
        uClass.feature.map((featureItem: any) => featureItem)
      )
      const itemsFeatures: any[] = items.flatMap((item: any) =>
        item.feature ? item.feature.map((featureItem: any) => featureItem) : []
      )

      const featureArray: any[] = ([] as any[]).concat(racesFeatures, classesFeatures, itemsFeatures)

      setFeatures(featureArray)
    }

    if (selection.filter) {
      if (selection.filterBy?.name === 'races') {
        const raceFeature: any[] = (races as any[])?.find((race: any) => race._id === selection.filter._id).features

        setFeatures(raceFeature)
      }
      if (selection.filterBy?.name === 'items') {
        const itemFeature: any[] = (items as any[])?.find((race: any) => race._id === selection.filter._id).features

        setFeatures(itemFeature)
      }
      if (selection.filterBy?.name === 'classes') {
        const classFeature: any[] = (classes as any[])?.find((race: any) => race._id === selection.filter._id).features

        setFeatures(classFeature)
      }
    }

    if (selection.feature) {
      const feature = features?.find((feature: any) => feature._id === selection.feature._id)

      setSelectedFeature(feature)
    }
  }, [races, classes, items, selection.filter, features, selection.filterBy?.name, selection.feature])

  const handleSelect = () => {
    const featureIndex = formState.features?.length ?? 0
    setFormState({
      target: {
        name: `features.${featureIndex}`,
        value: selectedFeature,
      },
    })
    navigate(-1)
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title='Copy Feature' />
        <Modal.Content>
          <Row cols={{ base: 2, lg: 2, md: 2 }}>
            <Dropdown
              options={[
                {
                  name: 'races',
                  value: 'Races',
                  _id: null,
                },
                {
                  name: 'classes',
                  value: 'Classes',
                  _id: null,
                },
                {
                  name: 'items',
                  value: 'Items',
                  _id: null,
                },
              ]}
              label='Filter by...'
              onChange={setSelection}
              name='filterBy'
              value={selection?.filterBy}
            />
            {selection?.filterBy?.name === 'races' && (
              <Dropdown
                options={races as unknown as DropdownOptionType[]}
                label='Race'
                onChange={setSelection}
                name='filter'
                value={selection.filter}
              />
            )}
            {selection?.filterBy?.name === 'classes' && (
              <Dropdown
                options={classes as unknown as DropdownOptionType[]}
                label='Class'
                onChange={setSelection}
                name='filter'
                value={selection.filter}
              />
            )}
            {selection?.filterBy?.name === 'items' && (
              <Dropdown
                options={items as unknown as DropdownOptionType[]}
                label='Item'
                onChange={setSelection}
                name='filter'
                value={selection.filter}
              />
            )}
            <Dropdown
              label='Feature'
              onChange={setSelection}
              name='feature'
              value={selection.feature}
              options={features
                ?.filter((featureItem: any) =>
                  selection.race
                    ? selection.race.feature?.some((raceFeature: any) => raceFeature._id === featureItem._id)
                    : featureItem
                )
                .filter((featureItem: any) =>
                  selection.class
                    ? selection.class.feature?.some((raceFeature: any) => raceFeature._id === featureItem._id)
                    : featureItem
                )}
            />
          </Row>
          <Button
            color='primary'
            onClick={() => handleSelect()}
            className={sprinkles({ mt: 'space-3', width: 'size-full' })}
            disabled={!selection.feature}
          >
            Copy
          </Button>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Copy
