import { useGetRacesQuery, selectAllRaces } from '../../features/race/raceApiSlice'
import { useGetClassesQuery, selectAllClasses } from '../../features/class/classApiSlice'
import { useGetItemsQuery, selectAllItems } from '../../features/item/itemApiSlice'
import useIsLoading from '../../hooks/useIsLoading'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../Spinner/Spinner'
import Modal from '../Modal/Modal'
import { useEffect, useReducer, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import { DropdownOption } from '../../utils/types'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'

const Copy = () => {
  const isLoading = useIsLoading()
  const navigate = useNavigate()
  const location = useLocation()

  const [selection, setSelection] = useReducer(formReducer, {})
  const [features, setFeatures] = useState<any[]>()
  const [selectedFeature, setSelectedFeature] = useState<any>()

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({ classes: data && selectAllClasses(data) }),
  })

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

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
      if (selection.filterBy?.name === 'race') {
        const raceFeature: any[] = (races as any[])?.find((race: any) => race._id === selection.filter._id).feature

        setFeatures(raceFeature)
      }
      if (selection.filterBy?.name === 'item') {
        const itemFeature: any[] = (items as any[])?.find((race: any) => race._id === selection.filter._id).feature

        setFeatures(itemFeature)
      }
      if (selection.filterBy?.name === 'class') {
        const classFeature: any[] = (classes as any[])?.find((race: any) => race._id === selection.filter._id).feature

        setFeatures(classFeature)
      }
    }

    if (selection.feature) {
      const feature = features?.find((feature: any) => feature._id === selection.feature._id)

      setSelectedFeature(feature)
    }
  }, [races, classes, items, selection.filter, features, selection.filterBy?.name, selection.feature])

  const handleSelect = () => {
    navigate(location.state.background.pathname, {
      state: {
        feature: selectedFeature,
        copy: true,
      },
    })
  }

  return isLoading ? (
    <Spinner />
  ) : (
    <>
      <Modal.Header title='Copy Feature' />
      <Modal.Body>
        <Grid cols={{ base: 2, lg: 2, md: 2 }}>
          <Dropdown
            options={[
              {
                name: 'race',
                value: 'Race',
                _id: null,
              },
              {
                name: 'class',
                value: 'Class',
                _id: null,
              },
              {
                name: 'item',
                value: 'item',
                _id: null,
              },
            ]}
            label='Filter by...'
            onChange={setSelection}
            name='filterBy'
            value={selection?.filterBy}
          />
          {selection?.filterBy?.name === 'race' && (
            <Dropdown
              options={races as unknown as DropdownOption[]}
              label='Race'
              onChange={setSelection}
              name='filter'
              value={selection.filter}
            />
          )}
          {selection?.filterBy?.name === 'class' && (
            <Dropdown
              options={classes as unknown as DropdownOption[]}
              label='Class'
              onChange={setSelection}
              name='filter'
              value={selection.filter}
            />
          )}
          {selection?.filterBy?.name === 'item' && (
            <Dropdown
              options={items as unknown as DropdownOption[]}
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
        </Grid>
        <Button
          variant='primary'
          onClick={() => handleSelect()}
          className={sprinkles({ mt: 'size-3', width: 'full' })}
          disabled={!selection.feature}
        >
          Copy
        </Button>
      </Modal.Body>
    </>
  )
}

export default Copy
