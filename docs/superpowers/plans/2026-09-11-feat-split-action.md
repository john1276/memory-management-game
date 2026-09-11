# Split Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the MVP v1.1 `feat/split-action` runtime: resumable expression execution with a single pivot, multi-fragment Split planning/cost, and fragmented allocation without introducing a bytecode VM.

**Architecture:** Keep the Rule Program / AST as the executable representation. A resumable tree-walk runtime uses explicit frames and advances through zero-cost syntax/reference nodes until it reaches one cost-bearing operation; one Simulation tick may execute at most one such cost-bearing step for the active rule pivot. Split resolves fragment expressions left-to-right in a local context, charges expression cost plus `fragmentCount - 1` physical cuts, commits the allocation shape only when the full plan succeeds, and leaves the Task waiting until a later Allocate action.

**Tech Stack:** TypeScript 6, Vitest 4, existing React/Vite project. No new runtime dependencies.

**Spec:** `MVP.md` v1.1 on `feat/split-action` (Revision date: 2026-09-11)

## Global Constraints

- Literal/reference reads and AST traversal cost 0 Tick.
- Arithmetic and supported Math calls cost 1 Tick each in the first implementation.
- MVP uses one active Execution Pivot; nested work is represented by explicit frames, not concurrent contexts.
- `Memory.*` references are not exposed in first-version Split; only the reference architecture is extensible.
- First-version Split expressions use `Task.Size`, `Split.Remaining`, numeric/boolean literals, `+ - * /`, and `Math.Min/Max/Floor/Ceil`.
- Split fragment expressions resolve left-to-right.
- Within one expression, `Split.Remaining` is a fixed snapshot; it changes only after a fragment is successfully resolved.
- A fragment result must be a finite positive integer and may not exceed the current remaining size.
- A successful Split must consume the entire Task size.
- Split planning is local/atomic: no Task allocation-shape mutation until the plan and physical cut work complete.
- Split does not Allocate; after completion the Task remains `waiting`.
- Physical Split cost is `fragmentCount - 1` ticks.
- Allocate remains a separate action and uses the Task's current allocation shape.
- Runtime failure halts; already committed Simulation State is not rolled back.
- Existing Condition representation remains unchanged in this branch.
- Do not add Parser, text DSL, compiler, bytecode VM, ECS, or `Memory.*` gameplay references.

---

## File Structure

Create:

- `src/simulation/expressions/Expression.ts` — Expression AST and RuntimeValue types.
- `src/simulation/expressions/ExpressionExecution.ts` — resumable explicit-frame expression machine.
- `src/simulation/expressions/ExpressionExecution.test.ts` — zero-cost reads, arithmetic/function cost, failure and snapshot tests.
- `src/simulation/actions/SplitExecution.ts` — left-to-right SplitPlan resolver plus physical-cut phase.
- `src/simulation/actions/SplitExecution.test.ts` — Split semantics/cost/atomicity tests.
- `src/simulation/rules/RuleExecutionSession.ts` — single-pivot resumable rule/statement/action frame machine.
- `src/simulation/rules/RuleExecutionSession.test.ts` — nested/ordered/stateful/suspend-resume tests.
- `src/simulation/rules/ProgramValidator.ts` — minimal static validation boundary required by v1.1.
- `src/simulation/rules/ProgramValidator.test.ts` — static call/known-type validation tests.

Modify:

- `src/simulation/rules/Rule.ts` — add `split` Action carrying Expression fragments.
- `src/domain/Task.ts` — add runtime allocation shape initialized to `[size]`.
- `src/domain/Memory.ts` — add atomic fragmented allocation.
- `src/domain/Memory.test.ts` — fragmented allocation success/failure/atomicity.
- `src/simulation/actions/ActionExecutor.ts` — add timed ActionExecution start/advance API while retaining concrete effect responsibility.
- `src/simulation/actions/ActionExecutor.test.ts` — Split preconditions and fragmented Allocate behavior.
- `src/simulation/SimulationEngine.ts` — hold one active RuleExecutionSession and hand Waiting Tasks to it in arrival order.
- `src/simulation/SimulationEngine.test.ts` — multi-tick Split, single-pivot handoff, failures, no head-of-line blocking for zero-cost/unhandled tasks.
- `src/simulation/SimulationState.ts` — only if a public execution snapshot is needed by tests/debug UI; do not store interpreter internals here by default.
- `MVP.md` — after implementation, update engineering-status checkboxes only; do not rewrite semantics.

