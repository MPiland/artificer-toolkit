import { useCallback, useMemo } from 'react'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import { get, startCase } from 'lodash'
import { useStore } from '../../store/useStore'
import { FilterState, FormType } from '../../store/filterSlice'
import Button from '../Button/Button'
import { FilterConfig, UpdateFilter } from '../../types/components'
import Grid from '../Grid/Grid'
import { FormDataType } from '../../types/form'

// Define a type that includes filterState to pass to Input/Dropdown
type FilterContextType = { filterState: FilterState }

interface FilterProps<T extends FormType, K extends FormDataType> {
  context: T
  data: K[] | null | undefined
  filterConfigs: FilterConfig<K>[]
}

const Filter = <T extends FormType, K extends FormDataType>({ context, data, filterConfigs }: FilterProps<T, K>) => {
  const { filterState, setFilter, resetFilters } = useStore()

  // Get the current filters for this context
  const currentFilters = filterState[context] || ({} as FilterState[typeof context])

  // Memoize the options for each filter config
  const memoizedConfigs = useMemo(() => {
    return filterConfigs.map((config) => {
      if (config.type === 'dropdown' || config.type === 'multiSelect') {
        return {
          path: config.path,
          options: config.options || (config.getOptionsFromData ? config.getOptionsFromData(data) : []),
        }
      }
      return { path: config.path, options: [] }
    })
  }, [data, filterConfigs])

  const handleFilterChange = useCallback(
    (update: UpdateFilter<K>) => {
      if (update.type === 'update') {
        setFilter(context as FormType, update.path as any, update.value)
      } else if (update.type === 'remove') {
        setFilter(context as FormType, update.path as any, null)
      }
    },
    [context, setFilter]
  )

  // Handler for the reset button
  const handleReset = useCallback(() => {
    resetFilters(context as FormType)
  }, [resetFilters, context])

  return (
    <Grid spacing={{ col: 8 }}>
      {filterConfigs.map((config) => {
        const value = get(currentFilters, config.path, '') as string

        switch (config.type) {
          case 'text':
            return (
              <Grid.Item key={config.path} colSpan={{ sm: 4, lg: 'auto' }}>
                <Input<FilterContextType>
                  key={config.path}
                  name={config.path}
                  label={config.label || startCase(config.path)}
                  autoComplete='off'
                  value={value}
                  onChange={handleFilterChange}
                />
              </Grid.Item>
            )

          case 'dropdown':
          case 'multiSelect': {
            // Get the memoized options for this config
            const optionsForConfig = memoizedConfigs.find((c) => c.path === config.path)?.options || []

            return (
              <Grid.Item key={config.path} colSpan={{ sm: 4, lg: 'auto' }}>
                <Dropdown<FilterContextType>
                  key={config.path}
                  multiSelect={config.type === 'multiSelect'}
                  name={config.path}
                  label={config.label || startCase(config.path)}
                  options={optionsForConfig}
                  value={value}
                  all={false}
                  boundary='app'
                  onChange={handleFilterChange}
                />
              </Grid.Item>
            )
          }

          default:
            return null
        }
      })}

      <Grid.Item colSpan={'auto'} align='end'>
        <Button width={'size-full'} color='main' style='outline' onClick={handleReset}>
          Reset
        </Button>
      </Grid.Item>
    </Grid>
  )
}

export default Filter
