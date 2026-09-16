# Compaction Runtime Action Design

## 1. Goal

Add the MVP `Compact` Runtime Action without implementing it yet.

The design must provide deterministic external-fragmentation relief, charge one Tick for each Task whose occupied positions actually change, suspend and resume through the existing single execution pivot, and preserve a clean seam for future selectable, configurable, or player-programmable compaction policies.

This document is the design gate for `feat/compaction-action`. An implementation plan must not be created until this spec is reviewed and approved.

## 2. Current Runtime Context

The current execution chain is:

```text
SimulationEngine
→ RuleExecutionSession
→ ActionExecution
→ SplitExecution / immediate Allocate work
→ SimulationState
```

Relevant existing behavior:

- one Rule phase has one active execution pivot;
- a cost-bearing Action step consumes the Tick's Rule budget;
- an unfinished `ActionExecution` remains on the `RuleExecutionSession` frame stack and resumes on a later Tick;
- zero-cost completion may return to the parent frame and continue traversal in the same Rule phase;
- Split builds local work and commits its Task shape only after the complete plan succeeds;
- committed Simulation State is not rolled back after a later failure;
- `Memory` owns the physical cell array and currently exposes allocation, release, clear, and read-only snapshot operations;
- Processing Tasks advance before the Waiting / Rule phase, so a release may change Memory between two advances of a suspended Action.

Compaction should extend these boundaries rather than create a second execution mechanism.

## 3. Confirmed MVP Semantics

The MVP policy is a deterministic naive Stable Left Pack.

Given a Memory snapshot, it must:

1. scan cells from left to right;
2. preserve the relative order of all occupied cells;
3. move occupied cells into a dense prefix;
4. place every free cell in one suffix on the right;
5. preserve Task IDs;
6. leave Task lifecycle status and `fragmentSizes` unchanged.

Example:

```text
Before: [A][A][ ][B][B][ ][C][ ]
After:  [A][A][B][B][C][ ][ ][ ]
```

The stable ordering applies to occupied cells, including repeated Task IDs from fragmented allocation. Compaction does not invent Fragment IDs, reorder fragments, or rewrite the Task's logical fragment shape.

The MVP Rule AST shape is parameterless:

```ts
type Action =
  | { type: 'allocate' }
  | { type: 'split'; fragments: readonly Expression[] }
  | { type: 'compact' }
```

The player cannot select or edit the policy in the MVP.

## 4. Considered Execution Approaches

### 4.1 Immutable plan with atomic commit — selected

A pure policy creates an immutable target snapshot and an ordered set of moved Task IDs. `CompactionExecution` consumes one Tick of movement work at a time and commits the target Memory snapshot atomically when all required movement work is paid.

Advantages:

- follows the existing Split plan / execution / commit pattern;
- Memory is always externally observable in a valid state;
- fragmented and interleaved Task cells do not require transient overwrite semantics;
- policy calculation is independently testable;
- the runtime can replace the policy later without replacing suspend / resume behavior.

Trade-off:

- the MVP board observes the pre-compaction layout and then the committed layout, not a literal per-Task cell animation.

This trade-off is acceptable because detailed per-Tick Compaction animation is outside the GUI MVP.

### 4.2 Incremental per-Task Memory mutation — rejected for MVP

Each Tick would directly move one Task's cells.

This is visually literal, but a fragmented Task may have cells interleaved with another Task. Moving only one Task can overwrite occupied cells, temporarily remove another Task, or require an explicit scratch buffer and lower-level move instruction model. Those semantics are larger than the MVP Action.

### 4.3 Immediate compaction with delayed Tick accounting — rejected

Memory would be compacted immediately and the Action would remain suspended only to pay its remaining cost.

This separates visible effects from the work that causes them and weakens the meaning of the current execution pivot. It also lets following world phases observe a completed effect while the Action is still logically running.

## 5. Component Boundaries

### 5.1 `CompactionPolicy`

The policy is responsible only for converting a read-only Memory snapshot into a valid `CompactionPlan`.

Conceptual contract:

```ts
interface CompactionPolicy {
  createPlan(
    cells: readonly MemoryCell[],
  ): CompactionPlan
}
```

The MVP supplies one implementation:

```text
StableLeftPackPolicy
```

The Action AST does not contain a policy name. MVP policy selection belongs to runtime composition / configuration, with Stable Left Pack as the fixed default.

This is the extension seam for future policies. It does not imply that policy selection UI, user-authored programs, validation sandboxes, or new scoring rules belong in this phase.

### 5.2 `CompactionPlan`

The plan is immutable local execution data.

Conceptually it contains:

```ts
interface CompactionPlan {
  readonly sourceCells: readonly MemoryCell[]
  readonly targetCells: readonly MemoryCell[]
  readonly movedTaskIds: readonly TaskId[]
}
```

`movedTaskIds` contains unique Task IDs in stable first-appearance order.

A Task is moved when the ordered set of indices occupied by that Task differs between `sourceCells` and `targetCells`. A Task with multiple fragments is still one moved Task and costs one Tick.

