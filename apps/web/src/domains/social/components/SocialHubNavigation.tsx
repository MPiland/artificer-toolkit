import { Button, Drawer, Tabs, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Check, ChevronDown } from 'lucide-react'
import { findOption } from '../../../forms/utils/valueGuards'
import { socialViewLabels, socialViews, type SocialView } from '../socialModels'
import * as styles from './SocialHubNavigation.css'

export function SocialHubNavigation({
  view,
  onChange
}: {
  view: SocialView
  onChange: (view: SocialView) => void
}) {
  const [drawerOpened, { close: closeDrawer, open: openDrawer }] = useDisclosure(false)

  const selectView = (nextView: SocialView) => {
    onChange(nextView)
    closeDrawer()
  }

  return (
    <>
      <Tabs
        className={styles.desktopNavigation}
        value={view}
        onChange={(value) => {
          const nextView = findOption(socialViews, value)
          if (nextView) selectView(nextView)
        }}
      >
        <Tabs.List aria-label='Social Hub views'>
          {socialViews.map((socialView) => (
            <Tabs.Tab className={styles.tab} key={socialView} value={socialView}>
              {socialViewLabels[socialView]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <div className={styles.mobileNavigation}>
        <Button
          fullWidth
          aria-haspopup='dialog'
          rightSection={<ChevronDown aria-hidden='true' size={16} />}
          variant='default'
          onClick={openDrawer}
        >
          {socialViewLabels[view]}
        </Button>
      </div>

      <Drawer
        closeButtonProps={{ 'aria-label': 'Close Social Hub navigation' }}
        opened={drawerOpened}
        position='bottom'
        size='min(20rem, 70dvh)'
        title='Social Hub views'
        onClose={closeDrawer}
      >
        <nav className={styles.drawerNavigation} aria-label='Social Hub views'>
          {socialViews.map((socialView) => {
            const active = socialView === view
            return (
              <UnstyledButton
                aria-current={active ? 'page' : undefined}
                className={styles.drawerItem}
                data-active={active || undefined}
                key={socialView}
                type='button'
                onClick={() => selectView(socialView)}
              >
                <span>{socialViewLabels[socialView]}</span>
                {active ? <Check aria-hidden='true' size={18} /> : null}
              </UnstyledButton>
            )
          })}
        </nav>
      </Drawer>
    </>
  )
}
