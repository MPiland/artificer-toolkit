import { AuthoringLayoutProvider } from './AuthoringLayoutProvider'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useMatches } from '@tanstack/react-router'
import * as styles from './AuthoringLayout.css'
import { ResetFormConfirmation } from './Actions/ResetFormConfirmation'
import { Steps } from './Steps/Steps'
import { useAuthoringLayout } from './AuthoringLayoutContext'
import { Previews } from './Previews/Previews'
import { Header } from './Header/Header'
import { AuthoringFormProvider } from './AuthoringFormProvider'
import { Editor } from './Editor/Editor'
import {
  useAuthoringForm,
  type AuthoringDomainRegistration,
  type AuthoringFormActionHandlers
} from './AuthoringFormContext'
import { useAppForm } from '../app-form/AppForm'
import { clearResolvedNodeFormPaths } from '../node-map/nodeFormUtils'
import { FormRenderer } from '../rendering/FormRenderer'
import { InvalidDraftAlert } from './Editor/SectionRow/InvalidDraftAlert'
import type { AuthoredFormDomainRegistration } from '../factories/authoredFormFactories'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import type { AuthoredFormRouteMode, CharacterBuilderRouteMode } from './authoredFormRouteContext'
import { CharacterBuilderAuthoringRuntime } from '#domains/characters/builder/core/CharacterBuilderAuthoringRuntime'
import { useBreakpoints } from '#ui'
import { useShellHeaderSupplement } from '#app/shell'
import { getRulesetLabel } from './AuthoringLayout.utils'

type EmptyAuthoringLayoutProps = {
  children?: ReactNode
  data?: never
  domain?: never
  kind?: never
  mode?: never
}

type AuthoringLayoutProps = { children?: ReactNode } & (
  | AuthoredFormDomainRegistration
  | CharacterBuilderDomainRegistration
  | EmptyAuthoringLayoutProps
)

type CharacterBuilderDomainRegistration = {
  data?: unknown
  kind: 'character-builder'
  mode?: CharacterBuilderRouteMode
}

const EMPTY_FORM_VALUES: object = {}
const AuthoredFormRenderer = FormRenderer({ defaultValues: EMPTY_FORM_VALUES })

export function AuthoringLayoutContent({ children }: { children?: ReactNode }) {
  return (
    <AuthoringLayoutProvider>
      <AuthoringLayoutShell>{children}</AuthoringLayoutShell>
    </AuthoringLayoutProvider>
  )
}

