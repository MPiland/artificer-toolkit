import { useCallback, useMemo } from 'react'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import { get, startCase } from 'lodash'
import { useStore } from '../../store/useStore'
import { FilterState } from '../../store/filterSlice'
import Button from '../Button/Button'
import { FilterConfig, UpdateFilter } from '../../types/components'
import Grid from '../Grid/Grid'

// Type-specific filter component creator
const TypedFilterComponent = (context: keyof FilterState) => {
  type DataType = FilterState[typeof context]

  // This is the actual component that will be returned
  return function TypedFilter({
    data,
    filterConfigs,
  }: {
    data: DataType[] | null | undefined
    filterConfigs: Array<FilterConfig<DataType>>
  }) {
    const { filterState, setFilter, resetFilters } = useStore()

    // Get the current filters for this context
    const currentFilters = filterState[context] || ({} as DataType)

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

    // Type-safe filter change handler
    const handleFilterChange = useCallback(
      (update: UpdateFilter<DataType>) => {
        if (update.type === 'update') {
          setFilter(context, update.path, update.value)
        } else if (update.type === 'remove') {
          setFilter(context, update.path, null)
        }
      },
      [setFilter]
    )

    // Handler for the reset button
    const handleReset = useCallback(() => {
      resetFilters(context)
    }, [resetFilters])

    return (
      <Grid spacing={{ col: 8 }}>
        {filterConfigs.map((config) => {
          const value = get(currentFilters, config.path, '') as string | string[] | null | undefined

          switch (config.type) {
            case 'text':
              return (
                <Grid.Item key={String(config.path)} colSpan={{ sm: 4, lg: 'auto' }}>
                  <Input<FilterState[typeof context]>
                    key={String(config.path)}
                    name={config.path}
                    label={config.label || startCase(String(config.path))}
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
                <Grid.Item key={String(config.path)} colSpan={{ sm: 4, lg: 'auto' }}>
                  <Dropdown<FilterState[typeof context]>
                    key={String(config.path)}
                    multiSelect={config.type === 'multiSelect'}
                    name={config.path}
                    label={config.label || startCase(String(config.path))}
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
}

// This is a wrapper component that maintains the same API as before
function Filter({
  context,
  data,
  filterConfigs,
}: {
  context: keyof FilterState
  data: any[] | null | undefined
  filterConfigs: any[]
}) {
  // Create a type-specific filter component for this context
  const TypedFilter = TypedFilterComponent(context)

  // Pass the props to the typed component
  return <TypedFilter data={data} filterConfigs={filterConfigs} />
}

export default Filter
