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
})