---

### Task 1: Expression AST and resumable expression execution

**Files:**
- Create: `src/simulation/expressions/Expression.ts`
- Create: `src/simulation/expressions/ExpressionExecution.ts`
- Create: `src/simulation/expressions/ExpressionExecution.test.ts`

**Interfaces:**
- Produces:
  - `Expression`
  - `RuntimeValue`
  - `EvaluationContext`
  - `ExpressionExecution`
  - `createExpressionExecution(expression, context)`
  - `advanceExpressionExecution(execution)`
- `advanceExpressionExecution` traverses zero-cost nodes internally and consumes at most one cost-bearing operation per call.

Use these public types:

```ts
import type { TaskRuntime } from '../../domain/Task'

export type RuntimeValue =
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }

export type BinaryOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'

export type MathFunction =
  | 'min'
  | 'max'
  | 'floor'
  | 'ceil'

export type Expression =
  | {
      type: 'literal'
      value: number | boolean
    }
  | {
      type: 'reference'
      namespace: 'task'
      member: 'size'
    }
  | {
      type: 'reference'
      namespace: 'split'
      member: 'remaining'
    }
  | {
      type: 'binary'
      operator: BinaryOperator
      left: Expression
      right: Expression
    }
  | {
      type: 'call'
      namespace: 'math'
      function: MathFunction
      arguments: readonly Expression[]
    }

export interface EvaluationContext {
  readonly task: TaskRuntime
  readonly split?: {
    readonly remaining: number
  }
}
```

Use this step result:

```ts
export type ExecutionAdvanceResult<T> =
  | {
      status: 'progress'
      consumedTick: true
    }
  | {
      status: 'complete'
      consumedTick: boolean
      value: T
    }
  | {
      status: 'failure'
      consumedTick: boolean
      reason: string
    }
```

The implementation should use explicit continuation frames rather than recursion across ticks. A minimal internal frame model is:

```ts
type ExpressionFrame =
  | { type: 'visit'; expression: Expression }
  | { type: 'applyBinary'; operator: BinaryOperator }
  | {
      type: 'applyMath'
      function: MathFunction
      argumentCount: number
    }
```

`visit` of Literal/Reference pushes a value and continues without returning a tick. `applyBinary` and `applyMath` execute exactly one cost-bearing operation and return after that operation.

- [ ] **Step 1: Write failing tests for zero-cost Literal/Reference completion**

