import { Alert, Button, Modal, Select, Stack, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { CreateSocialReportInput } from '@artificer-toolkit/schema/api/socialHub'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { reportReasonOptions } from '../socialModels'

export function SocialReportDialog({
  target
}: {
  target: Pick<CreateSocialReportInput, 'targetKind' | 'targetPublicId'>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [reason, setReason] = useState<CreateSocialReportInput['reason']>('OTHER')
  const [details, setDetails] = useState('')
  const createReport = useConvexMutation(convexApi.social.reports.create)
  const report = useMutation({
    mutationFn: () => createReport({ input: { ...target, reason, details } }),
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
