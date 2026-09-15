import type { SimulationStatus } from '../App'

type TopBarProps = {
  simulationStatus: SimulationStatus
  tick: number
  onRun: () => void
  onPauseResume: () => void
  onStep: () => void
  onReset: () => void
}

export function TopBar({
  simulationStatus,
  tick,
  onRun,
  onPauseResume,
  onStep,
  onReset,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__kicker">
          Prototype UI
        </span>

        <strong>
          Memory Management Game
        </strong>
      </div>

      <div className="topbar__center">
        <span className="tick-label">
          Tick
        </span>

        <span className="tick-value">
          {tick}
        </span>

        <span className="mode-badge">
          {simulationStatus.toUpperCase()}
        </span>
      </div>

      <div className="topbar__controls">
        {simulationStatus === 'idle' ? (
          <button
            type="button"
            className="control control--primary"
            onClick={onRun}
          >
            Run
          </button>
        ) : (
          <>
            <button
              type="button"
              className="control control--active"
              onClick={onPauseResume}
            >
              {simulationStatus === 'paused'
                ? 'Resume'
                : 'Pause'}
            </button>

            <button
              type="button"
              className="control"
              onClick={onStep}
            >
              Step
            </button>

            <button
              type="button"
              className="control"
              onClick={onReset}
            >
              Reset
            </button>
          </>
        )}
      </div>
    </header>
  )
}