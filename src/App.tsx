import {
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import './App.css'

import { TopBar } from './components/TopBar'

import { BoardPanel } from './components/board/BoardPanel'

import { RuleProgramPanel } from './components/rules/RuleProgramPanel'

export type SimulationStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'halted'
  | 'completed'

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

const totalBlocks = 32
const usedBlocks = 14

const memoryCells = [
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: 'Task1' },
  { taskId: 'Task1' },
  { taskId: 'Task1' },
  { taskId: 'Task1' },
  { taskId: 'Task1' },
  { taskId: 'Task1' },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: 'Task0' },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
  { taskId: null },
]

const upcomingTasks = [
  { id: 'Task3', size: 6, arrivesIn: 2 },
  { id: 'Task4', size: 4, arrivesIn: 5 },
  { id: 'Task5', size: 8, arrivesIn: 9 },
]

const waitingTasks = [
  { id: 'Task2', size: 10, waitingTicks: 0 },
]

const processingTasks = [
  {
    id: 'Task0',
    ticksLeft: 3,
    colorClass: 'processing-dot--task0',
  },
  {
    id: 'Task1',
    ticksLeft: 5,
    colorClass: 'processing-dot--task1',
  },
]

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
  const [simulationStatus, setSimulationStatus] =
    useState<SimulationStatus>('idle')

  const [workspaceProgress, setWorkspaceProgress] =
    useState(PROGRAM_FOCUS)

  const [isBoardPinned, setIsBoardPinned] =
    useState(false)

  const [isSnapping, setIsSnapping] =
    useState(false)

  const [tick, setTick] =
    useState(0)

  const workspaceProgressRef =
    useRef(workspaceProgress)

  const snapTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const animationTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const canEdit =
    simulationStatus === 'idle'

  const showsExecution =
    simulationStatus !== 'idle'

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
    setSimulationStatus('running')

    animateWorkspaceTo(
      isBoardPinned
        ? SPLIT_VIEW
        : BOARD_FOCUS
    )
  }

  function pauseSimulation() {
    setSimulationStatus((current) => {
      if (current === 'running') {
        return 'paused'
      }

      if (current === 'paused') {
        return 'running'
      }

      return current
    })
  }

  function stepSimulation() {
    if (
      simulationStatus !== 'running' &&
      simulationStatus !== 'paused'
    ) {
      return
    }

    setTick((current) =>
      current + 1
    )
  }

  function resetSimulation() {
    setSimulationStatus('idle')
    setTick(0)

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
        simulationStatus={simulationStatus}
        tick={tick}
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
          memoryCells={memoryCells}
          totalBlocks={totalBlocks}
          usedBlocks={usedBlocks}
          upcomingTasks={upcomingTasks}
          waitingTasks={waitingTasks}
          processingTasks={processingTasks}
        />

        <RuleProgramPanel
          canEdit={canEdit}
          showsExecution={showsExecution}
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