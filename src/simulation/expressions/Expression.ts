import type { TaskRuntime } from '../../domain/Task'

export type RuntimeValue =
  | {
      type: 'number'
      value: number
    }
  | {
      type: 'boolean'
      value: boolean
    }

export type BinaryOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'

export type MathFunction =
  | 'min'
  | 'max'
  | 'floor'
  | 'ceil'

export type Expression =
  | {
      type: 'literal'
      value: number | boolean
    }
  | {
      type: 'reference'
      namespace: 'task'
      member: 'size'
    }
  | {
      type: 'reference'
      namespace: 'split'
      member: 'remaining'
    }
  | {
      type: 'binary'
      operator: BinaryOperator
      left: Expression
      right: Expression
    }
  | {
      type: 'call'
      namespace: 'math'
      function: MathFunction
      arguments: readonly Expression[]
    }

export interface EvaluationContext {
  readonly task: TaskRuntime

  readonly split?: {
    readonly remaining: number
  }
}