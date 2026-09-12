import type { TaskId } from './Task'

export type MemoryCell = TaskId | null

export class Memory {
  private cells: MemoryCell[]

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Memory capacity must be greater than 0')
    }

    this.cells = Array(capacity).fill(null)
  }

  get capacity(): number {
    return this.cells.length
  }

  getCells(): readonly MemoryCell[] {
    return [...this.cells]
  }

  getFreeSpace(): number {
    return this.cells.filter((cell) => cell === null).length
  }

  findFirstFit(size: number): number | null {
    if (size <= 0) {
      return null
    }

    let freeCount = 0

    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === null) {
        freeCount++

        if (freeCount === size) {
          return i - size + 1
        }
      } else {
        freeCount = 0
      }
    }

    return null
  }

  allocateContiguous(
    taskId: TaskId,
    size: number
  ): boolean {
    const startIndex = this.findFirstFit(size)

    if (startIndex === null) {
      return false
    }

    for (let i = startIndex; i < startIndex + size; i++) {
      this.cells[i] = taskId
    }

    return true
  }
  allocateFragments(
    taskId: TaskId,
    fragmentSizes: readonly number[],
  ): boolean {
    if (fragmentSizes.length === 0) {
      return false
    }
    const nextCells = [...this.cells]

    for (const size of fragmentSizes) {
      let freeCount = 0
      let startIndex: number | null = null

      for (let i = 0; i < nextCells.length; i++) {
        if (nextCells[i] === null) {
          freeCount += 1

          if (freeCount === size) {
            startIndex = i - size + 1
            break
          }
        } else {
          freeCount = 0
        }
      }

      if (startIndex === null) {
        return false
      }

      for (
        let i = startIndex;
        i < startIndex + size;
        i += 1
      ) {
        nextCells[i] = taskId
      }
    }

    this.cells = nextCells

    return true
  }

  release(taskId: TaskId): number {
    let releasedCells = 0

    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === taskId) {
        this.cells[i] = null
        releasedCells++
      }
    }

    return releasedCells
  }

  clear(): void {
    this.cells.fill(null)
  }
}