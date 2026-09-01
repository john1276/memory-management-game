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