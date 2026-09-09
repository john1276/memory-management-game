import { describe, expect, it } from 'vitest'

import type { TaskDefinition } from '../domain/Task'
import { createTaskRuntime } from '../domain/Task'
import type { Workload } from '../domain/Workload'

import { SimulationEngine } from './SimulationEngine'

import type { RuleProgram } from './rules/Rule'

const taskA: TaskDefinition = {
  id: 'A',
  size: 2,
  duration: 3,
  splittable: false,
}

const taskB: TaskDefinition = {
  id: 'B',
  size: 3,
  duration: 2,
  splittable: true,
}

const workload: Workload = [
  {
    tick: 0,
    task: taskA,
  },
  {
    tick: 1,
    task: taskB,
  },
]

describe('SimulationEngine', () => {
  it('creates the correct initial state', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    const state = engine.getState()

    expect(state.tick).toBe(0)
    expect(state.status).toBe('idle')

    expect(state.memory.capacity).toBe(8)
    expect(state.memory.getFreeSpace()).toBe(8)

    expect(state.queue.isEmpty).toBe(true)

    expect(state.tasks.size).toBe(0)

    expect(state.failure).toBeNull()
    expect(state.logs).toEqual([])
  })

  it('changes from idle to running when started', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.start()

    expect(engine.getState().status).toBe(
      'running'
    )
  })

  it('does not run ticks while idle', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.runTick()

    expect(engine.getState().tick).toBe(0)
    expect(engine.getState().tasks.size).toBe(0)
  })

  it('puts arriving tasks into the waiting list', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.start()
    engine.runTick()

    const state = engine.getState()

    expect(state.tick).toBe(1)

    expect(state.tasks.has('A')).toBe(true)

    const runtime = state.tasks.get('A')

    expect(runtime).toBeDefined()
    expect(runtime?.definition).toBe(taskA)
    expect(runtime?.remainingDuration).toBe(3)
    expect(runtime?.status).toBe('waiting')
    expect(runtime?.waitingTicks).toBe(1)

    expect(state.queue.toArray()).toEqual([
      'A',
    ])

    expect(state.logs).toEqual([
      {
        tick: 0,
        message: 'Task A arrived',
      },
    ])
  })

  it('keeps unhandled arrivals waiting across later ticks', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.start()

    engine.runTick()
    engine.runTick()

    const state = engine.getState()

    expect(state.tick).toBe(2)

    expect(state.tasks.has('A')).toBe(true)
    expect(state.tasks.has('B')).toBe(true)

    expect(state.tasks.get('A')?.status).toBe(
      'waiting'
    )
    expect(state.tasks.get('A')?.waitingTicks).toBe(2)

    expect(state.tasks.get('B')?.status).toBe(
      'waiting'
    )
    expect(state.tasks.get('B')?.waitingTicks).toBe(1)

    expect(state.queue.toArray()).toEqual([
      'A',
      'B',
    ])

    expect(state.logs).toEqual([
      {
        tick: 0,
        message: 'Task A arrived',
      },
      {
        tick: 1,
        message: 'Task B arrived',
      },
    ])
  })

  it('decreases remaining duration of processing tasks', () => {
    const engine = new SimulationEngine(
      [],
      8
    )

    const runtime =
      createTaskRuntime(taskA)

    runtime.status = 'processing'

    engine
      .getState()
      .tasks
      .set(taskA.id, runtime)

    engine.start()
    engine.runTick()

    expect(
      engine
        .getState()
        .tasks
        .get('A')
        ?.remainingDuration
    ).toBe(2)
  })

  it('completes a processing task and releases its memory', () => {
    const shortTask: TaskDefinition = {
      id: 'A',
      size: 2,
      duration: 1,
      splittable: false,
    }

    const engine = new SimulationEngine(
      [],
      8
    )

    const runtime =
      createTaskRuntime(shortTask)

    runtime.status = 'processing'

    const state = engine.getState()

    state.tasks.set(
      shortTask.id,
      runtime
    )

    state.memory.allocateContiguous(
      shortTask.id,
      shortTask.size
    )

    expect(
      state.memory.getCells()
    ).toEqual([
      'A', 'A',
      null, null, null,
      null, null, null,
    ])

    engine.start()
    engine.runTick()

    expect(
      state.tasks.get('A')?.status
    ).toBe('completed')

    expect(
      state.tasks
        .get('A')
        ?.remainingDuration
    ).toBe(0)

    expect(
      state.memory.getFreeSpace()
    ).toBe(8)

    expect(state.logs).toContainEqual({
      tick: 0,
      message: 'Task A completed',
    })
  })

  it('halts the simulation with failure information', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.start()

    engine.halt(
      'Not enough contiguous memory',
      'A'
    )

    const state = engine.getState()

    expect(state.status).toBe('halted')

    expect(state.failure).toEqual({
      tick: 0,
      taskId: 'A',
      reason:
        'Not enough contiguous memory',
    })

    expect(state.logs).toContainEqual({
      tick: 0,
      message:
        'FAILURE: Not enough contiguous memory',
    })
  })

  it('does not continue ticking after halt', () => {
    const engine = new SimulationEngine(
      workload,
      8
    )

    engine.start()
    engine.halt('Test failure')

    engine.runTick()

    expect(engine.getState().tick).toBe(0)
  })

  it('executes task-waiting rules for a waiting task', () => {
    const task: TaskDefinition = {
      id: 'A',
      size: 3,
      duration: 4,
      splittable: false,
    }

    const taskWorkload: Workload = [
      {
        tick: 0,
        task,
      },
    ]

    const rules: RuleProgram = [
      {
        id: 'rule-1',
        trigger: 'taskWaiting',

        body: [
          {
            type: 'if',

            condition: {
              type: 'taskSizeLessThanOrEqual',
              value: 3,
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

    const engine = new SimulationEngine(
      taskWorkload,
      8,
      rules
    )

    engine.start()
    engine.runTick()

    const state = engine.getState()

    expect(state.tick).toBe(1)

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
    expect(state.status).toBe('running')
  })

  it('retries a waiting task on a later tick', () => {
    const waitingTask: TaskDefinition = {
      id: 'A',
      size: 2,
      duration: 3,
      splittable: false,
    }

    const blockerTask: TaskDefinition = {
      id: 'X',
      size: 2,
      duration: 2,
      splittable: false,
    }

    const rules: RuleProgram = [
      {
        id: 'rule-1',
        trigger: 'taskWaiting',
        body: [
          {
            type: 'if',
            condition: {
              type: 'freeSpaceGreaterThanOrEqual',
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

    const engine = new SimulationEngine(
      [
        {
          tick: 0,
          task: waitingTask,
        },
      ],
      2,
      rules
    )

    const state = engine.getState()
    const blocker = createTaskRuntime(blockerTask)

    blocker.status = 'processing'

    state.tasks.set(blockerTask.id, blocker)
    state.memory.allocateContiguous(
      blockerTask.id,
      blockerTask.size
    )

    engine.start()
    engine.runTick()

    expect(state.tasks.get('A')?.status).toBe(
      'waiting'
    )
    expect(state.tasks.get('A')?.waitingTicks).toBe(1)
    expect(state.queue.toArray()).toEqual(['A'])

    engine.runTick()

    expect(state.tasks.get('X')?.status).toBe(
      'completed'
    )
    expect(state.tasks.get('A')?.status).toBe(
      'processing'
    )
    expect(state.tasks.get('A')?.waitingTicks).toBe(1)
    expect(state.queue.toArray()).toEqual([])
    expect(state.memory.getCells()).toEqual([
      'A',
      'A',
    ])
  })

  it('can process a later waiting task while an earlier task remains waiting', () => {
    const taskTooLarge: TaskDefinition = {
      id: 'A',
      size: 3,
      duration: 4,
      splittable: false,
    }

    const taskThatFits: TaskDefinition = {
      id: 'B',
      size: 2,
      duration: 4,
      splittable: false,
    }

    const rules: RuleProgram = [
      {
        id: 'small-only',
        trigger: 'taskWaiting',
        body: [
          {
            type: 'if',
            condition: {
              type: 'taskSizeLessThanOrEqual',
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

    const engine = new SimulationEngine(
      [
        {
          tick: 0,
          task: taskTooLarge,
        },
        {
          tick: 1,
          task: taskThatFits,
        },
      ],
      2,
      rules
    )

    engine.start()
    engine.runTick()
    engine.runTick()

    const state = engine.getState()

    expect(state.tasks.get('A')?.status).toBe(
      'waiting'
    )
    expect(state.tasks.get('A')?.waitingTicks).toBe(2)

    expect(state.tasks.get('B')?.status).toBe(
      'processing'
    )
    expect(state.tasks.get('B')?.waitingTicks).toBe(0)

    expect(state.queue.toArray()).toEqual(['A'])
    expect(state.memory.getCells()).toEqual([
      'B',
      'B',
    ])
  })

  it('halts when a task-waiting rule action fails at runtime', () => {
    const task: TaskDefinition = {
      id: 'A',
      size: 9,
      duration: 4,
      splittable: false,
    }

    const taskWorkload: Workload = [
      {
        tick: 0,
        task,
      },
    ]

    const rules: RuleProgram = [
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

    const engine = new SimulationEngine(
      taskWorkload,
      8,
      rules
    )

    engine.start()
    engine.runTick()

    const state = engine.getState()

    expect(state.status).toBe('halted')
    expect(state.tick).toBe(0)

    expect(state.failure).toEqual({
      tick: 0,
      taskId: 'A',
      ruleId: 'rule-1',
      action: 'allocate',
      reason:
        'Not enough contiguous memory for Task A',
    })

    expect(state.tasks.get('A')?.status).toBe(
      'waiting'
    )
    expect(state.queue.toArray()).toEqual(['A'])
  })

  it('keeps earlier state changes when a later waiting rule fails', () => {
    const task: TaskDefinition = {
      id: 'A',
      size: 3,
      duration: 4,
      splittable: false,
    }

    const taskWorkload: Workload = [
      {
        tick: 0,
        task,
      },
    ]

    const rules: RuleProgram = [
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

    const engine = new SimulationEngine(
      taskWorkload,
      8,
      rules
    )

    engine.start()
    engine.runTick()

    const state = engine.getState()

    expect(state.status).toBe('halted')
    expect(state.tick).toBe(0)

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

    expect(state.failure?.ruleId).toBe(
      'rule-2'
    )
  })
})
