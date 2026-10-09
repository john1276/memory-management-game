import {
  describe,
  expect,
  it,
} from 'vitest'

import { prototypeRuleProgram } from '../data/prototypeRuleProgram'
import { prototypeWorkload } from '../data/prototypeWorkload'

import {
  GameController,
} from './GameController'

function createController() {
  return new GameController({
    workload:
      prototypeWorkload,

    memoryCapacity:
      32,

    ruleProgram:
      prototypeRuleProgram,
  })
}

describe('GameController', () => {
  it('starts, steps, pauses, and resets a run', () => {
    const controller =
      createController()

    expect(
      controller.getViewModel().status,
    ).toBe('idle')

    controller.start()

    expect(
      controller.getViewModel().status,
    ).toBe('running')

    controller.step()

    let view =
      controller.getViewModel()

    expect(view.tick).toBe(1)
    expect(view.usedBlocks).toBe(4)

    controller.togglePause()

    expect(
      controller.getViewModel().status,
    ).toBe('paused')

    controller.step()

    view =
      controller.getViewModel()

    expect(view.tick).toBe(2)

    controller.reset()

    view =
      controller.getViewModel()

    expect(view.status).toBe('idle')
    expect(view.tick).toBe(0)
    expect(view.usedBlocks).toBe(0)
    expect(view.processingTasks).toEqual([])
    expect(view.waitingTasks).toEqual([])
  })
})
