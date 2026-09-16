export type ProcessingTaskView = {
  id: string
  ticksLeft: number
  colorClass: string
}

type ProcessingStripProps = {
  tasks: ProcessingTaskView[]
}

export function ProcessingStrip({
  tasks,
}: ProcessingStripProps) {
  return (
    <div className="processing-strip">
      {tasks.map((task) => (
        <div
          className="processing-card"
          key={task.id}
        >
          <span
            className={[
              'processing-dot',
              task.colorClass,
            ].join(' ')}
          />

          <strong>
            {task.id}
          </strong>

          <span>
            Processing
          </span>

          <span>
            {task.ticksLeft} ticks left
          </span>
        </div>
      ))}
    </div>
  )
}