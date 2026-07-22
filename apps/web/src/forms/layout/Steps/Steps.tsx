import { useAuthoringLayout } from '#app/forms/layout/AuthoringLayoutContext'
import { useCallback, useMemo } from 'react'
import { useAuthoringForm } from '../AuthoringFormContext'
import { Rail, useBreakpoints } from '#ui'
import { Header } from './Header/Header'
import { Item } from './Item/Item'
import { Content } from './Content/Content'
import { Footer } from './Footer/Footer'
import { Collapse, Drawer } from '@mantine/core'
import * as styles from './Steps.css'
import { toAuthoringNavigationRailItems, toAuthoringRailItems } from './Steps.utils'
import { clsx } from 'clsx'
import { useLocation } from '@tanstack/react-router'

export function Steps() {
  const { stepsNavigationOpen, toggleStepsNavigation, activeSections, stepId, visibleSteps } =
    useAuthoringLayout()
  const { isMobile, isTabletPortrait } = useBreakpoints()
  const currentHref = useLocation({ select: (location) => location.href })
  const usesOverlayNavigation = isMobile || isTabletPortrait

  const { goToNavigationTarget, goToStep, mode, navigationTree, stepStatuses, visitedStepIds } =
    useAuthoringForm()

  const handleStepSelect = useCallback(
    (stepId: string) => {
      goToStep(stepId)
      if (usesOverlayNavigation) {
        toggleStepsNavigation()
      }
    },
    [goToStep, toggleStepsNavigation, usesOverlayNavigation]
  )
  const handleTargetSelect = useCallback(
    (targetId: string, hasChildren: boolean) => {
      goToNavigationTarget(targetId)
      if (usesOverlayNavigation && !hasChildren) {
        toggleStepsNavigation()
      }
    },
    [goToNavigationTarget, toggleStepsNavigation, usesOverlayNavigation]
  )

  const railItems = useMemo(() => {
    const items = navigationTree?.length
      ? toAuthoringNavigationRailItems({
          activeTargetId: stepId,
          mode,
          currentHref,
          navigationTree,
          onTargetSelect: handleTargetSelect,
          visitedStepIds
        })
      : toAuthoringRailItems({
          activeSections,
          activeStepId: stepId,
          mode,
          currentHref,
          onStepSelect: handleStepSelect,
          steps: visibleSteps,
          stepStatuses,
          visitedStepIds
        })

    return items
  }, [
    activeSections,
    handleStepSelect,
    handleTargetSelect,
    currentHref,
    mode,
    navigationTree,
    stepId,
    stepStatuses,
    visibleSteps,
    visitedStepIds
  ])

  const stepItems = railItems.map((item) => <Item key={item.id} item={item} />)

  return usesOverlayNavigation ? (
    <Drawer
      classNames={{
        body: styles.drawerBody,
        content: styles.drawerContent,
        header: styles.drawerAccessibleHeader
      }}
      onClose={toggleStepsNavigation}
      opened={stepsNavigationOpen}
      position='left'
      size='min(18rem, 86vw)'
      title='Authoring steps'
      withCloseButton={false}
    >
      <Rail
        aria-hidden={!stepsNavigationOpen}
        aria-label={'Authoring steps navigation'}
        className={styles.shell}
        id='authoring-steps-navigation'
      >
        <Header />
        <Content>{stepItems}</Content>
        <Footer />
      </Rail>
    </Drawer>
  ) : (
    <Collapse
      expanded={stepsNavigationOpen}
      orientation='horizontal'
      transitionDuration={180}
      transitionTimingFunction='ease'
      aria-label='Authoring steps'
    >
      <Rail
        aria-hidden={!stepsNavigationOpen}
        className={clsx(styles.shell, { ['hidden']: !stepsNavigationOpen })}
        aria-label={'Authoring steps navigation'}
        id='authoring-steps-navigation'
      >
        <Header />
        <Content>{stepItems}</Content>
        <Footer />
      </Rail>
    </Collapse>
  )
}
