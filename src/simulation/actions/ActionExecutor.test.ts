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

import type {
  Action,
} from '../rules/Rule'

import {
  advanceActionExecution,
  createActionExecution,
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
  it('rejects Split for an unsplittable task without changing the task', () => {
    const definition: TaskDefinition = {
      id: 'A',
      size: 3,
      duration: 4,
      splittable: false,
    }

    const task = createTaskRuntime(definition)
    const before = structuredClone(task)

    const action: Action = {
      type: 'split',
      fragments: [
        {
          type: 'literal',
          value: 1,
        },
        {
          type: 'reference',
          namespace: 'split',
          member: 'remaining',
        },
      ],
    }

    const result = createActionExecution(
      action,
      task,
    )

    expect(result).toEqual({
      ok: false,
      action: 'split',
      reason:
        'Task A cannot be split because it is not splittable',
    })

    expect(task).toEqual(before)
  })

  it('rejects Split for a non-waiting task without changing the task', () => {
    const task = createTaskRuntime(taskA)

    task.status = 'processing'

    const before = structuredClone(task)

    const action: Action = {
      type: 'split',
      fragments: [
        {
          type: 'literal',
          value: 1,
        },
        {
          type: 'reference',
          namespace: 'split',
          member: 'remaining',
        },
      ],
    }

    const result = createActionExecution(
      action,
      task,
    )

    expect(result).toEqual({
      ok: false,
      action: 'split',
      reason:
        'Task A cannot be split while status is processing',
    })

    expect(task).toEqual(before)
  })
  it('keeps Split local until execution completes', () => {
    const state = createState()
    const task = addWaitingTask(state)

    const action: Action = {
      type: 'split',
      fragments: [
        {
          type: 'literal',
          value: 1,
        },
        {
          type: 'reference',
          namespace: 'split',
          member: 'remaining',
        },
      ],
    }

    const startResult = createActionExecution(
      action,
      task,
    )

    expect(startResult.ok).toBe(true)

    if (!startResult.ok) {
      return
    }

    // Task starts unsplit.
    expect(task.fragmentSizes).toEqual([3])

    const firstAdvance = advanceActionExecution(
      startResult.execution,
      state,
      task,
    )

    // [1, 2] requires one physical cut.
    expect(firstAdvance).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    // The Split plan is still local while work is in progress.
    expect(task.fragmentSizes).toEqual([3])

    // Split does not allocate or remove the Task from waiting.
    expect(task.status).toBe('waiting')
    expect(state.queue.toArray()).toEqual(['A'])

    const secondAdvance = advanceActionExecution(
      startResult.execution,
      state,
      task,
    )

    expect(secondAdvance).toEqual({
      status: 'complete',
      consumedTick: false,
      value: undefined,
    })

    // Commit happens only after the whole Split execution succeeds.
    expect(task.fragmentSizes).toEqual([1, 2])

    expect(task.status).toBe('waiting')
    expect(state.queue.toArray()).toEqual(['A'])

    // Split itself does not allocate physical memory.
    expect(state.memory.getFreeSpace()).toBe(8)
  })
  it('allocates a fragmented task through the resumable action API', () => {
    const state = createState()

    const definition: TaskDefinition = {
      id: 'A',
      size: 4,
      duration: 4,
      splittable: true,
    }

    const task = createTaskRuntime(definition)

    task.fragmentSizes = [2, 2]

    state.tasks.set(task.definition.id, task)
    state.queue.enqueue(task.definition.id)

    // Build:
    //
    // [B][B][ ][ ][C][C][ ][ ]
    state.memory.allocateContiguous('B', 2)
    state.memory.allocateContiguous('X', 2)
    state.memory.allocateContiguous('C', 2)
    state.memory.release('X')

    expect(state.memory.getCells()).toEqual([
      'B', 'B',
      null, null,
      'C', 'C',
      null, null,
    ])

    const startResult = createActionExecution(
      { type: 'allocate' },
      task,
    )

    expect(startResult.ok).toBe(true)

    if (!startResult.ok) {
      return
    }

    const firstAdvance = advanceActionExecution(
      startResult.execution,
      state,
      task,
    )

    expect(firstAdvance).toEqual({
      status: 'progress',
      consumedTick: true,
    })

    expect(state.memory.getCells()).toEqual([
      'B', 'B',
      'A', 'A',
      'C', 'C',
      'A', 'A',
    ])

    expect(task.status).toBe('processing')
    expect(state.queue.toArray()).toEqual([])

    const secondAdvance = advanceActionExecution(
      startResult.execution,
      state,
      task,
    )

    expect(secondAdvance).toEqual({
      status: 'complete',
      consumedTick: false,
      value: undefined,
    })
  })
})