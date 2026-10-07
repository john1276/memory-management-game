# Compaction Runtime Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the MVP `Compact` Runtime Action as deterministic Stable Left Pack work that suspends once per moved Task, safely re-plans after Memory changes, and atomically commits only a current plan.

**Architecture:** Keep planning, execution, and storage mutation separate. `StableLeftPackPolicy` converts a read-only Memory snapshot into an immutable, validated `CompactionPlan`; `CompactionExecution` owns the current plan plus already-paid Task IDs and re-plans from current Memory before work or commit; `Memory.commitCells` is the policy-agnostic compare-and-swap boundary that either replaces the complete cell array or changes nothing. `ActionExecutor` adds the `compact` variant and accepts an `ActionExecutionDependencies` object whose fixed MVP default contains Stable Left Pack; `RuleExecutionSession` captures that dependency once so tests and future runtime composition can replace policy without putting policy in the AST or `Memory`. The existing action frame and single execution pivot remain unchanged.

**Tech Stack:** TypeScript 6, Vitest 4, existing Vite/React project. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-16-compaction-runtime-action-design.md`

## Global Constraints

- MVP policy is deterministic naive Stable Left Pack.
- Preserve the complete left-to-right sequence of occupied cells; do not group cells by Task ID.
- Preserve Task IDs, lifecycle status, queue membership, and `fragmentSizes`.
- `movedTaskIds` is unique and ordered by first appearance in the source snapshot.
- A Task costs one Tick iff its occupied index sequence differs between source and target; a fragmented Task still costs at most one Tick in one Compact execution.
- Compact performs at most one cost-bearing movement step per advance.
- Memory remains at the current source layout until all movement work required by the current plan has been paid.
- The final paid movement step commits the complete target atomically and completes with `consumedTick: true`.
- A no-op Compact completes with `consumedTick: false`, allowing same-phase traversal to continue.
- Before every movement step and commit, changed Memory invalidates the current plan and triggers deterministic re-planning.
- Re-planning retains paid Task IDs; paid work is never rolled back and a still-moved Task is not charged twice.
- An atomic commit rejects capacity mismatch, stale expected source, or changed occupied Task-ID multiset without partial mutation.
- Policy-specific packing and order invariants stay outside `Memory`.
- Compact uses the existing Rule action frame and single execution pivot; do not add a second scheduler or control-flow mechanism.
- The current Rule Task is diagnostic/pivot context, not the target of global compaction, and need not be `waiting` when Compact resumes.
- Runtime invariant failures preserve `action: 'compact'`; normal no-op and release/re-plan cases are not failures.
- Do not add GUI integration, a policy selector/editor, per-cell animation, a movement VM, GameController, Paging, or Virtual Memory.

---

## File Structure

Create:

- `src/simulation/actions/CompactionPolicy.ts` — `CompactionPlan`, `CompactionPolicy`, plan validation, and the fixed `StableLeftPackPolicy` pure planner.
- `src/simulation/actions/CompactionPolicy.test.ts` — planning determinism, stable ordering, moved-Task detection, fragmentation, and invariants.
- `src/simulation/actions/CompactionExecution.ts` — resumable movement accounting, stale-plan detection/re-planning, and atomic final commit.
- `src/simulation/actions/CompactionExecution.test.ts` — no-op, multi-Tick, atomicity, re-planning, paid-ID retention, and failures.

Modify:

- `src/simulation/rules/Rule.ts` — add parameterless `{ type: 'compact' }` to `Action`.
- `src/simulation/validation/ProgramValidator.test.ts` — prove Compact is a valid parameterless Action and does not affect Split validation.
- `src/domain/Memory.ts` — add one policy-neutral atomic snapshot commit operation.
- `src/domain/Memory.test.ts` — verify successful replacement and every rejection is non-mutating.
- `src/simulation/actions/ActionExecutor.ts` — add Compact creation/advance and pass `SimulationState` into action creation so planning sees current Memory.
- `src/simulation/actions/ActionExecutor.test.ts` — verify API creation, global scope, before-Allocate use, progress, completion, and failure propagation.
- `src/simulation/rules/RuleExecutionSession.ts` — pass `state` to `createActionExecution`; no new frame type.
- `src/simulation/rules/RuleExecutionSession.test.ts` — verify no-op same-phase continuation, cost-bearing completion suspension, and Compact diagnostics.
- `src/simulation/SimulationEngine.test.ts` — cover external fragmentation, single pivot, elapsed cost, release during suspension, and no rollback after later failure.
- `MVP.md` — only after implementation is green, mark the Compaction Runtime Action engineering item complete and record implemented file/test status without changing semantics.

Do not modify GUI files or `SimulationEngine.ts` unless a failing integration test exposes an actual runtime defect. The current phase order and active `RuleExecutionSession` already supply the required release/re-plan behavior.

---

### Task 1: Add the parameterless Compact AST variant

**Files:**
- Modify: `src/simulation/rules/Rule.ts`
- Modify: `src/simulation/validation/ProgramValidator.test.ts`

**Interfaces:**
- Produces: `Extract<Action, { type: 'compact' }>` with no fields other than `type`.
- Preserves: Split-only static validation in `validateAction`.

- [ ] **Step 1: Write the failing validator/typing test**

Add a validator test using this complete rule body:

```ts
const program: RuleProgram = [
  {
    id: 'compact-before-allocate',
    trigger: 'taskWaiting',
    body: [
      { type: 'action', action: { type: 'compact' } },
      { type: 'action', action: { type: 'allocate' } },
    ],
  },
]

