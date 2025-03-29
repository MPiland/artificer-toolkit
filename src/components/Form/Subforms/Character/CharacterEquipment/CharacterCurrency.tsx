import { Fragment, use, useEffect } from 'react'
import Collapse from '../../../../Collapse/Collapse'
import Grid from '../../../../Grid/Grid'
import { FormContext } from '../../../FormContext'
import { Character, CurrencyGroup } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { useGetSystemQuery } from '../../../../../apis/systemsApi'
import { sprinkles } from '../../../../../css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'
import Input from '../../../../Input/Input'

const CharacterCurrency = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: system } = useGetSystemQuery()

  const sm = useMediaQuery('(max-width: 567px)')

  // Initialize currencies into data
  useEffect(() => {
    // Only run this effect when needed - not on every render with updated formData
    if (formData.currencyGroups?.length && formData.currencyGroups.every((group) => group.currencies?.length)) {
      return // Already initialized properly
    }

    // Create a properly initialized currency structure
    const characterCurrencies: CurrencyGroup[] =
      formData.currencyGroups?.length ? [...formData.currencyGroups] : [{ __typename: 'CurrencyGroup', currencies: [] }]

    // Initialize any empty currency groups
    characterCurrencies.forEach((group, index) => {
      if (!group.currencies?.length) {
        characterCurrencies[index] = {
          ...group,
          currencies:
            system.currencies?.map((currency) => ({
              __typename: 'CharacterCurrency',
              id: currency.id,
              amount: 0,
            })) || [],
        }
      }
    })

    // Update only once
    updateFormData({
      type: 'update',
      path: 'currencyGroups',
      value: characterCurrencies,
    })
  }, [formData, system.currencies, updateFormData])

  const currencyTotals = formData?.currencyGroups?.flatMap(
    (group) => (group && group?.currencies?.length && group?.currencies?.map((currency) => currency)) || []
  )

  let baglessIndex = formData?.currencyGroups?.findIndex((group) => group?.container == null)

  if (!baglessIndex || baglessIndex === -1) {
    baglessIndex = 0
  }

  const currencyTotalsTitle = (
    <div>
      <span>{'Totals - '}</span>
      {currencyTotals?.map((currency, index) => {
        {
          const currencyLabel = system.currencies?.find((eCurrency) => eCurrency.id === currency?.id)?.label
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
            {formData?.currencyGroups
              ?.filter((group) => group.container == null)
              .flatMap((group) => group.currencies)
              .map((currency, index) => {
                const currencyLabel = system.currencies.find((sCurrency) => sCurrency.id === currency?.id)?.label
                return (
                  <Fragment key={index}>
                    <Grid.Item colSpan={6}>{currencyLabel}</Grid.Item>
                    <Grid.Item colSpan={6}>
                      <Input
                        name={`currencyGroups.${baglessIndex}.currencies.${index}.amount`}
                        value={currency?.amount}
                        onChange={updateFormData}
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