Add tests that:
- `{ type: 'literal', value: 3 }` completes with `{ type:'number', value:3 }` and `consumedTick:false`.
- `Task.Size` resolves to the runtime Task size with `consumedTick:false`.
- `Split.Remaining` resolves from the supplied Split context.
- `Split.Remaining` without Split context returns failure without consuming a tick.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- --run src/simulation/expressions/ExpressionExecution.test.ts
```

Expected: FAIL because the new expression modules do not exist.

- [ ] **Step 3: Implement Literal/Reference traversal and context snapshot**

`createExpressionExecution` must capture the current context values required by the expression. In particular, if the Split context has `remaining = 7`, repeated reads of `Split.Remaining` during that expression must keep reading 7 even if the outer Split resolver later changes its remaining value.

- [ ] **Step 4: Add failing tests for binary operators**

Test:
- `Task.Size / 2` with size 8: first advance returns `progress/consumedTick:true`; next advance returns complete Number(4) with `consumedTick:false`.
- division by zero returns Runtime Failure on the division step.
- nested `(Task.Size / 2) + 1` consumes two cost-bearing advances.

- [ ] **Step 5: Implement binary frame execution**

Binary visitation order must be deterministic: evaluate `left`, then `right`, then apply the operator. Literal/reference traversal itself does not yield.

- [ ] **Step 6: Add failing tests for Math calls**

Test:
- `Math.Floor(Task.Size / 2)` with size 7 consumes two ticks (`/`, then `floor`) and yields 3.
- `Math.Min(3, Split.Remaining)` consumes one tick and yields the correct number.
- incorrect Math arity produces failure rather than `undefined`/`NaN`.

- [ ] **Step 7: Implement Math call frames**

First-version behavior:

```ts
min(a, b)
max(a, b)
floor(value)
ceil(value)
```

All arguments must evaluate to Number RuntimeValues. A Boolean argument is a runtime type failure if it reaches execution.

- [ ] **Step 8: Run expression tests, then full test suite**

```bash
npm test -- --run src/simulation/expressions/ExpressionExecution.test.ts
npm test -- --run
npm run build
npm run lint
```

Expected: all existing tests remain green.

- [ ] **Step 9: Commit**

```bash
git add src/simulation/expressions
git commit -m "feat: add resumable expression runtime"
```

---

### Task 2: SplitPlan resolver and physical Split cost

**Files:**
- Create: `src/simulation/actions/SplitExecution.ts`
- Create: `src/simulation/actions/SplitExecution.test.ts`

**Interfaces:**
- Consumes: Task 1 Expression runtime.
- Produces:

```ts
export interface SplitPlan {
  readonly fragments: readonly number[]
}

export interface SplitExecution {
  // opaque mutable execution state; callers advance through exported functions
}

export function createSplitExecution(
  fragments: readonly Expression[],
  task: TaskRuntime
): SplitExecution

export function advanceSplitExecution(
  execution: SplitExecution
): ExecutionAdvanceResult<SplitPlan>
```

Rules:
- Each fragment expression receives an EvaluationContext with the same Task and the current Split `remaining`.
- An expression runs to completion before `remaining` changes.
- After successful expression completion, validate result, append fragment, subtract it from remaining, then create execution for the next fragment.
- After all fragment expressions resolve, require `remaining === 0`.
- Physical cut phase consumes exactly `fragments.length - 1` additional ticks.
- No Task mutation occurs in this module.

- [ ] **Step 1: Write failing tests for left-to-right zero-cost fragment resolution**

Example:

```ts
Task.Size = 8
fragments = [
  literal(3),
  Split.Remaining,
]
```

Expected plan `[3, 5]`, with one consumed tick total from the one physical cut and zero expression ticks.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- --run src/simulation/actions/SplitExecution.test.ts
```

- [ ] **Step 3: Implement local remaining/fragments state and physical cut phase**

Do not mutate `task`.

- [ ] **Step 4: Add failing test for a complex expression**

For size 10:

```text
[
  3,
  Math.Floor(Split.Remaining / 2),
  Split.Remaining
]
```

Expected fragments `[3,3,4]`.

Expected cost:
- division: 1 tick
- floor: 1 tick
- physical cuts: 2 ticks
- total: 4 consumed ticks

- [ ] **Step 5: Implement expression handoff while preserving Split.Remaining snapshot**

After the second expression resolves to 3, update remaining from 7 to 4 only before creating the third expression execution.

- [ ] **Step 6: Add failing validation tests**

Test each failure independently:
- Boolean fragment result.
- `0`.
- negative number.
- non-integer `2.5`.
- fragment larger than remaining.
- final remaining not zero.
- `NaN`/non-finite result if reachable through arithmetic.

Each failure must leave the Task unchanged.

- [ ] **Step 7: Implement validation**

Use clear failure strings containing the Task ID and the invalid resolved value/reason.

- [ ] **Step 8: Verify**

