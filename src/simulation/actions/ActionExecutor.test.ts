import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  createTaskRuntime,
  type TaskDefinition,
} from '../../domain/Task'

import { Memory } from '../../domain/Memory'
import { TaskQueue } from '../../domain/TaskQueue'

import type {
  SimulationState,
} from '../SimulationState'

import {
  executeAction,
} from './ActionExecutor'

function createState(): SimulationState {
  return {
    tick: 0,
    status: 'running',

    memory: new Memory(8),
    queue: new TaskQueue(),

    tasks: new Map(),

    workload: [],

    failure: null,
    logs: [],
  }
}

const taskA: TaskDefinition = {
  id: 'A',
  size: 3,
  duration: 4,
  splittable: true,
}

function addWaitingTask(
  state: SimulationState
) {
  const task = createTaskRuntime(taskA)

  state.tasks.set(taskA.id, task)
  state.queue.enqueue(taskA.id)

  return task
}

describe('ActionExecutor', () => {
  it('allocates a waiting task', () => {
    const state = createState()
    const task = addWaitingTask(state)

    const result = executeAction(
      { type: 'allocate' },
      state,
      task
    )

    expect(result).toEqual({
      ok: true,
    })

    expect(
      state.memory.getCells()
    ).toEqual([
      'A', 'A', 'A',
      null, null, null,
      null, null,
    ])

    expect(task.status).toBe('processing')
    expect(state.queue.toArray()).toEqual([])
  })

  it('fails when allocating a task that is not waiting', () => {
    const state = createState()
    const task = addWaitingTask(state)

    task.status = 'processing'

    const result = executeAction(
      { type: 'allocate' },
      state,
      task
    )

    expect(result).toEqual({
      ok: false,
      action: 'allocate',
      reason:
        'Task A cannot be allocated while status is processing',
    })

    expect(state.memory.getFreeSpace()).toBe(8)
    expect(state.queue.toArray()).toEqual(['A'])
  })

  it('fails when contiguous memory is insufficient', () => {
    const state = createState()
    const task = addWaitingTask(state)

    state.memory.allocateContiguous('B', 6)

    const result = executeAction(
      { type: 'allocate' },
      state,
      task
    )

    expect(result).toEqual({
      ok: false,
      action: 'allocate',
      reason:
        'Not enough contiguous memory for Task A',
    })

    expect(task.status).toBe('waiting')
    expect(state.queue.toArray()).toEqual(['A'])
  })
})