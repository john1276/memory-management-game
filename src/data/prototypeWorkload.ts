import type { Workload } from '../domain/Workload'

export const prototypeWorkload: Workload = [
  {
    tick: 0,
    task: {
      id: 'A',
      size: 4,
      duration: 4,
      splittable: false,
    },
  },

  {
    tick: 1,
    task: {
      id: 'B',
      size: 3,
      duration: 3,
      splittable: true,
    },
  },

  {
    tick: 3,
    task: {
      id: 'C',
      size: 5,
      duration: 2,
      splittable: true,
    },
  },
]