import { Vocabulary } from './vocabulary.js'

export enum CurrencyCode {
  GOLD = 'GOLD',
  COPPER = 'COPPER',
  ELECTRUM = 'ELECTRUM',
  SILVER = 'SILVER',
  PLATINUM = 'PLATINUM'
}

type CurrencyOption = Vocabulary<CurrencyCode> & {
  baseCurrencyCode: CurrencyCode
  baseValue: number
}

export const currencies: CurrencyOption[] = [
  {
    id: '2b9c4330-14d4-473a-aed7-52a8eb1906ce',
    label: 'Gold',
    short: 'gp',
    code: CurrencyCode.GOLD,
    baseCurrencyCode: CurrencyCode.COPPER,
    baseValue: 100
  },
  {
    id: '622c63f5-041a-429a-8cc5-ac17fb13d160',
    label: 'Copper',
    short: 'cp',
    code: CurrencyCode.COPPER,
    baseCurrencyCode: CurrencyCode.COPPER,
    baseValue: 1
  },
  {
    id: 'e14508e4-a326-444f-8ee8-d253ee7b18a9',
    label: 'Electrum',
    short: 'ep',
    code: CurrencyCode.ELECTRUM,
    baseCurrencyCode: CurrencyCode.COPPER,
    baseValue: 50
  },
  {
    id: '563e0322-3cc3-4fcc-8cfa-2253383e5daf',
    label: 'Silver',
    short: 'sp',
    code: CurrencyCode.SILVER,
    baseCurrencyCode: CurrencyCode.COPPER,
    baseValue: 10
  },
  {
    id: 'd9447a5b-c73c-4aa1-85ea-2fbc827bcecf',
    label: 'Platinum',
    short: 'pp',
    code: CurrencyCode.PLATINUM,
    baseCurrencyCode: CurrencyCode.COPPER,
    baseValue: 1000
  }
]
