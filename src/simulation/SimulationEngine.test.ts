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


    const state = engine.getState()

    engine.start()

    /*
    * Tick 0:
    * rule-1 Allocate consumes the Rule budget.
    */
    engine.runTick()

    expect(state.status).toBe('running')
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

    /*
    * Tick 1:
    *
    * Resume the same RuleExecutionSession.
    * rule-1 finishes at zero cost, then rule-2
    * attempts another Allocate and fails because
    * A is already processing.
    */
    engine.runTick()

    expect(state.status).toBe('halted')

    expect(state.tick).toBe(1)

    expect(state.failure?.ruleId).toBe(
      'rule-2'
    )

    expect(state.failure?.action).toBe(
      'allocate'
    )

    /*
    * No rollback:
    * rule-1's committed allocation remains.
    */
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
  it('lets a later waiting task consume the rule tick when an earlier task is unhandled', () => {
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
        tick: 0,
        task: taskThatFits,
      },
    ],
    2,
    rules,
  )

  engine.start()
  engine.runTick()

  const state = engine.getState()

  expect(state.tick).toBe(1)

  expect(state.tasks.get('A')?.status).toBe(
    'waiting',
  )
  expect(state.tasks.get('A')?.waitingTicks).toBe(1)

  expect(state.tasks.get('B')?.status).toBe(
    'processing',
  )
  expect(state.tasks.get('B')?.waitingTicks).toBe(0)

  expect(state.queue.toArray()).toEqual(['A'])

  expect(state.memory.getCells()).toEqual([
    'B',
    'B',
  ])
})
  it('advances a Split action across simulation ticks', () => {
  const task: TaskDefinition = {
    id: 'A',
    size: 7,
    duration: 4,
    splittable: true,
  }

  const rules: RuleProgram = [
    {
      id: 'split-then-allocate',
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
    [
      {
        tick: 0,
        task,
      },
    ],
    8,
    rules,
  )

  engine.start()

  // Tick 1: division
  engine.runTick()

  expect(engine.getState().status).toBe('running')
  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])
  expect(
    engine.getState().tasks.get('A')?.status,
  ).toBe('waiting')

  // Tick 2: Math.Floor
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])

  // Tick 3: physical cut
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])

  /*
   * Tick 4:
   *
   * Split completes at zero cost,
   * commits [3, 4],
   * then Allocate consumes this rule tick.
   */
  engine.runTick()

  const state = engine.getState()

  expect(state.tick).toBe(4)
  expect(state.status).toBe('running')

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([3, 4])

  expect(
    state.tasks.get('A')?.status,
  ).toBe('processing')

  expect(state.queue.toArray()).toEqual([])
  expect(state.memory.getFreeSpace()).toBe(1)
})
  it('keeps the Rule pivot on a running Split before handing off to a later task', () => {
  const splittingTask: TaskDefinition = {
    id: 'A',
    size: 7,
    duration: 4,
    splittable: true,
  }

  const laterTask: TaskDefinition = {
    id: 'B',
    size: 2,
    duration: 4,
    splittable: false,
  }

  const rules: RuleProgram = [
    {
      id: 'split-splittable',
      trigger: 'taskWaiting',
      body: [
        {
          type: 'if',
          condition: {
            type: 'taskSplittableIs',
            value: true,
          },
          then: [
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
          ],
        },
      ],
    },

    {
      id: 'allocate-small',
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
        task: splittingTask,
      },
      {
        tick: 0,
        task: laterTask,
      },
    ],
    8,
    rules,
  )

  engine.start()

  // Tick 1: A division.
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])

  expect(
    engine.getState().tasks.get('B')?.status,
  ).toBe('waiting')

  expect(
    engine.getState().memory.getFreeSpace(),
  ).toBe(8)

  // Tick 2: A Math.Floor.
  engine.runTick()

  expect(
    engine.getState().tasks.get('B')?.status,
  ).toBe('waiting')

  expect(
    engine.getState().memory.getFreeSpace(),
  ).toBe(8)

  // Tick 3: A physical cut.
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])

  expect(
    engine.getState().tasks.get('B')?.status,
  ).toBe('waiting')

  expect(
    engine.getState().memory.getFreeSpace(),
  ).toBe(8)

  /*
   * Tick 4:
   *
   * A's Split completes at zero cost and commits [3, 4].
   * A has no later applicable Action, so its session ends.
   *
   * Only now may B receive the pivot and Allocate.
   */
  engine.runTick()

  const state = engine.getState()

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([3, 4])

  expect(
    state.tasks.get('A')?.status,
  ).toBe('waiting')

  expect(
    state.tasks.get('B')?.status,
  ).toBe('processing')

  expect(state.queue.toArray()).toEqual(['A'])

  expect(state.memory.getCells()).toEqual([
    'B', 'B',
    null, null, null,
    null, null, null,
  ])
})
  it('halts on an invalid Split without rolling back committed state', () => {
  const task: TaskDefinition = {
    id: 'A',
    size: 7,
    duration: 4,
    splittable: true,
  }

  const rules: RuleProgram = [
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
                type: 'literal',
                value: 3,
              },
              {
                type: 'reference',
                namespace: 'split',
                member: 'remaining',
              },
            ],
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

              /*
               * Invalid fragment.
               */
              {
                type: 'literal',
                value: 0,
              },
            ],
          },
        },
      ],
    },
  ]

  const engine = new SimulationEngine(
    [
      {
        tick: 0,
        task,
      },
    ],
    8,
    rules,
  )

  engine.start()

  /*
   * Tick 0:
   * rule-1 physical cut.
   */
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([7])

  /*
   * Tick 1:
   *
   * rule-1 completes at zero cost and commits [3,4].
   * rule-2 then starts and consumes its division tick.
   */
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([3, 4])

  expect(engine.getState().status).toBe('running')

  /*
   * Tick 2:
   * Math.Floor consumes one tick.
   */
  engine.runTick()

  expect(
    engine.getState().tasks.get('A')?.fragmentSizes,
  ).toEqual([3, 4])

  expect(engine.getState().status).toBe('running')

  /*
   * Tick 3:
   *
   * First fragment resolves to 3.
   * Second fragment resolves to invalid 0.
   * Failure itself costs 0 ticks and halts the Engine.
   */
  engine.runTick()

  const state = engine.getState()

  expect(state.status).toBe('halted')

  /*
   * runTick halts before its final tick++.
   */
  expect(state.tick).toBe(3)

  expect(state.failure).toEqual({
    tick: 3,
    taskId: 'A',
    ruleId: 'rule-2',
    action: 'split',
    reason:
      'Task A split fragment must be a positive integer, got 0',
  })

  /*
   * rule-1 was already committed.
   * It must NOT be rolled back.
   *
   * rule-2 never completed, so it must NOT commit
   * any new allocation shape either.
   */
  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([3, 4])

  expect(
    state.tasks.get('A')?.status,
  ).toBe('waiting')

  expect(state.queue.toArray()).toEqual(['A'])

  /*
   * Split never allocates physical Memory.
   */
  expect(state.memory.getFreeSpace()).toBe(8)
})
  it('runs Split through fragmented allocation and releases every fragment', () => {
  const taskA: TaskDefinition = {
    id: 'A',
    size: 4,
    duration: 1,
    splittable: true,
  }

  const blockerB: TaskDefinition = {
    id: 'B',
    size: 2,
    duration: 100,
    splittable: false,
  }

  const gateX: TaskDefinition = {
    id: 'X',
    size: 1,
    duration: 5,
    splittable: false,
  }

  const blockerC: TaskDefinition = {
    id: 'C',
    size: 2,
    duration: 100,
    splittable: false,
  }

  const rules: RuleProgram = [
    {
      id: 'split-or-allocate',
      trigger: 'taskWaiting',

      body: [
        {
          type: 'if',

          condition: {
            type: 'freeSpaceGreaterThanOrEqual',
            value: 4,
          },

          then: [
            {
              type: 'action',
              action: {
                type: 'allocate',
              },
            },
          ],

          else: [
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
          ],
        },
      ],
    },
  ]

  const engine = new SimulationEngine(
    [
      {
        tick: 0,
        task: taskA,
      },
    ],
    8,
    rules,
  )

  const state = engine.getState()

  /*
   * Seed:
   *
   * [B][B][X][ ][C][C][ ][ ]
   *
   * Y is only used temporarily to force C into cells 4-5.
   */
  const runtimeB = createTaskRuntime(blockerB)
  runtimeB.status = 'processing'

  const runtimeX = createTaskRuntime(gateX)
  runtimeX.status = 'processing'

  const runtimeC = createTaskRuntime(blockerC)
  runtimeC.status = 'processing'

  state.tasks.set('B', runtimeB)
  state.tasks.set('X', runtimeX)
  state.tasks.set('C', runtimeC)

  state.memory.allocateContiguous('B', 2)
  state.memory.allocateContiguous('X', 1)
  state.memory.allocateContiguous('Y', 1)
  state.memory.allocateContiguous('C', 2)

  state.memory.release('Y')

  expect(state.memory.getCells()).toEqual([
    'B', 'B',
    'X', null,
    'C', 'C',
    null, null,
  ])

  expect(state.memory.findFirstFit(4)).toBeNull()

  engine.start()

  /*
   * Tick 1:
   * Task.Size / 2
   */
  engine.runTick()

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([4])

  expect(
    state.tasks.get('A')?.status,
  ).toBe('waiting')

  /*
   * Tick 2:
   * Math.Floor(...)
   */
  engine.runTick()

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([4])

  /*
   * Tick 3:
   * physical cut
   */
  engine.runTick()

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([4])

  /*
   * Tick 4:
   *
   * Split completes at zero cost.
   * Shape commits to [2,2].
   *
   * X has not completed yet, so Allocate condition
   * is still false and this Rule session finishes.
   */
  engine.runTick()

  expect(
    state.tasks.get('A')?.fragmentSizes,
  ).toEqual([2, 2])

  expect(
    state.tasks.get('A')?.status,
  ).toBe('waiting')

  expect(state.queue.toArray()).toEqual(['A'])

  expect(state.memory.getCells()).toEqual([
    'B', 'B',
    'X', null,
    'C', 'C',
    null, null,
  ])

  /*
   * Tick 5:
   *
   * X completes during Processing phase:
   *
   * [B][B][ ][ ][C][C][ ][ ]
   *
   * Free space becomes 4, so A's next Rule session
   * takes the Allocate branch.
   *
   * There is still no contiguous size-4 region,
   * but [2,2] fits into the two holes.
   */
  engine.runTick()

  expect(
    state.tasks.get('X')?.status,
  ).toBe('completed')

  expect(
    state.tasks.get('A')?.status,
  ).toBe('processing')

  expect(state.queue.toArray()).toEqual([])

  expect(state.memory.getCells()).toEqual([
    'B', 'B',
    'A', 'A',
    'C', 'C',
    'A', 'A',
  ])

  /*
   * Tick 6:
   *
   * A.duration = 1, so Processing completes and
   * Memory.release('A') must release BOTH fragments.
   */
  engine.runTick()

  expect(
    state.tasks.get('A')?.status,
  ).toBe('completed')

  expect(state.memory.getCells()).toEqual([
    'B', 'B',
    null, null,
    'C', 'C',
    null, null,
  ])
})
})
