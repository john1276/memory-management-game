import { describe, expect, it } from 'vitest'

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
import type {
  RuleProgram,
} from './Rule'

import {
  advanceRuleExecutionSession,
  createRuleExecutionSession,
} from './RuleExecutionSession'

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
  state: SimulationState,
) {
  const task = createTaskRuntime(taskA)

  state.tasks.set(taskA.id, task)
  state.queue.enqueue(taskA.id)

  return task
}

const taskWaiting: SimulationEvent = {
  type: 'taskWaiting',
  taskId: 'A',
}

describe('RuleExecutionSession', () => {
  it('completes a zero-cost rule without consuming a tick', () => {
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

    const session = createRuleExecutionSession(
      program,
      taskWaiting,
      state,
    )

    /*
     * createRuleExecutionSession may return an
     * immediate construction failure.
     *
     * This valid program must produce a session.
     */
    if ('status' in session) {
      throw new Error(
        `Unexpected session creation failure: ${session.reason}`,
      )
    }

    const result = advanceRuleExecutionSession(
      session,
      state,
    )

    expect(result).toEqual({
      status: 'complete',
      consumedTick: false,
    })

    // The false branch executed no Action.
    expect(state.memory.getFreeSpace()).toBe(8)
    expect(state.queue.toArray()).toEqual(['A'])
    expect(
      state.tasks.get('A')?.status,
    ).toBe('waiting')
  })
  it('suspends after Allocate consumes one tick', () => {
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
    ]

    const session = createRuleExecutionSession(
        program,
        taskWaiting,
        state,
    )

    if ('status' in session) {
        throw new Error(
        `Unexpected session creation failure: ${session.reason}`,
        )
    }

    const firstAdvance = advanceRuleExecutionSession(
        session,
        state,
    )

    expect(firstAdvance).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    /*
    * Allocate effect happens on the consumed tick.
    */
    expect(state.memory.getCells()).toEqual([
        'A', 'A', 'A',
        null, null, null,
        null, null,
    ])

    expect(
        state.tasks.get('A')?.status,
    ).toBe('processing')

    expect(state.queue.toArray()).toEqual([])

    /*
    * The Action has consumed its tick, but the
    * Rule session still needs to resume past it.
    */
    const secondAdvance = advanceRuleExecutionSession(
        session,
        state,
    )

    expect(secondAdvance).toEqual({
        status: 'complete',
        consumedTick: false,
    })
    })
    it('resumes a multi-tick Split before continuing to the next statement', () => {
    const state = createState()

    const definition: TaskDefinition = {
        id: 'A',
        size: 7,
        duration: 4,
        splittable: true,
    }

    const task = createTaskRuntime(definition)

    state.tasks.set(task.definition.id, task)
    state.queue.enqueue(task.definition.id)

    const program: RuleProgram = [
        {
        id: 'rule-1',
        trigger: 'taskWaiting',

        body: [
            {
            type: 'action',
            action: {
                type: 'split',
                fragments: [
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
                        namespace: 'task',
                        member: 'size',
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
                ],
            },
            },

            /*
            * This must not execute until Split is
            * completely finished and committed.
            */
            {
            type: 'action',
            action: {
                type: 'allocate',
            },
            },
        ],
        },
    ]

    const session = createRuleExecutionSession(
        program,
        taskWaiting,
        state,
    )

    if ('status' in session) {
        throw new Error(
        `Unexpected session creation failure: ${session.reason}`,
        )
    }

    // Tick 1: Task.Size / 2
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    expect(task.fragmentSizes).toEqual([7])
    expect(task.status).toBe('waiting')
    expect(state.memory.getFreeSpace()).toBe(8)

    // Tick 2: Math.Floor(...)
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    expect(task.fragmentSizes).toEqual([7])
    expect(task.status).toBe('waiting')
    expect(state.memory.getFreeSpace()).toBe(8)

    // Tick 3: one physical cut.
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    /*
    * The cut work has consumed its tick, but the
    * Action has not yet returned complete.
    *
    * Therefore the Task shape is still uncommitted.
    */
    expect(task.fragmentSizes).toEqual([7])
    expect(task.status).toBe('waiting')
    expect(state.memory.getFreeSpace()).toBe(8)

    /*
    * Next advance:
    *
    * - SplitExecution reports complete at zero cost.
    * - ActionExecutor commits [3, 4].
    * - RuleExecutionSession pops the Split frame.
    * - Traversal reaches the following Allocate.
    * - Allocate consumes this call's one cost-bearing tick.
    */
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    expect(task.fragmentSizes).toEqual([3, 4])
    expect(task.status).toBe('processing')
    expect(state.queue.toArray()).toEqual([])
    expect(state.memory.getFreeSpace()).toBe(1)

    // Allocate itself now finishes at zero cost.
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'complete',
        consumedTick: false,
    })
    })
    it('evaluates later conditions using updated simulation state', () => {
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

    const session = createRuleExecutionSession(
        program,
        taskWaiting,
        state,
    )

    if ('status' in session) {
        throw new Error(
        `Unexpected session creation failure: ${session.reason}`,
        )
    }

    /*
    * rule-1 Allocate consumes its tick.
    *
    * Memory goes from 8 free cells to 5.
    */
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    expect(state.memory.getFreeSpace()).toBe(5)

    /*
    * Resume after Allocate.
    *
    * rule-2 now evaluates:
    *
    * freeSpace >= 6
    *
    * against the CURRENT state (5 free), so its
    * Allocate branch must be skipped.
    */
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'complete',
        consumedTick: false,
    })

    expect(state.memory.getFreeSpace()).toBe(5)
    expect(
        state.tasks.get('A')?.status,
    ).toBe('processing')
    })
    it('keeps earlier committed state when a later action fails', () => {
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

    const session = createRuleExecutionSession(
        program,
        taskWaiting,
        state,
    )

    if ('status' in session) {
        throw new Error(
        `Unexpected session creation failure: ${session.reason}`,
        )
    }

    /*
    * rule-1 succeeds and commits its effect.
    */
    expect(
        advanceRuleExecutionSession(
        session,
        state,
        ),
    ).toEqual({
        status: 'progress',
        consumedTick: true,
    })

    expect(state.memory.getCells()).toEqual([
        'A', 'A', 'A',
        null, null, null,
        null, null,
    ])

    expect(
        state.tasks.get('A')?.status,
    ).toBe('processing')

    expect(state.queue.toArray()).toEqual([])

    /*
    * Resume past rule-1.
    *
    * rule-2 tries Allocate again.
    * The Task is already processing, so this Action fails.
    */
    const result = advanceRuleExecutionSession(
        session,
        state,
    )

    expect(result).toEqual({
        status: 'failure',
        consumedTick: true,
        ruleId: 'rule-2',
        taskId: 'A',
        action: 'allocate',
        reason:
        'Task A cannot be allocated while status is processing',
    })

    /*
    * No rollback:
    * rule-1's committed state remains exactly as it was.
    */
    expect(state.memory.getCells()).toEqual([
        'A', 'A', 'A',
        null, null, null,
        null, null,
    ])

    expect(
        state.tasks.get('A')?.status,
    ).toBe('processing')

    expect(state.queue.toArray()).toEqual([])
    })
})