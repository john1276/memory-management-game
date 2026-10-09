import type { TaskId } from '../domain/Task'
import { getUpcomingRequests } from '../domain/Workload'
import type {
  SimulationState,
  SimulationStatus,
} from '../simulation/SimulationState'
import type {
  ProgramValidationError,
} from '../simulation/validation/ProgramValidator'

export type PlaybackStatus =
  | 'idle'
  | 'running'
  | 'paused'

export type GameStatus =
  | SimulationStatus
  | 'paused'

export interface MemoryCellViewModel {
  readonly taskId: TaskId | null
}

export interface UpcomingTaskViewModel {
  readonly id: TaskId
  readonly size: number
  readonly arrivesIn: number
}

export interface WaitingTaskViewModel {
  readonly id: TaskId
  readonly size: number
  readonly waitingTicks: number
}

export interface ProcessingTaskViewModel {
  readonly id: TaskId
  readonly ticksLeft: number
}

export interface FailureViewModel {
  readonly message: string
  readonly taskId?: TaskId
  readonly ruleId?: string
  readonly action?: string
}

export interface GameViewModel {
  readonly status: GameStatus
  readonly tick: number

  readonly totalBlocks: number
  readonly usedBlocks: number
  readonly memoryCells: readonly MemoryCellViewModel[]

  readonly upcomingTasks: readonly UpcomingTaskViewModel[]
  readonly waitingTasks: readonly WaitingTaskViewModel[]
  readonly processingTasks: readonly ProcessingTaskViewModel[]

  readonly failure: FailureViewModel | null
  readonly validationErrors: readonly string[]
}

export function createGameViewModel(
  state: SimulationState,
  playbackStatus: PlaybackStatus,
  validationErrors: readonly ProgramValidationError[] = [],
): GameViewModel {
  const memoryCells =
    state.memory
      .getCells()
      .map((taskId) => ({ taskId }))

  const upcomingTasks =
    getUpcomingRequests(
      state.workload,
      state.tick,
    ).map((entry) => ({
      id: entry.task.id,
      size: entry.task.size,
      arrivesIn:
        entry.tick - state.tick,
    }))

  const waitingTasks =
    state.queue
      .toArray()
      .flatMap((taskId) => {
        const task =
          state.tasks.get(taskId)

        if (
          !task ||
          task.status !== 'waiting'
        ) {
          return []
        }

        return [{
          id: taskId,
          size: task.definition.size,
          waitingTicks: task.waitingTicks,
        }]
      })

  const processingTasks =
    Array
      .from(state.tasks.values())
      .filter(
        (task) =>
          task.status === 'processing',
      )
      .map((task) => ({
        id: task.definition.id,
        ticksLeft:
          task.remainingDuration,
      }))

  const freeBlocks =
    state.memory.getFreeSpace()

  return {
    status:
      getGameStatus(
        state.status,
        playbackStatus,
      ),

    tick: state.tick,

    totalBlocks:
      state.memory.capacity,

    usedBlocks:
      state.memory.capacity -
      freeBlocks,

    memoryCells,
    upcomingTasks,
    waitingTasks,
    processingTasks,

    failure:
      state.failure
        ? {
            message:
              state.failure.reason,
            taskId:
              state.failure.taskId,
            ruleId:
              state.failure.ruleId,
            action:
              state.failure.action,
          }
        : null,

    validationErrors:
      validationErrors.map(
        (error) =>
          `${error.ruleId}: ${error.message}`,
      ),
  }
}

function getGameStatus(
  simulationStatus: SimulationStatus,
  playbackStatus: PlaybackStatus,
): GameStatus {
  if (
    simulationStatus === 'running' &&
    playbackStatus === 'paused'
  ) {
    return 'paused'
  }

  return simulationStatus
}
