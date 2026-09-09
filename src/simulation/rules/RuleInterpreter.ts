import type {
  TaskId,
  TaskRuntime,
} from '../../domain/Task'

import type {
  SimulationState,
} from '../SimulationState'

import type {
  SimulationEvent,
} from '../SimulationEvent'

import type {
  Action,
  Condition,
  RuleProgram,
  Statement,
} from './Rule'

export type RuleExecutionResult =
  | {
      ok: true
    }
  | {
      ok: false
      ruleId: string
      taskId: TaskId
      action?: Action['type']
      reason: string
    }

export function executeRuleProgram(
  program: RuleProgram,
  event: SimulationEvent,
  state: SimulationState
): RuleExecutionResult {
  const task = state.tasks.get(event.taskId)

  if (!task) {
    return {
      ok: false,
      ruleId: 'system',
      taskId: event.taskId,
      reason: `Task ${event.taskId} does not exist`,
    }
  }

  for (const rule of program) {
    if (rule.trigger !== event.type) {
      continue
    }

    const result = executeStatements(
      rule.body,
      rule.id,
      event,
      state,
      task
    )

    if (!result.ok) {
      return result
    }
  }

  return {
    ok: true,
  }
}

function executeStatements(
  statements: readonly Statement[],
  ruleId: string,
  event: SimulationEvent,
  state: SimulationState,
  task: TaskRuntime
): RuleExecutionResult {
  for (const statement of statements) {
    if (statement.type === 'if') {
      const conditionResult =
        evaluateCondition(
          statement.condition,
          state,
          task
        )

      const branch = conditionResult
        ? statement.then
        : statement.else

      if (branch) {
        const result = executeStatements(
          branch,
          ruleId,
          event,
          state,
          task
        )

        if (!result.ok) {
          return result
        }
      }

      continue
    }

    if (statement.type === 'action') {
      const result = executeAction(
        statement.action,
        ruleId,
        event,
        state,
        task
      )

      if (!result.ok) {
        return result
      }
    }
  }

  return {
    ok: true,
  }
}

function evaluateCondition(
  condition: Condition,
  state: SimulationState,
  task: TaskRuntime
): boolean {
  switch (condition.type) {
    case 'taskSizeGreaterThan':
      return (
        task.definition.size >
        condition.value
      )

    case 'taskSizeLessThanOrEqual':
      return (
        task.definition.size <=
        condition.value
      )

    case 'taskSplittableIs':
      return (
        task.definition.splittable ===
        condition.value
      )

    case 'freeSpaceGreaterThanOrEqual':
      return (
        state.memory.getFreeSpace() >=
        condition.value
      )
  }
}

function executeAction(
  action: Action,
  ruleId: string,
  event: SimulationEvent,
  state: SimulationState,
  task: TaskRuntime
): RuleExecutionResult {
  switch (action.type) {
    case 'allocate': {
      if (task.status !== 'waiting') {
        return {
          ok: false,
          ruleId,
          taskId: event.taskId,
          action: 'allocate',
          reason:
            `Task ${event.taskId} cannot be allocated ` +
            `while status is ${task.status}`,
        }
      }

      const success =
        state.memory.allocateContiguous(
          event.taskId,
          task.definition.size
        )

      if (!success) {
        return {
          ok: false,
          ruleId,
          taskId: event.taskId,
          action: 'allocate',
          reason:
            `Not enough contiguous memory ` +
            `for Task ${event.taskId}`,
        }
      }

      task.status = 'processing'
      state.queue.remove(event.taskId)

      return {
        ok: true,
      }
    }
  }
}
