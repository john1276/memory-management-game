import './App.css'

const memoryCells = ['A', 'A', null, null, 'B', 'B', null, null]

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Prototype 0.1</p>
          <h1>Memory Management Game</h1>
        </div>

        <span className="status-badge">EDIT MODE</span>
      </header>

      <section className="workspace">
        <aside className="panel queue-panel">
          <h2>Incoming / Queue</h2>

          <div className="request-card current-request">
            <span>Current</span>
            <strong>Task A</strong>
            <small>Size 2 · Duration 3</small>
          </div>

          <div className="request-card">
            <span>Next</span>
            <strong>Task B</strong>
            <small>Size 2 · Duration 4</small>
          </div>

          <div className="request-card">
            <span>Next + 1</span>
            <strong>Task C</strong>
            <small>Size 3 · Duration 2</small>
          </div>

          <div className="queue">
            <h3>Queue</h3>
            <div className="queue-item">Task D</div>
            <div className="queue-item">Task E</div>
          </div>
        </aside>

        <section className="panel memory-panel">
          <div className="panel-heading">
            <div>
              <h2>Memory</h2>
              <p>8 slots</p>
            </div>

            <span>5 / 8 used</span>
          </div>

          <div className="memory-grid">
            {memoryCells.map((taskId, index) => (
              <div
                className={`memory-cell ${taskId ? 'occupied' : ''}`}
                key={index}
              >
                <span className="memory-index">{index}</span>
                <strong>{taskId ?? ''}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel rules-panel">
          <h2>Rule Editor</h2>

          <div className="rule-block">
            <span>WHEN</span>
            <strong>Request Arrives</strong>
          </div>

          <div className="rule-block">
            <span>IF</span>
            <strong>Size &gt; 3</strong>
          </div>

          <div className="rule-block">
            <span>DO</span>
            <strong>Enqueue</strong>
          </div>

          <button type="button">Add Rule</button>
        </aside>
      </section>

      <section className="console">
        <div className="console-status">
          <span>Tick: <strong>0</strong></span>
          <span>Status: <strong>Ready</strong></span>
          <span>Score: <strong>0</strong></span>
        </div>

        <div className="log">
          <h2>Log</h2>
          <p>[Tick 0] System ready.</p>
        </div>
      </section>
    </main>
  )
}

export default App