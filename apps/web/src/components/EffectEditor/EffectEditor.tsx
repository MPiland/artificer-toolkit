import { useState } from 'react'
import { ActionIcon, Button, Group, Modal, Stack, Text, Title } from '@mantine/core'
import type { EffectDto, PathDto } from '@artificer-toolkit/schema'
import IX from '#assets/icons/IX'
import { EffectInvocationStep } from './EffectInvocationStep'
import { EffectSummaryCard } from './EffectSummaryCard'
import { OutcomePathsStep } from './OutcomePathsStep'
import { PathEditor } from './PathEditor'
import type { EffectEditorFormApi, EffectEditorReferenceData } from './effectEditor.types'
import {
  actionIcon,
  editorBreadcrumbCurrent,
  editorBreadcrumbLink,
  editorBreadcrumbs,
  editorContent,
  editorContentInner,
  editorContext,
  editorFooter,
  editorFrame,
  editorHeader,
  editorModalBody,
  editorModalContent,
  sectionPanel
} from './EffectEditor.css'
import { createDefaultEffect, createDefaultPath, formatEffectSummary, pathCodeOptions } from './effectEditor.utils'

type EffectEditorStep = 'start' | 'paths' | 'pathDetail'

export type { EffectEditorReferenceData } from './effectEditor.types'

