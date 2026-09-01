import type { TaskDefinition } from './Task'

export interface WorkloadEntry {
  readonly tick: number
  readonly task: TaskDefinition
}

export type Workload = readonly WorkloadEntry[]

export function getArrivalsAtTick(
  workload: Workload,
  tick: number
): TaskDefinition[] {
  return workload
    .filter((entry) => entry.tick === tick)
    .map((entry) => entry.task)
}

export function getUpcomingRequests(
  workload: Workload,
  currentTick: number,
  count: number = 3
): WorkloadEntry[] {
  return workload
    .filter((entry) => entry.tick >= currentTick)
    .slice(0, count)
}