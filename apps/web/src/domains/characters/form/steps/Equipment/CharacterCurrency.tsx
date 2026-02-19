import { Fragment, useEffect } from 'react'
import Collapsible from '@components/Collapse'
import { Grid } from '@mantine/core'
import { sprinkles } from '@css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'
import { useFormField, useSystemData } from '@hooks'
import type { CurrencyGroupInput, CharacterInput } from '@types'
import { CharacterCurrencyInputSchema, CurrencyGroupInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { useFieldUpdates } from '@hooks'

const CharacterCurrency = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  // Use optimized selector to batch store properties with shallow comparison
  const { updateField, currencyGroups } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    currencyGroups: state.current?.currencyGroups
  }))

  const { currencies } = useSystemData()

  const sm = useMediaQuery('(max-width: 567px)')

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  // Initialize currencies into data
  useEffect(() => {
    // Only run this effect when needed - not on every render with updated data
    if (currencyGroups?.length && currencyGroups.every((group) => group.currencies?.length)) {
      return // Already initialized properly
    }

    // Create a properly initialized currency structure
    const characterCurrencies: CurrencyGroupInput[]
      = currencyGroups?.length ? [...currencyGroups] : [CurrencyGroupInputSchema.parse({ currencies: [] })]

    // Initialize any empty currency groups
    characterCurrencies.forEach((curGroup, index) => {
      if (!curGroup.currencies?.length) {
        const currencyGroup = CurrencyGroupInputSchema.parse({
          ...curGroup,
          currencies:
            currencies?.map((currency) => CharacterCurrencyInputSchema.parse({
              id: currency.id,
              amount: 0
            })) || []
        })
        updateField({ path: `currencyGroups[${index}]`, value: currencyGroup })
      }
    })
  }, [currencyGroups, currencies, updateField])

  const currencyTotals = currencyGroups?.flatMap(
    (group) => (group && group?.currencies?.length && group?.currencies?.map((currency) => currency)) || []
  )

  let baglessIndex = currencyGroups?.findIndex((group) => group?.container == null)

  if (!baglessIndex || baglessIndex === -1) {
    baglessIndex = 0
  }

  const currencyTotalsTitle = (
    <div>
      <span>{'Totals - '}</span>
      {currencyTotals?.map((currency, index) => {
        {
          const currencyLabel = currencies?.findCurrency(currency?.id)?.label
          return (
            <span key={index}>
              <span className={sprinkles({ ws: 'nowrap' })}>{`${currencyLabel}: ${currency?.amount}`}</span>
              {index !== currencyTotals?.length - 1 && ' / '}
            </span>
          )
        }
      })}
    </div>
  )

  return (
    <Grid.Col>
      <Collapsible props={{ trigger: { title: 'Currency', titleRight: !sm && currencyTotalsTitle } }}>
        <Grid>
          <Grid.Col span={6}>
            <h3>
              <u>Currency</u>
            </h3>
          </Grid.Col>
          <Grid.Col span={6}>
            <h3>
              <u>Total</u>
            </h3>
          </Grid.Col>
          <AppField name="currencyGroups" mode="array">
            {(currencyGroups) => currencyGroups.state.value
              ?.filter((group) => group.container == null)
              .flatMap((group) => group.currencies)
              .map((currency, index) => {
                const currencyLabel = currencies.findCurrency(currency?.id)?.label
                return (
                  currencyLabel && (
                    <Fragment key={index}>
                      <Grid.Col span={6}>{currencyLabel}</Grid.Col>
                      <Grid.Col span={6}>
                        <AppField
                          name={`currencyGroups[${baglessIndex}].currencies[${index}].amount`}
                          validators={fieldValidators({
                            onChange: { type: 'number', min: 0, name: currencyLabel }
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => <TextField />}
                        </AppField>
                      </Grid.Col>
                    </Fragment>
                  )
                )
              })}
          </AppField>
        </Grid>
      </Collapsible>
    </Grid.Col>
  )
}
export default CharacterCurrency
