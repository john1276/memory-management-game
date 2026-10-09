import {
  describe,
  expect,
  it,
} from 'vitest'

import { prototypeRuleProgram } from '../data/prototypeRuleProgram'
import { prototypeWorkload } from '../data/prototypeWorkload'
import { SimulationEngine } from '../simulation/SimulationEngine'

import {
  createGameViewModel,
} from './GameViewModel'

describe('createGameViewModel', () => {
  it('maps the initial simulation state', () => {
    const engine =
      new SimulationEngine(
        prototypeWorkload,
        32,
        prototypeRuleProgram,
      )

    const view =
      createGameViewModel(
        engine.getState(),
        'idle',
      )

    expect(view.status).toBe('idle')
    expect(view.tick).toBe(0)

    expect(view.totalBlocks).toBe(32)
    expect(view.usedBlocks).toBe(0)

    expect(view.memoryCells).toHaveLength(32)
    expect(
      view.memoryCells.every(
        (cell) =>
          cell.taskId === null,
      ),
    ).toBe(true)

    expect(view.upcomingTasks).toEqual([
      {
        id: 'A',
        size: 4,
        arrivesIn: 0,
      },
      {
        id: 'B',
        size: 3,
        arrivesIn: 1,
      },
      {
        id: 'C',
        size: 5,
        arrivesIn: 3,
      },
    ])

    expect(view.waitingTasks).toEqual([])
    expect(view.processingTasks).toEqual([])
  })

  it('maps real runtime state after one tick', () => {
    const engine =
      new SimulationEngine(
        prototypeWorkload,
        32,
        prototypeRuleProgram,
      )

    engine.start()
    engine.runTick()

    const view =
      createGameViewModel(
        engine.getState(),
        'running',
      )

    expect(view.status).toBe('running')
    expect(view.tick).toBe(1)
    expect(view.usedBlocks).toBe(4)

    expect(
      view.memoryCells
        .slice(0, 4)
        .map((cell) => cell.taskId),
    ).toEqual([
      'A',
      'A',
      'A',
      'A',
    ])

    expect(view.waitingTasks).toEqual([])

    expect(view.processingTasks).toEqual([
      {
        id: 'A',
        ticksLeft: 4,
      },
    ])

    expect(view.upcomingTasks[0]).toEqual({
      id: 'B',
      size: 3,
      arrivesIn: 0,
    })
  })

  it('maps application pause separately from core running state', () => {
    const engine =
      new SimulationEngine(
        prototypeWorkload,
        32,
        prototypeRuleProgram,
      )

    engine.start()

    const view =
      createGameViewModel(
        engine.getState(),
        'paused',
      )

    expect(
      engine.getState().status,
    ).toBe('running')

    expect(view.status).toBe('paused')
  })
})
