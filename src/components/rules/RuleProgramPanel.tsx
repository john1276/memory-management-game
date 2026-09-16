import { RuleLine } from './RuleLine'

type RuleProgramPanelProps = {
  canEdit: boolean
  showsExecution: boolean
  isBoardPinned: boolean
  onToggleBoardPin: () => void
  onFocusProgram: () => void
  onFocusBoard: () => void
  onSplitView: () => void
}

export function RuleProgramPanel({
  canEdit,
  showsExecution,
  isBoardPinned,
  onToggleBoardPin,
  onFocusProgram,
  onFocusBoard,
  onSplitView,
}: RuleProgramPanelProps) {
  return (
    <section className="rule-panel">
      <div className="rule-panel__toolbar">
        <div>
          <span className="panel-kicker">
            Player Logic
          </span>

          <h2>
            Rule Program
          </h2>
        </div>

        <div className="rule-panel__actions">
          <button
            type="button"
            className="control control--small"
            onClick={onFocusProgram}
            disabled={isBoardPinned}
          >
            Program
          </button>

          <button
            type="button"
            className="control control--small"
            onClick={onSplitView}
            disabled={isBoardPinned}
          >
            Split
          </button>

          <button
            type="button"
            className="control control--small"
            onClick={onFocusBoard}
            disabled={isBoardPinned}
          >
            Board
          </button>

          <button
            type="button"
            className={[
              'control',
              'control--small',
              isBoardPinned
                ? 'control--active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleBoardPin}
          >
            {isBoardPinned
              ? 'Unpin'
              : 'Pin split'}
          </button>

          <span className="mode-badge">
            {canEdit
              ? 'Editable'
              : 'Execution View'}
          </span>
        </div>
      </div>

      <div
        className="rule-panel__content"
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="rule-program">
          <RuleLine
            depth={0}
            label="WHEN"
            value="Task Waiting"
          />

          <RuleLine
            depth={1}
            label="IF"
            value="Task.Size > 8"
          />

          <RuleLine
            depth={2}
            label="Split"
            value=""
          />

          <RuleLine
            depth={3}
            label="Fragment 1"
            value="Math.Floor(Task.Size / 2)"
            highlighted={showsExecution}
          />

          <RuleLine
            depth={3}
            label="Fragment 2"
            value="Split.Remaining"
          />

          <RuleLine
            depth={2}
            label="Allocate"
            value=""
          />

          <RuleLine
            depth={1}
            label="ELSE"
            value=""
          />

          <RuleLine
            depth={2}
            label="Allocate"
            value=""
          />
        </div>

        {canEdit && (
          <div className="edit-tools">
            <button type="button">
              + Add block
            </button>

            <button type="button">
              + Add rule
            </button>
          </div>
        )}

        {showsExecution && (
          <div className="execution-caption">
            <span className="execution-caption__dot" />

            Current execution:
            {' '}
            Task2 · Rule 0 · Split expression
          </div>
        )}
      </div>
    </section>
  )
}