Planner invariants:

- source and target capacities are equal;
- source and target contain the same multiset of non-null Task IDs;
- removing null cells from source and target produces the same ordered occupied-cell sequence;
- target has no null cell before an occupied cell;
- `movedTaskIds` has no duplicates;
- every and only Task whose occupied indices changed appears in `movedTaskIds`.

### 5.3 `CompactionExecution`

`CompactionExecution` owns resumable local work:

```text
current CompactionPlan
movement work already paid by Task ID
next pending moved Task
```

It does not own Rule control flow and does not directly decide which policy is available to the player.

Each advance performs at most one cost-bearing movement step.

### 5.4 `ActionExecutor`

`ActionExecution` gains a `compact` variant that wraps `CompactionExecution`.

`createActionExecution` creates the execution from the current Memory snapshot and fixed runtime policy. Unlike Split, Compact is a global Memory operation. It does not require the current Rule-context Task to remain `waiting`; that Task ID remains useful for pivot ownership and failure diagnostics, but it is not the target of the Action.

`advanceActionExecution` delegates movement progress to `CompactionExecution` and commits through a controlled `Memory` mutation boundary.

### 5.5 `Memory`

`Memory` remains the owner of physical cells.

It needs one controlled atomic commit operation rather than exposing its mutable array. The operation must reject a stale expected source, capacity mismatch, or changed occupied Task-ID multiset and must never partially replace cells.

Policy-specific ordering and packing invariants are validated by the planner / plan-validation boundary, not by `Memory`. The policy must not be embedded in `Memory`: `Memory` protects storage integrity and applies a result; it does not choose how compaction works.

### 5.6 `RuleExecutionSession`

No new control-flow model is required.

The existing action frame must:

- remain active while Compact reports progress;
- consume at most one Rule-budget Tick per advance;
- pop when Compact completes;
- continue zero-cost traversal only when the completion result did not consume a Tick;
- preserve `action: 'compact'` in a failure result.

## 6. Planning Algorithm

Stable Left Pack planning is a pure transformation:

```text
occupiedCells = sourceCells without nulls
freeCount = capacity - occupiedCells.length
targetCells = occupiedCells followed by freeCount nulls
```

Moved Task detection compares each Task's source indices and target indices.

Example:

```text
Source: [A][A][ ][B][B][ ][A][A]
Target: [A][A][B][B][A][A][ ][ ]

A source indices: [0, 1, 6, 7]
A target indices: [0, 1, 4, 5]
→ A moved

B source indices: [3, 4]
B target indices: [2, 3]
→ B moved

movedTaskIds: [A, B]
cost: 2 Ticks
```

This preserves the complete occupied-cell sequence:

```text
[A, A, B, B, A, A]
```

It does not group all cells with the same Task ID together.

## 7. Tick and Commit Semantics

### 7.1 No-op

If `sourceCells` already equals `targetCells`:

- `movedTaskIds` is empty;
- Compact completes with `consumedTick: false`;
- Memory is unchanged;
- the Rule session may continue to the next Statement in the same Rule phase.

### 7.2 One or more moved Tasks

For a stable plan with `N` moved Task IDs:

- the Action consumes exactly `N` movement-work Ticks;
- each advance consumes at most one Tick;
- Memory stays at the source layout before the final required step;
- the final required step atomically commits `targetCells` and completes with `consumedTick: true`;
- the parent Rule resumes on a later Simulation Tick.

Example for two moved Tasks:

```text
Advance 1: pay movement work for first Task
           → progress / consumedTick true
           → Memory unchanged

Advance 2: pay movement work for second Task
           → atomic target commit
           → complete / consumedTick true
```

The existing `RuleExecutionSession` already handles an Action that completes on a cost-bearing step by popping the action frame and returning Rule progress for that Tick.

## 8. Memory Changes During Suspension

The current Simulation phase order can release a completed Processing Task before a suspended Compact resumes. Therefore an immutable plan must never be committed solely because it was valid on an earlier Tick.

Before every movement step and before commit:

1. compare current Memory with `plan.sourceCells`;
2. if they match, continue the current plan;
3. if they differ, discard the stale target and create a new deterministic plan from current Memory;
4. retain the set of Task IDs whose movement work has already consumed a Tick;
5. charge only moved Task IDs in the current plan that have not already been paid during this Compact execution;
6. commit only when the current plan still matches Memory and all its moved Task IDs have paid movement work.

Consumed Ticks are never rolled back. A Task that disappeared because it completed may therefore leave already-spent work behind, but it cannot be resurrected by a stale commit. A Task that still requires movement is not charged twice within the same Compact execution.

This rule keeps the outcome deterministic, preserves normal Processing progression, and avoids introducing a stop-the-world Memory lock into the MVP.

## 9. Data Flow

