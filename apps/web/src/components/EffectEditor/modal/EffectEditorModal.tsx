import { useState } from 'react'
import { ActionIcon, Button, Stack, Text, Title } from '@mantine/core'
import type { EffectDto, PathDto } from '@artificer-toolkit/schema'
import IX from '#assets/icons/IX'
import { withForm } from '#components/Form/runtime'
import { EffectInvocationBridge } from './EffectInvocationBridge'
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
  editorHeader
} from '../EffectEditor.css'
import { OutcomePathsStep } from '../steps/OutcomePathsStep'
import { PathEditorBridge } from './PathEditorBridge'
import type { EffectEditorReferenceData } from '../effectEditor.types'
import { createDefaultEffect, createDefaultPath, formatEffectSummary, pathCodeOptions } from '../effectEditor.utils'

type EffectEditorStep = 'start' | 'paths' | 'pathDetail'

const emptyReferences: EffectEditorReferenceData = {
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

const effectEditorModalDefaultValues: EffectDto = createDefaultEffect(1)

export const EffectEditorModalForm = withForm({
  defaultValues: effectEditorModalDefaultValues,
  props: {
    index: 0,
    references: emptyReferences,
    readOnly: false,
    sourceLabel: '',
    titleId: undefined as string | undefined,
    onClose: noop
  },
  render: function EffectEditorModalFormRender({ form, index, references, readOnly, sourceLabel, titleId, onClose }) {
    const [editorStep, setEditorStep] = useState<EffectEditorStep>('start')
    const [activePathIndex, setActivePathIndex] = useState(0)

    return (
      <form.Subscribe selector={(state): EffectDto => state.values}>
        {(effect) => {
          const fallbackPath = effect.paths[0] ?? createDefaultPath(1)
          const activePath = effect.paths[activePathIndex] ?? fallbackPath
          const currentTitle = getEditorTitle(editorStep, activePath)

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
                        <EffectInvocationBridge
                          invocation={effect.invocation}
                          index={index}
                          readOnly={readOnly}
                          onChange={(nextInvocation) => {
                            form.setFieldValue('invocation', nextInvocation)
                          }}
                        />
                      )
                    : null}

                  {editorStep === 'paths'
                    ? (
                        <OutcomePathsStep
                          form={form}
                          fields={{ paths: 'paths' }}
                          readOnly={readOnly}
                          onOpen={(pathIndex) => {
                            setActivePathIndex(pathIndex)
                            setEditorStep('pathDetail')
                          }}
                        />
                      )
                    : null}

                  {editorStep === 'pathDetail'
                    ? (
                        <PathEditorBridge
                          path={activePath}
                          references={references}
                          readOnly={readOnly}
                          onChange={(nextPath) => {
                            void form.replaceFieldValue('paths', activePathIndex, nextPath)
                          }}
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
        }}
      </form.Subscribe>
    )
  }
})

function noop() {}

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
