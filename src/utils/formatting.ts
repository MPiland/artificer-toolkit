import { FormDataType } from '~/types'
import { CamelCase } from 'type-fest'
import { ProfCats } from '~/enums'
import { SECTION_STEPS } from '~/components/Form'

export const numberToWords = (number: number): string => {
  const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const teens = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ]

  const tens = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  if (number === 0) return 'zero'

  let result = ''

  // Handle billions
  if (Math.floor(number / 1000000000) > 0) {
    result += numberToWords(Math.floor(number / 1000000000)) + ' billion, '
    number %= 1000000000
  }

  // Handle millions
  if (Math.floor(number / 1000000) > 0) {
    result += numberToWords(Math.floor(number / 1000000)) + ' million, '
    number %= 1000000
  }

  // Handle thousands
  if (Math.floor(number / 1000) > 0) {
    result += numberToWords(Math.floor(number / 1000)) + ' thousand, '
    number %= 1000
  }

  // Handle hundreds
  if (Math.floor(number / 100) > 0) {
    result += numberToWords(Math.floor(number / 100)) + ' hundred '
    number %= 100
    if (number > 0) result += 'and '
  }

  if (number > 0) {
    if (result !== '') result += 'and '

    if (number < 10) result += units[number]
    else if (number < 20) result += teens[number - 10]
    else {
      result += tens[Math.floor(number / 10)]
      if (number % 10 > 0) result += '-' + units[number % 10]
    }
  }

  return result.trim().replace(/,$/, '')
}

export const routeRoot = (__kind: FormDataType['__kind'] | undefined): string => {
  if (!__kind) return ''
  let routeString: string = ''
  switch (__kind) {
    case 'CharacterInput':
      routeString = 'characters'
      break
    case 'ClassInput':
      routeString = 'classes'
      break
    case 'FeatInput':
      routeString = 'feats'
      break
    case 'EquipmentInput':
      routeString = 'equipment'
      break
    case 'BackgroundInput':
      routeString = 'backgrounds'
      break
    case 'RaceInput':
      routeString = 'races'
      break
    case 'SpellInput':
      routeString = 'spells'
      break
  }

  return routeString
}

export const sectionIdKey = (sectionStep: (typeof SECTION_STEPS)[number]) => {
  const idMap = {
    feats: 'featId',
    proficiencies: 'proficiencyId',
    expertise: 'expertiseId',
    modifiers: 'modifierId',
    senses: 'senseId',
    spells: 'spellId',
  } as const

  return idMap[sectionStep]
}

export const typenameMap = {
  feats: {
    __kind: 'CharacterFeatInput',
    id: 'featId',
  },
  proficiencies: {
    __kind: 'CharacterProficiencyInput',
    id: 'proficiencyId',
  },
  expertise: {
    __kind: 'CharacterExpertiseInput',
    id: 'expertiseId',
  },
  modifiers: {
    __kind: 'CharacterModifierInput',
    id: 'modifierId',
  },
  senses: {
    __kind: 'CharacterSenseInput',
    id: 'senseId',
  },
} as const

// Make the function generic to properly narrow the return type
export function kind<T extends keyof typeof typenameMap, P extends keyof (typeof typenameMap)[T]>(
  sectionStep: T,
  type: P
): (typeof typenameMap)[T][P] {
  return typenameMap[sectionStep][type]
}

export const proficiencyKey = (category: Exclude<CamelCase<keyof typeof ProfCats>, 'initiative'>) => {
  switch (category) {
    case 'skills':
      return 'skill'
    case 'properties':
      return 'property'
    case 'languages':
      return 'language'
    case 'equipment':
      return 'equipment'
    case 'saveAbilities':
      return 'saveAbility'
  }
}
