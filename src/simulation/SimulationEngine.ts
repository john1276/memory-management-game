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

export class SimulationEngine {
  private state: SimulationState

  constructor(
    workload: Workload,
    memoryCapacity: number
  ) {
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
    this.processIncomingRequests()

    // TODO:
    // Rule Phase
    // Action Phase
    // Validation Phase

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

      /*
       * 暫時不要決定：
       *
       * Allocate?
       * Split?
       * Enqueue?
       *
       * 這些之後應該由 Rule Engine 決定。
       */
    }
  }

  halt(
    reason: string,
    taskId?: TaskId
  ): void {
    this.state.status = 'halted'

    this.state.failure = {
      tick: this.state.tick,
      taskId,
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