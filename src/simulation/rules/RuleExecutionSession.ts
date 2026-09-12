import type {
  TaskId,
} from '../../domain/Task'

import type {
  SimulationState,
} from '../SimulationState'

import type {
  SimulationEvent,
} from '../SimulationEvent'

import type {
  Action,
  RuleProgram,
  Statement,
} from './Rule'

import {
  evaluateCondition,
} from './RuleInterpreter'

import {
  advanceActionExecution,
  createActionExecution,
  type ActionExecution,
} from '../actions/ActionExecutor'

export interface RuleExecutionSession {
  readonly taskId: TaskId
}

export type RuleExecutionFailure = {
  status: 'failure'
  consumedTick: boolean
  ruleId: string
  taskId: TaskId
  action?: Action['type']
  reason: string
}

export type RuleAdvanceResult =
  | {
      status: 'progress'
      consumedTick: true
    }
  | {
      status: 'complete'
      consumedTick: boolean
    }
  | RuleExecutionFailure

type RuleFrame =
  | {
      type: 'statements'
      ruleId: string
      statements: readonly Statement[]
      index: number
    }
  | {
      type: 'action'
      ruleId: string
      execution: ActionExecution
    }

interface InternalRuleExecutionSession
  extends RuleExecutionSession {
  frames: RuleFrame[]
}

export function createRuleExecutionSession(
  program: RuleProgram,
  event: SimulationEvent,
  state: SimulationState,
): RuleExecutionSession | RuleExecutionFailure {
  const task = state.tasks.get(event.taskId)

  if (!task) {
    return {
      status: 'failure',
      consumedTick: false,
      ruleId: 'system',
      taskId: event.taskId,
      reason:
        `Task ${event.taskId} does not exist`,
    }
  }

  const frames: RuleFrame[] = []

  /*
   * Frames are a stack.
   *
   * Push matching rules in reverse order so the
   * first matching rule becomes the top frame.
   */
  for (
    let index = program.length - 1;
    index >= 0;
    index -= 1
  ) {
    const rule = program[index]

    if (rule.trigger !== event.type) {
      continue
    }

    frames.push({
      type: 'statements',
      ruleId: rule.id,
      statements: rule.body,
      index: 0,
    })
  }

  const session: InternalRuleExecutionSession = {
    taskId: event.taskId,
    frames,
  }

  return session
}

export function advanceRuleExecutionSession(
  session: RuleExecutionSession,
  state: SimulationState,
): RuleAdvanceResult {
  const internal =
    session as InternalRuleExecutionSession

  const task = state.tasks.get(session.taskId)

  if (!task) {
    return {
      status: 'failure',
      consumedTick: false,
      ruleId: 'system',
      taskId: session.taskId,
      reason:
        `Task ${session.taskId} does not exist`,
    }
  }

  while (internal.frames.length > 0) {
    const frame =
      internal.frames[
        internal.frames.length - 1
      ]
    if (frame.type === 'action') {
    const result = advanceActionExecution(
        frame.execution,
        state,
        task,
    )

    if (result.status === 'progress') {
        return {
        status: 'progress',
        consumedTick: true,
        }
    }

    if (result.status === 'failure') {
        return {
        status: 'failure',
        consumedTick: result.consumedTick,
        ruleId: frame.ruleId,
        taskId: session.taskId,
        action: frame.execution.type,
        reason: result.reason,
        }
    }

    /*
    * Action completed.
    * Remove its frame and resume the parent.
    */
    internal.frames.pop()

    /*
    * Normally our current Action implementations finish
    * with consumedTick:false after their previous progress.
    *
    * Keep this branch correct even if a future Action can
    * complete on the same cost-bearing step.
    */
    if (result.consumedTick) {
        return {
        status: 'progress',
        consumedTick: true,
        }
    }

    continue
    }

    if (frame.index >= frame.statements.length) {
      internal.frames.pop()
      continue
    }

    const statement =
      frame.statements[frame.index]

    /*
     * Advance the parent before descending.
     * When a nested branch completes, execution
     * resumes at the following statement.
     */
    frame.index += 1

    if (statement.type === 'if') {
      const conditionResult = evaluateCondition(
        statement.condition,
        state,
        task,
      )

      const branch = conditionResult
        ? statement.then
        : statement.else

      if (branch && branch.length > 0) {
        internal.frames.push({
          type: 'statements',
          ruleId: frame.ruleId,
          statements: branch,
          index: 0,
        })
      }

      continue
    }

    /*
     * Action suspension is deliberately the next
     * TDD step. Reaching one currently proves that
     * zero-cost traversal itself is working.
     */
    const startResult = createActionExecution(
    statement.action,
    task,
    )

    if (!startResult.ok) {
    return {
        status: 'failure',
        consumedTick: false,
        ruleId: frame.ruleId,
        taskId: session.taskId,
        action: startResult.action,
        reason: startResult.reason,
    }
    }

    internal.frames.push({
    type: 'action',
    ruleId: frame.ruleId,
    execution: startResult.execution,
    })

    continue
  }

  return {
    status: 'complete',
    consumedTick: false,
  }
}