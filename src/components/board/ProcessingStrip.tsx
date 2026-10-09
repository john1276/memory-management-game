import {
  getProcessingTaskColorClass,
} from './taskColor'

export type ProcessingTaskView = {
  readonly id: string
  readonly ticksLeft: number
}

type ProcessingStripProps = {
  tasks:
    readonly ProcessingTaskView[]
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
              getProcessingTaskColorClass(
                task.id,
              ),
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