expect(validateRuleProgram(program)).toEqual([])
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run src/simulation/validation/ProgramValidator.test.ts
```

Expected: TypeScript/Vitest fails because `'compact'` is not assignable to `Action['type']`.

- [ ] **Step 3: Add only the AST variant**

Extend `Action`:

```ts
| {
    type: 'compact'
  }
```

Do not add a policy field. `validateAction` should continue returning early for every non-Split action. Add exhaustive placeholder branches in `ActionExecutor.ts` so this commit remains buildable: `executeAction` returns `{ ok: false, action: 'compact', reason: 'Compact action requires resumable execution' }`, and `createActionExecution` returns `{ ok: false, action: 'compact', reason: 'Compact action is not implemented' }`. These are explicit pre-integration results, not Compact behavior.

- [ ] **Step 4: Run the focused test and type build**

```bash
npm test -- --run src/simulation/validation/ProgramValidator.test.ts
npm run build
```

Expected: validator tests and build pass. No runtime path claims Compact is implemented yet.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/rules/Rule.ts src/simulation/validation/ProgramValidator.test.ts src/simulation/actions/ActionExecutor.ts
git commit -m "feat: define compact rule action"
```

---

### Task 2: Implement pure Stable Left Pack planning

**Files:**
- Create: `src/simulation/actions/CompactionPolicy.ts`
- Create: `src/simulation/actions/CompactionPolicy.test.ts`

**Interfaces:**
- Consumes: `MemoryCell` and `TaskId`.
- Produces:

```ts
export interface CompactionPlan {
  readonly sourceCells: readonly MemoryCell[]
  readonly targetCells: readonly MemoryCell[]
  readonly movedTaskIds: readonly TaskId[]
}

export interface CompactionPolicy {
  createPlan(cells: readonly MemoryCell[]): CompactionPlan
}

export function validateCompactionPlan(
  plan: CompactionPlan,
): string | null

export class StableLeftPackPolicy implements CompactionPolicy {
  createPlan(cells: readonly MemoryCell[]): CompactionPlan
}

export const stableLeftPackPolicy: CompactionPolicy
```

The policy must copy input arrays; no plan array may alias caller-owned mutable data.

- [ ] **Step 1: Write failing no-op and packed-layout tests**

Assert exact plans for `[]` and `['A', 'A', 'B', null]`. Both plans have copied equal source/target arrays and `movedTaskIds: []`; mutating the original test input after `createPlan` must not change either snapshot.

- [ ] **Step 2: Run planner tests and verify RED**

```bash
npm test -- --run src/simulation/actions/CompactionPolicy.test.ts
```

