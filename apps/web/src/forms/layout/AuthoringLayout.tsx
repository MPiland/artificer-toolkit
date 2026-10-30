import { AuthoringPanelsProvider, AuthoringPreviewProvider } from './AuthoringPanelsProvider'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Group, Stack } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import { useMatches } from '@tanstack/react-router'
import * as styles from './AuthoringLayout.css'
import { ResetFormConfirmation } from './Actions/ResetFormConfirmation'
import { Steps } from './Steps/Steps'
import { useAuthoringPanels, useAuthoringPreview } from './AuthoringLayoutContext'
import { Previews } from './Previews/Previews'
import { AuthoringFormProvider } from './AuthoringFormProvider'
import { Editor } from './Editor/Editor'
import {
  useAuthoringActions,
  useAuthoringFormStore,
  useAuthoringSession,
  type AuthoringDomainRegistration
} from './AuthoringFormContext'
import { FormRenderer } from '../rendering/FormRenderer'
import { InvalidDraftAlert } from './Editor/SectionRow/InvalidDraftAlert'
import { SystemChoiceAlert } from './SystemChoiceAlert'
import type { AuthoredFormDomainRegistration } from '../factories/authoredFormFactories'
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
import type { AuthoredFormRouteMode } from './authoredFormRouteContext'
import { useShellHeaderSupplement } from '#app/shell'
import { getAuthoringStatus, getRulesetLabel } from './AuthoringLayout.utils'
import { useAuthoringSaveShortcut } from './useAuthoringSaveShortcut'
import { useAuthoringExperience } from './useAuthoringExperience'
import { GuidedAuthoring } from '../guided/GuidedAuthoring'
import type { GuidedAuthoringState } from '../guided/guidedAuthoring.types'
import { isObjectValue } from '../utils/valueGuards'

type EmptyAuthoringLayoutProps = {
  children?: ReactNode
  data?: never
  domain?: never
  mode?: never
}

type AuthoringLayoutProps = { children?: ReactNode } & (
  | AuthoredFormDomainRegistration
  | EmptyAuthoringLayoutProps
)

const EMPTY_FORM_VALUES: object = {}
const INITIAL_GUIDED_STATE: GuidedAuthoringState = { isReview: false, showPreview: false }
const AuthoredFormRenderer = FormRenderer({ defaultValues: EMPTY_FORM_VALUES })

export function AuthoringLayoutContent({ children }: { children?: ReactNode }) {
  return (
    <AuthoringPanelsProvider>
      <AuthoringPreviewProvider>
        <AuthoringLayoutShell>{children}</AuthoringLayoutShell>
      </AuthoringPreviewProvider>
    </AuthoringPanelsProvider>
  )
}

