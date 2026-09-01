import type {
  TaskId,
  TaskRuntime,
} from '../domain/Task'

import { Memory } from '../domain/Memory'
import { TaskQueue } from '../domain/TaskQueue'

import type { Workload } from '../domain/Workload'

export type SimulationStatus =
  | 'idle'
  | 'running'
  | 'halted'
  | 'completed'

export interface SimulationFailure {
  tick: number

  taskId?: TaskId
  ruleId?: string
  action?: string

  reason: string
}

export interface SimulationLogEntry {
  tick: number
  message: string
}

export interface SimulationState {
  tick: number

  status: SimulationStatus

  memory: Memory
  queue: TaskQueue

  tasks: Map<TaskId, TaskRuntime>

  workload: Workload

  failure: SimulationFailure | null

  logs: SimulationLogEntry[]
}