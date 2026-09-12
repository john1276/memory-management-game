import type {
  TaskRuntime,
} from '../../domain/Task'

import type {
  SimulationState,
} from '../SimulationState'

import type {
  Action,
} from '../rules/Rule'
import {
  advanceSplitExecution,
  createSplitExecution,
  type SplitExecution,
} from './SplitExecution'
import type {
  ExecutionAdvanceResult,
} from '../expressions/ExpressionExecution'

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
        state.memory.allocateFragments(
          taskId,
          task.fragmentSizes
        )

      if (!success) {
        return {
          ok: false,
          action: 'allocate',
          reason:
            `Unable to allocate memory for Task ${taskId} ` +
            `with fragment shape [${task.fragmentSizes.join(', ')}]`,
        }
      }

      task.status = 'processing'
      state.queue.remove(taskId)

      return {
        ok: true,
      }
    }
    case 'split':
    return {
      ok: false,
      action: 'split',
      reason:
        'Split action requires resumable execution',
    }
  }
}
export type ActionExecution =
  | {
      type: 'allocate'
      action: Extract<Action, { type: 'allocate' }>
      started: boolean
    }
  | {
      type: 'split'
      action: Extract<Action, { type: 'split' }>
      split: SplitExecution
    }

export type ActionExecutionStartResult =
  | {
      ok: true
      execution: ActionExecution
    }
  | {
      ok: false
      action: Action['type']
      reason: string
    }

export function createActionExecution(
  action: Action,
  task: TaskRuntime,
): ActionExecutionStartResult {
  switch (action.type) {
    case 'allocate':
      return {
        ok: true,
        execution: {
          type: 'allocate',
          action,
          started: false,
        },
      }

    case 'split': {
      const taskId = task.definition.id

      if (task.status !== 'waiting') {
        return {
          ok: false,
          action: 'split',
          reason:
            `Task ${taskId} cannot be split ` +
            `while status is ${task.status}`,
        }
      }

      if (!task.definition.splittable) {
        return {
          ok: false,
          action: 'split',
          reason:
            `Task ${taskId} cannot be split ` +
            `because it is not splittable`,
        }
      }

      return {
        ok: true,
        execution: {
          type: 'split',
          action,
          split: createSplitExecution(
            action.fragments,
            task,
          ),
        },
      }
    }
  }
}

export function advanceActionExecution(
  execution: ActionExecution,
  state: SimulationState,
  task: TaskRuntime,
): ExecutionAdvanceResult<void> {
  switch (execution.type) {
    case 'split': {
      const result = advanceSplitExecution(
        execution.split,
      )

      if (result.status === 'progress') {
        return result
      }

      if (result.status === 'failure') {
        return result
      }

      /*
       * SplitExecution has finished all expression work
       * and physical cuts successfully.
       *
       * Only now do we commit the new allocation shape.
       */
      task.fragmentSizes = [
        ...result.value.fragments,
      ]

      return {
        status: 'complete',
        consumedTick: result.consumedTick,
        value: undefined,
      }
    }

    case 'allocate': {
      /*
       * Allocate is still backed by the existing
       * immediate executeAction helper.
       *
       * The resumable API makes its effect cost one tick.
       */
      if (execution.started) {
        return {
          status: 'complete',
          consumedTick: false,
          value: undefined,
        }
      }

      execution.started = true

      const result = executeAction(
        execution.action,
        state,
        task,
      )

      if (!result.ok) {
        return {
          status: 'failure',
          consumedTick: true,
          reason: result.reason,
        }
      }

      return {
        status: 'progress',
        consumedTick: true,
      }
    }
  }
}