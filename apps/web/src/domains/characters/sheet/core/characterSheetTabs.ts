import type { CharacterSheetMobilePageId, CharacterSheetTabId } from './CharacterSheet.types'

export const CHARACTER_SHEET_DESKTOP_TABS: ReadonlyArray<{
  id: CharacterSheetTabId
  label: string
}> = [
  { id: 'overview', label: 'Overview' },
  { id: 'actions', label: 'Actions' },
  { id: 'spells', label: 'Spells' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'reference', label: 'Features & Traits' },
  { id: 'extras', label: 'Extras' },
  { id: 'notes', label: 'Notes' }
]

export const CHARACTER_SHEET_MOBILE_PAGES: ReadonlyArray<{
  id: CharacterSheetMobilePageId
  label: string
}> = [
  { id: 'overview', label: 'Overview' },
  { id: 'actions', label: 'Actions' },
  { id: 'spells', label: 'Spells' },
  { id: 'equipment', label: 'Inventory' },
  { id: 'features', label: 'Features & Traits' },
  { id: 'extras', label: 'Extras' },
  { id: 'notes', label: 'Notes' },
  { id: 'skills', label: 'Skills' },
  { id: 'proficiencies', label: 'Proficiencies' }
]

export function getMobilePageForTab(tabId: CharacterSheetTabId): CharacterSheetMobilePageId {
  if (tabId === 'actions') return tabId
  if (tabId === 'spells') return 'spells'
  if (tabId === 'extras') return 'extras'
  if (tabId === 'inventory') return 'equipment'
  if (tabId === 'reference') return 'features'
  if (tabId === 'notes') return 'notes'
  return 'overview'
}

export function getTabForMobilePage(pageId: CharacterSheetMobilePageId): CharacterSheetTabId {
  if (pageId === 'actions') return 'actions'
  if (pageId === 'spells') return 'spells'
  if (pageId === 'extras') return 'extras'
  if (pageId === 'equipment') return 'inventory'
  if (pageId === 'features') return 'reference'
  if (pageId === 'notes') return 'notes'
  return 'overview'
}
