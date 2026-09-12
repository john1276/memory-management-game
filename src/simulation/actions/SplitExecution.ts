import type { TaskRuntime } from '../../domain/Task'
import type { Expression } from '../expressions/Expression'
import {
  advanceExpressionExecution,
  createExpressionExecution,
  type ExecutionAdvanceResult,
  type ExpressionExecution,
} from '../expressions/ExpressionExecution'

export interface SplitPlan {
  readonly fragments: readonly number[]
}

export interface SplitExecution {
  readonly expressions: readonly Expression[]
  readonly task: TaskRuntime

  remaining: number
  resolvedFragments: number[]

  nextExpressionIndex: number
  currentExpression?: ExpressionExecution

  physicalCutsRemaining: number
  expressionsComplete: boolean
}

export function createSplitExecution(
  fragments: readonly Expression[],
  task: TaskRuntime,
): SplitExecution {
  return {
    expressions: fragments,
    task,

    remaining: task.definition.size,
    resolvedFragments: [],

    nextExpressionIndex: 0,
    currentExpression: undefined,

    physicalCutsRemaining: 0,
    expressionsComplete: false,
  }
}

export function advanceSplitExecution(
  execution: SplitExecution,
): ExecutionAdvanceResult<SplitPlan> {
  while (true) {
    if (!execution.expressionsComplete) {
      const expressionResult =
        advanceFragmentResolution(execution)

      if (expressionResult) {
        return expressionResult
      }

      continue
    }

    if (execution.physicalCutsRemaining > 0) {
      execution.physicalCutsRemaining -= 1

      return {
        status: 'progress',
        consumedTick: true,
      }
    }

    return {
      status: 'complete',
      consumedTick: false,
      value: {
        fragments: [...execution.resolvedFragments],
      },
    }
  }
}

function advanceFragmentResolution(
  execution: SplitExecution,
): ExecutionAdvanceResult<SplitPlan> | undefined {
  if (!execution.currentExpression) {
    if (
    execution.nextExpressionIndex >=
    execution.expressions.length
    ) {
    if (execution.remaining !== 0) {
        return {
        status: 'failure',
        consumedTick: false,
        reason:
            `Task ${execution.task.definition.id} ` +
            `split plan leaves ${execution.remaining} unassigned`,
        }
    }

    execution.expressionsComplete = true

    execution.physicalCutsRemaining = Math.max(
        0,
        execution.resolvedFragments.length - 1,
    )

    return undefined
    }

    const expression =
      execution.expressions[
        execution.nextExpressionIndex
      ]

    execution.currentExpression =
      createExpressionExecution(expression, {
        task: execution.task,

        split: {
          remaining: execution.remaining,
        },
      })
  }

  const result = advanceExpressionExecution(
    execution.currentExpression,
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
      reason:
        `Task ${execution.task.definition.id} ` +
        `split expression failed: ${result.reason}`,
    }
  }

  /*
   * Full runtime validation comes in the next TDD steps.
   *
   * For the first GREEN case the fragment expressions
   * are known to produce numbers.
   */
  if (result.value.type !== 'number') {
    return {
      status: 'failure',
      consumedTick: false,
      reason:
        `Task ${execution.task.definition.id} ` +
        `split fragment must resolve to a number, ` +
        `got boolean ${result.value.value}`,
    }
  }

  const fragmentSize = result.value.value

  if (
    !Number.isInteger(fragmentSize) ||
    fragmentSize <= 0
  ) {
    return {
        status: 'failure',
        consumedTick: false,
        reason:
        `Task ${execution.task.definition.id} ` +
        `split fragment must be a positive integer, ` +
        `got ${fragmentSize}`,
    }
  }
  
  if (fragmentSize > execution.remaining) {
  return {
    status: 'failure',
    consumedTick: false,
    reason:
      `Task ${execution.task.definition.id} ` +
      `split fragment ${fragmentSize} exceeds ` +
      `remaining size ${execution.remaining}`,
    }
  }

  execution.resolvedFragments.push(fragmentSize)
  execution.remaining -= fragmentSize

  execution.nextExpressionIndex += 1
  execution.currentExpression = undefined

  /*
   * No tick was consumed by the expression completion.
   * Continue immediately so additional zero-cost fragments
   * can resolve during the same advance call.
   */
  return undefined
}