import { Alert, Button, Modal, Select, Stack, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { CreateSocialReportInput } from '#app/lib/api'
import { api } from '#app/lib/api'
import { reportReasonOptions } from '../socialModels'

export function SocialReportDialog({
  target
}: {
  target: Pick<CreateSocialReportInput, 'targetKind' | 'targetPublicId'>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [reason, setReason] = useState<CreateSocialReportInput['reason']>('OTHER')
  const [details, setDetails] = useState('')
  const report = useMutation({
    mutationFn: () => {
      if (target.targetKind === 'PROFILE') {
        return api.socialHub.reports.create({
          targetKind: 'PROFILE',
          targetPublicId: target.targetPublicId,
          reason,
          details
        })
      }
      if (target.targetKind === 'LISTING') {
        return api.socialHub.reports.create({
          targetKind: 'LISTING',
          targetPublicId: target.targetPublicId,
          reason,
          details
        })
      }
      return api.socialHub.reports.create({
        targetKind: 'APPLICATION',
        targetPublicId: target.targetPublicId,
        reason,
        details
      })
    },
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Report submitted for review.' })
      setDetails('')
      close()
    }
  })

  return (
    <>
      <Button size='xs' variant='subtle' onClick={open}>
        Report
      </Button>
      <Modal centered opened={opened} title='Report to moderators' onClose={close}>
        <form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            report.mutate()
          }}
        >
          <Stack>
            <Select
              data={reportReasonOptions.map((option) => ({ ...option }))}
              label='Reason'
              value={reason}
              onChange={(value) => {
                const next = reportReasonOptions.find((option) => option.value === value)
                if (next) setReason(next.value)
              }}
            />
            <Textarea
              autosize
              label='What happened?'
              maxLength={4000}
              minRows={4}
              required
              value={details}
              onChange={(event) => setDetails(event.currentTarget.value)}
            />
            {report.error ? <Alert color='red'>{report.error.message}</Alert> : null}
            <Button disabled={!details.trim()} loading={report.isPending} type='submit'>
              Submit report
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