```text
Rule reaches { type: 'compact' }
        ↓
ActionExecutor creates CompactionExecution
        ↓
fixed runtime policy creates CompactionPlan
        ↓
each advance pays at most one moved-Task Tick
        ↓
source changed? ── yes ──→ deterministic re-plan
        │
        no
        ↓
all current moved Tasks paid?
        │
        yes
        ↓
Memory validates source + atomically commits target
        ↓
Action frame completes; Rule resumes later if Tick was consumed
```

## 10. Failure and Consistency Rules

Normal cases that are not failures:

- already compact Memory;
- empty Memory;
- one resident Task that does not move;
- fragmented Tasks;
- a Processing Task completing while Compact is suspended, followed by deterministic re-planning.

Invariant failures should halt through the existing Runtime Failure path and include `action: 'compact'`. Examples include:

- plan capacity differs from Memory capacity;
- source snapshot no longer matches at the atomic commit boundary and re-planning was not performed;
- target changes the occupied Task-ID multiset;
- target violates the policy's declared ordering / packing invariants;
- atomic Memory replacement fails validation.

No partial Compaction state is committed on failure.

## 11. Testing Strategy

### 11.1 Policy / planner unit tests

- empty Memory produces a no-op plan;
- already packed Memory produces zero moved Tasks;
- gaps are removed and free space is placed on the right;
- occupied-cell order is preserved;
- repeated Task IDs / fragmented allocation preserve cell order;
- moved Task IDs are unique and stable;
- a Task whose occupied indices do not change is not charged;
- source and target have equal capacity and occupancy multiset.

### 11.2 `CompactionExecution` unit tests

- zero moved Tasks complete without consuming a Tick;
- one moved Task consumes one Tick and commits atomically;
- multiple moved Tasks suspend and resume one Tick at a time;
- Memory is unchanged before the final movement step;
- a fragmented Task still costs at most one Tick per execution;
- a changed source snapshot triggers deterministic re-planning;
- already-paid Task IDs are not charged twice after re-planning;
- stale plans are never committed.

### 11.3 `Memory` tests

- valid target replaces all cells atomically;
- capacity mismatch is rejected without mutation;
- stale expected source is rejected without mutation;
- changed occupancy data cannot partially mutate Memory;
- policy-specific ordering tests remain outside `Memory`.

### 11.4 `ActionExecutor` and `RuleExecutionSession` tests

- `{ type: 'compact' }` creates a resumable action execution;
- the current Rule Task is context, not the only movable Task;
- Compact may run before Allocate for a waiting Task;
- no-op Compact can continue to the following Action in the same Rule phase;
- a cost-bearing final commit keeps the parent Rule suspended until the next Tick;
- Compact failures include rule ID, context Task ID, action type, and reason.

### 11.5 `SimulationEngine` integration tests

- Compact resolves external fragmentation so a following contiguous Allocate can succeed;
- an active Compact retains the single execution pivot and prevents handoff to a later waiting candidate;
- moved-Task count matches elapsed Rule-work Ticks in a stable layout;
- Processing progression and release during suspension cannot cause a stale commit;
- committed Compaction state is preserved if a later Action fails;
- Task identity, statuses, queue membership, and `fragmentSizes` remain consistent.

## 12. GUI Boundary

This phase does not integrate the GUI with the runtime.

Future GUI Phase 2 needs only:

- current execution information capable of identifying the `Compact` block;
- committed Memory state after the Action completes;
- normal Runtime Failure presentation if an invariant failure occurs.

Per-Task movement animation, scratch-space visualization, and a policy editor are not required.

## 13. Explicit Non-goals

- player-selectable Compaction policy;
- player-authored Compaction programs;
- policy configuration UI;
- policy scoring / balancing beyond moved-Task Tick cost;
- a general movement instruction VM;
- per-cell or per-fragment movement cost;
- physical scratch-buffer simulation;
- detailed per-Tick Compaction animation;
- GameController or GUI Runtime Integration;
- Allocation policy customization;
- Virtual Memory / Paging.

## 14. Future Policy Evolution

Future versions may introduce a policy catalog, level-provided policies, configurable heuristics, or a player-built Compaction Program.

Those systems should produce a validated `CompactionPlan` through the same high-level boundary:

```text
selected / configured / programmed policy
→ validated CompactionPlan
→ existing CompactionExecution
→ atomic Memory commit
```

Player-programmable policies may eventually need their own expression/runtime cost, validation, sandboxing, and failure model. Those concerns must be designed when that feature becomes real; the MVP should preserve the seam without implementing speculative machinery now.

## 15. Completion Criteria for the Future Implementation

The implementation phase is complete only when:

- `compact` exists in the Rule AST;
- Stable Left Pack planning is deterministic and pure;
- policy selection is fixed for MVP but not embedded in the AST or `Memory`;
- moved Task detection and Tick cost match this spec;
- Compact suspends and resumes through the existing Action frame;
- each advance consumes at most one Rule-work Tick;
- Memory commits atomically and never accepts a stale plan;
- normal release during suspension re-plans deterministically;
- unit and integration tests cover no-op, fragmented, multi-Tick, stale-plan, and external-fragmentation scenarios;
- no GameController, GUI integration, policy editor, or player-programmable policy is added.
