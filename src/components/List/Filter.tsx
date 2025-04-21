import { useCallback, useMemo } from 'react'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import { get, startCase } from 'lodash'
import { useStore } from '../../store/useStore'
import { type FilterState } from '../../store/filterStore'
import Button from '../Button/Button'
import type { FilterConfig, FilterDataType, UpdateFilter } from '../../types/components'
import Grid from '../Grid/Grid'
import type { MetaDataType } from '../../types/form'
import useMetaData from '../../hooks/useMetaData'

// This is a wrapper component that maintains the same API as before
function Filter<K extends MetaDataType>({
  context,
  metaData,
  filterConfigs,
}: {
  context: keyof FilterState
  metaData?: K
  filterConfigs: FilterConfig<FilterDataType, K>[]
}) {
  const { filterState, setFilter, resetFilters } = useStore()
  const { getFilterOptions } = useMetaData({ metaData })

  // Get the current filters for this context
  const currentFilters = filterState[context] || ({} as FilterDataType)

  // Memoize the options for each filter config
  const memoizedConfigs = useMemo(() => {
    return filterConfigs.map((config) => {
      if (config.type === 'dropdown' || config.type === 'multiSelect') {
        // If the config has options configuration
        if (config.options) {
          // If it has metaPath, use metadata to build options
          if (config.options.metaPath && metaData) {
            return {
              path: config.path,
              options: getFilterOptions({
                metaPath: config.options.metaPath,
                source: config.options.source,
              }),
            }
          }
        }
        return { path: config.path, options: [] }
      }
      return { path: config.path, options: [] }
    })
  }, [filterConfigs, metaData, getFilterOptions])

  // Type-safe filter change handler
  const handleFilterChange = useCallback(
    (update: UpdateFilter<FilterDataType>) => {
      if (update.type === 'update') {
        setFilter(context, update.path, update.value)
      } else if (update.type === 'remove') {
        setFilter(context, update.path, null)
      }
    },
    [setFilter, context]
  )

  // Handler for the reset button
  const handleReset = useCallback(() => {
    resetFilters(context)
  }, [resetFilters, context])

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

export default Filter
