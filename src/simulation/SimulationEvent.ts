import type { TaskId } from '../domain/Task'

export type SimulationEvent =
  | {
      type: 'requestArrived'
      taskId: TaskId
    }
  | {
      type: 'taskWaiting'
      taskId: TaskId
    }
