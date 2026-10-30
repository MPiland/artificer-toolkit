import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  type NodeRuntimePathDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { notifications } from '@mantine/notifications'
import {
  clearResolvedNodeFormPaths,
  toResolvedNodeValues,
  type ResolvedNodeClearableForm
} from '../node-map/nodeFormUtils'
import { hasMeaningfulAuthoringValueAtPaths, setAuthoringFieldValue } from '../utils/pathUtils'

type StructuralChangeRequest = {
  commit: () => void
  fieldName: string
  label: string
  nextValue: unknown
}

type StructuralChangeConfirmation = StructuralChangeRequest & {
  baseValuesFingerprint: string
  clearPaths: readonly NodeRuntimePathDto[]
  opener: HTMLElement | null
}

export type StructuralChangeGuard = {
  blocked: boolean
  cancel: () => void
  confirm: () => void
  confirmation?: StructuralChangeConfirmation
  request: (request: StructuralChangeRequest) => void
}

type UseStructuralChangeGuardOptions<TValues extends object> = {
  form: ResolvedNodeClearableForm<TValues>
  rootMapId?: string
  rootSystemId?: string
}

export function useStructuralChangeGuard<TValues extends object>({
  form,
  rootMapId,
  rootSystemId
}: UseStructuralChangeGuardOptions<TValues>): StructuralChangeGuard {
  const convex = useConvex()
  const [pending, setPending] = useState(false)
  const [confirmation, setConfirmation] = useState<StructuralChangeConfirmation>()
  const requestSequence = useRef(0)
  const restoreFocus = useCallback((opener: HTMLElement | null) => {
    window.setTimeout(() => {
      if (opener?.isConnected) opener.focus()
    }, 0)
  }, [])

  const cancel = useCallback(() => {
    const opener = confirmation?.opener ?? null
    requestSequence.current += 1
    setConfirmation(undefined)
    restoreFocus(opener)
  }, [confirmation, restoreFocus])

  const confirm = useCallback(() => {
    if (!confirmation) return

    requestSequence.current += 1
    if (
      fingerprintAuthoringValues(toResolvedNodeValues(form.state.values)) !==
      confirmation.baseValuesFingerprint
    ) {
      setConfirmation(undefined)
      restoreFocus(confirmation.opener)
      showChangeVerificationError(
        'The form changed before this update was confirmed. Try the change again.'
      )
      return
    }

    confirmation.commit()
    clearResolvedNodeFormPaths(form, confirmation.clearPaths)
    setConfirmation(undefined)
    restoreFocus(confirmation.opener)
  }, [confirmation, form, restoreFocus])

  const request = useCallback(
    (change: StructuralChangeRequest) => {
      const requestId = requestSequence.current + 1
      requestSequence.current = requestId
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (!rootMapId || !rootSystemId) {
        showChangeVerificationError('This change could not be verified. Try again.')
        return
      }

      const rootValues = toResolvedNodeValues(form.state.values)
      const baseValuesFingerprint = fingerprintAuthoringValues(rootValues)
      const prospectiveValues = setAuthoringFieldValue(
        rootValues,
        change.fieldName,
        change.nextValue
      )
      setPending(true)

      const normalizationRequest = {
        mapId: rootMapId,
        systemId: rootSystemId,
        values: prospectiveValues
      }
      void Promise.resolve()
        .then(() => {
          if (!convex) throw new Error('Native node runtime client is unavailable.')

          return convex.query(
            convexApi.authoring.nodeRuntime.normalizeValues,
            nodeRuntimeNormalizeValuesRequestDtoSchema.parse(
              JSON.parse(JSON.stringify(normalizationRequest))
            )
          )
        })
        .then((normalization) => {
          const verifiedNormalization =
            nodeRuntimeNormalizeValuesResponseDtoSchema.parse(normalization)
          if (requestSequence.current !== requestId) return
          if (
            fingerprintAuthoringValues(toResolvedNodeValues(form.state.values)) !==
            baseValuesFingerprint
          ) {
            showChangeVerificationError(
              'The form changed before this update was verified. Try the change again.'
            )
            return
          }

          if (
            hasMeaningfulAuthoringValueAtPaths(
              prospectiveValues,
              verifiedNormalization.clearedPaths
            )
          ) {
            setConfirmation({
              ...change,
              baseValuesFingerprint,
              clearPaths: verifiedNormalization.clearedPaths,
              opener
            })
            return
          }

          change.commit()
          clearResolvedNodeFormPaths(form, verifiedNormalization.clearedPaths)
        })
        .catch(() => {
          if (requestSequence.current !== requestId) return
          showChangeVerificationError('This change could not be verified. Try again.')
        })
        .finally(() => {
          if (requestSequence.current === requestId) setPending(false)
        })
    },
    [convex, form, rootMapId, rootSystemId]
  )

  useEffect(
    () => () => {
      requestSequence.current += 1
    },
    []
  )

  return useMemo(
    () => ({
      blocked: pending || Boolean(confirmation),
      cancel,
      confirm,
      confirmation,
      request
    }),
    [cancel, confirmation, confirm, pending, request]
  )
}

function fingerprintAuthoringValues(values: Record<string, unknown>): string {
  return JSON.stringify(values) ?? ''
}

function showChangeVerificationError(message: string) {
  notifications.show({
    color: 'red',
    message,
    title: 'Change not applied'
  })
}