Expected: FAIL because `CompactionPolicy.ts` does not exist.

- [ ] **Step 3: Implement target construction only**

Use the pure transformation:

```ts
const sourceCells = [...cells]
const occupiedCells = sourceCells.filter(
  (cell): cell is TaskId => cell !== null,
)
const targetCells = [
  ...occupiedCells,
  ...Array(sourceCells.length - occupiedCells.length).fill(null),
]
```

Return copied snapshots from `StableLeftPackPolicy.createPlan`, then export one `stableLeftPackPolicy` singleton for the default runtime dependency. Do not inspect `TaskRuntime`, queue state, or lifecycle status.

- [ ] **Step 4: Add failing moved-Task and fragmentation tests**

Cover these exact cases:

```ts
// B moves, A does not.
['A', 'A', null, 'B', 'B', null]
// target: ['A', 'A', 'B', 'B', null, null]
// movedTaskIds: ['B']

// Repeated A cells stay interleaved in occupied-cell order.
['A', 'A', null, 'B', 'B', null, 'A', 'A']
// target: ['A', 'A', 'B', 'B', 'A', 'A', null, null]
// movedTaskIds: ['A', 'B']
```

Also assert that each Task appears once, ordered by first appearance in the source, and that a Task whose occupied indices are identical is absent.

- [ ] **Step 5: Implement moved-Task detection**

Build source and target index lists per Task ID, iterate unique source IDs in first-appearance order, and compare the complete ordered index lists. Do not compare only first index or cell count.

- [ ] **Step 6: Add failing invariant-validation tests**

Construct invalid plans that independently violate:

- equal capacity;
- equal occupied Task-ID multiset;
- stable occupied-cell sequence;
- dense target prefix;
- unique `movedTaskIds`;
- exact moved-Task membership.

Assert `validateCompactionPlan` returns a non-null diagnostic for each and `null` for a policy-produced plan.

- [ ] **Step 7: Implement plan validation**

Return deterministic diagnostics such as:

```text
Compaction plan target capacity does not match source capacity
Compaction plan changes occupied Task IDs
Compaction plan does not preserve occupied-cell order
Compaction plan target is not left packed
Compaction plan contains duplicate moved Task A
Compaction plan moved Task IDs do not match changed occupied indices
```

Validation remains pure and does not modify the plan.

- [ ] **Step 8: Run focused tests and full suite**

```bash
npm test -- --run src/simulation/actions/CompactionPolicy.test.ts
npm test -- --run
```

Expected: all tests pass; the explicit pre-integration Compact result remains until Task 5.

- [ ] **Step 9: Commit**

```bash
git add src/simulation/actions/CompactionPolicy.ts src/simulation/actions/CompactionPolicy.test.ts
git commit -m "feat: add stable left pack planner"
```

---

### Task 3: Add policy-neutral atomic Memory commit

**Files:**
- Modify: `src/domain/Memory.ts`
- Modify: `src/domain/Memory.test.ts`

**Interfaces:**
- Produces:

```ts
export type MemoryCommitResult =
  | { ok: true }
  | { ok: false; reason: string }

Memory.commitCells(
  expectedSource: readonly MemoryCell[],
  targetCells: readonly MemoryCell[],
): MemoryCommitResult
```

`Memory` validates storage integrity only. It must not require left packing or Stable Left Pack ordering.

- [ ] **Step 1: Write the failing valid-commit test**

