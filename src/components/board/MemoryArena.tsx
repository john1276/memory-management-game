export type MemoryCellView = {
  taskId: string | null
}

type MemoryArenaProps = {
  cells: MemoryCellView[]
  totalBlocks: number
  usedBlocks: number
}

export function MemoryArena({
  cells,
  totalBlocks,
  usedBlocks,
}: MemoryArenaProps) {
  const freeBlocks =
    totalBlocks - usedBlocks

  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">
            Simulation World
          </span>

          <h1>
            Memory Arena
          </h1>
        </div>

        <div className="memory-summary">
          <span>
            {totalBlocks} blocks
          </span>

          <span>
            {usedBlocks} used
          </span>

          <span>
            {freeBlocks} free
          </span>
        </div>
      </div>

      <div
        className="memory-board"
        aria-label="Memory arena"
      >
        {cells.map((cell, index) => (
          <div
            className={[
              'memory-cell',
              cell.taskId
                ? 'memory-cell--occupied'
                : '',
              cell.taskId === 'Task0'
                ? 'memory-cell--task0'
                : '',
              cell.taskId === 'Task1'
                ? 'memory-cell--task1'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={index}
          >
            <span className="memory-cell__index">
              {index}
            </span>

            {cell.taskId && (
              <strong className="memory-cell__task">
                {cell.taskId}
              </strong>
            )}
          </div>
        ))}
      </div>
    </>
  )
}