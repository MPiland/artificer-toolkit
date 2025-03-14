import { useListRacesQuery } from '../../../../features/races/racesApi'
import { useListClassesQuery } from '../../../../features/classes/classesApi'
import { useListEquipmentQuery } from '../../../../features/equipment/equipmentApi'
import { useNavigate } from 'react-router-dom'
import Modal from '../../../Modal/Modal'
import { useEffect, useState, use } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import Button from '../../../Button/Button'
import { sprinkles } from '../../../../css/sprinkles.css'
import { FormContext } from '../../FormContext'
import { Class, Equipment, Feature, Race } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { FeatureContext } from '../FeatureContext'
import Grid from '../../../Grid/Grid'
import { isEqual } from 'lodash'

type CopySelection = {
  filter: Race['id'] | Class['id'] | Equipment['id']
  filterBy: string
  feature: Feature['id']
}

const CopyFeature = () => {
  const navigate = useNavigate()
  const { formData, updateFormData } = use(FormContext)
  const { setFeatureStep, updateFeatureData } = use(FeatureContext)

  const [selection, setSelection] = useState<CopySelection>(null)
  const [features, setFeatures] = useState<any[]>([])
  const [selectedFeature, setSelectedFeature] = useState<any>()

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: equipment } = useListEquipmentQuery()

  const createFeatures = () => {
    const racesFeatures = races.flatMap((race) => race.features.map((feature) => feature))
    console.log({ racesFeatures })
    const classesFeatures = classes.flatMap((uClass) => uClass.features.map((feature) => feature))
    const equipmentFeatures = equipment.flatMap((equipment) =>
      equipment.features ? equipment.features.map((feature) => feature) : []
    )

    const featureArray = ([] as Feature[]).concat(racesFeatures, classesFeatures, equipmentFeatures)

    return featureArray
  }

  const featureArray = createFeatures()

  useEffect(() => {
    if (features.length === 0 && !isEqual(featureArray, features)) {
      setFeatures(featureArray)
    }

    if (selection?.filter) {
      if (selection?.filterBy === 'races') {
        const raceFeature = races?.find((race) => race.id === selection?.filter).features

        setFeatures(raceFeature)
      }
      if (selection?.filterBy === 'equipment') {
        const equipmentFeature = equipment?.find((equipment) => equipment.id === selection?.filter).features

        setFeatures(equipmentFeature)
      }
      if (selection?.filterBy === 'classes') {
        const classFeature = classes?.find((uClass) => uClass.id === selection?.filter).features

        setFeatures(classFeature)
      }
    }

    if (selection?.feature) {
      const feature = features?.find((feature) => feature._id === selection?.feature)

      setSelectedFeature(feature)
    }
  }, [races, classes, equipment, selection?.filter, features, selection?.filterBy, selection?.feature, featureArray])

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
      updateFeatureData({ type: 'index', value: featureIndex })
      updateFeatureData({ type: 'reset', value: selectedFeature })
      updateFeatureData({ type: 'initialReset', value: selectedFeature })
      setFeatureStep('feature')
      navigate(-1)
    }
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title='Copy Feature' />
        <Modal.Content>
          <Grid>
            <Grid.Item>
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
            </Grid.Item>
            {selection?.filterBy === 'races' ? (
              <Grid.Item colSpan={6}>
                <Dropdown
                  options={races}
                  label='Race'
                  onChange={handleSetFilter}
                  name='filter'
                  value={selection?.filter}
                />
              </Grid.Item>
            ) : selection?.filterBy === 'classes' ? (
              <Grid.Item colSpan={6}>
                <Dropdown
                  options={classes}
                  label='Class'
                  onChange={handleSetFilter}
                  name='filter'
                  value={selection?.filter}
                />
              </Grid.Item>
            ) : (
              selection?.filterBy === 'equipment' && (
                <Grid.Item colSpan={6}>
                  <Dropdown
                    options={equipment}
                    label='Equipment'
                    onChange={handleSetFilter}
                    name='filter'
                    value={selection?.filter}
                  />
                </Grid.Item>
              )
            )}
            <Grid.Item colSpan={6}>
              <Dropdown
                label='Feature'
                onChange={handleSetFeature}
                name='feature'
                value={selection?.feature}
                options={features}
              />
            </Grid.Item>
          </Grid>
          <Button
            color='primary'
            onClick={() => handleSelect()}
            className={sprinkles({ mt: 'space-3', width: 'size-full' })}
            disabled={!selection?.feature}
          >
            Copy
          </Button>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default CopyFeature
