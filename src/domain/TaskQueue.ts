import type { TaskId } from './Task'

export class TaskQueue {
  private items: TaskId[] = []

  enqueue(taskId: TaskId): void {
    this.items.push(taskId)
  }

  dequeue(): TaskId | undefined {
    return this.items.shift()
  }

  peek(): TaskId | undefined {
    return this.items[0]
  }

  contains(taskId: TaskId): boolean {
    return this.items.includes(taskId)
  }

  remove(taskId: TaskId): boolean {
    const index = this.items.indexOf(taskId)

    if (index === -1) {
      return false
    }

    this.items.splice(index, 1)

    return true
  }

  get length(): number {
    return this.items.length
  }

  get isEmpty(): boolean {
    return this.items.length === 0
  }

  toArray(): readonly TaskId[] {
    return [...this.items]
  }

  clear(): void {
    this.items = []
  }
}