Create `[A, A, null, B, B, null]`, call `commitCells` with that exact expected source and target `[A, A, B, B, null, null]`, then assert `{ ok: true }` and the entire target snapshot.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- --run src/domain/Memory.test.ts
```

Expected: FAIL because `commitCells` does not exist.

- [ ] **Step 3: Implement compare-and-swap replacement**

Perform all validation against local reads before assigning `this.cells = [...targetCells]`. Compare cell arrays positionally and compare non-null Task-ID multisets including repeated cells. Return explicit failure results; do not throw for expected validation rejection.

- [ ] **Step 4: Add failing non-mutation tests for every rejection**

For each case, capture `before`, assert `ok: false`, and assert `memory.getCells()` still equals `before`:

- `expectedSource.length !== memory.capacity`;
- `targetCells.length !== memory.capacity`;
- current cells differ from `expectedSource`;
- target removes, adds, or changes any occupied Task-ID cell count.

Also add a policy-neutral success case whose target is not left packed but preserves capacity and multiset; this proves `Memory` does not embed the compaction policy.

- [ ] **Step 5: Implement rejection diagnostics**

Use stable reasons:

```text
Expected source capacity does not match Memory capacity
Target capacity does not match Memory capacity
Expected source is stale
Target changes occupied Task IDs
```

- [ ] **Step 6: Run Memory and planner tests**

```bash
npm test -- --run src/domain/Memory.test.ts src/simulation/actions/CompactionPolicy.test.ts
```

Expected: PASS with no partial mutation.

- [ ] **Step 7: Commit**

```bash
git add src/domain/Memory.ts src/domain/Memory.test.ts
git commit -m "feat: add atomic memory snapshot commit"
```

---

### Task 4: Implement resumable CompactionExecution and stale-plan re-planning

**Files:**
- Create: `src/simulation/actions/CompactionExecution.ts`
- Create: `src/simulation/actions/CompactionExecution.test.ts`

**Interfaces:**
- Consumes: `Memory`, `CompactionPolicy`, `CompactionPlan`, `validateCompactionPlan`, and `ExecutionAdvanceResult<void>`.
- Produces:

```ts
export interface CompactionExecution {
  readonly policy: CompactionPolicy
  plan: CompactionPlan
  readonly paidTaskIds: Set<TaskId>
}

export type CompactionExecutionStartResult =
  | {
      ok: true
      execution: CompactionExecution
    }
  | {
      ok: false
      reason: string
    }

export function createCompactionExecution(
  policy: CompactionPolicy,
  cells: readonly MemoryCell[],
): CompactionExecutionStartResult

export function advanceCompactionExecution(
  execution: CompactionExecution,
  memory: Memory,
): ExecutionAdvanceResult<void>
```

Creation validates the policy result and returns `{ ok: false, reason }` for an invalid initial plan. It must not throw an invariant failure across the Action boundary.

- [ ] **Step 1: Write the failing no-op execution test**

With packed `['A', 'A', null, null]`, assert creation returns `{ ok: true, execution }`, then assert the first advance returns:

```ts
{
  status: 'complete',
  consumedTick: false,
  value: undefined,
}
```

Memory must be unchanged.

- [ ] **Step 2: Run focused execution tests and verify RED**

```bash
npm test -- --run src/simulation/actions/CompactionExecution.test.ts
```

Expected: FAIL because the execution module does not exist.

- [ ] **Step 3: Implement no-op validation and completion**

Implement creation with the exact result boundary:

```ts
const plan = policy.createPlan(cells)
const reason = validateCompactionPlan(plan)

if (reason) {
  return { ok: false, reason }
}

return {
  ok: true,
  execution: {
    policy,
    plan,
    paidTaskIds: new Set(),
  },
}
```

On every advance, compare `memory.getCells()` positionally with `plan.sourceCells`; re-plan first if different and validate the replacement before using it. If the current plan has no unpaid moved Tasks, atomically commit only when target differs; an equal no-op completes without calling `commitCells` and returns `complete/false`. A re-plan whose moved Tasks are all already paid also commits at zero additional cost and returns `complete/false`.

- [ ] **Step 4: Add failing one- and multi-Task Tick tests**

Cover:

```ts
// One moved Task: first advance commits and completes, consumedTick true.
['A', 'A', null, 'B', 'B', null]

// Two moved Tasks: first advance is progress and Memory unchanged;
// second advance commits the full target and completes, consumedTick true.
['A', null, 'B', null, 'C', null]
```

Assert `paidTaskIds` grows in plan order and each advance charges at most one ID.

- [ ] **Step 5: Implement one-step accounting and final commit**

On an unpaid moved Task, add exactly the first unpaid ID. If unpaid IDs remain, return `progress/true`. If none remain, re-read current Memory, re-plan if the source became stale, and only then call `commitCells`. A successful final commit returns `complete/true`, not a later zero-cost completion.

Use this control flow so an advance never charges two Tasks, including when the source changes at the pre-commit check:

```ts
refresh stale plan and validate it

