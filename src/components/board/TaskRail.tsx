import { TaskSection } from './TaskSection'

export type UpcomingTaskView = {
  readonly id: string
  readonly size: number
  readonly arrivesIn: number
}

export type WaitingTaskView = {
  readonly id: string
  readonly size: number
  readonly waitingTicks: number
}

type TaskRailProps = {
  upcomingTasks:
    readonly UpcomingTaskView[]

  waitingTasks:
    readonly WaitingTaskView[]
}

export function TaskRail({
  upcomingTasks,
  waitingTasks,
}: TaskRailProps) {
  return (
    <aside
      className="task-rail"
      onWheel={(event) => event.stopPropagation()}
    >
      <TaskSection title="Upcoming">
        {upcomingTasks.map((task, index) => (
          <article
            className="task-card"
            key={task.id}
          >
            <span className="task-card__index">
              {task.arrivesIn === 0
                ? 'NOW'
                : `+${index}`}
            </span>

            <strong>{task.id}</strong>

            <small>
              Size {task.size}
            </small>

            <small>
              Arrives in {task.arrivesIn} ticks
            </small>
          </article>
        ))}
      </TaskSection>

      <TaskSection title="Waiting">
        {waitingTasks.map((task) => (
          <article
            className="task-card task-card--waiting"
            key={task.id}
          >
            <strong>{task.id}</strong>

            <small>
              Size {task.size}
            </small>

            <small>
              Waiting {task.waitingTicks} ticks
            </small>
          </article>
        ))}
      </TaskSection>
    </aside>
  )
}
