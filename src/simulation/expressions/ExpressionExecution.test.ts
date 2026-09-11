import { describe, expect, it } from 'vitest'

import {
  createTaskRuntime,
  type TaskDefinition,
} from '../../domain/Task'
import type { Expression } from './Expression'
import {
  advanceExpressionExecution,
  createExpressionExecution,
} from './ExpressionExecution'

const taskDefinition: TaskDefinition = {
  id: 'A',
  size: 8,
  duration: 3,
  splittable: true,
}

function createTask() {
  return createTaskRuntime(taskDefinition)
}

describe('ExpressionExecution zero-cost reads', () => {
  it('completes a numeric literal without consuming a tick', () => {
    const execution = createExpressionExecution(
      { type: 'literal', value: 3 },
      { task: createTask() },
    )

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 3 },
    })
  })

  it('resolves Task.Size without consuming a tick', () => {
    const expression: Expression = {
      type: 'reference',
      namespace: 'task',
      member: 'size',
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 8 },
    })
  })

  it('resolves Split.Remaining from the split context without consuming a tick', () => {
    const expression: Expression = {
      type: 'reference',
      namespace: 'split',
      member: 'remaining',
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
      split: { remaining: 5 },
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 5 },
    })
  })

  it('fails Split.Remaining without split context without consuming a tick', () => {
    const expression: Expression = {
      type: 'reference',
      namespace: 'split',
      member: 'remaining',
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    const result = advanceExpressionExecution(execution)

    expect(result.status).toBe('failure')
    expect(result.consumedTick).toBe(false)
  })

  it('captures Split.Remaining when the expression execution is created', () => {
    const split = { remaining: 7 }

    const expression: Expression = {
      type: 'binary',
      operator: 'add',
      left: {
        type: 'reference',
        namespace: 'split',
        member: 'remaining',
      },
      right: {
        type: 'reference',
        namespace: 'split',
        member: 'remaining',
      },
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
      split,
    })

    // The expression must keep the snapshot from creation time.
    split.remaining = 2

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 14 },
    })
  })
})

describe('ExpressionExecution binary operations', () => {
  it('consumes one tick for Task.Size / 2 and completes on the next advance', () => {
    const expression: Expression = {
      type: 'binary',
      operator: 'divide',
      left: {
        type: 'reference',
        namespace: 'task',
        member: 'size',
      },
      right: {
        type: 'literal',
        value: 2,
      },
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 4 },
    })
  })

  it('fails division by zero on the division step', () => {
    const expression: Expression = {
      type: 'binary',
      operator: 'divide',
      left: {
        type: 'literal',
        value: 8,
      },
      right: {
        type: 'literal',
        value: 0,
      },
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    const result = advanceExpressionExecution(execution)

    expect(result.status).toBe('failure')
    expect(result.consumedTick).toBe(true)
  })

  it('consumes one tick per nested binary operation', () => {
    const expression: Expression = {
      type: 'binary',
      operator: 'add',
      left: {
        type: 'binary',
        operator: 'divide',
        left: {
          type: 'reference',
          namespace: 'task',
          member: 'size',
        },
        right: {
          type: 'literal',
          value: 2,
        },
      },
      right: {
        type: 'literal',
        value: 1,
      },
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 5 },
    })
  })
})

describe('ExpressionExecution math calls', () => {
  it('consumes one tick for division and one tick for Math.Floor', () => {
    const task = createTaskRuntime({
      ...taskDefinition,
      size: 7,
    })

    const expression: Expression = {
      type: 'call',
      namespace: 'math',
      function: 'floor',
      arguments: [
        {
          type: 'binary',
          operator: 'divide',
          left: {
            type: 'reference',
            namespace: 'task',
            member: 'size',
          },
          right: {
            type: 'literal',
            value: 2,
          },
        },
      ],
    }

    const execution = createExpressionExecution(expression, { task })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 3 },
    })
  })

  it('evaluates Math.Min with Split.Remaining in one tick', () => {
    const expression: Expression = {
      type: 'call',
      namespace: 'math',
      function: 'min',
      arguments: [
        {
          type: 'literal',
          value: 3,
        },
        {
          type: 'reference',
          namespace: 'split',
          member: 'remaining',
        },
      ],
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
      split: { remaining: 5 },
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceExpressionExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: { type: 'number', value: 3 },
    })
  })

  it('fails an incorrect Math arity without producing undefined or NaN', () => {
    const expression: Expression = {
      type: 'call',
      namespace: 'math',
      function: 'min',
      arguments: [
        {
          type: 'literal',
          value: 3,
        },
      ],
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    const result = advanceExpressionExecution(execution)

    expect(result.status).toBe('failure')
    expect(result.consumedTick).toBe(false)
  })

  it('fails when a boolean argument reaches a Math operation', () => {
    const expression: Expression = {
      type: 'call',
      namespace: 'math',
      function: 'floor',
      arguments: [
        {
          type: 'literal',
          value: true,
        },
      ],
    }

    const execution = createExpressionExecution(expression, {
      task: createTask(),
    })

    const result = advanceExpressionExecution(execution)

    expect(result.status).toBe('failure')
    expect(result.consumedTick).toBe(true)
  })
})