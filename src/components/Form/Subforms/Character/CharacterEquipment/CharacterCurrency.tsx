import { Fragment, use, useEffect } from 'react'
import Collapse from '../../../../Collapse/Collapse'
import Grid from '../../../../Grid/Grid'
import { FormContext } from '../../../FormContext'
import { Character, CurrencyGroup } from '../../../../../../amplify/gql/types'
import { sprinkles } from '../../../../../css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'
import Input from '../../../../Input/Input'
import useSystemData from '../../../../../hooks/useSystemData'
import type { OnChange } from '../../../../../types/types'

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
    <Grid.Item>
      <Collapse>
        <Collapse.Header title='Currency' rightSide={!sm && currencyTotalsTitle} />
        <Collapse.Body>
          <Grid>
            <Grid.Item colSpan={6}>
              <h3>
                <u>Currency</u>
              </h3>
            </Grid.Item>
            <Grid.Item colSpan={6}>
              <h3>
                <u>Total</u>
              </h3>
            </Grid.Item>
            {data?.currencyGroups
              ?.filter((group) => group.container == null)
              .flatMap((group) => group.currencies)
              .map((currency, index) => {
                const currencyLabel = currencies.findCurrency(currency?.id)?.label
                return (
                  <Fragment key={index}>
                    <Grid.Item colSpan={6}>{currencyLabel}</Grid.Item>
                    <Grid.Item colSpan={6}>
                      <Input
                        name={`currencyGroups.${baglessIndex}.currencies.${index}.amount`}
                        value={currency?.amount}
                        onChange={{ updateField }}
                        type='cur'
                      />
                    </Grid.Item>
                  </Fragment>
                )
              })}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}
export default CharacterCurrency
