import { TaskSection } from './TaskSection'

export type UpcomingTaskView = {
  id: string
  size: number
  arrivesIn: number
}

export type WaitingTaskView = {
  id: string
  size: number
  waitingTicks: number
}

type TaskRailProps = {
  upcomingTasks: UpcomingTaskView[]
  waitingTasks: WaitingTaskView[]
}

export function TaskRail({
  upcomingTasks,
  waitingTasks,
}: TaskRailProps) {
  return (
    <aside
      className="task-rail"
      data-workspace-scroll-region="true"
    >
      <TaskSection title="Upcoming">
        {upcomingTasks.map((task, index) => (
          <article
            className="task-card"
            key={task.id}
          >
            <span className="task-card__index">
              {index === 0
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