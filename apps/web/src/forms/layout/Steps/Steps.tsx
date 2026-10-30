import { useAuthoringLayout } from '#app/forms/layout/AuthoringLayoutContext'
import { useCallback, useMemo } from 'react'
import { useAuthoringNavigation, useAuthoringSession } from '../AuthoringFormContext'
import { Rail } from '#ui'
import { Header } from './Header/Header'
import { Item } from './Item/Item'
import { Content } from './Content/Content'
import { Footer } from './Footer/Footer'
import { Drawer } from '@mantine/core'
import * as styles from './Steps.css'
import { toAuthoringNavigationRailItems, toAuthoringRailItems } from './Steps.utils'
import { useLocation } from '@tanstack/react-router'

export function Steps() {
  const {
    isWideDesktop,
    stepsNavigationOpen,
    toggleStepsNavigation,
    activeSections,
    stepId,
    visibleSteps
  } = useAuthoringLayout()
  const currentHref = useLocation({ select: (location) => location.href })

  const { mode } = useAuthoringSession()
  const { goToNavigationTarget, goToStep, navigationTree, stepStatuses, visitedStepIds } =
    useAuthoringNavigation()

  const handleStepSelect = useCallback(
    (stepId: string) => {
      goToStep(stepId)
      if (!isWideDesktop) {
        toggleStepsNavigation()
      }
    },
    [goToStep, isWideDesktop, toggleStepsNavigation]
  )
  const handleTargetSelect = useCallback(
    (targetId: string, hasChildren: boolean) => {
      goToNavigationTarget(targetId)
      if (!isWideDesktop && !hasChildren) {
        toggleStepsNavigation()
      }
    },
    [goToNavigationTarget, isWideDesktop, toggleStepsNavigation]
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

  return !isWideDesktop ? (
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
    <Rail
      aria-label='Authoring steps navigation'
      className={styles.shell}
      id='authoring-steps-navigation'
    >
      <Header />
      <Content>{stepItems}</Content>
      <Footer />
    </Rail>
  )
}