if current plan has no unpaid moved Task:
  commit current target if needed
  return complete/false

mark the first unpaid moved Task as paid

if current plan still has an unpaid moved Task:
  return progress/true

refresh stale plan again before commit and validate it

if refreshed plan has an unpaid moved Task:
  return progress/true

commit current target if needed
return complete/true
```

If `commitCells` rejects, return `failure` with its exact reason and with `consumedTick` equal to whether this advance just paid a Task. Never retry a rejected commit inside the same advance.

- [ ] **Step 6: Add the fragmented-Task cost test**

Use source `['A', null, 'B', null, 'A', null]`; assert `A` may own multiple separated regions but appears once in `movedTaskIds` and is charged once.

- [ ] **Step 7: Add failing stale-plan re-planning tests**

Test both required paths:

1. Start from `['A', null, 'B', null, 'C', null]`, pay `B`, then `memory.release('A')`. The fresh plan is `['B', 'C', null, null, null, null]`; `B` remains moved but already paid, so the next advance charges only `C` and commits. Assert `B` is not charged twice.
2. Start from the same source, pay `B`, then `memory.release('B')`. The next advance re-plans, charges `C`, and commits `['A', 'C', null, null, null, null]`. Assert the old target is never committed, the spent Tick stays spent, and `B` is not resurrected.

- [ ] **Step 8: Implement deterministic re-planning**

Use positional snapshot equality. On mismatch:

```ts
execution.plan = execution.policy.createPlan(currentCells)
```

Keep the same `paidTaskIds` Set. Determine pending work as current `plan.movedTaskIds.filter(id => !paidTaskIds.has(id))`; do not use a numeric cursor that becomes invalid after re-plan.

- [ ] **Step 9: Add failure/atomicity tests with fake policies**

Cover three exact failure boundaries:

1. A policy returning an invalid initial plan makes `createCompactionExecution` return `{ ok: false, reason }`.
2. A stateful fake policy returns a valid initial plan, then an invalid plan after Memory is changed; the next advance returns `failure/false` before paying more work.
3. A `RejectingCommitMemory extends Memory` overrides `commitCells` to return `{ ok: false, reason: 'Forced commit rejection' }`; the final paid advance returns `failure/true`, forwards that exact reason, and leaves Memory unchanged.

- [ ] **Step 10: Run execution, Memory, and planner tests**

```bash
npm test -- --run src/simulation/actions/CompactionPolicy.test.ts src/domain/Memory.test.ts src/simulation/actions/CompactionExecution.test.ts
```

Expected: PASS; every stale source either re-plans or fails without committing old cells.

- [ ] **Step 11: Commit**

```bash
git add src/simulation/actions/CompactionExecution.ts src/simulation/actions/CompactionExecution.test.ts
git commit -m "feat: add resumable compaction execution"
```

---

### Task 5: Integrate Compact through ActionExecutor

**Files:**
- Modify: `src/simulation/actions/ActionExecutor.ts`
- Modify: `src/simulation/actions/ActionExecutor.test.ts`
- Modify: `src/simulation/rules/RuleExecutionSession.ts`

**Interfaces:**
- Changes:

```ts
createActionExecution(
  action: Action,
  state: SimulationState,
  task: TaskRuntime,
  dependencies: ActionExecutionDependencies =
    defaultActionExecutionDependencies,
): ActionExecutionStartResult
```

- Adds to `ActionExecution`:

```ts
| {
    type: 'compact'
    action: Extract<Action, { type: 'compact' }>
    compaction: CompactionExecution
  }
