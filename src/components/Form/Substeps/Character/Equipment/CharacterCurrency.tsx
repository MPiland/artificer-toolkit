import { Fragment, use, useEffect } from 'react'
import Collapsible from '@/components/Collapsible'
import { Grid } from '@mantine/core'
import { FormContext } from '../../../FormContext'
import { sprinkles } from '@/css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'
import Input from '@/components/Input'
import { useSystemData } from '@/hooks'
import type { OnChange, Character, CurrencyGroup } from '@/types'

const CharacterCurrency = () => {
  const {
    formStore: { data, updateField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
    }
  }

  const { currencies } = useSystemData()

  const sm = useMediaQuery('(max-width: 567px)')

  // Initialize currencies into data
  useEffect(() => {
    // Only run this effect when needed - not on every render with updated data
    if (data.currencyGroups?.length && data.currencyGroups.every((group) => group.currencies?.length)) {
      return // Already initialized properly
    }

    // Create a properly initialized currency structure
    const characterCurrencies: CurrencyGroup[] =
      data.currencyGroups?.length ? [...data.currencyGroups] : [{ __typename: 'CurrencyGroup', currencies: [] }]

    // Initialize any empty currency groups
    characterCurrencies.forEach((group, index) => {
      if (!group.currencies?.length) {
        characterCurrencies[index] = {
          ...group,
          currencies:
            currencies?.map((currency) => ({
              __typename: 'CharacterCurrency',
              id: currency.id,
              amount: 0,
            })) || [],
        }
      }
    })

    // Update only once
    updateField({ path: 'currencyGroups', value: characterCurrencies })
  }, [updateField, data.currencyGroups, currencies])

  const currencyTotals = data?.currencyGroups?.flatMap(
    (group) => (group && group?.currencies?.length && group?.currencies?.map((currency) => currency)) || []
  )

  let baglessIndex = data?.currencyGroups?.findIndex((group) => group?.container == null)

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
            {data?.currencyGroups
              ?.filter((group) => group.container == null)
              .flatMap((group) => group.currencies)
              .map((currency, index) => {
                const currencyLabel = currencies.findCurrency(currency?.id)?.label
                return (
                  <Fragment key={index}>
                    <Grid.Col span={6}>{currencyLabel}</Grid.Col>
                    <Grid.Col span={6}>
                      <Input
                        name={`currencyGroups.${baglessIndex}.currencies.${index}.amount`}
                        value={currency?.amount}
                        onChange={{ updateField }}
                        type='cur'
                      />
                    </Grid.Col>
                  </Fragment>
                )
              })}
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}
export default CharacterCurrency