```bash
npm test -- --run src/simulation/actions/SplitExecution.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 9: Commit**

```bash
git add src/simulation/actions/SplitExecution.ts src/simulation/actions/SplitExecution.test.ts
git commit -m "feat: add split plan execution"
```

---

### Task 3: Task allocation shape and atomic fragmented Memory allocation

**Files:**
- Modify: `src/domain/Task.ts`
- Modify: `src/domain/Memory.ts`
- Modify: `src/domain/Memory.test.ts`
- Add/modify the existing Task tests if present.

**Interfaces:**
- `TaskRuntime` gains mutable runtime allocation shape:

```ts
fragmentSizes: number[]
```

`createTaskRuntime(definition)` initializes:

```ts
fragmentSizes: [definition.size]
```

- `Memory` gains:

```ts
allocateFragments(
  taskId: TaskId,
  fragmentSizes: readonly number[]
): boolean
```

Semantics:
- Every fragment is individually contiguous.
- Different fragments may occupy different holes.
- Placement is deterministic first-fit, fragment by fragment, in the provided order.
- Allocation is atomic: if every fragment cannot be placed, Memory stays unchanged.
- `release(taskId)` continues to release every cell owned by the Task across all fragments.

- [ ] **Step 1: Write failing Task runtime test**

Assert a new Task of size 6 starts with `fragmentSizes === [6]`.

- [ ] **Step 2: Implement TaskRuntime fragmentSizes**

Do not change TaskDefinition yet; fragment limit remains deferred.

- [ ] **Step 3: Write failing fragmented allocation test**

Construct:

```text
[B][B][ ][ ][C][C][ ][ ]
```

Then `allocateFragments('A', [2,2])` should produce:

```text
[B][B][A][A][C][C][A][A]
```

A contiguous size-4 allocation should not be required.

- [ ] **Step 4: Write failing atomic-failure test**

Use a layout where the first requested fragment fits but a later fragment does not. Assert:
- `allocateFragments` returns false.
- cell contents are exactly unchanged.

- [ ] **Step 5: Implement atomic first-fit fragmented allocation**

Use a copy of the cells (or compute every placement against a temporary array) and assign back only after all fragments succeed.

Reject empty arrays, non-positive fragment sizes, and invalid sizes by returning false.

- [ ] **Step 6: Verify release across fragments**

Allocate `[2,2]`, then `release('A')`; assert all four A cells become null and the returned release count is 4.

- [ ] **Step 7: Verify**

```bash
npm test -- --run src/domain/Memory.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/domain/Task.ts src/domain/Memory.ts src/domain/Memory.test.ts
git commit -m "feat: support fragmented task allocation"
```

---

### Task 4: Split Action AST and timed Action execution

**Files:**
- Modify: `src/simulation/rules/Rule.ts`
- Modify: `src/simulation/actions/ActionExecutor.ts`
- Modify: `src/simulation/actions/ActionExecutor.test.ts`

**Interfaces:**
- Extend Action:

```ts
export type Action =
  | { type: 'allocate' }
  | {
      type: 'split'
      fragments: readonly Expression[]
    }
```

- Keep `executeAction(...)` as the concrete immediate effect helper for existing Allocate behavior during this migration.
- Add a resumable Action execution API:

```ts
export type ActionExecution =
  | {
      type: 'allocate'
      action: Extract<Action, { type: 'allocate' }>
      started: boolean
    }
  | {
      type: 'split'
      action: Extract<Action, { type: 'split' }>
      split: SplitExecution
    }

export function createActionExecution(
  action: Action,
  task: TaskRuntime
): ActionExecutionResult