```

- Produces `ActionExecutionDependencies` and `defaultActionExecutionDependencies`; the fixed MVP default contains `stableLeftPackPolicy`. `createActionExecution` accepts this dependencies object as an optional fourth argument. The policy remains a separate object and is not placed in the AST or `Memory`.
- Changes `createRuleExecutionSession(program, event, state, dependencies = defaultActionExecutionDependencies)` to retain one dependency object on the internal session and pass it to every later `createActionExecution` call. This is runtime composition, not player configuration.

- [ ] **Step 1: Update existing call sites/tests for the API shape**

Mechanically change existing `createActionExecution(action, task)` calls to `createActionExecution(action, state, task)`. Add exactly:

```ts
export interface ActionExecutionDependencies {
  readonly compactionPolicy: CompactionPolicy
}

export const defaultActionExecutionDependencies:
  ActionExecutionDependencies = {
    compactionPolicy: stableLeftPackPolicy,
  }
```

Let callers omit the fourth `createActionExecution` argument. Update `RuleExecutionSession` to store the dependency object once at session creation and pass it together with `state` when it creates any action frame. Run `ActionExecutor` and `RuleExecutionSession` tests to prove Allocate/Split behavior is unchanged before adding Compact behavior.

```bash
npm test -- --run src/simulation/actions/ActionExecutor.test.ts src/simulation/rules/RuleExecutionSession.test.ts
```

- [ ] **Step 2: Write the failing Compact creation test**

Build fragmented Memory, use a waiting Task only as context, call:

```ts
createActionExecution(
  { type: 'compact' },
  state,
  task,
)
```

Assert the result is an execution with `type: 'compact'`. Also assert creation does not mutate Memory, Task status, queue, or `fragmentSizes`.

- [ ] **Step 3: Implement Compact creation**

Create the execution from `state.memory.getCells()` and `dependencies.compactionPolicy`. Map the start result exactly:

```ts
const result = createCompactionExecution(
  dependencies.compactionPolicy,
  state.memory.getCells(),
)

if (!result.ok) {
  return {
    ok: false,
    action: 'compact',
    reason: result.reason,
  }
}

return {
  ok: true,
  execution: {
    type: 'compact',
    action,
    compaction: result.execution,
  },
}
```

Do not apply the Split preconditions: Compact is legal even if the context Task is no longer waiting when a suspended action resumes.

- [ ] **Step 4: Write failing Compact advance tests**

Through `advanceActionExecution`, cover:

- global Memory moves Tasks other than the context Task;
- Compact can run before Allocate while the context Task is waiting;
- Compact creation and resume remain legal when the context Task is `processing`; no Split-style waiting precondition is applied;
- multi-Task Compact reports progress until the final paid step;
- final completion returns `consumedTick: true` and commits atomically;
- no-op returns `complete/false`;
- execution failure reason is forwarded unchanged.

- [ ] **Step 5: Delegate Compact advance**

Add an exhaustive `compact` branch that calls:

```ts
advanceCompactionExecution(
  execution.compaction,
  state.memory,
)
```

Do not alter Allocate's two-advance behavior or Split's local commit behavior.

- [ ] **Step 6: Replace the Task 1 pre-integration failure branch and run focused tests**

```bash
npm test -- --run src/simulation/actions/ActionExecutor.test.ts src/simulation/rules/RuleExecutionSession.test.ts
npm run build
```

Expected: Action switches are exhaustive and all prior Allocate/Split tests remain green.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/actions/ActionExecutor.ts src/simulation/actions/ActionExecutor.test.ts src/simulation/rules/RuleExecutionSession.ts
git commit -m "feat: integrate compact action execution"
```

---

### Task 6: Verify RuleExecutionSession suspension and diagnostics

**Files:**
- Modify: `src/simulation/rules/RuleExecutionSession.test.ts`
- Modify: `src/simulation/rules/RuleExecutionSession.ts` only if the tests expose a defect beyond the Task 5 state argument.

**Interfaces:**
- Preserves the existing action frame; `frame.execution.type` supplies failure action `'compact'`.
- A complete result with `consumedTick: true` pops the frame and returns Rule progress, so the parent resumes only on a later Simulation Tick.
- Uses the optional `ActionExecutionDependencies` wiring added in Task 5. Production callers omit it; tests inject an invalid policy to exercise diagnostics.

