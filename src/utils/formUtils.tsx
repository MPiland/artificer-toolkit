import { FC } from 'react'
import {
  FeatContent,
  ModifierContent,
  ProficiencyContent,
  SenseContent,
  SpellContent,
  SectionContentProps,
  AncestryContent,
} from '../components/Form/Feature/SectionContent'
import { SectionName } from './types'

type TableContent = {
  [key: string]: {
    content: FC<SectionContentProps>
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
  ancestry: {
    content: AncestryContent,
  },
}

export const getSectionNames = (): SectionName[] => {
  const sectionNameArray: SectionName[] = Array.from(
    Object.keys(tableContent)
  ) as SectionName[]
  sectionNameArray.push('option', 'feature')
  return sectionNameArray
}
