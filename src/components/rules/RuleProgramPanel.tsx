import type {
  RuleProgramLineViewModel,
} from '../../application/RuleProgramViewModel'

import { RuleLine } from './RuleLine'

type RuleProgramPanelProps = {
  programLines:
    readonly RuleProgramLineViewModel[]

  isBoardPinned: boolean
  onToggleBoardPin: () => void
  onFocusProgram: () => void
  onFocusBoard: () => void
  onSplitView: () => void
}

export function RuleProgramPanel({
  programLines,
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
            Program Definition
          </span>
        </div>
      </div>

      <div
        className="rule-panel__content"
        onWheel={(event) =>
          event.stopPropagation()
        }
      >
        <div className="rule-program">
          {programLines.length === 0 ? (
            <RuleLine
              depth={0}
              label="EMPTY"
              value="No rules configured"
            />
          ) : (
            programLines.map((line) => (
              <RuleLine
                key={line.id}
                depth={line.depth}
                label={line.label}
                value={line.value}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