export function advanceActionExecution(
  execution: ActionExecution,
  state: SimulationState,
  task: TaskRuntime
): ExecutionAdvanceResult<void>
```

First-version Action timing:
- Allocate action effect consumes 1 tick.
- Split has no additional call-base tick; its expression steps and physical cuts are its cost.
- When Split execution completes, commit `task.fragmentSizes = [...plan.fragments]` and leave status `waiting`.

Preconditions for creating Split execution:
- task is `waiting`.
- `task.definition.splittable === true`.

- [ ] **Step 1: Add failing tests for Split Action construction**

Verify unsplittable/non-waiting Tasks fail before changing state.

- [ ] **Step 2: Add failing test that a valid Split stays local until completion**

Before the final consumed Split step, `task.fragmentSizes` remains `[task.size]`.

After completion, it becomes the resolved fragments and Task remains `waiting`/still in queue.

- [ ] **Step 3: Implement Split action execution delegation**

Delegate plan/cost mechanics to `SplitExecution`; do not duplicate expression logic in ActionExecutor.

- [ ] **Step 4: Add failing fragmented Allocate test**

Give a waiting Task `fragmentSizes = [2,2]` and fragmented free holes. Allocate should:
- consume its action tick under the resumable API,
- call `Memory.allocateFragments`,
- set status `processing`,
- remove the Task from the queue.

- [ ] **Step 5: Update Allocate effect to use fragmentSizes**

Single-fragment `[size]` remains behavior-compatible with old contiguous allocation.

- [ ] **Step 6: Verify**

```bash
npm test -- --run src/simulation/actions/ActionExecutor.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/simulation/rules/Rule.ts src/simulation/actions/ActionExecutor.ts src/simulation/actions/ActionExecutor.test.ts
git commit -m "feat: add timed split action execution"
```

---

### Task 5: Single-pivot resumable Rule execution session

**Files:**
- Create: `src/simulation/rules/RuleExecutionSession.ts`
- Create: `src/simulation/rules/RuleExecutionSession.test.ts`
- Modify: `src/simulation/rules/RuleInterpreter.ts` only to keep a compatibility helper or shared Condition evaluation; do not retain two independent semantics.

**Interfaces:**

```ts
export interface RuleExecutionSession {
  readonly taskId: TaskId
  // internal frame stack/current rule data remains encapsulated
}

export type RuleAdvanceResult =
  | {
      status: 'progress'
      consumedTick: true
    }
  | {
      status: 'complete'
      consumedTick: boolean
    }
  | {
      status: 'failure'
      consumedTick: boolean
      ruleId: string
      taskId: TaskId
      action?: Action['type']
      reason: string
    }

export function createRuleExecutionSession(
  program: RuleProgram,
  event: SimulationEvent,
  state: SimulationState
): RuleExecutionSession | RuleExecutionFailure

export function advanceRuleExecutionSession(
  session: RuleExecutionSession,
  state: SimulationState
): RuleAdvanceResult
```

Use explicit frames:

```ts
type RuleFrame =
  | {
      type: 'statements'
      ruleId: string
      statements: readonly Statement[]
      index: number
    }
  | {
      type: 'action'
      ruleId: string
      execution: ActionExecution
    }
```

Rules:
- Matching Rules remain ordered.
- IF/ELSE and existing Condition evaluation are zero-cost in this branch.
- A nested branch pushes a `statements` frame and returns to the parent index afterward.
- Encountering an Action creates/pushes an Action frame.
- `advance...` loops through free traversal until:
  - one cost-bearing Action/Expression/physical-cut step is consumed,
  - execution completes,
  - or failure occurs.
- There is exactly one current pivot represented by the top frame.

- [ ] **Step 1: Write failing test for a zero-cost rule**

A Rule whose condition is false and has no executed Action should complete in one `advance...` call with `consumedTick:false`.

- [ ] **Step 2: Write failing test for Allocate suspension**

A Rule containing Allocate should require one `advance...` call that reports a consumed tick and applies allocation. If the action also completes on that tick, the next advance (or the same result if encoded as complete+consumedTick) must leave the session correctly positioned after the Action.

- [ ] **Step 3: Implement ordered Statement frames**

Preserve current DFS semantics from `RuleInterpreter.ts`.

- [ ] **Step 4: Write failing test for Split across several advances**

Use:

```text
Task.Split([
  Math.Floor(Task.Size / 2),
  Split.Remaining
])
```

For size 7:
- `/`: tick 1
- `floor`: tick 2
- physical cut: tick 3
- only after the final Split step does Task shape become `[3,4]`
- the next Rule statement executes after Split completion.

- [ ] **Step 5: Implement Action-frame suspension/resume**

Do not restart the Split expression on each call.

- [ ] **Step 6: Preserve stateful behavior test**

A Rule that performs one completed Action and then reaches a later Condition must observe the updated Simulation State.

- [ ] **Step 7: Preserve no-rollback failure test**

If an earlier committed Action succeeds and a later Action fails, the earlier state remains.

- [ ] **Step 8: Verify**

```bash
npm test -- --run src/simulation/rules/RuleExecutionSession.test.ts
npm test -- --run src/simulation/rules/RuleInterpreter.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 9: Commit**

