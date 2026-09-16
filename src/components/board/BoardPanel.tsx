import {
  MemoryArena,
  type MemoryCellView,
} from './MemoryArena'

import {
  ProcessingStrip,
  type ProcessingTaskView,
} from './ProcessingStrip'

import {
  TaskRail,
  type UpcomingTaskView,
  type WaitingTaskView,
} from './TaskRail'

type BoardPanelProps = {
  memoryCells: MemoryCellView[]
  totalBlocks: number
  usedBlocks: number
  upcomingTasks: UpcomingTaskView[]
  waitingTasks: WaitingTaskView[]
  processingTasks: ProcessingTaskView[]
}

export function BoardPanel({
  memoryCells,
  totalBlocks,
  usedBlocks,
  upcomingTasks,
  waitingTasks,
  processingTasks,
}: BoardPanelProps) {
  return (
    <section className="board-panel">
      <TaskRail
        upcomingTasks={upcomingTasks}
        waitingTasks={waitingTasks}
      />

      <section className="memory-panel">
        <MemoryArena
          cells={memoryCells}
          totalBlocks={totalBlocks}
          usedBlocks={usedBlocks}
        />

        <ProcessingStrip
          tasks={processingTasks}
        />
      </section>
    </section>
  )
}