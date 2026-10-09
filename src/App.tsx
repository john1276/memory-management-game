import {
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import './App.css'

import {
  GameController,
} from './application/GameController'

import { TopBar } from './components/TopBar'

import { BoardPanel } from './components/board/BoardPanel'

import { RuleProgramPanel } from './components/rules/RuleProgramPanel'

import {
  prototypeRuleProgram,
} from './data/prototypeRuleProgram'

import {
  prototypeWorkload,
} from './data/prototypeWorkload'

const PROGRAM_FOCUS = 0
const SPLIT_VIEW = 0.72
const BOARD_FOCUS = 1

const SNAP_TARGETS = [
  PROGRAM_FOCUS,
  SPLIT_VIEW,
  BOARD_FOCUS,
] as const

const WHEEL_SENSITIVITY = 0.00135
const SNAP_DELAY_MS = 140
const SNAP_ANIMATION_MS = 240

const MEMORY_CAPACITY = 32

function clampProgress(value: number) {
  return Math.min(
    BOARD_FOCUS,
    Math.max(PROGRAM_FOCUS, value)
  )
}

function findNearestSnapTarget(progress: number) {
  return SNAP_TARGETS.reduce((nearest, candidate) => {
    const nearestDistance =
      Math.abs(progress - nearest)

    const candidateDistance =
      Math.abs(progress - candidate)

    return candidateDistance < nearestDistance
      ? candidate
      : nearest
  })
}

function App() {
  const [controller] =
    useState(
      () =>
        new GameController({
          workload:
            prototypeWorkload,

          memoryCapacity:
            MEMORY_CAPACITY,

          ruleProgram:
            prototypeRuleProgram,
        }),
    )

  const [gameView, setGameView] =
    useState(
      () =>
        controller.getViewModel(),
    )

  const [workspaceProgress, setWorkspaceProgress] =
    useState(PROGRAM_FOCUS)

  const [isBoardPinned, setIsBoardPinned] =
    useState(false)

  const [isSnapping, setIsSnapping] =
    useState(false)

  const workspaceProgressRef =
    useRef(workspaceProgress)

  const snapTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const animationTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncGameView() {
    setGameView(
      controller.getViewModel(),
    )
  }

  function updateWorkspaceProgress(next: number) {
    const clamped =
      clampProgress(next)

    workspaceProgressRef.current =
      clamped

    setWorkspaceProgress(clamped)
  }

  function stopPendingSnap() {
    if (snapTimer.current) {
      clearTimeout(snapTimer.current)
      snapTimer.current = null
    }

    if (animationTimer.current) {
      clearTimeout(animationTimer.current)
      animationTimer.current = null
    }

    setIsSnapping(false)
  }

  function animateWorkspaceTo(target: number) {
    if (isBoardPinned && target !== SPLIT_VIEW) {
      return
    }

    if (snapTimer.current) {
      clearTimeout(snapTimer.current)
      snapTimer.current = null
    }

    if (animationTimer.current) {
      clearTimeout(animationTimer.current)
    }

    setIsSnapping(true)

    requestAnimationFrame(() => {
      updateWorkspaceProgress(target)
    })

    animationTimer.current = setTimeout(() => {
      setIsSnapping(false)
      animationTimer.current = null
    }, SNAP_ANIMATION_MS)
  }

  function scheduleSnap() {
    if (isBoardPinned) {
      return
    }

    if (snapTimer.current) {
      clearTimeout(snapTimer.current)
    }

    snapTimer.current = setTimeout(() => {
      const target =
        findNearestSnapTarget(
          workspaceProgressRef.current
        )

      animateWorkspaceTo(target)
    }, SNAP_DELAY_MS)
  }

  function startSimulation() {
    controller.start()

    const nextView =
      controller.getViewModel()

    setGameView(nextView)

    if (nextView.status === 'idle') {
      return
    }

    animateWorkspaceTo(
      isBoardPinned
        ? SPLIT_VIEW
        : BOARD_FOCUS
    )
  }

  function pauseSimulation() {
    controller.togglePause()
    syncGameView()
  }

  function stepSimulation() {
    controller.step()
    syncGameView()
  }

  function resetSimulation() {
    controller.reset()
    syncGameView()

    animateWorkspaceTo(
      isBoardPinned
        ? SPLIT_VIEW
        : PROGRAM_FOCUS
    )
  }

  function toggleBoardPin() {
    setIsBoardPinned((current) => {
      const next =
        !current

      stopPendingSnap()

      if (next) {
        requestAnimationFrame(() => {
          setIsSnapping(true)
          updateWorkspaceProgress(SPLIT_VIEW)

          animationTimer.current =
            setTimeout(() => {
              setIsSnapping(false)
            }, SNAP_ANIMATION_MS)
        })
      }

      return next
    })
  }

  function handleWorkspaceWheel(
    event: ReactWheelEvent<HTMLElement>
  ) {
    if (isBoardPinned) {
      return
    }

    event.preventDefault()

    if (isSnapping) {
      stopPendingSnap()
    }

    const nextProgress =
      workspaceProgressRef.current +
      event.deltaY * WHEEL_SENSITIVITY

    updateWorkspaceProgress(
      nextProgress
    )

    scheduleSnap()
  }

  const boardPercent =
    workspaceProgress * 66

  const programPercent =
    100 - boardPercent

  const workspaceStyle = {
    '--board-size': `${boardPercent}%`,
    '--program-size': `${programPercent}%`,
  } as CSSProperties

  return (
    <main
      className={[
        'game-shell',
        isSnapping
          ? 'game-shell--snapping'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onWheel={handleWorkspaceWheel}
    >
      <TopBar
        simulationStatus={gameView.status}
        tick={gameView.tick}
        onRun={startSimulation}
        onPauseResume={pauseSimulation}
        onStep={stepSimulation}
        onReset={resetSimulation}
      />

      <section
        className="workspace"
        style={workspaceStyle}
      >
        <BoardPanel
          memoryCells={gameView.memoryCells}
          totalBlocks={gameView.totalBlocks}
          usedBlocks={gameView.usedBlocks}
          upcomingTasks={gameView.upcomingTasks}
          waitingTasks={gameView.waitingTasks}
          processingTasks={gameView.processingTasks}
        />

        <RuleProgramPanel
          programLines={gameView.ruleProgram}
          isBoardPinned={isBoardPinned}
          onToggleBoardPin={toggleBoardPin}
          onFocusProgram={() =>
            animateWorkspaceTo(
              PROGRAM_FOCUS
            )
          }
          onFocusBoard={() =>
            animateWorkspaceTo(
              BOARD_FOCUS
            )
          }
          onSplitView={() =>
            animateWorkspaceTo(
              SPLIT_VIEW
            )
          }
        />
      </section>
    </main>
  )
}

export default App
