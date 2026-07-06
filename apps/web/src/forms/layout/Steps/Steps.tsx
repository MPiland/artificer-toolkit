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

export function Steps() {
  const {
    visitedStepIds,
    setVisitedStepIds,
    stepsNavigationOpen,
    toggleStepsNavigation,
    activeSections,
    stepId,
    visibleSteps,
  } = useAuthoringLayout()
  const { isMobile } = useBreakpoints()

  const { goToNavigationTarget, goToStep, mode, navigationTree, stepStatuses } = useAuthoringForm()

  const handleStepSelect = useCallback(
    (stepId: string) => {
      setVisitedStepIds((current) => {
        if (current.has(stepId)) return current
        const next = new Set(current)
        next.add(stepId)
        return next
      })
      goToStep(stepId)
      if (isMobile) {
        toggleStepsNavigation()
      }
    },
    [goToStep, isMobile, setVisitedStepIds, toggleStepsNavigation]
  )
  const handleTargetSelect = useCallback(
    (targetId: string) => {
      setVisitedStepIds((current) => {
        if (current.has(targetId)) return current
        const next = new Set(current)
        next.add(targetId)
        return next
      })
      goToNavigationTarget(targetId)
      if (isMobile) {
        toggleStepsNavigation()
      }
    },
    [goToNavigationTarget, isMobile, setVisitedStepIds, toggleStepsNavigation]
  )

  const stepItems = useMemo(
    () =>
      (navigationTree?.length
        ? toAuthoringNavigationRailItems({
            activeTargetId: stepId,
            mode,
            navigationTree,
            onTargetSelect: handleTargetSelect,
            visitedStepIds
          })
        : toAuthoringRailItems({
            activeSections,
            activeStepId: stepId,
            mode,
            onStepSelect: handleStepSelect,
            steps: visibleSteps,
            stepStatuses,
            visitedStepIds
          })
      ).map((item) => <Item key={item.id} item={item} />),
    [
      activeSections,
      handleStepSelect,
      handleTargetSelect,
      mode,
      navigationTree,
      stepId,
      stepStatuses,
      visibleSteps,
      visitedStepIds
    ]
  )

  return isMobile ? (
    <Drawer
      classNames={{
        body: styles.drawerBody,
        content: styles.drawerContent
      }}
      onClose={toggleStepsNavigation}
      opened={stepsNavigationOpen}
      position='left'
      size='min(20rem, 86vw)'
      withCloseButton={false}
      aria-label='Authoring steps'
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
      >
        <Content>{stepItems}</Content>
        <Footer />
      </Rail>
    </Collapse>
  )
}
