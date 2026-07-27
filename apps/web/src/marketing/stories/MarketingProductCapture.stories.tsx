import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button, Checkbox, CloseButton, Drawer, Popover, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Heart, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { expect, within } from 'storybook/test'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetFixture,
  characterSheetMulticlassFixture
} from '#domains/characters/character.fixtures'
import { CharacterSheetView } from '#domains/characters/components/sheet/CharacterSheetView'
import type { CharacterSheetTabId } from '#domains/characters/components/sheet/CharacterSheet.types'
import * as inspectorStyles from '#domains/characters/components/sheet/panels/characterSheetInspector.css'
import { Shell, platformNavigation } from '#app/shell'
import * as restStyles from './CharacterSheetShortRestPreview.css'

const meta = {
  title: 'Guest/Marketing/Product captures',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function CharacterSheetCapture({
  sheet = characterSheetFixture,
  initialTab = 'spells'
}: {
  sheet?: CharacterSheetResponseDto
  initialTab?: CharacterSheetTabId
}) {
  return (
    <Shell
      navigation={platformNavigation}
      currentPath={`/characters/${sheet.publicId ?? sheet.meta.characterId}`}
      isAuthenticated
      userEmail='player@example.test'
    >
      <CharacterSheetView
        characterPublicId={sheet.publicId ?? sheet.meta.characterId}
        hasDraft={false}
        initialTab={initialTab}
        sheet={sheet}
      />
    </Shell>
  )
}

function ShortRestPreviewContent({ initialRollResult }: { initialRollResult?: number }) {
  const [selectedD10, setSelectedD10] = useState(1)
  const [selectedD8, setSelectedD8] = useState(1)
  const [resetMaximumHitPoints, setResetMaximumHitPoints] = useState(false)
  const [applyHealing, setApplyHealing] = useState(true)
  const [rollResult, setRollResult] = useState<number | null>(initialRollResult ?? null)
  const selectedHitDice = selectedD10 + selectedD8
  const constitutionBonus = selectedHitDice * 2
  const rollExpression =
    selectedHitDice === 0
      ? 'Choose hit dice'
      : [
          selectedD10 > 0 ? `${selectedD10}d10` : null,
          selectedD8 > 0 ? `${selectedD8}d8` : null,
          constitutionBonus > 0 ? `${constitutionBonus}` : null
        ]
          .filter(Boolean)
          .join(' + ')

  return (
    <div className={restStyles.body}>
      <Text className={restStyles.description}>
        Choose hit dice, then review the recovery before applying it.
      </Text>

      <div className={restStyles.vitals}>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Current HP</Text>
          <Text className={restStyles.value}>20 / 26</Text>
        </div>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Temp HP</Text>
          <Text className={restStyles.value}>0</Text>
        </div>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Missing</Text>
          <Text className={restStyles.value}>6 HP</Text>
        </div>
      </div>

      <section className={restStyles.section} aria-labelledby='short-rest-recovery-options'>
        <Text className={restStyles.sectionTitle} id='short-rest-recovery-options'>
          Recovery Options
        </Text>
        <div className={restStyles.options}>
          <Checkbox
            checked={resetMaximumHitPoints}
            label='Reset Maximum HP changes during this rest'
            onChange={(event) => setResetMaximumHitPoints(event.currentTarget.checked)}
          />
          <Checkbox
            checked={applyHealing}
            label='Automatically apply healing with dice result'
            onChange={(event) => setApplyHealing(event.currentTarget.checked)}
          />
        </div>
      </section>

      <section className={restStyles.section} aria-labelledby='short-rest-hit-dice'>
        <div className={restStyles.sectionHeading}>
          <Text className={restStyles.sectionTitle} id='short-rest-hit-dice'>
            Spend Hit Dice
          </Text>
          <Text className={restStyles.sectionMeta}>2 of 3 available</Text>
        </div>
        <div className={restStyles.hitDiceList}>
          <div className={restStyles.hitDieRow}>
            <div className={restStyles.hitDieIdentity}>
              <Text className={restStyles.hitDieName}>Fighter d10</Text>
              <Text className={restStyles.hitDieMeta}>1 of 2 available · adds +2 CON</Text>
            </div>
            <div className={restStyles.stepper} aria-label='Selected d10 hit dice'>
              <Button
                className={restStyles.stepperButton}
                aria-label='Remove one d10 hit die'
                disabled={selectedD10 === 0}
                size='xs'
                variant='default'
                onClick={() => {
                  setSelectedD10(0)
                  setRollResult(null)
                }}
              >
                <Minus aria-hidden='true' size={14} />
              </Button>
              <Text className={restStyles.stepperValue}>{selectedD10}</Text>
              <Button
                className={restStyles.stepperButton}
                aria-label='Add one d10 hit die'
                disabled={selectedD10 === 1}
                size='xs'
                variant='default'
                onClick={() => {
                  setSelectedD10(1)
                  setRollResult(null)
                }}
              >
                <Plus aria-hidden='true' size={14} />
              </Button>
            </div>
          </div>
          <div className={restStyles.hitDieRow}>
            <div className={restStyles.hitDieIdentity}>
              <Text className={restStyles.hitDieName}>Rogue d8</Text>
              <Text className={restStyles.hitDieMeta}>1 of 1 available · adds +2 CON</Text>
            </div>
            <div className={restStyles.stepper} aria-label='Selected d8 hit dice'>
              <Button
                className={restStyles.stepperButton}
                aria-label='Remove one d8 hit die'
                disabled={selectedD8 === 0}
                size='xs'
                variant='default'
                onClick={() => {
                  setSelectedD8(0)
                  setRollResult(null)
                }}
              >
                <Minus aria-hidden='true' size={14} />
              </Button>
              <Text className={restStyles.stepperValue}>{selectedD8}</Text>
              <Button
                className={restStyles.stepperButton}
                aria-label='Add one d8 hit die'
                disabled={selectedD8 === 1}
                size='xs'
                variant='default'
                onClick={() => {
                  setSelectedD8(1)
                  setRollResult(null)
                }}
              >
                <Plus aria-hidden='true' size={14} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className={restStyles.diceAction}>
        <Button
          className={restStyles.diceButton}
          disabled={selectedHitDice === 0}
          rightSection={<Heart aria-hidden='true' size={15} />}
          variant='default'
          onClick={() => setRollResult(15)}
        >
          {rollExpression}
        </Button>
      </div>

      <div className={restStyles.recoverySummary}>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Roll status</Text>
          <Text className={restStyles.recoveryValue}>
            {rollResult == null ? 'Ready to roll' : `${rollResult} rolled`}
          </Text>
        </div>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Healing</Text>
          <Text className={restStyles.recoveryValue}>
            {rollResult == null
              ? '6 HP missing'
              : applyHealing
                ? `${Math.min(6, rollResult)} HP staged`
                : 'Waiting to apply'}
          </Text>
        </div>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Automatic recovery</Text>
          <Text className={restStyles.recoveryValue}>Second Wind, Action Surge</Text>
        </div>
        <Text className={restStyles.note}>
          Temp HP is unchanged. The roll and selected recoveries commit with the rest.
        </Text>
      </div>

      <div className={restStyles.actions}>
        <Button variant='default'>Cancel</Button>
        <Button disabled={selectedHitDice === 0}>Take Short Rest</Button>
      </div>
    </div>
  )
}

function ShortRestPreviewOverlay({ initialRollResult }: { initialRollResult?: number }) {
  const isMobile = useMediaQuery('(max-width: 760px)', false)

  if (isMobile) {
    return (
      <Drawer
        classNames={{
          body: inspectorStyles.drawerBody,
          content: inspectorStyles.drawerContent,
          header: inspectorStyles.drawerHeader,
          title: inspectorStyles.drawerTitle
        }}
        closeButtonProps={{ 'aria-label': 'Close short rest preview' }}
        opened
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
        position='bottom'
        size='min(48rem, calc(100dvh - 3.5rem))'
        title='Short Rest'
        onClose={() => undefined}
      >
        <div className={restStyles.drawerBody}>
          <ShortRestPreviewContent initialRollResult={initialRollResult} />
        </div>
      </Drawer>
    )
  }

  return (
    <Popover
      hideDetached={false}
      opened
      position='bottom-end'
      shadow='md'
      transitionProps={{ duration: 0 }}
      width={420}
      withinPortal
    >
      <Popover.Target>
        <button
          className={restStyles.popoverAnchor}
          aria-hidden='true'
          tabIndex={-1}
          type='button'
        />
      </Popover.Target>
      <Popover.Dropdown
        aria-labelledby='character-sheet-short-rest-preview-title'
        className={restStyles.popover}
      >
        <div className={restStyles.header}>
          <Text className={restStyles.title} id='character-sheet-short-rest-preview-title'>
            Short Rest
          </Text>
          <CloseButton aria-label='Close short rest preview' />
        </div>
        <ShortRestPreviewContent initialRollResult={initialRollResult} />
      </Popover.Dropdown>
    </Popover>
  )
}

function CharacterSheetShortRestCapture({ initialRollResult }: { initialRollResult?: number }) {
  return (
    <>
      <CharacterSheetCapture initialTab='actions' sheet={characterSheetMulticlassFixture} />
      <ShortRestPreviewOverlay initialRollResult={initialRollResult} />
    </>
  )
}

export const CharacterSheet: Story = {
  render: () => <CharacterSheetCapture />
}

export const CharacterSheetMulticlass: Story = {
  render: () => (
    <CharacterSheetCapture initialTab='actions' sheet={characterSheetMulticlassFixture} />
  )
}

export const CharacterSheetShortRest: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await expect(within(dialog).getByText('1d10 + 1d8 + 4')).toBeVisible()
    await expect(
      within(dialog).getByLabelText('Reset Maximum HP changes during this rest')
    ).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  },
  render: () => <CharacterSheetShortRestCapture />
}

export const CharacterSheetShortRestMobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  },
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await expect(within(dialog).getByText('1d10 + 1d8 + 4')).toBeVisible()
    await expect(
      within(dialog).getByLabelText('Automatically apply healing with dice result')
    ).toBeChecked()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  },
  render: () => <CharacterSheetShortRestCapture />
}

export const CharacterSheetShortRestRolled: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await expect(within(dialog).getByText('15 rolled')).toBeVisible()
    await expect(within(dialog).getByText('6 HP staged')).toBeVisible()
  },
  render: () => <CharacterSheetShortRestCapture initialRollResult={15} />
}
