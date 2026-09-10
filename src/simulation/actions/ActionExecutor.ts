import type {
  TaskRuntime,
} from '../../domain/Task'

import type {
  SimulationState,
} from '../SimulationState'

import type {
  Action,
} from '../rules/Rule'

export type ActionExecutionResult =
  | {
      ok: true
    }
  | {
      ok: false
      action: Action['type']
      reason: string
    }

export function executeAction(
  action: Action,
  state: SimulationState,
  task: TaskRuntime
): ActionExecutionResult {
  switch (action.type) {
    case 'allocate': {
      const taskId = task.definition.id

      if (task.status !== 'waiting') {
        return {
          ok: false,
          action: 'allocate',
          reason:
            `Task ${taskId} cannot be allocated ` +
            `while status is ${task.status}`,
        }
      }

      const success =
        state.memory.allocateContiguous(
          taskId,
          task.definition.size
        )

      if (!success) {
        return {
          ok: false,
          action: 'allocate',
          reason:
            `Not enough contiguous memory ` +
            `for Task ${taskId}`,
        }
      }

      task.status = 'processing'
      state.queue.remove(taskId)

      return {
        ok: true,
      }
    }
  }
}