- [ ] **Step 1: Write the no-op same-phase continuation test**

Use packed/empty Memory and a rule body `[Compact, Allocate]`. One call to `advanceRuleExecutionSession` must traverse Compact at zero cost and let Allocate consume the Tick in the same call.

- [ ] **Step 2: Run the focused test and verify behavior**

```bash
npm test -- --run src/simulation/rules/RuleExecutionSession.test.ts
```

Expected: PASS if the existing complete/false branch is correctly reused; otherwise RED identifies the minimal session defect.

- [ ] **Step 3: Write the cost-bearing final-commit suspension test**

Use one moved Task and a following Allocate. The first session advance must compact and return `progress/true` without running Allocate. The second advance resumes the parent and runs Allocate, returning `progress/true`. Assert the compacted snapshot after the first boundary and the allocated snapshot after the second.

- [ ] **Step 4: Write the multi-Tick and failure-diagnostic tests**

For two moved Tasks, assert the action frame remains active across two advances. Create another session with injected dependencies whose policy returns an invalid plan, then assert:

```ts
{
  status: 'failure',
  ruleId: 'rule-1',
  taskId: 'A',
  action: 'compact',
  reason:
    'Compaction plan target capacity does not match source capacity',
  consumedTick: false,
}
```

- [ ] **Step 5: Keep the generic frame unchanged and run tests**

Do not add a Compact-specific frame or another dependency lookup. If any assertion fails, correct only the generic complete/progress/failure branch that the failing assertion identifies; the Action-specific work remains in `ActionExecutor` and `CompactionExecution`.

```bash
npm test -- --run src/simulation/rules/RuleExecutionSession.test.ts src/simulation/actions/ActionExecutor.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/simulation/rules/RuleExecutionSession.ts src/simulation/rules/RuleExecutionSession.test.ts
git commit -m "test: cover compact rule session semantics"
```

---

### Task 7: Add SimulationEngine end-to-end scenarios

**Files:**
- Modify: `src/simulation/SimulationEngine.test.ts`
- Modify: `src/simulation/SimulationEngine.ts` only if a test demonstrates a defect in existing generic phase/pivot handling.

**Interfaces:**
- Consumes existing phase order: processing/release, arrivals, waiting/rules, waiting metrics.
- No new public engine API.

- [ ] **Step 1: Write the external-fragmentation rescue test**

Use capacity 8, long-running resident Tasks B and C, and waiting Task A of size 4. Seed Memory as `['B', 'B', null, null, 'C', 'C', null, null]` by allocating and releasing a temporary blocker. With rule body `[Compact, Allocate]`, assert Tick 0 charges/commits the one moved Task C to produce `['B', 'B', 'C', 'C', null, null, null, null]`; Tick 1 allocates A contiguously into the suffix. Assert B/C runtime object identity, status, and fragment shapes are unchanged.

- [ ] **Step 2: Write the single-pivot and elapsed-cost test**

Queue A as the Compact context and a distinct Task Z as the later waiting candidate. Seed a stable layout such as `['B', null, 'C', null, 'D', null]`, whose moved IDs are exactly C then D, and use `[Compact, Allocate]`. After Tick 0, assert Memory is unchanged and both A/Z are waiting. After Tick 1, assert the compact target is committed, `state.tick === 2`, and A/Z are still waiting. On Tick 2, assert A may advance to Allocate while Z remains waiting. This proves two Rule-work Ticks, ordered movement, and no candidate handoff before the active pivot returns.

- [ ] **Step 3: Write the release-during-suspension stale-plan test**

Seed capacity 8 as `['B', 'B', null, 'C', 'C', null, 'D', 'D']`. Give C `remainingDuration: 2`, keep B/D long-running, and start Compact for waiting A. Tick 0 decrements C to 1 and pays C as the first moved ID without mutating Memory. Tick 1 completes/releases C before Rule work, forcing a re-plan of `['B', 'B', null, null, null, null, 'D', 'D']`; the same Tick pays D and commits `['B', 'B', 'D', 'D', null, null, null, null]`. Assert C is completed and never reappears.

