import { describe, expect, it } from 'vitest'

import {
  createTaskRuntime,
  type TaskDefinition,
} from './Task'

const taskA: TaskDefinition = {
  id: 'A',
  size: 2,
  duration: 3,
  splittable: false,
}

describe('TaskRuntime', () => {
  it('starts in waiting state with fresh runtime metrics', () => {
    const runtime = createTaskRuntime(taskA)

    expect(runtime.definition).toBe(taskA)
    expect(runtime.status).toBe('waiting')
    expect(runtime.remainingDuration).toBe(3)
    expect(runtime.waitingTicks).toBe(0)
  })
  it('starts with one fragment covering the full task size', () => {
    const definition: TaskDefinition = {
      id: 'A',
      size: 6,
      duration: 3,
      splittable: true,
    }

    const runtime = createTaskRuntime(definition)

    expect(runtime.fragmentSizes).toEqual([6])
  })
})
