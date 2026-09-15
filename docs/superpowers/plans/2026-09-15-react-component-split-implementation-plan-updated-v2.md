# React Component Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current GUI shell into focused React presentational components while preserving all existing behavior and visual output.

**Architecture:** Keep all current GUI-shell state, timers, wheel/snap logic, mock simulation controls, and workspace orchestration in `App.tsx`. Extract only presentational markup into `TopBar`, board-side components, and rule-program components. Keep `App.css` unchanged and postpone Controller integration, custom hooks, feature folders, and application sidebar work.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, ESLint 10

**Spec:** `docs/superpowers/specs/2026-09-15-react-component-split-design.md`

## Global Constraints

- This is a behavior-preserving refactor except for one explicitly approved correction: the Memory Arena summary must use level/runtime-provided `totalBlocks` and `usedBlocks`, while `freeBlocks` is derived as `totalBlocks - usedBlocks`.
- Do not integrate `SimulationEngine` or `GameController`.
- Do not add Context, Redux, Zustand, or another state library.
- Do not create `features/simulation`, `features/rules`, or `features/workspace`.
- Do not add `useMockSimulation` or `useWorkspaceNavigation`.
- Do not redesign the layout or interactions.
- Do not change wheel / snap semantics.
- Do not change mock task/cell layout or interaction behavior. The only approved mock-presentation correction is replacing the hard-coded Memory Arena summary with level/runtime metadata (`totalBlocks`, `usedBlocks`) and deriving `freeBlocks = totalBlocks - usedBlocks`.
- Do not split `src/App.css`.
- Do not add drag-and-drop rule editing.
- Do not add the future application sidebar or reserve layout space for it.
- `App.tsx` remains the owner of simulation/workspace state and transition callbacks.
- Existing CSS class names must remain unchanged unless compilation requires an import-only change.
- After each extraction task, run build and lint so TypeScript/prop-contract mistakes are caught immediately.
- Final verification must include `npm test`, `npm run build`, `npm run lint`, plus the manual GUI checklist from the spec.

---

## File Structure After This Refactor

```text
src/
├─ App.tsx
├─ App.css
└─ components/
   ├─ TopBar.tsx
   ├─ board/
   │  ├─ BoardPanel.tsx
   │  ├─ TaskRail.tsx
   │  ├─ TaskSection.tsx
   │  ├─ MemoryArena.tsx
   │  └─ ProcessingStrip.tsx
   └─ rules/
      ├─ RuleProgramPanel.tsx
      └─ RuleLine.tsx
```

### Responsibility Map

- `App.tsx`
  - owns `simulationStatus`
  - owns mock `tick`
  - owns `workspaceProgress`
  - owns pin/snap/timer state
  - owns Run/Pause/Resume/Step/Reset handlers
  - owns wheel navigation and workspace transitions
  - passes data and callbacks to children

- `TopBar.tsx`
  - renders brand, tick/status, simulation controls

- `BoardPanel.tsx`
  - composes task rail + memory arena + processing strip

- `TaskRail.tsx`
  - renders Upcoming and Waiting sections

- `TaskSection.tsx`
  - reusable section heading/list wrapper

- `MemoryArena.tsx`
  - renders memory heading, summary, and cell grid

- `ProcessingStrip.tsx`
  - renders currently processing mock tasks

- `RuleProgramPanel.tsx`
  - renders rule toolbar, mock program, edit tools, execution caption

- `RuleLine.tsx`
  - renders one rule line and execution highlight

---

### Task 1: Extract the top bar

**Files:**
- Create: `src/components/TopBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  ```ts
  export type SimulationStatus =
    | 'idle'
    | 'running'
    | 'paused'
    | 'halted'
    | 'completed'
  ```
- Produces:
  ```ts
  type TopBarProps = {
    simulationStatus: SimulationStatus
    tick: number
    onRun: () => void
    onPauseResume: () => void
    onStep: () => void
    onReset: () => void
  }
  ```

- [ ] **Step 1: Export the status type from `App.tsx` temporarily or move it to `TopBar.tsx` only if App can import it without creating a circular dependency**

Preferred minimal form in `src/App.tsx`:

```ts
export type SimulationStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'halted'
  | 'completed'
