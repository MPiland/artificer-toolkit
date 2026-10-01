import { Badge, Button, Text } from '@mantine/core'
import type { CharacterPreparationOptionDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import * as editorStyles from './inspectorEditor.css'
import * as shellStyles from './inspectorShell.css'

type SpellSource = Extract<
  CharacterSheetPanelDto,
  { kind: 'SPELLS' }
>['groups'][number]['sources'][number]

export function CharacterSheetManageSpellRow({
  spell,
  disabled,
  preparationDisabled,
  canManageKnown,
  onPreparedChange,
  onKnownChange,
  onTargetChange
}: {
  spell: CharacterPreparationOptionDto & {
    rowId: string
    classId?: string
    sourceLabel: string
    prepared: boolean
    eligibleForPreparation: boolean
    source?: SpellSource
  }
  disabled: boolean
  preparationDisabled: boolean
  canManageKnown: boolean
  onPreparedChange: (classId: string, spellId: string, prepared: boolean) => Promise<boolean>
  onKnownChange: (source: SpellSource, known: boolean) => Promise<boolean>
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  const source = spell.source
  const label = (
    <>
      <Text fw={700}>{spell.label}</Text>
      <Text className={shellStyles.muted}>
        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.sourceLabel}
      </Text>
    </>
  )
  return (
    <>
      {source ? (
        <button
          className={editorStyles.entryLink}
          type='button'
          onClick={() => onTargetChange(source.target)}
        >
          {label}
        </button>
      ) : (
        <div>{label}</div>
      )}
      <div className={editorStyles.actions}>
        {source && source.state !== 'DEFAULT' ? (
          <Badge color='cyan' variant='light'>
            Modified
          </Badge>
        ) : null}
        {spell.classId && (!source || source.canPrepare) ? (
          <Button
            disabled={
              disabled ||
              preparationDisabled ||
              !spell.eligibleForPreparation ||
              Boolean(source?.canManageKnown && !source.known)
            }
            size='xs'
            variant={spell.prepared ? 'default' : 'filled'}
            onClick={() => void onPreparedChange(spell.classId!, spell.spellId, !spell.prepared)}
          >
            {spell.prepared ? 'Unprepare' : 'Prepare'}
          </Button>
        ) : null}
        {source?.canManageKnown && source.knownClassId ? (
          <Button
            disabled={disabled || !canManageKnown}
            size='xs'
            variant={source.known ? 'default' : 'filled'}
            onClick={() => void onKnownChange(source, !source.known)}
          >
            {source.known ? 'Forget' : 'Learn'}
          </Button>
        ) : null}
      </div>
    </>
  )
}
