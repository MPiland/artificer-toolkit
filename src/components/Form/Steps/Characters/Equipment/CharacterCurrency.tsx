import { z } from 'zod/v4'
import { Fragment, useEffect } from 'react'
import Collapsible from '@/components/Collapsible'
import { Grid } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'
import { useSystemData } from '@/hooks'
import type { CurrencyGroupInput } from '@/types'
import { withFieldGroup } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { CharacterCurrencyInputSchema, CurrencyGroupInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { get, isEqual } from 'lodash'

const CharacterCurrency = withFieldGroup({
  defaultValues: [] as CurrencyGroupInput[],
  render: function Render({ group }) {
    const { AppField, Subscribe } = group

    const formStore = useFormStore()

    const { currencies } = useSystemData()

    const sm = useMediaQuery('(max-width: 567px)')

    const { currencyGroups } = useStore(group.store, (state) => ({
      currencyGroups: state.values,
    }))

    const handleBlur = ({
      target: { name, value },
    }: {
      target: { name: string; value: string | string[] | number | null | undefined }
    }) => {
      const pathName = 'currencyGroups' + (name.startsWith('[') ? '' : '.') + name
      const currentValue = get(formStore.current, pathName)
      if (value != null && !isEqual(currentValue, value)) {
        formStore.updateField({ path: pathName, value })
      } else if (currentValue && value == null) {
        formStore.removeField({ path: pathName })
      }
    }

    // Initialize currencies into data
    useEffect(() => {
      // Only run this effect when needed - not on every render with updated data
      if (currencyGroups?.length && currencyGroups.every((group) => group.currencies?.length)) {
        return // Already initialized properly
      }

      // Create a properly initialized currency structure
      const characterCurrencies: CurrencyGroupInput[] =
        currencyGroups?.length ? [...currencyGroups] : [CurrencyGroupInputSchema.parse({ currencies: [] })]

      // Initialize any empty currency groups
      characterCurrencies.forEach((curGroup, index) => {
        if (!curGroup.currencies?.length) {
          const currencyGroup = CurrencyGroupInputSchema.parse({
            ...curGroup,
            currencies:
              currencies?.map((currency) =>
                CharacterCurrencyInputSchema.parse({
                  id: currency.id,
                  amount: 0,
                })
              ) || [],
          })
          group.setFieldValue(`[${index}]`, currencyGroup)
          formStore.updateField({ path: `currencyGroups[${index}]`, value: currencyGroup })
        }
      })
    }, [group, currencyGroups, currencies, formStore])

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
        <Collapsible>
          <Collapsible.Trigger title='Currency' titleRight={!sm && currencyTotalsTitle} />
          <Collapsible.Content>
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
              <Subscribe selector={(state) => state.values}>
                {(values) =>
                  values
                    ?.filter((group) => group.container == null)
                    .flatMap((group) => group.currencies)
                    .map((currency, index) => {
                      const currencyLabel = currencies.findCurrency(currency?.id)?.label
                      return (
                        <Fragment key={index}>
                          <Grid.Col span={6}>{currencyLabel}</Grid.Col>
                          <Grid.Col span={6}>
                            <AppField
                              name={`[${baglessIndex}].currencies[${index}].amount`}
                              validators={{
                                onChange: z
                                  .number('Amount must be a number')
                                  .gte(0, 'Amount must be greater than or equal to 0'),
                              }}
                              listeners={{
                                onBlur: ({ value, fieldApi }) =>
                                  fieldApi.state.meta.isValid && handleBlur({ target: { name: fieldApi.name, value } }),
                              }}
                            >
                              {({ TextField }) => <TextField />}
                            </AppField>
                          </Grid.Col>
                        </Fragment>
                      )
                    })
                }
              </Subscribe>
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})
export default CharacterCurrency
