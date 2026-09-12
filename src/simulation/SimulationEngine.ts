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
import {
  advanceRuleExecutionSession,
  createRuleExecutionSession,
  type RuleExecutionSession,
} from './rules/RuleExecutionSession'
import type { SimulationEvent } from './SimulationEvent'

export class SimulationEngine {
  private state: SimulationState

  private readonly ruleProgram: RuleProgram

  private activeRuleSession: RuleExecutionSession | null = null
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

    this.processProcessingTasks()

    if (this.state.status !== 'running') {
      return
    }

    this.processArrivals()

    if (this.state.status !== 'running') {
      return
    }

    this.processWaitingTasks()

    if (this.state.status !== 'running') {
      return
    }

    this.updateWaitingMetrics()

    this.state.tick++
  }

  private processProcessingTasks(): void {
    for (const task of this.state.tasks.values()) {
      if (task.status !== 'processing') {
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

  private processArrivals(): void {
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

      this.state.queue.enqueue(
        definition.id
      )

      this.addLog(
        `Task ${definition.id} arrived`
      )
    }
  }

  private processWaitingTasks(): void {
  const waitingTaskIds =
    this.state.queue.toArray()

  /*
   * If a session survived from a previous tick,
   * tasks before that pivot were already scanned
   * during the earlier Rule phase.
   *
   * Once the pivot completes at zero cost, resume
   * scanning AFTER that task.
   */
  const activeTaskId =
    this.activeRuleSession?.taskId

  let candidateIndex = 0

  if (activeTaskId) {
    const activeIndex =
      waitingTaskIds.indexOf(activeTaskId)

    if (activeIndex >= 0) {
      candidateIndex = activeIndex + 1
    }
  }

  while (this.state.status === 'running') {
    /*
     * Exactly one active execution pivot exists.
     */
    if (this.activeRuleSession) {
      const result =
        advanceRuleExecutionSession(
          this.activeRuleSession,
          this.state,
        )

      if (result.status === 'failure') {
        this.activeRuleSession = null

        this.halt(
          result.reason,
          result.taskId,
          result.ruleId,
          result.action,
        )

        return
      }

      /*
       * One cost-bearing rule step has consumed
       * this Simulation tick's Rule budget.
       */
      if (result.status === 'progress') {
        return
      }

      /*
       * Session finished.
       */
      this.activeRuleSession = null

      if (result.consumedTick) {
        return
      }

      /*
       * Zero-cost completion:
       * keep scanning waiting candidates during
       * this same Rule phase.
       */
      continue
    }

    if (candidateIndex >= waitingTaskIds.length) {
      return
    }

    const taskId =
      waitingTaskIds[candidateIndex]

    candidateIndex += 1

    const task = this.state.tasks.get(taskId)

    if (!task || task.status !== 'waiting') {
      continue
    }

    const event: SimulationEvent = {
      type: 'taskWaiting',
      taskId,
    }

    const session =
      createRuleExecutionSession(
        this.ruleProgram,
        event,
        this.state,
      )

    if ('status' in session) {
      this.halt(
        session.reason,
        session.taskId,
        session.ruleId,
        session.action,
      )

      return
    }

    this.activeRuleSession = session

    /*
     * Loop immediately so the newly created
     * session advances in this same Rule phase.
     */
  }
}

  private updateWaitingMetrics(): void {
    for (const taskId of this.state.queue.toArray()) {
      const task = this.state.tasks.get(taskId)

      if (task?.status === 'waiting') {
        task.waitingTicks++
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