- [ ] **Step 4: Write the committed-state/no-rollback test**

Reuse the fragmented B/C plus size-4 A setup, but run `[Compact, Allocate, Allocate]`. Let Compact commit, let the first Allocate place A, then let the second Allocate fail because A is already processing. Assert the engine halts with `action: 'allocate'` and retains both the compacted resident order and A's committed allocation.

- [ ] **Step 5: Add identity/state consistency assertions**

Across the integration tests, assert all unaffected values explicitly:

```ts
expect(task.status).toBe(statusBefore)
expect(task.fragmentSizes).toEqual(fragmentSizesBefore)
expect(state.queue.toArray()).toEqual(expectedQueue)
expect(state.tasks.get(id)).toBe(task)
```

This prevents a visually correct Memory result from hiding Task/queue corruption.

- [ ] **Step 6: Run engine tests, then full verification**

```bash
npm test -- --run src/simulation/SimulationEngine.test.ts
npm test -- --run
npm run build
npm run lint
```

Expected: all tests, TypeScript build, Vite build, and ESLint pass. Do not weaken existing Allocate/Split assertions to make Compact green.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/SimulationEngine.ts src/simulation/SimulationEngine.test.ts
git commit -m "test: verify compact action end to end"
```

---

### Task 8: Update implementation status and perform final verification

**Files:**
- Modify: `MVP.md`

**Interfaces:**
- Documentation-only; no semantic design changes.

- [ ] **Step 1: Update only completed engineering status**

Make these bounded documentation changes:

- in `22.2 Engineering Implemented / Tested`, add completed entries for Stable Left Pack planning, resumable `CompactionExecution`, atomic `Memory` commit, stale-plan re-planning, and Compaction unit/integration tests;
- in `22.3 Engineering Roadmap`, change only `Implement Compaction Runtime Action` from `[ ]` to `[x]`;
- in `23. Next Recommended Step`, append Compaction to the completed chain and move the next stage to `GameController → GUI Phase 2 Runtime Integration`;
- keep the confirmed Compaction semantics and v1.3 revision notes unchanged.

Do not mark GUI Runtime Integration, GameController, configurable policies, or Virtual Memory complete.

- [ ] **Step 2: Run the complete verification gate**

```bash
npm test -- --run
npm run build
npm run lint
git diff --check
git status --short
```

Expected: every command exits 0; `git status` shows only the intended MVP status edit before the documentation commit.

- [ ] **Step 3: Audit spec coverage**

Confirm there is a passing test for each of these before committing:

- empty/already packed no-op;
- stable occupied-cell order;
- fragmented/repeated Task IDs;
- unique moved-Task cost;
- one- and multi-Tick execution;
- Memory unchanged before final work;
- atomic valid commit and non-mutating rejections;
- stale-plan re-planning and paid-ID retention;
- Compact before Allocate;
- non-waiting Rule-context Task accepted by Compact;
- Rule no-op same-phase continuation;
- cost-bearing completion suspension;
- single execution pivot;
- release during suspension;
- external-fragmentation rescue;
- failure diagnostics and committed-state preservation;
- unchanged Task identity/status/queue/`fragmentSizes`.

- [ ] **Step 4: Commit**

```bash
git add MVP.md
git commit -m "docs: mark compaction runtime complete"
```

---

## TDD Dependency Order

The required order is intentional:

1. AST makes Compact representable.
2. Pure policy proves what the result and cost must be without runtime mutation.
3. Memory proves the atomic storage boundary independently of policy.
4. Execution combines those two stable contracts and proves stale-plan accounting.
5. ActionExecutor adapts execution into the existing runtime API.
6. RuleExecutionSession proves generic frame semantics at the control-flow boundary.
7. SimulationEngine proves phase-order, release, pivot, and gameplay outcomes end to end.
8. Documentation changes only after the implementation verification gate passes.

Do not start with an engine integration test and implement downward. The stale-plan and atomicity failure cases are substantially easier to isolate at the policy/Memory/execution layers, while the engine tests should verify composition rather than duplicate every invariant.
