import { describe, expect, it } from 'vitest'
import { TaskQueue } from './TaskQueue'

describe('TaskQueue', () => {
  it('starts empty', () => {
    const queue = new TaskQueue()

    expect(queue.length).toBe(0)
    expect(queue.isEmpty).toBe(true)
    expect(queue.peek()).toBeUndefined()
  })

  it('enqueues tasks', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')

    expect(queue.toArray()).toEqual(['A', 'B'])
    expect(queue.length).toBe(2)
  })

  it('dequeues tasks in FIFO order', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')
    queue.enqueue('C')

    expect(queue.dequeue()).toBe('A')
    expect(queue.dequeue()).toBe('B')
    expect(queue.dequeue()).toBe('C')
  })

  it('removes a task without disturbing arrival order', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')
    queue.enqueue('C')

    expect(queue.remove('B')).toBe(true)
    expect(queue.toArray()).toEqual(['A', 'C'])

    expect(queue.remove('X')).toBe(false)
    expect(queue.toArray()).toEqual(['A', 'C'])
  })

  it('peek returns the first task without removing it', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')

    expect(queue.peek()).toBe('A')
    expect(queue.length).toBe(2)
  })

  it('can check whether a task exists', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')

    expect(queue.contains('A')).toBe(true)
    expect(queue.contains('C')).toBe(false)
  })

  it('returns undefined when dequeuing an empty queue', () => {
    const queue = new TaskQueue()

    expect(queue.dequeue()).toBeUndefined()
  })

  it('can clear the queue', () => {
    const queue = new TaskQueue()

    queue.enqueue('A')
    queue.enqueue('B')

    queue.clear()

    expect(queue.toArray()).toEqual([])
    expect(queue.length).toBe(0)
    expect(queue.isEmpty).toBe(true)
  })
})