function AuthoringLayoutShell({ children }: { children?: ReactNode }) {
  const { isWideDesktop } = useAuthoringPanels()
  const { setPreviewContent } = useAuthoringPreview()
  const {
    authoredSession: session,
    hasActiveDraft,
    isDiscardingDraft,
    isDraft,
    isHostedForm,
    mode,
    subjectLabel
  } = useAuthoringSession()
  const status = getAuthoringStatus(mode, isDraft || hasActiveDraft)
  const { cancel, discardDraft } = useAuthoringActions()
  const { form } = useAuthoringFormStore()
  const { experience, isUpdating: isExperienceUpdating, setExperience } = useAuthoringExperience()
  const [guidedState, setGuidedState] = useState<GuidedAuthoringState>(INITIAL_GUIDED_STATE)
  const rulesetLabel = getRulesetLabel(session?.system)
  useShellHeaderSupplement(rulesetLabel ?? null)
  useAuthoringSaveShortcut()
  const canonicalLabel = useSelector(form.store, (state) =>
    readPreviewLabel(state.values, session?.fallbackLabel ?? 'Untitled Item')
  )
  const editorTitle = isHostedForm ? subjectLabel : canonicalLabel
  const guidedAvailable = Boolean(session && isGuidedSessionEligible(session))
  const isGuided =
    experience === 'guided' &&
    guidedAvailable &&
    !session?.systemRequired &&
    session?.system !== null &&
    session?.system !== undefined
  const guidedModeButtonRef = useRef<HTMLButtonElement>(null)
  const previousGuidedRef = useRef(isGuided)
  const guidedModeFocusPendingRef = useRef(false)
  useEffect(() => {
    const wasGuided = previousGuidedRef.current
    previousGuidedRef.current = isGuided

    if (!guidedAvailable) {
      guidedModeFocusPendingRef.current = false
      return
    }
    if (wasGuided && !isGuided) guidedModeFocusPendingRef.current = true
    if (guidedModeFocusPendingRef.current && !isGuided && !isExperienceUpdating) {
      guidedModeButtonRef.current?.focus()
      guidedModeFocusPendingRef.current = false
    }
  }, [guidedAvailable, isExperienceUpdating, isGuided])
  const [guidedStateKey, setGuidedStateKey] = useState(session?.key)
  if (guidedStateKey !== session?.key) {
    setGuidedStateKey(session?.key)
    setGuidedState(INITIAL_GUIDED_STATE)
  }

  const previewContent = useMemo(() => {
    if (!session?.renderPreview) return undefined

    return (
      <form.Subscribe selector={(state) => state.values}>
        {(nextValues) =>
          session.renderPreview?.({
            domain: session.domain,
            label: readPreviewLabel(nextValues, session.fallbackLabel),
            statusLabel: status.label,
            system: session.system,
            values: nextValues
          })
        }
      </form.Subscribe>
    )
  }, [form, session, status.label])

  const visiblePreviewContent = isGuided && !guidedState.showPreview ? undefined : previewContent

  useEffect(() => {
    setPreviewContent(visiblePreviewContent)
  }, [setPreviewContent, visiblePreviewContent])

  useEffect(() => () => setPreviewContent(undefined), [setPreviewContent])

  const editorContent = useMemo(() => {
    if (!session) return children

    const domainLabel = session.subjectKindLabel.toLowerCase()

    if (session.systemRequired) {
      return (
        <Stack>
          <SystemChoiceAlert subjectPlural={`${domainLabel}s`} systems={session.systems} />
          <Button onClick={() => void cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    if (session.invalidDraftOnly) {
      return (
        <Stack>
          <InvalidDraftAlert
            domainLabel={domainLabel}
            isDiscarding={isDiscardingDraft}
            onDiscard={() => void discardDraft()}
          />
          <Button onClick={() => void cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    if (session.notFound) {
      return (
        <Stack>
          <Alert color='yellow'>{`That ${domainLabel} could not be found.`}</Alert>
          <Button onClick={() => void cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    const renderer = isGuided ? (
      <AuthoredFormRenderer
        canvasContent={
          <GuidedAuthoring
            key={session.key}
            form={form}
            session={session}
            onAdvanced={isExperienceUpdating ? undefined : () => void setExperience('advanced')}
            onStateChange={setGuidedState}
          />
        }
        form={form}
        mapId={session.mapId}
        readOnly={session.readOnly}
        systemId={session.systemId}
      />
    ) : (
      <Stack gap='xs'>
        {guidedAvailable ? (
          <Group justify='flex-end'>
            <Button
              disabled={isExperienceUpdating}
              ref={guidedModeButtonRef}
              size='compact-sm'
              type='button'
              variant='subtle'
              onClick={() => void setExperience('guided')}
            >
              Use guided authoring
            </Button>
          </Group>
        ) : null}
        <AuthoredFormRenderer
          form={form}
          mapId={session.mapId}
          readOnly={session.readOnly}
          systemId={session.systemId}
        />
      </Stack>
    )

    return (
      <>
        {session.hasInvalidDraft ? (
          <InvalidDraftAlert
            domainLabel={domainLabel}
            isDiscarding={isDiscardingDraft}
            onDiscard={() => void discardDraft()}
          />
        ) : null}
        {renderer}
      </>
    )
  }, [
    cancel,
    children,
    discardDraft,
    form,
    guidedAvailable,
    isDiscardingDraft,
    isExperienceUpdating,
    isGuided,
    session,
    setExperience
  ])

  const shell = (
    <>
      <main
        className={styles.canvas}
        data-testid='authoring-form-canvas'
        data-structure-open={isWideDesktop ? 'true' : 'false'}
      >
        <section id='authoring-workspace' className={styles.workspace}>
          {isGuided ? null : <Steps />}
          <Editor
            showActivate={!isGuided || guidedState.isReview}
            showStepNavigation={!isGuided}
            title={editorTitle}
          >
            {editorContent}
          </Editor>
          <Previews />
        </section>
      </main>
      <ResetFormConfirmation />
    </>
  )

  if (!session) return shell

  return <form.AppForm>{shell}</form.AppForm>
}

export function AuthoringLayout(props: AuthoringLayoutProps) {
  const { children } = props
  const routeRegistration = useMatches({
    select: (matches) => getAuthoredFormRouteRegistration(matches)
  })
  const registration = isExplicitAuthoringRegistration(props) ? props : routeRegistration

  if (registration?.domain) {
    return (
      <AuthoringFormProvider
        data={registration.data}
        domain={registration.domain}
        mode={registration.mode}
      >
        <AuthoringLayoutContent>{children}</AuthoringLayoutContent>
      </AuthoringFormProvider>
    )
  }

  return (
    <AuthoringFormProvider>
      <AuthoringLayoutContent>{children}</AuthoringLayoutContent>
    </AuthoringFormProvider>
  )
}

function isExplicitAuthoringRegistration(
  props: AuthoringLayoutProps
): props is AuthoredFormDomainRegistration {
  return Boolean(props.domain)
}

const AUTHORED_FORM_DOMAINS: Record<AuthoredFormDomain, true> = {
  background: true,
  class: true,
  creature: true,
  equipment: true,
  feat: true,
  race: true,
  spell: true,
  vehicle: true
}

type AuthoredFormRouteMatch = {
  context: unknown
  loaderData?: unknown
}

function getAuthoredFormRouteRegistration(
  matches: readonly AuthoredFormRouteMatch[]
): AuthoringDomainRegistration | undefined {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    const authoring = readAuthoringRouteContext(match.context)
    const data = readAuthoringRouteData(match.loaderData)

    if (authoring && data !== undefined) {
      return { data, domain: authoring.domain, mode: authoring.mode }
    }
  }

  return undefined
}

function readAuthoringRouteContext(
  value: unknown
): { domain: AuthoredFormDomain; mode: AuthoredFormRouteMode } | undefined {
  if (!isObjectValue(value)) return undefined
  const authoring = value.authoring

  if (!isObjectValue(authoring)) return undefined

  return isAuthoredFormDomain(authoring.domain) && isAuthoredFormRouteMode(authoring.mode)
    ? { domain: authoring.domain, mode: authoring.mode }
    : undefined
}

function readAuthoringRouteData(value: unknown): unknown {
  if (!isObjectValue(value) || !('authoringData' in value)) return undefined

  return value.authoringData
}

function isAuthoredFormDomain(value: unknown): value is AuthoredFormDomain {
  return typeof value === 'string' && value in AUTHORED_FORM_DOMAINS
}

function isAuthoredFormRouteMode(value: unknown): value is AuthoredFormRouteMode {
  return value === 'create' || value === 'edit'
}

function readPreviewLabel(values: object, fallbackLabel: string): string {
  if (!('label' in values) || typeof values.label !== 'string') return fallbackLabel

  return values.label.trim() || fallbackLabel
}

function isGuidedSessionEligible(session: AuthoredFormSession) {
  if (session.readOnly || session.invalidDraftOnly || session.notFound) return false
  if (session.mode === 'create') return true

  return (
    session.mode === 'edit' &&
    session.isDraft &&
    !session.hasActiveDraft &&
    session.provenanceKind === 'OWNED'
  )
}
