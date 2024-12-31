import { useListRacesQuery } from '../../features/races/racesApi'
import { useListClassesQuery } from '../../features/classes/classesApi'
import { useListEquipmentQuery } from '../../features/equipment/equipmentApi'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal/Modal'
import { useEffect, useState, use } from 'react'
import Row from '../Row/Row'
import Dropdown from '../Dropdown/Dropdown'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { FormContext } from '../Form/FormContext'
import { Class, Equipment, Feature, Race } from '../../../amplify/API'
import { FormDataType, UpdateState } from '../../types/form'

type CopySelection = {
  filter: Race['id'] | Class['id'] | Equipment['id']
  filterBy: string
  feature: Feature['id']
}

const Copy = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: FormDataType
    updateFormData: (arg: UpdateState<FormDataType>) => void
  }
  const navigate = useNavigate()

  const [selection, setSelection] = useState<CopySelection>(null)
  const [features, setFeatures] = useState<any[]>([])
  const [selectedFeature, setSelectedFeature] = useState<any>()

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (races && classes && equipment && !features) {
      const racesFeatures = races.flatMap((race) => race.features.map((feature) => feature))
      const classesFeatures = classes.flatMap((uClass) => uClass.features.map((feature) => feature))
      const equipmentFeatures = equipment.flatMap((equipment) =>
        equipment.features ? equipment.features.map((feature) => feature) : []
      )

      const featureArray = ([] as Feature[]).concat(racesFeatures, classesFeatures, equipmentFeatures)

      setFeatures(featureArray)
    }

    if (selection.filter) {
      if (selection.filterBy === 'races') {
        const raceFeature = races?.find((race) => race.id === selection.filter).features

        setFeatures(raceFeature)
      }
      if (selection.filterBy === 'equipment') {
        const equipmentFeature = equipment?.find((equipment) => equipment.id === selection.filter).features

        setFeatures(equipmentFeature)
      }
      if (selection.filterBy === 'classes') {
        const classFeature = classes?.find((uClass) => uClass.id === selection.filter).features

        setFeatures(classFeature)
      }
    }

    if (selection.feature) {
      const feature = features?.find((feature) => feature._id === selection.feature)

      setSelectedFeature(feature)
    }
  }, [races, classes, equipment, selection.filter, features, selection.filterBy, selection.feature])

  const handleSetFilterBy = (e: UpdateState<CopySelection>) => {
    if (e.type === 'update') {
      setSelection((prev) => ({ ...prev, filterBy: e.value }))
    }
  }

  const handleSetFilter = (e: UpdateState<CopySelection>) => {
    if (e.type === 'update') {
      setSelection((prev) => ({ ...prev, filter: e.value }))
    }
  }

  const handleSetFeature = (e: UpdateState<CopySelection>) => {
    if (e.type === 'update') {
      setSelection((prev) => ({ ...prev, feature: e.value }))
    }
  }

  const handleSelect = () => {
    if (
      formData.__typename === 'Equipment' ||
      formData.__typename === 'Race' ||
      formData.__typename === 'Feat' ||
      formData.__typename === 'Class' ||
      formData.__typename === 'Background'
    ) {
      const featureIndex = formData.features?.length ?? 0
      updateFormData({
        type: 'update',
        path: `features.${featureIndex}`,
        value: selectedFeature,
      })
      navigate(-1)
    }
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title='Copy Feature' />
        <Modal.Content>
          <Row cols={{ base: 2, lg: 2, md: 2 }}>
            <Dropdown<CopySelection>
              options={[
                {
                  value: 'races',
                  label: 'Races',
                  id: 'races',
                },
                {
                  value: 'classes',
                  label: 'Classes',
                  id: 'classes',
                },
                {
                  value: 'equipment',
                  label: 'Equipment',
                  id: 'equipment',
                },
              ]}
              label='Filter by...'
              onChange={handleSetFilterBy}
              name='filterBy'
              value={selection?.filterBy}
            />
            {selection?.filterBy === 'races' && (
              <Dropdown
                options={races}
                label='Race'
                onChange={handleSetFilter}
                name='filter'
                value={selection.filter}
              />
            )}
            {selection?.filterBy === 'classes' && (
              <Dropdown
                options={classes}
                label='Class'
                onChange={handleSetFilter}
                name='filter'
                value={selection.filter}
              />
            )}
            {selection?.filterBy === 'equipment' && (
              <Dropdown
                options={equipment}
                label='Equipment'
                onChange={handleSetFilter}
                name='filter'
                value={selection.filter}
              />
            )}
            <Dropdown
              label='Feature'
              onChange={handleSetFeature}
              name='feature'
              value={selection.feature}
              options={features}
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
