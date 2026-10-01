import { useQueryClient } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetSliceSchema } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { CharacterSheetView } from '../core/CharacterSheetView'

/** Fixture collections exercise the production subscriptions using the shared projection. */
export function CharacterSheetFixtureView({
  sheet,
  ...props
}: Omit<ComponentProps<typeof CharacterSheetView>, 'sheet'> & {
  sheet: CharacterSheetResponseDto
}) {
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(['convexQuery', 'characters/sheetSlices:get'], {
    queryFn: async ({ queryKey }) => {
      const input = queryKey[2]
      if (!input || typeof input !== 'object' || !('slice' in input))
        throw new Error('Missing fixture slice')
      const slice = characterSheetSliceSchema.parse(input.slice)
      return projectCharacterSheetSlice(sheet, slice)
    }
  })
  return <CharacterSheetView {...props} sheet={projectCharacterSheetSlice(sheet, 'COMMON').data} />
}