function AuthoringLayoutShell({ children }: { children?: ReactNode }) {
  const { stepsNavigationOpen, setPreviewContent } = useAuthoringLayout()
  const { isMobile, isTabletPortrait } = useBreakpoints()
  const usesOverlayNavigation = isMobile || isTabletPortrait
  const authoring = useAuthoringForm()
  const session = authoring.authoredSession
  const characterSession = authoring.characterSession
  const rulesetLabel = getRulesetLabel(session?.system)
  useShellHeaderSupplement(rulesetLabel ?? null)
  const { activateValues, clearValidationIssues, saveDraftValues, updateAuthoringFormActions } =
    authoring
  const defaultValues = useMemo(() => session?.initialValues ?? EMPTY_FORM_VALUES, [session])
  const form = useAppForm({
    defaultValues,
    listeners: {
      onChange: ({ fieldApi }) => clearValidationIssues(fieldApi.name)
    },
    onSubmit: async ({ value }) => {
      if (!session) return
      await activateValues(value)
    }
  })
  useEffect(() => {
    if (!session) return
    form.reset(session.initialValues)
  }, [form, session])

  const previewContent = useMemo(() => {
    if (!session?.renderPreview) return undefined

    return (
      <form.Subscribe selector={(state) => state.values}>
        {(nextValues) =>
          session.renderPreview?.({
            domain: session.domain,
            system: session.system,
            values: nextValues
          })
        }
      </form.Subscribe>
    )
  }, [form, session])

  useEffect(() => {
    setPreviewContent(previewContent)
  }, [previewContent, setPreviewContent])

  useEffect(() => () => setPreviewContent(undefined), [setPreviewContent])

  const formActions = useMemo<AuthoringFormActionHandlers>(
    () => ({
      onActivate: () => form.handleSubmit(),
      onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
      onResetForm: () => form.reset(session?.initialValues ?? EMPTY_FORM_VALUES),
      onSaveDraft: () => {
        if (!session) return
        return saveDraftValues(form.state.values)
      }
    }),
    [form, saveDraftValues, session]
  )

  useEffect(() => {
    if (!session) return
    updateAuthoringFormActions(formActions)
  }, [formActions, session, updateAuthoringFormActions])

  const editorContent = useMemo(() => {
    if (characterSession) {
      return <CharacterBuilderAuthoringRuntime session={characterSession} />
    }

    if (!session) return children

    const domainLabel = session.subjectKindLabel.toLowerCase()

    if (session.systemRequired) {
      return (
        <Stack>
          <Alert color='yellow'>{`A system is required before creating ${domainLabel}s.`}</Alert>
          <Button onClick={() => void authoring.cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    if (session.invalidDraftOnly) {
      return (
        <Stack>
          <InvalidDraftAlert
            domainLabel={domainLabel}
            isDiscarding={authoring.isDiscardingDraft}
            onDiscard={() => void authoring.discardDraft()}
          />
          <Button onClick={() => void authoring.cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    if (session.notFound) {
      return (
        <Stack>
          <Alert color='yellow'>{`That ${domainLabel} could not be found.`}</Alert>
          <Button onClick={() => void authoring.cancel()}>{`Back to ${domainLabel}s`}</Button>
        </Stack>
      )
    }

    return (
      <>
        {session.hasInvalidDraft ? (
          <InvalidDraftAlert
            domainLabel={domainLabel}
            isDiscarding={authoring.isDiscardingDraft}
            onDiscard={() => void authoring.discardDraft()}
          />
        ) : null}
        <AuthoredFormRenderer
          form={form}
          mapId={session.mapId}
          readOnly={session.readOnly}
          systemId={session.systemId}
        />
      </>
    )
  }, [authoring, characterSession, children, form, session])

  const shell = (
    <>
      <main
        className={styles.canvas}
        data-testid='authoring-form-canvas'
        data-structure-open={!usesOverlayNavigation && stepsNavigationOpen ? 'true' : 'false'}
      >
        <Header />
        <section id='authoring-workspace' className={styles.workspace}>
          <Steps />
          <Editor>{editorContent}</Editor>
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

  if (registration && 'kind' in registration && registration.kind === 'character-builder') {
    return (
      <AuthoringFormProvider
        data={registration.data}
        kind='character-builder'
        mode={registration.mode}
      >
        <AuthoringLayoutContent>{children}</AuthoringLayoutContent>
      </AuthoringFormProvider>
    )
  }

  if (registration && 'domain' in registration && registration.domain) {
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
): props is AuthoredFormDomainRegistration | CharacterBuilderDomainRegistration {
  return Boolean(('domain' in props && props.domain) || ('kind' in props && props.kind))
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

type AuthoringRouteRegistration = AuthoringDomainRegistration | CharacterBuilderDomainRegistration

function getAuthoredFormRouteRegistration(
  matches: readonly AuthoredFormRouteMatch[]
): AuthoringRouteRegistration | undefined {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    const authoring = readAuthoringRouteContext(match.context)
    const data = readAuthoringRouteData(match.loaderData)

    if (authoring && data !== undefined) {
      return authoring.kind === 'character-builder'
        ? {
            data,
            kind: 'character-builder',
            mode: authoring.mode
          }
        : {
            data,
            domain: authoring.domain,
            mode: authoring.mode
          }
    }
  }

  return undefined
}

function readAuthoringRouteContext(
  value: unknown
):
  | { domain: AuthoredFormDomain; kind: 'authored-form'; mode: AuthoredFormRouteMode }
  | { kind: 'character-builder'; mode: CharacterBuilderRouteMode }
  | undefined {
  if (!isRecord(value)) return undefined
  const authoring = value.authoring

  if (!isRecord(authoring)) return undefined

  if (authoring.kind === 'character-builder' && isAuthoredFormRouteMode(authoring.mode)) {
    return {
      kind: 'character-builder',
      mode: authoring.mode
    }
  }

  return isAuthoredFormDomain(authoring.domain) && isAuthoredFormRouteMode(authoring.mode)
    ? {
        domain: authoring.domain,
        kind: 'authored-form',
        mode: authoring.mode
      }
    : undefined
}

function readAuthoringRouteData(value: unknown): unknown {
  if (!isRecord(value) || !('authoringData' in value)) return undefined

  return value.authoringData
}

function isAuthoredFormDomain(value: unknown): value is AuthoredFormDomain {
  return typeof value === 'string' && value in AUTHORED_FORM_DOMAINS
}

function isAuthoredFormRouteMode(value: unknown): value is AuthoredFormRouteMode {
  return value === 'create' || value === 'edit'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
