import {
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import './App.css'

import { TopBar } from './components/TopBar'

import { BoardPanel } from './components/board/BoardPanel'
import type { MemoryCellView } from './components/board/MemoryArena'
import type { ProcessingTaskView } from './components/board/ProcessingStrip'

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

const memoryCells: MemoryCellView[] = [
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

const processingTasks: ProcessingTaskView[] = [
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

    const target =
      event.target as HTMLElement

    const scrollRegion =
      target.closest<HTMLElement>(
        '[data-workspace-scroll-region="true"]'
      )

    if (scrollRegion) {
      const atTop =
        scrollRegion.scrollTop <= 0

      const atBottom =
        scrollRegion.scrollTop +
          scrollRegion.clientHeight >=
        scrollRegion.scrollHeight - 1

      const scrollingUp =
        event.deltaY < 0

      const scrollingDown =
        event.deltaY > 0

      if (
        (scrollingUp && !atTop) ||
        (scrollingDown && !atBottom)
      ) {
        return
      }
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


function RuleProgramPanel({
  canEdit,
  showsExecution,
  isBoardPinned,
  onToggleBoardPin,
  onFocusProgram,
  onFocusBoard,
  onSplitView,
}: {
  canEdit: boolean
  showsExecution: boolean
  isBoardPinned: boolean
  onToggleBoardPin: () => void
  onFocusProgram: () => void
  onFocusBoard: () => void
  onSplitView: () => void
}) {
  return (
    <section className="rule-panel">
      <div className="rule-panel__toolbar">
        <div>
          <span className="panel-kicker">
            Player Logic
          </span>

          <h2>
            Rule Program
          </h2>
        </div>

        <div className="rule-panel__actions">
          <button
            type="button"
            className="control control--small"
            onClick={onFocusProgram}
            disabled={isBoardPinned}
          >
            Program
          </button>

          <button
            type="button"
            className="control control--small"
            onClick={onSplitView}
            disabled={isBoardPinned}
          >
            Split
          </button>

          <button
            type="button"
            className="control control--small"
            onClick={onFocusBoard}
            disabled={isBoardPinned}
          >
            Board
          </button>

          <button
            type="button"
            className={[
              'control',
              'control--small',
              isBoardPinned
                ? 'control--active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleBoardPin}
          >
            {isBoardPinned
              ? 'Unpin'
              : 'Pin split'}
          </button>

          <span className="mode-badge">
            {canEdit
              ? 'Editable'
              : 'Execution View'}
          </span>
        </div>
      </div>

      <div
        className="rule-panel__content"
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="rule-program">
          <RuleLine
            depth={0}
            label="WHEN"
            value="Task Waiting"
          />

          <RuleLine
            depth={1}
            label="IF"
            value="Task.Size > 8"
          />

          <RuleLine
            depth={2}
            label="Split"
            value=""
          />

          <RuleLine
            depth={3}
            label="Fragment 1"
            value="Math.Floor(Task.Size / 2)"
            highlighted={showsExecution}
          />

          <RuleLine
            depth={3}
            label="Fragment 2"
            value="Split.Remaining"
          />

          <RuleLine
            depth={2}
            label="Allocate"
            value=""
          />

          <RuleLine
            depth={1}
            label="ELSE"
            value=""
          />

          <RuleLine
            depth={2}
            label="Allocate"
            value=""
          />
        </div>

        {canEdit && (
          <div className="edit-tools">
            <button type="button">
              + Add block
            </button>

            <button type="button">
              + Add rule
            </button>
          </div>
        )}

        {showsExecution && (
          <div className="execution-caption">
            <span className="execution-caption__dot" />

            Current execution:
            {' '}
            Task2 · Rule 0 · Split expression
          </div>
        )}
      </div>
    </section>
  )
}

function RuleLine({
  depth,
  label,
  value,
  highlighted = false,
}: {
  depth: number
  label: string
  value: string
  highlighted?: boolean
}) {
  return (
    <div
      className={[
        'rule-line',
        highlighted
          ? 'rule-line--current'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--rule-depth': depth,
        } as CSSProperties
      }
    >
      <span className="rule-line__rail" />

      <span className="rule-line__label">
        {label}
      </span>

      {value && (
        <span className="rule-line__value">
          {value}
        </span>
      )}

      {highlighted && (
        <span className="rule-line__current-label">
          CURRENT
        </span>
      )}
    </div>
  )
}

export default App
