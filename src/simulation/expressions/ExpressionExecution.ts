import type {
  BinaryOperator,
  EvaluationContext,
  Expression,
  MathFunction,
  RuntimeValue,
} from './Expression'

export type ExecutionAdvanceResult<T> =
  | {
      status: 'progress'
      consumedTick: true
    }
  | {
      status: 'complete'
      consumedTick: boolean
      value: T
    }
  | {
      status: 'failure'
      consumedTick: boolean
      reason: string
    }

type ExpressionFrame =
  | {
      type: 'visit'
      expression: Expression
    }
  | {
      type: 'applyBinary'
      operator: BinaryOperator
    }
  | {
      type: 'applyMath'
      function: MathFunction
      argumentCount: number
    }

interface EvaluationSnapshot {
  readonly taskSize: number
  readonly splitRemaining?: number
}

export interface ExpressionExecution {
  readonly frames: ExpressionFrame[]
  readonly values: RuntimeValue[]
  readonly context: EvaluationSnapshot
}

export function createExpressionExecution(
  expression: Expression,
  context: EvaluationContext,
): ExpressionExecution {
  return {
    frames: [
      {
        type: 'visit',
        expression,
      },
    ],

    values: [],

    context: {
      taskSize: context.task.definition.size,
      splitRemaining: context.split?.remaining,
    },
  }
}

export function advanceExpressionExecution(
  execution: ExpressionExecution,
): ExecutionAdvanceResult<RuntimeValue> {
  while (execution.frames.length > 0) {
    const frame = execution.frames.pop()

    if (!frame) {
      break
    }

    if (frame.type === 'visit') {
      const result = visitExpression(
        execution,
        frame.expression,
      )

      if (result) {
        return result
      }

      continue
    }

    if (frame.type === 'applyBinary') {
      return applyBinary(
        execution,
        frame.operator,
      )
    }

    return applyMath(
      execution,
      frame.function,
      frame.argumentCount,
    )
  }

  const value = execution.values.pop()

  if (!value) {
    return {
      status: 'failure',
      consumedTick: false,
      reason: 'Expression completed without a value',
    }
  }

  return {
    status: 'complete',
    consumedTick: false,
    value,
  }
}

function visitExpression(
  execution: ExpressionExecution,
  expression: Expression,
): ExecutionAdvanceResult<RuntimeValue> | undefined {
  if (expression.type === 'literal') {
    execution.values.push(
      typeof expression.value === 'number'
        ? {
            type: 'number',
            value: expression.value,
          }
        : {
            type: 'boolean',
            value: expression.value,
          },
    )

    return undefined
  }

  if (expression.type === 'reference') {
    if (expression.namespace === 'task') {
      execution.values.push({
        type: 'number',
        value: execution.context.taskSize,
      })

      return undefined
    }

    if (execution.context.splitRemaining === undefined) {
      return {
        status: 'failure',
        consumedTick: false,
        reason:
          'Split.Remaining requires a split evaluation context',
      }
    }

    execution.values.push({
      type: 'number',
      value: execution.context.splitRemaining,
    })

    return undefined
  }

  if (expression.type === 'binary') {
    execution.frames.push(
      {
        type: 'applyBinary',
        operator: expression.operator,
      },
      {
        type: 'visit',
        expression: expression.right,
      },
      {
        type: 'visit',
        expression: expression.left,
      },
    )

    return undefined
  }

  const expectedArity =
    expression.function === 'min' ||
    expression.function === 'max'
      ? 2
      : 1

  if (expression.arguments.length !== expectedArity) {
    return {
      status: 'failure',
      consumedTick: false,
      reason:
        `Math.${expression.function} expects ` +
        `${expectedArity} argument(s)`,
    }
  }

  execution.frames.push({
    type: 'applyMath',
    function: expression.function,
    argumentCount: expression.arguments.length,
  })

  /*
   * Stack is LIFO.
   *
   * Push arguments from right to left so execution order becomes:
   *
   * argument 0
   * argument 1
   * ...
   * applyMath
   */
  for (
    let index = expression.arguments.length - 1;
    index >= 0;
    index -= 1
  ) {
    execution.frames.push({
      type: 'visit',
      expression: expression.arguments[index],
    })
  }

  return undefined
}

function applyBinary(
  execution: ExpressionExecution,
  operator: BinaryOperator,
): ExecutionAdvanceResult<RuntimeValue> {
  const right = execution.values.pop()
  const left = execution.values.pop()

  if (!left || !right) {
    return {
      status: 'failure',
      consumedTick: false,
      reason: 'Binary expression is missing an operand',
    }
  }

  /*
   * We reached the actual arithmetic operation.
   *
   * Therefore even a runtime type failure consumes
   * the operation's tick.
   */
  if (
    left.type !== 'number' ||
    right.type !== 'number'
  ) {
    return {
      status: 'failure',
      consumedTick: true,
      reason:
        'Binary arithmetic requires number operands',
    }
  }

  if (
    operator === 'divide' &&
    right.value === 0
  ) {
    return {
      status: 'failure',
      consumedTick: true,
      reason: 'Division by zero',
    }
  }

  let value: number

  switch (operator) {
    case 'add':
      value = left.value + right.value
      break

    case 'subtract':
      value = left.value - right.value
      break

    case 'multiply':
      value = left.value * right.value
      break

    case 'divide':
      value = left.value / right.value
      break
  }

  execution.values.push({
    type: 'number',
    value,
  })

  return {
    status: 'progress',
    consumedTick: true,
  }
}

function applyMath(
  execution: ExpressionExecution,
  fn: MathFunction,
  argumentCount: number,
): ExecutionAdvanceResult<RuntimeValue> {
  if (execution.values.length < argumentCount) {
    return {
      status: 'failure',
      consumedTick: false,
      reason: `Math.${fn} is missing an argument`,
    }
  }

  const args = execution.values.splice(
    execution.values.length - argumentCount,
    argumentCount,
  )

  const numbers: number[] = []

  for (const argument of args) {
    /*
     * We have reached the actual Math operation,
     * so a runtime type failure consumes its tick.
     */
    if (argument.type !== 'number') {
      return {
        status: 'failure',
        consumedTick: true,
        reason: `Math.${fn} requires number arguments`,
      }
    }

    numbers.push(argument.value)
  }

  let value: number

  switch (fn) {
    case 'min':
      value = Math.min(
        numbers[0],
        numbers[1],
      )
      break

    case 'max':
      value = Math.max(
        numbers[0],
        numbers[1],
      )
      break

    case 'floor':
      value = Math.floor(numbers[0])
      break

    case 'ceil':
      value = Math.ceil(numbers[0])
      break
  }

  execution.values.push({
    type: 'number',
    value,
  })

  return {
    status: 'progress',
    consumedTick: true,
  }
}