```

- [ ] **Step 2: Create `src/components/TopBar.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace the existing top-bar JSX in `App.tsx`**

Add:

```ts
import { TopBar } from './components/TopBar'
```

Replace the current `<header className="topbar">...</header>` with:

```tsx
<TopBar
  simulationStatus={simulationStatus}
  tick={tick}
  onRun={startSimulation}
  onPauseResume={pauseSimulation}
  onStep={stepSimulation}
  onReset={resetSimulation}
/>
```

- [ ] **Step 4: Run static verification**

Run:

```bash
npm run build
npm run lint
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/TopBar.tsx
git commit -m "refactor: extract top bar component"
```

---

### Task 2: Extract the reusable task section and task rail

**Files:**
- Create: `src/components/board/TaskSection.tsx`
- Create: `src/components/board/TaskRail.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  ```ts
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
  ```

- [ ] **Step 1: Create `TaskSection.tsx`**

```tsx
import type { ReactNode } from 'react'

type TaskSectionProps = {
  title: string
  children: ReactNode
}

export function TaskSection({
  title,
  children,
}: TaskSectionProps) {
  return (
    <section className="task-section">
      <div className="task-section__heading">
        <h2>{title}</h2>
      </div>

      <div className="task-section__list">
        {children}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `TaskRail.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace the task-rail JSX in `App.tsx`**

Add:

```ts
import { TaskRail } from './components/board/TaskRail'
```

Replace the entire current `<aside className="task-rail" ...>` block with:

```tsx
<TaskRail
  upcomingTasks={upcomingTasks}
  waitingTasks={waitingTasks}
/>
```

Delete the old local `TaskSection` function from the bottom of `App.tsx`.

- [ ] **Step 4: Remove the now-unused `ReactNode` type import from `App.tsx`**

The React import should no longer include:

```ts
type ReactNode
```

- [ ] **Step 5: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/board/TaskSection.tsx src/components/board/TaskRail.tsx
git commit -m "refactor: extract task rail components"
```

---

### Task 3: Extract the memory arena

**Files:**
- Create: `src/components/board/MemoryArena.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type MemoryCellView = {
    taskId: string | null
  }

  type MemoryArenaProps = {
    cells: MemoryCellView[]
    totalBlocks: number
    usedBlocks: number
  }
  ```

- [ ] **Step 1: Create `MemoryArena.tsx`**

```tsx
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
          <span>{totalBlocks} blocks</span>
          <span>{usedBlocks} used</span>
          <span>{freeBlocks} free</span>
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
```

**Approved behavior correction:** The current GUI shell hard-codes `32 blocks / 18 used / 14 free`. Replace that demo-only summary with the level-spec contract:

```ts
const totalBlocks = 32
const usedBlocks = 14
```

`MemoryArena` derives:

```ts
const freeBlocks =
  totalBlocks - usedBlocks
```

so the current prototype renders `32 blocks / 14 used / 18 free`.

`usedBlocks` is authoritative level/runtime metadata and must **not** be recomputed from `memoryCells`. The cell array is used to render the Memory Arena; the summary metadata comes from the loaded level/runtime state.

- [ ] **Step 2: Replace the heading and memory-grid JSX in `App.tsx`**

Add:

```ts
import { MemoryArena } from './components/board/MemoryArena'
```

Inside the existing `.memory-panel`, replace the heading + memory board blocks with:

```tsx
<MemoryArena
  cells={memoryCells}
  totalBlocks={totalBlocks}
  usedBlocks={usedBlocks}
/>
```

Leave the processing strip in `App.tsx` for this task.

- [ ] **Step 3: Remove the local `MemoryCell` type from `App.tsx`**

Import the view type only if needed:

```ts
import type { MemoryCellView } from './components/board/MemoryArena'
```

Use:

```ts
const memoryCells: MemoryCellView[] = [...]
```

- [ ] **Step 4: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Manually verify the memory summary and cell colors**

Run:

```bash
npm run dev
```

Check:

- cell count is unchanged
- Task0 / Task1 colors are unchanged
- total / used summary values come from level metadata
- free is derived as `total - used`
- with the current prototype metadata, the summary reads `32 blocks / 14 used / 18 free`

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/board/MemoryArena.tsx
git commit -m "refactor: extract memory arena component"
```

---

### Task 4: Extract the processing strip and compose the board panel

**Files:**
- Create: `src/components/board/ProcessingStrip.tsx`
- Create: `src/components/board/BoardPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  ```ts
  MemoryCellView[]
  UpcomingTaskView[]
  WaitingTaskView[]
  ```
- Produces:
  ```ts
  export type ProcessingTaskView = {
    id: string
    ticksLeft: number
    colorClass: string
  }

  type BoardPanelProps = {
    memoryCells: MemoryCellView[]
    totalBlocks: number
    usedBlocks: number
    upcomingTasks: UpcomingTaskView[]
    waitingTasks: WaitingTaskView[]
    processingTasks: ProcessingTaskView[]
  }
  ```

- [ ] **Step 1: Create `ProcessingStrip.tsx`**

```tsx
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
          <strong>{task.id}</strong>
          <span>Processing</span>
          <span>{task.ticksLeft} ticks left</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add the existing mock processing data to `App.tsx`**

```ts
const processingTasks: ProcessingTaskView[] = [
  {
    id: 'Task0',
    ticksLeft: 3,
    colorClass: 'processing-dot--task0',
  },
  {
    id: 'Task1',
    ticksLeft: 5,
    colorClass: 'processing-dot--task1',
  },
]
```

Import:

```ts
import type { ProcessingTaskView } from './components/board/ProcessingStrip'
```

- [ ] **Step 3: Create `BoardPanel.tsx`**

```tsx
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
```

- [ ] **Step 4: Replace board markup in `App.tsx`**

Add:

```ts
import { BoardPanel } from './components/board/BoardPanel'
```

Replace the current `<section className="board-panel">...</section>` with:

```tsx
<BoardPanel
  memoryCells={memoryCells}
  totalBlocks={totalBlocks}
  usedBlocks={usedBlocks}
  upcomingTasks={upcomingTasks}
  waitingTasks={waitingTasks}
  processingTasks={processingTasks}
/>
```

- [ ] **Step 5: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/board/BoardPanel.tsx src/components/board/ProcessingStrip.tsx
git commit -m "refactor: compose board panel components"
```

---

### Task 5: Extract a single rule line

**Files:**
- Create: `src/components/rules/RuleLine.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  ```ts
  type RuleLineProps = {
    depth: number
    label: string
    value: string
    highlighted?: boolean
  }
  ```

- [ ] **Step 1: Create `RuleLine.tsx`**

```tsx
import type { CSSProperties } from 'react'

type RuleLineProps = {
  depth: number
  label: string
  value: string
  highlighted?: boolean
}

export function RuleLine({
  depth,
  label,
  value,
  highlighted = false,
}: RuleLineProps) {
  return (
    <div
      className={[
        'rule-line',
        highlighted
          ? 'rule-line--current'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--rule-depth': depth,
        } as CSSProperties
      }
    >
      <span className="rule-line__rail" />

      <span className="rule-line__label">
        {label}
      </span>

      {value && (
        <span className="rule-line__value">
          {value}
        </span>
      )}

      {highlighted && (
        <span className="rule-line__current-label">
          CURRENT
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Import the component into `App.tsx`**

```ts
import { RuleLine } from './components/rules/RuleLine'
```

- [ ] **Step 3: Delete the local `RuleLine` function from `App.tsx`**

Do not alter any of the existing `RuleLine` call sites yet.

- [ ] **Step 4: Remove `CSSProperties` from `App.tsx` only if it is no longer needed elsewhere**

`App.tsx` still uses `CSSProperties` for `workspaceStyle`, so keep it there.

- [ ] **Step 5: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/rules/RuleLine.tsx
git commit -m "refactor: extract rule line component"
```

---

### Task 6: Extract the rule program panel

**Files:**
- Create: `src/components/rules/RuleProgramPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  ```ts
  type RuleProgramPanelProps = {
    canEdit: boolean
    showsExecution: boolean
    isBoardPinned: boolean
    onToggleBoardPin: () => void
    onFocusProgram: () => void
    onFocusBoard: () => void
    onSplitView: () => void
  }
  ```
- Produces: complete rule-program panel presentation with no state ownership

- [ ] **Step 1: Create `RuleProgramPanel.tsx`**

Move the existing local `RuleProgramPanel` function into the new file without changing markup or behavior.

The file must import:

```ts
import { RuleLine } from './RuleLine'
```

and declare exactly:

```ts
type RuleProgramPanelProps = {
  canEdit: boolean
  showsExecution: boolean
  isBoardPinned: boolean
  onToggleBoardPin: () => void
  onFocusProgram: () => void
  onFocusBoard: () => void
  onSplitView: () => void
}
```

The exported signature must be:

```ts
export function RuleProgramPanel({
  canEdit,
  showsExecution,
  isBoardPinned,
  onToggleBoardPin,
  onFocusProgram,
  onFocusBoard,
  onSplitView,
}: RuleProgramPanelProps) {
  // existing JSX moved here unchanged
}
```

- [ ] **Step 2: Import it into `App.tsx`**

```ts
import { RuleProgramPanel } from './components/rules/RuleProgramPanel'
```

- [ ] **Step 3: Delete the old local `RuleProgramPanel` function from `App.tsx`**

Keep the existing invocation in the `App` return block unchanged.

- [ ] **Step 4: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Manually verify scroll ownership**

Run:

```bash
npm run dev
```

Check specifically:

- wheel over Rule Program body scrolls the program content
- wheel over Rule Program body does not move the outer workspace
- wheel over the Rule Program toolbar can still move the outer workspace
- Program / Split / Board buttons still work
- Pin / Unpin still works

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/rules/RuleProgramPanel.tsx
git commit -m "refactor: extract rule program panel"
```

---

### Task 7: Clean up `App.tsx` as the orchestration layer

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- `App.tsx` should now render only major child components while retaining all state and transition behavior.

- [ ] **Step 1: Review imports**

Expected React imports should be limited to what orchestration still needs, approximately:

```ts
import {
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from 'react'
```

Remove any presentational-only type imports that are no longer used.

- [ ] **Step 2: Confirm state ownership remains in App**

The following must still be owned by `App`:

```ts
simulationStatus
workspaceProgress
isBoardPinned
isSnapping
tick
workspaceProgressRef
snapTimer
animationTimer
```

- [ ] **Step 3: Confirm behavior functions remain in App**

The following functions must remain in `App.tsx`:

```ts
updateWorkspaceProgress
stopPendingSnap
animateWorkspaceTo
scheduleSnap
startSimulation
pauseSimulation
stepSimulation
resetSimulation
toggleBoardPin
handleWorkspaceWheel
```

- [ ] **Step 4: Confirm the App render is now structural**

Its main shape should be equivalent to:

```tsx
return (
  <main
    className={[
      'game-shell',
      isSnapping
        ? 'game-shell--snapping'
        : '',
    ]
      .filter(Boolean)
      .join(' ')}
    onWheel={handleWorkspaceWheel}
  >
    <TopBar
      simulationStatus={simulationStatus}
      tick={tick}
      onRun={startSimulation}
      onPauseResume={pauseSimulation}
      onStep={stepSimulation}
      onReset={resetSimulation}
    />

    <section
      className="workspace"
      style={workspaceStyle}
    >
      <BoardPanel
        memoryCells={memoryCells}
        upcomingTasks={upcomingTasks}
        waitingTasks={waitingTasks}
        processingTasks={processingTasks}
      />

      <RuleProgramPanel
        canEdit={canEdit}
        showsExecution={showsExecution}
        isBoardPinned={isBoardPinned}
        onToggleBoardPin={toggleBoardPin}
        onFocusProgram={() =>
          animateWorkspaceTo(PROGRAM_FOCUS)
        }
        onFocusBoard={() =>
          animateWorkspaceTo(BOARD_FOCUS)
        }
        onSplitView={() =>
          animateWorkspaceTo(SPLIT_VIEW)
        }
      />
    </section>
  </main>
)
```

Do not extract a `Workspace` component in this refactor. `App` must continue to own the workspace style and wheel behavior.

- [ ] **Step 5: Run static verification**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Commit cleanup if there are meaningful changes**

```bash
git add src/App.tsx
git commit -m "refactor: simplify app orchestration"
```

Skip this commit if Task 7 produces no diff.

---

### Task 8: Full regression verification

**Files:**
- No production-code changes expected unless verification reveals a regression.

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --run
```

Expected: all existing tests pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: TypeScript compilation and Vite build pass.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 4: Start the GUI**

```bash
npm run dev
```

- [ ] **Step 5: Verify simulation controls manually**

Confirm:

1. Idle initially shows `Run`.
2. `Run` changes status to running and moves toward Board Focus.
3. `Pause` changes running → paused.
4. `Resume` changes paused → running.
5. `Step` increments the mock tick in running or paused state.
6. `Reset` returns status to idle and tick to 0.

- [ ] **Step 6: Verify workspace controls manually**

Confirm:

1. `Program` focuses Rule Program.
2. `Split` moves to Split View.
3. `Board` focuses Memory Board.
4. `Pin split` pins Split View.
5. Program / Split / Board controls are disabled while pinned.
6. `Unpin` restores normal navigation.
7. Run/Reset respect pinned Split View.

- [ ] **Step 7: Verify wheel and scroll ownership manually**

Confirm:

1. wheel over outer workspace continuously changes panel proportions;
2. release snaps to Program / Split / Board targets;
3. wheel over task rail scrolls its content while it can still scroll internally;
4. wheel over Rule Program body scrolls its content only;
5. wheel at the scroll boundary still permits outer workspace movement according to the existing behavior;
6. Rule Program toolbar wheel remains owned by the outer workspace.

- [ ] **Step 8: Verify visual parity**

Confirm:

- same top-bar labels and controls
- same memory cells and Task0 / Task1 colors
- Memory Arena summary now uses level metadata (`32 blocks / 14 used`) and derives `18 free`
- same Upcoming / Waiting task cards
- same processing cards
- same rule tree
- same current-execution highlight
- same edit tools and execution caption
- no intentional spacing, color, or layout changes

- [ ] **Step 9: Inspect architecture against the spec**

Confirm there is still:

- no Controller integration
- no custom hook extraction
- no feature-folder architecture
- no stylesheet split
- no sidebar implementation
- no reserved sidebar width
- no new UI behavior beyond the explicitly approved Memory Arena summary correction using level/runtime metadata

- [ ] **Step 10: Final commit only if verification required fixes**

If no fixes were necessary, do not create an empty commit.

If fixes were required:

```bash
git add src
git commit -m "fix: preserve gui behavior after component split"
```

---

## Expected Result

After this plan is complete:

```text
App.tsx
│
├─ TopBar
│
├─ BoardPanel
│  ├─ TaskRail
│  │  └─ TaskSection
│  ├─ MemoryArena
│  └─ ProcessingStrip
│
└─ RuleProgramPanel
   └─ RuleLine
```

`App.tsx` still owns the current GUI-shell behavior and mock state, but the presentational markup is isolated behind explicit prop contracts. `MemoryArena` derives its total / used / free summary from the supplied cells rather than carrying forward a demo-only hard-coded value. This leaves the next Controller-integration phase free to replace mock data and simulation controls without first untangling a monolithic JSX tree.
