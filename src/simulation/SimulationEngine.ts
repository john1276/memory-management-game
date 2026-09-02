import {
  createTaskRuntime,
  type TaskId,
} from '../domain/Task'

import { Memory } from '../domain/Memory'
import { TaskQueue } from '../domain/TaskQueue'

import {
  getArrivalsAtTick,
  type Workload,
} from '../domain/Workload'

import type {
  SimulationState,
} from './SimulationState'

import type { RuleProgram } from './rules/Rule'
import { executeRuleProgram } from './rules/RuleInterpreter'
import type { SimulationEvent } from './SimulationEvent'

export class SimulationEngine {
  private state: SimulationState

  private readonly ruleProgram: RuleProgram

  constructor(
    workload: Workload,
    memoryCapacity: number,
    ruleProgram: RuleProgram = []
  ) {
    this.ruleProgram = ruleProgram

    this.state = this.createInitialState(
      workload,
      memoryCapacity
    )
  }

  private createInitialState(
    workload: Workload,
    memoryCapacity: number
  ): SimulationState {
    return {
      tick: 0,

      status: 'idle',

      memory: new Memory(memoryCapacity),
      queue: new TaskQueue(),

      tasks: new Map(),

      workload,

      failure: null,

      logs: [],
    }
  }

  getState(): SimulationState {
    return this.state
  }

  start(): void {
    if (this.state.status === 'idle') {
      this.state.status = 'running'
    }
  }

  runTick(): void {
  if (this.state.status !== 'running') {
    return
  }

  this.processActiveTasks()

  if (this.state.status !== 'running') {
    return
  }

  this.processIncomingRequests()

  if (this.state.status !== 'running') {
    return
  }

  this.state.tick++
}

  private processActiveTasks(): void {
    for (const task of this.state.tasks.values()) {
      if (task.status !== 'active') {
        continue
      }

      task.remainingDuration--

      if (task.remainingDuration <= 0) {
        task.status = 'completed'

        this.state.memory.release(
          task.definition.id
        )

        this.addLog(
          `Task ${task.definition.id} completed`
        )
      }
    }
  }

  private processIncomingRequests(): void {
  const arrivals = getArrivalsAtTick(
    this.state.workload,
    this.state.tick
  )

  for (const definition of arrivals) {
    const runtime =
      createTaskRuntime(definition)

    this.state.tasks.set(
      definition.id,
      runtime
    )

    this.addLog(
      `Task ${definition.id} arrived`
    )

    const event: SimulationEvent = {
      type: 'requestArrived',
      taskId: definition.id,
    }

    const result = executeRuleProgram(
      this.ruleProgram,
      event,
      this.state
    )

    if (!result.ok) {
      this.halt(
        result.reason,
        result.taskId,
        result.ruleId,
        result.action
      )

      return
    }
  }
}

  halt(
  reason: string,
  taskId?: TaskId,
  ruleId?: string,
  action?: string
): void {
  this.state.status = 'halted'

  this.state.failure = {
    tick: this.state.tick,
    taskId,
    ruleId,
    action,
    reason,
  }

  this.addLog(`FAILURE: ${reason}`)
}

  private addLog(message: string): void {
    this.state.logs.push({
      tick: this.state.tick,
      message,
    })
  }
}