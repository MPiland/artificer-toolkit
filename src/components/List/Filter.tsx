import { useCallback, useMemo } from 'react'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { get, startCase } from 'lodash'
import { useFilterStore, type FilterState } from '@/store'
import Button from '@/components/Button'
import type { FilterConfig, FilterDataType } from '@/components/List'
import type { MetaDataType, OnChange } from '@/types'
import { useMetaData } from '@/hooks'
import { Grid } from '@mantine/core'

// This is a wrapper component that maintains the same API as before
function Filter<T extends FilterDataType, K extends MetaDataType>({
  context,
  metaData,
  filterConfigs,
}: {
  context: keyof FilterState
  metaData?: K
  filterConfigs: FilterConfig<T, K>[]
}) {
  const filterStore = useFilterStore((state) => state)
  const { filters, setFilter, resetFilters } = filterStore
  const { getFilterOptions } = useMetaData({ metaData })

  // Get the current filters for this context
  const currentFilters = filters[context] || ({} as FilterDataType)

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

  // Handler for the reset button
  const handleReset = useCallback(() => {
    resetFilters(context)
  }, [resetFilters, context])

  return (
    <Grid align='flex-end'>
      {filterConfigs.map((config) => {
        const value = get(currentFilters, config.path, '') as string | string[] | null | undefined

        switch (config.type) {
          case 'text':
            return (
              <Grid.Col key={String(config.path)} span={{ sm: 4, lg: 'auto' }}>
                <Input<FilterState[typeof context]>
                  key={String(config.path)}
                  name={config.path}
                  label={config.label || startCase(String(config.path))}
                  autoComplete='off'
                  value={value}
                  onChange={
                    {
                      updateField: ({ path, value }) => {
                        return setFilter(context, path, value)
                      },
                    } as {
                      updateField: OnChange<FilterState[typeof context]>['updateField']
                    }
                  }
                />
              </Grid.Col>
            )

          case 'dropdown':
          case 'multiSelect': {
            // Get the memoized options for this config
            const optionsForConfig = memoizedConfigs.find((c) => c.path === config.path)?.options || []

            return (
              <Grid.Col key={String(config.path)} span={{ sm: 4, lg: 'auto' }}>
                <Dropdown<FilterState[typeof context]>
                  key={String(config.path)}
                  multiSelect={config.type === 'multiSelect'}
                  name={config.path}
                  label={config.label || startCase(String(config.path))}
                  options={optionsForConfig}
                  value={value}
                  all={false}
                  boundary='app'
                  onChange={
                    {
                      updateField: ({ path, value }) => {
                        return setFilter(context, path, value)
                      },
                      removeField: ({ path }) => {
                        return setFilter(context, path, null)
                      },
                    } as {
                      updateField: OnChange<FilterState[typeof context]>['updateField']
                      removeField: OnChange<FilterState[typeof context]>['removeField']
                    }
                  }
                />
              </Grid.Col>
            )
          }

          default:
            return null
        }
      })}

      <Grid.Col>
        <Button width={'size-full'} color='main' style='outline' onClick={handleReset}>
          Reset
        </Button>
      </Grid.Col>
    </Grid>
  )
}

export default Filter
