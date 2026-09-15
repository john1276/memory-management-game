# React Component Split Design

## Goal

Refactor the current GUI shell so `App.tsx` stops owning most presentational markup directly, while preserving the current GUI behavior and visual output.

This refactor is intentionally limited to component boundaries. It does not integrate the real `GameController`, redesign the UI, introduce feature-based architecture, add a state-management library, or split stylesheets.

## Current Problem

`App.tsx` currently mixes several responsibilities:

- mock simulation state and controls
- workspace progress / pin / snap state
- wheel-driven workspace navigation
- top bar rendering
- task rail rendering
- memory arena rendering
- processing task rendering
- rule program rendering

This makes the file harder to reason about and would make future Controller integration more expensive if runtime concerns were added before presentational boundaries were extracted.

## Design Principle

Use a component-based structure first, and postpone feature-based architecture until real runtime data flow exists.

The rationale is:

- presentational boundaries are already visible and stable enough to identify now;
- true feature boundaries depend on how `GameController`, runtime state, execution snapshots, and presentation mapping interact;
- moving already-clean components between folders later is cheap;
- extracting UI from a larger App after Controller integration would be more expensive.

## Proposed Structure

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

## Responsibility Boundaries

### `App.tsx`

`App.tsx` remains the orchestration layer for the current GUI shell.

It keeps:

- `simulationStatus`
- mock `tick`
- `workspaceProgress`
- pinned split state
- snap / animation state and timers
- workspace wheel handling
- Run / Pause / Resume / Step / Reset handlers
- shared workspace transition functions

It renders the major sections and passes data / callbacks downward.

### `TopBar.tsx`

Owns top-bar presentation only.

Receives the current status, tick, and control callbacks via props. It does not own simulation state.

### `BoardPanel.tsx`

Owns the board-side composition.

It combines:

- `TaskRail`
- `MemoryArena`
- `ProcessingStrip`

It does not own workspace navigation or runtime state.

### `TaskRail.tsx`

Owns Upcoming and Waiting task presentation.

It receives task data through props and uses `TaskSection` for repeated section structure.

### `TaskSection.tsx`

Small reusable presentational wrapper for a labeled task list section.

### `MemoryArena.tsx`

Owns:

- memory heading / summary
- memory-cell grid rendering

It receives memory cell data rather than owning simulation logic.

### `ProcessingStrip.tsx`

Owns current processing-task presentation.

The initial extraction may preserve the existing mock values, but the component API should make replacing them with runtime-derived values straightforward.

### `RuleProgramPanel.tsx`

Owns rule-program presentation and local toolbar markup.

It receives:

- editability / execution-view flags
- pinned state
- workspace navigation callbacks

It does not own workspace state.

### `RuleLine.tsx`

Owns a single displayed rule line, including depth and current-execution highlighting.

## State Ownership

State stays lifted in `App.tsx` for this refactor.

No custom hooks are introduced yet because:

- mock simulation state will later be replaced by the real Controller;
- workspace behavior is still small enough to understand in one place;
- extracting hooks now would risk creating temporary abstractions.

## Data Flow

The intended flow is one-way:

```text
App state / mock data
        ↓
major UI components
        ↓
small presentational components
```

Callbacks flow upward through props.

No child component should import or mutate App-owned state directly.

## Styling

Keep `src/App.css` as a single stylesheet during this refactor.

Reasons:

- current class naming already separates visual regions clearly;
- splitting TSX and CSS at the same time would increase diff size without improving runtime architecture;
- stylesheet modularization can be evaluated after component boundaries stabilize.

## Explicit Non-goals

This refactor will not:

- integrate `SimulationEngine` or `GameController`
- introduce Context, Redux, Zustand, or another state library
- create `features/simulation`, `features/rules`, or `features/workspace`
- introduce `useMockSimulation`
- introduce `useWorkspaceNavigation` unless implementation reveals a concrete need
- redesign layout or interaction
- change wheel / snap semantics
- change mock data behavior
- split `App.css`
- add drag-and-drop rule editing
- add an application sidebar / level-selection navigation

## Future Architecture Decision

After the real Controller is integrated, reevaluate whether the code should move toward feature-based modules.

At that point, use observed dependencies to distinguish at least:

- gameplay/runtime state
- presentation mapping / view models
- workspace-local UI state
- rule-editor state

Feature boundaries should be chosen from real coupling rather than predicted folder names.


## Future Work: Application Sidebar / Navigation

A future version may add a collapsible application-level sidebar on the left side of the desktop UI, similar in role to the navigation sidebars used by applications such as ChatGPT or LeetCode.

Potential responsibilities include:

- level / challenge selection
- progress and completion records
- navigation to other game modes or sections
- settings
- other application-level functions

This sidebar is explicitly **not part of the current GUI MVP or this component refactor**.

The only architectural consideration retained now is that the current Memory Board / Rule Program workspace should be treated as the game's **level workspace**, not as an assumption that it will always directly own the entire application viewport.

A likely future composition is:

```text
Application Shell
├─ Sidebar
└─ Main Area
   ├─ TopBar
   └─ Game Workspace
      ├─ Memory Board
      └─ Rule Program
```

The sidebar should be introduced later by a higher-level Application Shell wrapping the current Game Workspace. It should not require Simulation, Memory Board, or Rule Program components to absorb application-navigation responsibilities.

No placeholder sidebar, reserved width, empty component, routing system, or other speculative implementation should be added now.

## Verification

The component extraction is behavior-preserving.

Verification should include:

1. `npm test`
2. `npm run build`
3. `npm run lint`
4. manual GUI check confirming:
   - Run / Pause / Resume / Step / Reset still behave the same
   - Program / Split / Board buttons still move the workspace correctly
   - Pin / Unpin behavior is unchanged
   - workspace wheel navigation still works
   - Rule Program body scroll still does not move the outer workspace
   - current-execution highlight is unchanged
   - visual layout is unchanged

## Completion Criteria

The refactor is complete when:

- `App.tsx` primarily orchestrates state, transitions, and major child components;
- board and rule-program rendering are split into focused components;
- no intentional behavior or visual changes are introduced;
- current GUI-shell behavior passes verification;
- the code remains ready for later Controller integration without committing to premature feature boundaries.
