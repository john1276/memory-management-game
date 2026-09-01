import { describe, expect, it } from 'vitest'

import type { TaskDefinition } from './Task'
import {
  getArrivalsAtTick,
  getUpcomingRequests,
  type Workload,
} from './Workload'

const taskA: TaskDefinition = {
  id: 'A',
  size: 2,
  duration: 3,
  splittable: false,
}

const taskB: TaskDefinition = {
  id: 'B',
  size: 3,
  duration: 4,
  splittable: true,
}

const taskC: TaskDefinition = {
  id: 'C',
  size: 1,
  duration: 2,
  splittable: false,
}

const taskD: TaskDefinition = {
  id: 'D',
  size: 4,
  duration: 5,
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
  {
    tick: 3,
    task: taskC,
  },
  {
    tick: 5,
    task: taskD,
  },
]

describe('Workload', () => {
  describe('getArrivalsAtTick', () => {
    it('returns the task arriving at the requested tick', () => {
      const arrivals = getArrivalsAtTick(workload, 1)

      expect(arrivals).toEqual([taskB])
    })

    it('returns an empty array when no task arrives', () => {
      const arrivals = getArrivalsAtTick(workload, 2)

      expect(arrivals).toEqual([])
    })

    it('returns the first task at tick 0', () => {
      const arrivals = getArrivalsAtTick(workload, 0)

      expect(arrivals).toEqual([taskA])
    })

    it('supports multiple tasks arriving at the same tick', () => {
      const workloadWithMultipleArrivals: Workload = [
        {
          tick: 0,
          task: taskA,
        },
        {
          tick: 1,
          task: taskB,
        },
        {
          tick: 1,
          task: taskC,
        },
      ]

      const arrivals = getArrivalsAtTick(
        workloadWithMultipleArrivals,
        1
      )

      expect(arrivals).toEqual([
        taskB,
        taskC,
      ])
    })
  })

  describe('getUpcomingRequests', () => {
    it('returns current and next two requests by default', () => {
      const upcoming = getUpcomingRequests(
        workload,
        0
      )

      expect(upcoming).toEqual([
        {
          tick: 0,
          task: taskA,
        },
        {
          tick: 1,
          task: taskB,
        },
        {
          tick: 3,
          task: taskC,
        },
      ])
    })

    it('does not include requests from past ticks', () => {
      const upcoming = getUpcomingRequests(
        workload,
        2
      )

      expect(upcoming).toEqual([
        {
          tick: 3,
          task: taskC,
        },
        {
          tick: 5,
          task: taskD,
        },
      ])
    })

    it('allows a custom preview count', () => {
      const upcoming = getUpcomingRequests(
        workload,
        0,
        2
      )

      expect(upcoming).toEqual([
        {
          tick: 0,
          task: taskA,
        },
        {
          tick: 1,
          task: taskB,
        },
      ])
    })

    it('returns an empty array after all requests have passed', () => {
      const upcoming = getUpcomingRequests(
        workload,
        10
      )

      expect(upcoming).toEqual([])
    })
  })
})