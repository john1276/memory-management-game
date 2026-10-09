import type { Workload } from '../domain/Workload'
import { SimulationEngine } from '../simulation/SimulationEngine'
import type { RuleProgram } from '../simulation/rules/Rule'
import {
  validateRuleProgram,
  type ProgramValidationError,
} from '../simulation/validation/ProgramValidator'

import {
  createGameViewModel,
  type GameViewModel,
  type PlaybackStatus,
} from './GameViewModel'

export interface GameControllerOptions {
  readonly workload: Workload
  readonly memoryCapacity: number
  readonly ruleProgram: RuleProgram
}

export class GameController {
  private engine: SimulationEngine

  private playbackStatus: PlaybackStatus =
    'idle'

  private validationErrors:
    readonly ProgramValidationError[] = []

  private readonly options:
    GameControllerOptions

  constructor(
    options: GameControllerOptions,
  ) {
    this.options = options

    this.engine =
      this.createEngine()
  }

  start(): void {
    if (
      this.engine.getState().status !==
      'idle'
    ) {
      return
    }

    this.validationErrors =
      validateRuleProgram(
        this.options.ruleProgram,
      )

    if (
      this.validationErrors.length > 0
    ) {
      return
    }

    this.engine.start()
    this.playbackStatus = 'running'
  }

  togglePause(): void {
    if (
      this.engine.getState().status !==
      'running'
    ) {
      return
    }

    this.playbackStatus =
      this.playbackStatus === 'paused'
        ? 'running'
        : 'paused'
  }

  step(): void {
    if (
      this.engine.getState().status !==
      'running'
    ) {
      return
    }

    this.engine.runTick()
  }

  reset(): void {
    this.engine =
      this.createEngine()

    this.playbackStatus = 'idle'
    this.validationErrors = []
  }

  getViewModel(): GameViewModel {
    return createGameViewModel(
      this.engine.getState(),
      this.playbackStatus,
      this.options.ruleProgram,
      this.validationErrors,
    )
  }

  private createEngine():
    SimulationEngine {
    return new SimulationEngine(
      this.options.workload,
      this.options.memoryCapacity,
      this.options.ruleProgram,
    )
  }
}