```bash
git add src/simulation/rules
git commit -m "feat: add resumable rule execution session"
```

---

### Task 6: SimulationEngine single-pivot integration and Waiting handoff

**Files:**
- Modify: `src/simulation/SimulationEngine.ts`
- Modify: `src/simulation/SimulationEngine.test.ts`
- Modify: `src/simulation/SimulationState.ts` only if a read-only debug snapshot is required; otherwise keep execution internals private to the engine.

**Interfaces/behavior:**
- `SimulationEngine` holds at most one active `RuleExecutionSession`.
- `runTick()` still advances world time exactly once.
- During the Rule Runtime phase:
  1. If an active session exists, advance only that session until it either consumes one cost-bearing step, completes, or fails.
  2. If no active session exists, scan Waiting Task IDs in arrival order.
  3. Start a session for the first eligible waiting candidate.
  4. If that session completes without consuming a tick and the Task remains waiting, continue to the next candidate in the same Rule phase.
  5. Stop the Rule phase after one cost-bearing rule step is consumed.
  6. If a session remains suspended, keep it as the single pivot for the next Simulation tick.
- This preserves “A unhandled does not block B” while ensuring an actively executing multi-tick Split owns the pivot until its current Rule execution finishes.

- [ ] **Step 1: Write failing test that zero-cost/unhandled A does not block B**

A has no applicable Action; B's Rule Allocate is reached in the same Rule phase and consumes that tick.

- [ ] **Step 2: Write failing multi-tick Split integration test**

Assert the Task shape changes only after the expected expression + physical cut ticks.

- [ ] **Step 3: Implement active RuleExecutionSession ownership**

Replace the current `processWaitingTasks()` whole-program call with session creation/advancement.

- [ ] **Step 4: Write failing test that the pivot stays on a running Split**

While A's Rule is suspended inside Split, B must not obtain the pivot until A's current Rule execution yields completion/failure.

- [ ] **Step 5: Implement Waiting candidate handoff**

Do not mutate Waiting List ordering. Do not auto-Allocate.

- [ ] **Step 6: Write failure integration test**

An invalid Split fragment should:
- halt the engine,
- record tick/task/rule/action,
- preserve earlier committed state,
- leave uncommitted Split shape unchanged.

- [ ] **Step 7: Verify old lifecycle tests**

```bash
npm test -- --run src/simulation/SimulationEngine.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/simulation/SimulationEngine.ts src/simulation/SimulationEngine.test.ts src/simulation/SimulationState.ts
git commit -m "feat: integrate single-pivot rule runtime"
```

---

### Task 7: Minimal Program Validator boundary

**Files:**
- Create: `src/simulation/rules/ProgramValidator.ts`
- Create: `src/simulation/rules/ProgramValidator.test.ts`

**Interfaces:**

```ts
export interface ProgramValidationError {
  readonly ruleId: string
  readonly message: string
}

export function validateRuleProgram(
  program: RuleProgram
): readonly ProgramValidationError[]
```

First-version static checks:
- Math arity:
  - Min/Max: exactly 2.
  - Floor/Ceil: exactly 1.
