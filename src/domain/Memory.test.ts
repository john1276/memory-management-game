import { describe, expect, it } from 'vitest'
import { Memory } from './Memory'

describe('Memory', () => {
  it('creates memory with the requested capacity', () => {
    const memory = new Memory(8)

    expect(memory.capacity).toBe(8)

    expect(memory.getCells()).toEqual([
      null, null, null, null,
      null, null, null, null,
    ])
  })

  it('reports free space correctly', () => {
    const memory = new Memory(8)

    expect(memory.getFreeSpace()).toBe(8)

    memory.allocateContiguous('A', 3)

    expect(memory.getFreeSpace()).toBe(5)
  })

  it('allocates using first fit', () => {
    const memory = new Memory(8)

    const success = memory.allocateContiguous('A', 3)

    expect(success).toBe(true)

    expect(memory.getCells()).toEqual([
      'A', 'A', 'A',
      null, null, null, null, null,
    ])
  })

  it('allocates the next task after existing memory', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('A', 3)
    memory.allocateContiguous('B', 2)

    expect(memory.getCells()).toEqual([
      'A', 'A', 'A',
      'B', 'B',
      null, null, null,
    ])
  })

  it('releases all cells owned by a task', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('A', 3)
    memory.allocateContiguous('B', 2)

    const released = memory.release('A')

    expect(released).toBe(3)

    expect(memory.getCells()).toEqual([
      null, null, null,
      'B', 'B',
      null, null, null,
    ])
  })

  it('fails when no contiguous block is large enough', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('A', 2)
    memory.allocateContiguous('B', 2)
    memory.allocateContiguous('C', 2)

    memory.release('B')

    // [A][A][ ][ ][C][C][ ][ ]
    //
    // Total free space = 4
    // Largest contiguous block = 2

    const success = memory.allocateContiguous('D', 3)

    expect(success).toBe(false)
  })

  it('can clear all memory', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('A', 3)
    memory.allocateContiguous('B', 2)

    memory.clear()

    expect(memory.getFreeSpace()).toBe(8)

    expect(memory.getCells()).toEqual([
      null, null, null, null,
      null, null, null, null,
    ])
  })
  it('allocates fragments independently using first fit', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('B', 2)
    memory.allocateContiguous('X', 2)
    memory.allocateContiguous('C', 2)

    memory.release('X')

    // [B][B][ ][ ][C][C][ ][ ]
    expect(memory.getCells()).toEqual([
      'B', 'B',
      null, null,
      'C', 'C',
      null, null,
    ])

    const success = memory.allocateFragments(
      'A',
      [2, 2],
    )

    expect(success).toBe(true)

    expect(memory.getCells()).toEqual([
      'B', 'B',
      'A', 'A',
      'C', 'C',
      'A', 'A',
    ])
  })
  it('leaves memory unchanged when a later fragment cannot fit', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('B', 2)
    memory.allocateContiguous('X', 2)
    memory.allocateContiguous('C', 3)
    memory.release('X')

    // [B][B][ ][ ][C][C][C][ ]
    const before = memory.getCells()

    const success = memory.allocateFragments(
      'A',
      [2, 2],
    )

    expect(success).toBe(false)

    expect(memory.getCells()).toEqual(before)
  })
  it('rejects an empty fragment list', () => {
    const memory = new Memory(8)

    const before = memory.getCells()

    const success = memory.allocateFragments(
      'A',
      [],
    )

    expect(success).toBe(false)
    expect(memory.getCells()).toEqual(before)
  })
  it.each([
    { fragmentSizes: [0] },
    { fragmentSizes: [-1] },
    { fragmentSizes: [2.5] },
    { fragmentSizes: [Number.NaN] },
    { fragmentSizes: [Number.POSITIVE_INFINITY] },
  ])(
    'rejects invalid fragment sizes',
    ({ fragmentSizes }) => {
      const memory = new Memory(8)

      const before = memory.getCells()

      const success = memory.allocateFragments(
        'A',
        fragmentSizes,
      )

      expect(success).toBe(false)
      expect(memory.getCells()).toEqual(before)
    },
  )
  it('releases every fragment owned by a task', () => {
    const memory = new Memory(8)

    memory.allocateContiguous('B', 2)
    memory.allocateContiguous('X', 2)
    memory.allocateContiguous('C', 2)
    memory.release('X')

    expect(
      memory.allocateFragments('A', [2, 2]),
    ).toBe(true)

    expect(memory.getCells()).toEqual([
      'B', 'B',
      'A', 'A',
      'C', 'C',
      'A', 'A',
    ])

    const released = memory.release('A')

    expect(released).toBe(4)

    expect(memory.getCells()).toEqual([
      'B', 'B',
      null, null,
      'C', 'C',
      null, null,
    ])
  })
})