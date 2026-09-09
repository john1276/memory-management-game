export type TaskId = string

export type TaskStatus =
  | 'waiting'
  | 'processing'
  | 'completed'

export interface TaskDefinition {
  readonly id: TaskId
  readonly size: number
  readonly duration: number
  readonly splittable: boolean
}

export interface TaskRuntime {
  definition: TaskDefinition

  remainingDuration: number
  waitingTicks: number

  status: TaskStatus
}

export function createTaskRuntime(
  definition: TaskDefinition
): TaskRuntime {
  return {
    definition,
    remainingDuration: definition.duration,
    waitingTicks: 0,
    status: 'waiting',
  }
}