- A Split fragment that is statically a Boolean literal is invalid before Run.
- Unsupported AST variants are prevented by TypeScript and need no runtime registry.
- `Split.Remaining` is legal inside Split fragment expressions; there are no other Expression-bearing contexts in this branch, so no broader scope traversal is required yet.

Do not build a general type checker in this task.

- [ ] **Step 1: Write failing validator tests**

Include invalid `Math.Floor(1, 2)` and `Task.Split([true, Split.Remaining])`.

- [ ] **Step 2: Implement minimal recursive expression validation**

Return all validation errors rather than throwing on the first one.

- [ ] **Step 3: Add valid complex Split test**

Ensure the v1.1 example validates:

```text
Task.Split([
  3,
  Math.Floor(Split.Remaining / 2),
  Split.Remaining
])
```

- [ ] **Step 4: Verify**

```bash
npm test -- --run src/simulation/rules/ProgramValidator.test.ts
npm test -- --run
npm run build
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/simulation/rules/ProgramValidator.ts src/simulation/rules/ProgramValidator.test.ts
git commit -m "feat: validate split expressions"
```

---

### Task 8: End-to-end Split scenario and status documentation

**Files:**
- Modify: the most appropriate existing integration test file, or create `src/simulation/SplitIntegration.test.ts` if keeping it focused is clearer.
- Modify: `MVP.md` engineering-status checkboxes only.

**Scenario:**
Use a fixed Memory/Waiting/Rule setup that demonstrates:
1. A Task cannot fit contiguously.
2. Its Split Rule resolves multiple fragments.
3. Expression/function convenience costs observable ticks.
4. Split completes but Task remains Waiting.
5. A later Allocate uses the fragmented shape and succeeds.
6. Processing completion releases every fragment.

Example shape target:

```text
Memory before A allocation:
[B][B][ ][ ][C][C][ ][ ]

A.size = 4
A.fragmentSizes after Split = [2,2]

After Allocate:
[B][B][A][A][C][C][A][A]
```

- [ ] **Step 1: Write the end-to-end failing test**

Drive the engine using `runTick()` and assert observable state at each meaningful tick boundary.

- [ ] **Step 2: Fix only integration defects exposed by the test**

Do not add unrelated new primitives.

- [ ] **Step 3: Run complete verification**

```bash
npm test -- --run
npm run build
npm run lint
```

Expected: all pass.

- [ ] **Step 4: Update MVP engineering status**

Mark only features that are actually implemented/tested:
- Expression AST / RuntimeValue.
- single-pivot Execution Cursor / Frames.
- zero-cost vs cost-bearing execution.
- SplitPlan.
- Split Runtime Action.
- fragmented allocation.

Do not mark GameController, Compaction, Rule Editor UI, or Score balancing complete.

- [ ] **Step 5: Commit**

```bash
git add src MVP.md
git commit -m "test: cover split action end to end"
```

---

## Plan Self-Review

**Spec coverage**
- Expression AST / RuntimeValue: Task 1.
- `Task.Size` / `Split.Remaining` and no first-version `Memory.*`: Task 1.
- Zero-cost references/literals and cost-bearing operations: Tasks 1, 5, 6.
- Left-to-right Split resolution and atomic local plan: Task 2.
- Multi-fragment cost `N - 1`: Task 2.
- Task allocation shape / same logical Task: Task 3.
- Split is separate from Allocate: Tasks 4, 8.
- Single pivot / nested frames / suspend-resume: Tasks 5, 6.
- Waiting arrival-order handoff without strict head-of-line blocking for unhandled work: Task 6.
- Runtime failure/no rollback: Tasks 2, 5, 6.
- Minimal Validator: Task 7.
- No compiler/VM/parser/ECS: Global Constraints.

**Deliberately deferred**
- Fragment-count field (`maxFragments` / `fragmentLimit`).
- `Memory.*` gameplay references.
- Multiple independent execution contexts / scheduler.
- `break` semantics.
- GameController UI controls.
- Compaction implementation.
- Final action/function tick balancing beyond the first deterministic cost table.
