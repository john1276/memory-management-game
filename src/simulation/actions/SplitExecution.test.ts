import { describe, expect, it } from 'vitest'

import {
  createTaskRuntime,
  type TaskDefinition,
} from '../../domain/Task'
import type { Expression } from '../expressions/Expression'
import {
  advanceSplitExecution,
  createSplitExecution,
} from './SplitExecution'

const taskDefinition: TaskDefinition = {
  id: 'A',
  size: 8,
  duration: 3,
  splittable: true,
}

describe('SplitExecution', () => {
  it('resolves zero-cost fragments left-to-right and charges one physical cut', () => {
    const task = createTaskRuntime(taskDefinition)

    const fragments: Expression[] = [
      {
        type: 'literal',
        value: 3,
      },
      {
        type: 'reference',
        namespace: 'split',
        member: 'remaining',
      },
    ]

    const execution = createSplitExecution(
      fragments,
      task,
    )

    expect(advanceSplitExecution(execution)).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(advanceSplitExecution(execution)).toEqual({
      status: 'complete',
      consumedTick: false,
      value: {
        fragments: [3, 5],
      },
    })
  })
  it('resolves complex expressions across ticks and charges physical cuts', () => {
  const task = createTaskRuntime({
    ...taskDefinition,
    size: 10,
  })

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: 3,
    },
    {
      type: 'call',
      namespace: 'math',
      function: 'floor',
      arguments: [
        {
          type: 'binary',
          operator: 'divide',
          left: {
            type: 'reference',
            namespace: 'split',
            member: 'remaining',
          },
          right: {
            type: 'literal',
            value: 2,
          },
        },
      ],
    },
    {
      type: 'reference',
      namespace: 'split',
      member: 'remaining',
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  // Split.Remaining = 7
  // 7 / 2 = 3.5
  expect(advanceSplitExecution(execution)).toEqual({
    status: 'progress',
    consumedTick: true,
  })

  // Math.Floor(3.5) = 3
  expect(advanceSplitExecution(execution)).toEqual({
    status: 'progress',
    consumedTick: true,
  })

  // First physical cut
  expect(advanceSplitExecution(execution)).toEqual({
    status: 'progress',
    consumedTick: true,
  })

  // Second physical cut
  expect(advanceSplitExecution(execution)).toEqual({
    status: 'progress',
    consumedTick: true,
  })

  expect(advanceSplitExecution(execution)).toEqual({
    status: 'complete',
    consumedTick: false,
    value: {
      fragments: [3, 3, 4],
    },
  })
})
  it('fails when a fragment resolves to zero', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: 0,
    },
    {
      type: 'reference',
      namespace: 'split',
      member: 'remaining',
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})
  it('fails when a fragment resolves to a non-integer', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: 2.5,
    },
    {
      type: 'reference',
      namespace: 'split',
      member: 'remaining',
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})
  it('fails when a fragment is larger than the remaining size', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: 9,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})
  it('fails when the resolved fragments do not consume the full task size', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: 3,
    },
    {
      type: 'literal',
      value: 3,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})
  it('fails when a fragment resolves to a boolean', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: true,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})

  it('fails when a fragment resolves to a negative number', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: -1,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})

  it('fails when a fragment resolves to NaN', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: Number.NaN,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})

  it('fails when a fragment resolves to Infinity', () => {
  const task = createTaskRuntime(taskDefinition)

  const fragments: Expression[] = [
    {
      type: 'literal',
      value: Number.POSITIVE_INFINITY,
    },
  ]

  const execution = createSplitExecution(
    fragments,
    task,
  )

  const result = advanceSplitExecution(execution)

  expect(result.status).toBe('failure')
  expect(result.consumedTick).toBe(false)
})
  it('includes the task id in a boolean fragment failure', () => {
    const task = createTaskRuntime(taskDefinition)

    const execution = createSplitExecution(
      [
        {
          type: 'literal',
          value: true,
        },
      ],
      task,
    )

    const result = advanceSplitExecution(execution)

    expect(result.status).toBe('failure')

    if (result.status === 'failure') {
      expect(result.reason).toContain('Task A')
      expect(result.reason).toContain('boolean')
    }
  })
  it('includes the task id when fragment expression evaluation fails', () => {
    const task = createTaskRuntime(taskDefinition)

    const execution = createSplitExecution(
      [
        {
          type: 'binary',
          operator: 'divide',
          left: {
            type: 'literal',
            value: 1,
          },
          right: {
            type: 'literal',
            value: 0,
          },
        },
      ],
      task,
    )

    const result = advanceSplitExecution(execution)

    expect(result.status).toBe('failure')

    if (result.status === 'failure') {
      expect(result.consumedTick).toBe(true)
      expect(result.reason).toContain('Task A')
      expect(result.reason).toContain('Division by zero')
    }
  })
  it('does not mutate the task when split execution fails', () => {
    const task = createTaskRuntime(taskDefinition)

    const originalTask = structuredClone(task)

    const execution = createSplitExecution(
      [
        {
          type: 'literal',
          value: 9,
        },
      ],
      task,
    )

    expect(advanceSplitExecution(execution).status).toBe(
      'failure',
    )

    expect(task).toEqual(originalTask)
  })
})