export function EffectEditor({
  effects,
  form,
  references,
  readOnly,
  sourceLabel = 'Content'
}: {
  effects: EffectDto[]
  form: EffectEditorFormApi
  references: EffectEditorReferenceData
  readOnly?: boolean
  sourceLabel?: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeEffect = activeIndex == null ? null : effects[activeIndex]
  const modalTitleId = activeEffect ? getEffectEditorTitleId(activeEffect.id) : undefined

  function updateEffects(next: EffectDto[]) {
    if (!readOnly) form.setFieldValue('effects', next)
  }

  return (
    <section className={sectionPanel} aria-labelledby='effects-heading'>
      <Group justify='space-between' align='flex-start'>
        <Stack gap={4}>
          <Title id='effects-heading' order={2}>Effects</Title>
          <Text c='dimmed' size='sm'>
            Define how this content is used in play: invocation, outcome paths, and the results that happen.
          </Text>
        </Stack>
        <Button
          disabled={readOnly}
          onClick={() => {
            updateEffects([...effects, createDefaultEffect(effects.length + 1)])
            setActiveIndex(effects.length)
          }}
        >
          Add effect
        </Button>
      </Group>

      {effects.length === 0
        ? (
            <Text c='dimmed'>No effects yet. Add one when this content needs engine-backed play behavior.</Text>
          )
        : (
            <Stack gap='md'>
              {effects.map((effect, index) => (
                <EffectSummaryCard
                  key={effect.id}
                  effect={effect}
                  index={index}
                  readOnly={readOnly}
                  onEdit={() => setActiveIndex(index)}
                  onRemove={() => updateEffects(effects.filter((item) => item.id !== effect.id))}
                />
              ))}
            </Stack>
          )}

      <Modal
        fullScreen
        opened={activeEffect != null}
        onClose={() => setActiveIndex(null)}
        aria-labelledby={modalTitleId}
        withCloseButton={false}
        padding={0}
        classNames={{
          content: editorModalContent,
          body: editorModalBody
        }}
      >
        {activeEffect && activeIndex != null
          ? (
              <EffectEditorModal
                effect={activeEffect}
                index={activeIndex}
                references={references}
                readOnly={readOnly}
                sourceLabel={sourceLabel}
                titleId={modalTitleId}
                onChange={(next) => updateEffects(effects.map((item, itemIndex) => itemIndex === activeIndex ? next : item))}
                onClose={() => setActiveIndex(null)}
              />
            )
          : null}
      </Modal>
    </section>
  )
}

function EffectEditorModal({
  effect,
  index,
  references,
  readOnly,
  sourceLabel,
  titleId,
  onChange,
  onClose
}: {
  effect: EffectDto
  index: number
  references: EffectEditorReferenceData
  readOnly?: boolean
  sourceLabel: string
  titleId?: string
  onChange: (effect: EffectDto) => void
  onClose: () => void
}) {
  const fallbackPath = (effect.paths[0] ?? createDefaultPath(1)) as PathDto
  const [editorStep, setEditorStep] = useState<EffectEditorStep>('start')
  const [activePathIndex, setActivePathIndex] = useState(0)
  const activePath = (effect.paths[activePathIndex] ?? fallbackPath) as PathDto
  const currentTitle = getEditorTitle(editorStep, activePath)

  function updatePathAt(pathIndex: number, nextPath: PathDto) {
    onChange({
      ...effect,
      paths: effect.paths.length === 0
        ? [nextPath]
        : effect.paths.map((item, itemIndex) => itemIndex === pathIndex ? nextPath : item)
    })
  }

  function updatePaths(nextPaths: PathDto[]) {
    onChange({
      ...effect,
      paths: nextPaths
    })
  }

  return (
    <div className={editorFrame}>
      <header className={editorHeader}>
        <div className={editorBreadcrumbs} aria-label='Effect editor location'>
          <span className={editorBreadcrumbLink}>{sourceLabel || 'Content'}</span>
          <span>/</span>
          <span className={editorBreadcrumbLink}>Effects</span>
          <span>/</span>
          <span className={editorBreadcrumbLink}>{`Effect ${index + 1}`}</span>
          <span>/</span>
          <span className={editorBreadcrumbCurrent}>{currentTitle}</span>
        </div>
        <ActionIcon aria-label='Close effect editor' className={actionIcon} variant='subtle' onClick={onClose}>
          <IX size={18} />
        </ActionIcon>
      </header>

      <main className={editorContent}>
        <div className={editorContentInner}>
          <Stack gap={4}>
            <Title id={titleId} order={2}>{currentTitle}</Title>
            <Text className={editorContext}>{formatEffectSummary(effect)}</Text>
          </Stack>

          {editorStep === 'start'
            ? (
                <EffectInvocationStep
                  effect={effect}
                  index={index}
                  readOnly={readOnly}
                  onChange={onChange}
                />
              )
            : null}

          {editorStep === 'paths'
            ? (
                <OutcomePathsStep
                  paths={(effect.paths.length > 0 ? effect.paths : [fallbackPath]) as PathDto[]}
                  readOnly={readOnly}
                  onOpen={(pathIndex) => {
                    setActivePathIndex(pathIndex)
                    setEditorStep('pathDetail')
                  }}
                  onChange={(nextPaths) => updatePaths(nextPaths)}
                />
              )
            : null}

          {editorStep === 'pathDetail'
            ? (
                <PathEditor
                  path={activePath}
                  references={references}
                  readOnly={readOnly}
                  onChange={(nextPath) => updatePathAt(activePathIndex, nextPath)}
                />
              )
            : null}
        </div>
      </main>

      <footer className={editorFooter}>
        <Button
          variant='default'
          onClick={() => {
            if (editorStep === 'pathDetail') {
              setEditorStep('paths')
              return
            }
            if (editorStep === 'paths') {
              setEditorStep('start')
              return
            }
            onClose()
          }}
        >
          {getBackLabel(editorStep)}
        </Button>
        {editorStep === 'start'
          ? (
              <Button onClick={() => setEditorStep('paths')}>Next: outcome paths</Button>
            )
          : (
              <Button onClick={onClose}>{getPrimaryActionLabel(editorStep, readOnly)}</Button>
            )}
      </footer>
    </div>
  )
}

function getEffectEditorTitleId(effectId: string) {
  return `effect-editor-${effectId}-title`
}

function getBackLabel(editorStep: EffectEditorStep) {
  if (editorStep === 'pathDetail') return 'Back to paths'
  if (editorStep === 'paths') return 'Back to start'
  return 'Close'
}

function getPrimaryActionLabel(editorStep: EffectEditorStep, readOnly?: boolean) {
  if (editorStep === 'pathDetail') return readOnly ? 'Done' : 'Save path'
  return 'Done editing effect'
}

function getEditorTitle(editorStep: EffectEditorStep, activePath: PathDto) {
  if (editorStep === 'start') return 'How it Starts'
  if (editorStep === 'paths') return 'Outcome Paths'

  const pathLabel = pathCodeOptions.find((option) => option.value === activePath.pathCode)?.label ?? activePath.pathCode
  const resolutionLabel = activePath.selectionKind === 'ROLL_TABLE' ? 'Roll Table / Range' : 'Direct'
  return `${pathLabel} - ${resolutionLabel}`
}
