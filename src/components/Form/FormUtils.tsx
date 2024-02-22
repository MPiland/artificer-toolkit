import { FC } from 'react'
import {
  FeatContent,
  ModifierContent,
  ProficiencyContent,
  SenseContent,
  SpellContent,
  SectionProps,
} from './SectionContent'
import { SectionName } from '../../utils/types'

type TableContent = {
  [key: string]: {
    content: FC<SectionProps>
  }
}

export const tableContent: TableContent = {
  feat: {
    content: FeatContent,
  },
  modifier: {
    content: ModifierContent,
  },
  proficiency: {
    content: ProficiencyContent,
  },
  sense: {
    content: SenseContent,
  },
  spell: {
    content: SpellContent,
  },
}

export const getSectionNames = (): SectionName[] => {
  const sectionNameArray: SectionName[] = Array.from(
    Object.keys(tableContent)
  ) as SectionName[]
  sectionNameArray.push('option')
  return sectionNameArray
}
