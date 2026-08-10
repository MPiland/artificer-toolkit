import { Alert, Drawer, Skeleton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'

import { getCharacterSheetPanel } from '#app/data/characters/queries'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as sheetOverlayStyles from '../shared/sheetOverlay.css'
import { CharacterSheetInspectorContent } from './CharacterSheetInspectorContent'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

export function CharacterSheetInspector({
  characterId,
  equipmentItems,
  commandError,
  expectedVersion,
  pending,
  target,
  submitCommand,
  onClose,
  onTargetChange
}: {
  characterId: string
  equipmentItems?: CharacterSheet['inventory']['items']
  commandError?: string
  expectedVersion: number
  pending: boolean
  target: CharacterSheetPanelTargetDto
  submitCommand: SubmitSheetCommand
  onClose: () => void
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const panelQuery = useQuery(getCharacterSheetPanel(characterId, target))

  return (
    <Drawer
      aria-busy={pending}
      classNames={{
        body: sheetOverlayStyles.drawerBody,
        content: `${sheetOverlayStyles.drawerContent} ${inspectorShellStyles.drawerContent}`,
        header: sheetOverlayStyles.drawerHeader,
        title: sheetOverlayStyles.drawerTitle
      }}
      closeButtonProps={{ 'aria-label': 'Close character inspector' }}
      opened
      overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? 'auto' : '26rem'}
      title={panelQuery.data?.title ?? 'Character details'}
      onClose={onClose}
    >
      {pending ? (
        <Alert color='blue' role='status' title='Saving changes'>
          Updating the character sheet…
        </Alert>
      ) : null}
      {commandError ? (
        <Alert color='red' role='alert' title='Character sheet update failed'>
          {commandError}
        </Alert>
      ) : null}
      {panelQuery.isPending ? (
        <div className={inspectorEditorStyles.loading} aria-label='Loading character details'>
          <Skeleton height={24} width='45%' />
          <Skeleton height={64} />
          <Skeleton height={16} width='72%' />
          <Skeleton height={120} />
          <Skeleton height={160} />
        </div>
      ) : panelQuery.error ? (
        <div className={inspectorShellStyles.section}>
          <Alert color='red' title='Character details unavailable'>
            {panelQuery.error.message}
          </Alert>
        </div>
      ) : panelQuery.data ? (
        <CharacterSheetInspectorContent
          expectedVersion={expectedVersion}
          equipmentItems={equipmentItems ?? []}
          panel={panelQuery.data}
          pending={pending}
          submitCommand={submitCommand}
          onClose={onClose}
          onTargetChange={onTargetChange}
        />
      ) : null}
    </Drawer>
  )
}
