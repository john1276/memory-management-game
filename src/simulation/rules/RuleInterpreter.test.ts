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
  SimulationEvent,
} from '../SimulationEvent'

import {
  executeRuleProgram,
} from './RuleInterpreter'

import type {
  RuleProgram,
} from './Rule'

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
): void {
  state.tasks.set(
    taskA.id,
    createTaskRuntime(taskA)
  )

  state.queue.enqueue(taskA.id)
}

const taskWaiting: SimulationEvent = {
  type: 'taskWaiting',
  taskId: 'A',
}

describe('RuleInterpreter', () => {
  it('allocates a waiting task when the condition is true', () => {
    const state = createState()

    addWaitingTask(state)

    const program: RuleProgram = [
      {
        id: 'rule-1',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'if',

            condition: {
              type: 'taskSizeGreaterThan',
              value: 2,
            },

            then: [
              {
                type: 'action',

                action: {
                  type: 'allocate',
                },
              },
            ],
          },
        ],
      },
    ]

    const result = executeRuleProgram(
      program,
      taskWaiting,
      state
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

    expect(
      state.tasks.get('A')?.status
    ).toBe('processing')

    expect(state.queue.toArray()).toEqual([])
  })

  it('executes the else branch when condition is false', () => {
    const state = createState()

    addWaitingTask(state)

    const program: RuleProgram = [
      {
        id: 'rule-1',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'if',

            condition: {
              type: 'taskSizeGreaterThan',
              value: 10,
            },

            then: [],

            else: [
              {
                type: 'action',

                action: {
                  type: 'allocate',
                },
              },
            ],
          },
        ],
      },
    ]

    const result = executeRuleProgram(
      program,
      taskWaiting,
      state
    )

    expect(result.ok).toBe(true)

    expect(
      state.memory.getFreeSpace()
    ).toBe(5)
  })

  it('evaluates later conditions using the updated state', () => {
    const state = createState()

    addWaitingTask(state)

    const program: RuleProgram = [
      {
        id: 'rule-1',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'action',

            action: {
              type: 'allocate',
            },
          },
        ],
      },

      {
        id: 'rule-2',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'if',

            condition: {
              type: 'freeSpaceGreaterThanOrEqual',
              value: 6,
            },

            then: [
              {
                type: 'action',

                action: {
                  type: 'allocate',
                },
              },
            ],
          },
        ],
      },
    ]

    const result = executeRuleProgram(
      program,
      taskWaiting,
      state
    )

    expect(result.ok).toBe(true)

    expect(
      state.memory.getFreeSpace()
    ).toBe(5)
  })

  it('keeps previous state changes when a later action fails', () => {
    const state = createState()

    addWaitingTask(state)

    const program: RuleProgram = [
      {
        id: 'rule-1',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'action',

            action: {
              type: 'allocate',
            },
          },
        ],
      },

      {
        id: 'rule-2',

        trigger: 'taskWaiting',

        body: [
          {
            type: 'action',

            action: {
              type: 'allocate',
            },
          },
        ],
      },
    ]

    const result = executeRuleProgram(
      program,
      taskWaiting,
      state
    )

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.ruleId).toBe(
        'rule-2'
      )

      expect(result.action).toBe(
        'allocate'
      )
    }

    expect(
      state.memory.getCells()
    ).toEqual([
      'A', 'A', 'A',
      null, null, null,
      null, null,
    ])

    expect(
      state.tasks.get('A')?.status
    ).toBe('processing')

    expect(state.queue.toArray()).toEqual([])
  })
})
