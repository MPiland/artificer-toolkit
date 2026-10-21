import { Button, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useId } from 'react'
import type {
  EncounterCommandResultDto,
  MoveHeldEffectInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { ACTIVATION_REGISTRY, formatLengthMeasurement } from '@artificer-toolkit/shared/core'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import {
  effectOfferKey,
  EFFECT_OFFER_KIND_LABELS,
  type MoveEffectOfferChoice
} from './effectOffers.model'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type EffectOffersProps = {
  offers: MoveEffectOfferChoice[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  /** The creatures an offer's pick may name, by id; the effect's current holder is never one. */
  creatures: ReadonlyArray<{ id: string; label: string }>
  holderLabel: (holderActorId: string) => string
  /** The offer whose new holder is being chosen, by `effectOfferKey`; null when none. */
  chosenOfferKey: string | null
  /** The new holder picked in the list or on the map; null until one is. */
  targetActorId: string | null
  /** The Scene read that measures the offer's range, or null when the Scene cannot place both tokens. */
  sceneContext: (
    offer: MoveEffectOfferChoice,
    targetActorId: string
  ) => MoveHeldEffectInputDto['sceneContext']
  onChooseOffer: (key: string | null) => void
  onTargetPick: (actorId: string | null) => void
  onPickOnMap: () => void
  onMove: (command: MoveHeldEffectInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The choices held effects offer the current actor beside their holders' turns (D160): one row per
 * live offer, with the cost it spends and how far its pick reaches. Choosing an offer opens a pick
 * of the creature that holds the effect next. The outcome belongs to the offers on offer, so a
 * different actor or set of offers starts afresh.
 */
export function CampaignTabletopEffectOffers(props: EffectOffersProps) {
  const offersKey = `${props.actorId}:${props.offers.map(effectOfferKey).join()}`
  return <EffectOfferList key={offersKey} {...props} />
}

function EffectOfferList({
  offers,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  creatures,
  holderLabel,
  chosenOfferKey,
  targetActorId,
  sceneContext,
  onChooseOffer,
  onTargetPick,
  onPickOnMap,
  onMove
}: EffectOffersProps) {
  const titleId = useId()
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)
  const busy = disabled || submittingId !== null

  function move(
    offer: MoveEffectOfferChoice,
    newHolderId: string,
    acknowledgedWarnings: MoveHeldEffectInputDto['acknowledgedWarnings']
  ) {
    return run(
      effectOfferKey(offer),
      () =>
        onMove({
          type: 'MOVE_HELD_EFFECT',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          effectId: offer.effectId,
          offerIndex: offer.offerIndex,
          target: { kind: 'ACTOR', actorId: newHolderId },
          acknowledgedWarnings,
          sceneContext: sceneContext(offer, newHolderId)
        }),
      { done: () => 'Effect moved.', failed: 'The effect could not be moved.' }
    )
  }

  const confirmingOffer = offers.find((offer) => effectOfferKey(offer) === confirming?.id)
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <Title id={titleId} order={3} size='h5'>
        Effect choices
      </Title>
      <ul className={styles.list}>
        {offers.map((offer) => {
          const key = effectOfferKey(offer)
          const chosen = key === chosenOfferKey
          const label = `${EFFECT_OFFER_KIND_LABELS[offer.kind]} on ${holderLabel(offer.holderActorId)}`
          return (
            <li className={styles.row} key={key}>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text fw={600} size='sm'>
                  {label}{' '}
                  <Text c='dimmed' component='span' fw={400} size='xs'>
                    · {ACTIVATION_REGISTRY[offer.activation].label} · within{' '}
                    {formatLengthMeasurement(offer.range)}
                  </Text>
                </Text>
                {offer.warnings.length ? (
                  <Text c='dimmed' size='xs'>
                    {offer.warnings.map((warning) => warning.message).join(' ')}
                  </Text>
                ) : null}
                {chosen ? (
                  <Group align='flex-end' wrap='nowrap'>
                    <Select
                      comboboxProps={{ withinPortal: false }}
                      data={creatures
                        .filter(({ id }) => id !== offer.holderActorId)
                        .map(({ id, label: creature }) => ({ label: creature, value: id }))}
                      disabled={busy}
                      label='New holder'
                      searchable
                      value={targetActorId}
                      onChange={onTargetPick}
                    />
                    <Button disabled={busy} variant='default' onClick={onPickOnMap}>
                      Pick on map
                    </Button>
                  </Group>
                ) : null}
              </Stack>
              {chosen ? (
                <Button
                  disabled={busy || targetActorId === null}
                  loading={submittingId === key}
                  size='xs'
                  onClick={() => targetActorId && void move(offer, targetActorId, [])}
                >
                  Move
                </Button>
              ) : (
                <Button
                  aria-label={label}
                  disabled={busy}
                  size='xs'
                  variant='default'
                  onClick={() => onChooseOffer(key)}
                >
                  Choose target
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={busy}
        error={error}
        feedback={feedback}
        warnings={confirmingOffer ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) =>
          confirmingOffer &&
          targetActorId &&
          void move(
            confirmingOffer,
            targetActorId,
            warnings.map((warning) => warning.code)
          )
        }
      />
    </section>
  )
}
