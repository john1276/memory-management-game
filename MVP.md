# MVP Specification

> Version: v1.1
>
> Revision date: 2026-09-11
>
> Base: `simulation-core/MVP.md`
>
> 本次修訂重點：更新 Rule Runtime / Tick 語意、加入 Expression Runtime、重新定義 Split、補上 GameController 執行控制；並確認 Runtime 採單一 Execution Pivot + 巢狀 Frame Stack，第一版 Split 不開放 `Memory.*` Reference。

---

## 1. MVP Goal

本 MVP 的目標不是一次決定遊戲的最終方向，而是建立一個可玩的 Prototype，用來驗證以下核心問題：

> 「讓玩家透過組裝規則，自動管理有限記憶體資源」這件事本身是否好玩？

MVP 先採固定 Workload、固定規則環境與單一 Prototype 情境。
未來是否發展成更偏向 Puzzle、Automation、OS Simulation，或其他形式，應在 MVP 實際遊玩與測試後再決定。

---

## 2. Core Gameplay Loop

核心循環：

1. 玩家觀察目前 Memory、Waiting List、Current Request 與未來兩個 Request。
2. 玩家使用結構化／方塊化 Rule Editor 組裝處理規則。
3. 玩家開始執行。
4. 系統依 Tick 推進 Simulation 與 Rule Runtime。
5. Rule Runtime 依目前執行位置逐步解讀 Rule Program / Expression AST；免費的語法 traversal、Literal 與 Reference 讀取不額外消耗 Tick，有實際計算或效果的步驟依 Cost Model 消耗 Tick。
6. Action Executor 將 Action 套用到目前 Runtime；若 Action 或 Expression 在當前狀態下無法合法執行，則產生 Runtime Failure。
7. 執行期間玩家不能修改 Rule。
8. 若玩家想修改 Rule，必須 Stop / Reset，再重新執行。
9. 若完整跑完 Workload，且所有必要 Task 均完成、Failure = 0，則成功完成。
10. 成功後依 Task 處理品質計算 Score，鼓勵玩家最佳化解法。

概念上接近：

> Design → Run → Observe → Fail / Complete → Reset → Improve

MVP 的核心決策空間不是 Queue Scheduling，而是：

> 玩家如何透過 Rule 有效利用有限的 Memory Arena，並在規則泛用性、執行時間與配置品質之間取捨。

---

## 3. Memory Model

### 3.1 Logical Model

MVP 採用一維連續 Memory。

例如：

```text
0  1  2  3  4  5  6  7
[A][A][ ][B][B][ ][C][ ]
```

Memory 具有固定容量。

MVP 的 Memory 應理解為：

> 玩家目前負責管理的一個有限 Memory Arena / Physical-Memory-like Resource Pool。

它不是在宣稱「整台電腦只有這幾格記憶體」，也不是要在 MVP 階段完整模擬整個 OS Memory Subsystem。

### 3.2 Task Lifecycle and Memory Residency

Task 的生命週期與 Memory Residency 應保持分離。

MVP 使用較中性的 Runtime Lifecycle：

```text
Waiting
→ Processing
→ Completed
```

其中 Task 是否實際佔用 Memory，由 Memory / Allocation State 描述。

此分離是為了避免把目前的 Contiguous Allocation Model 寫死成永久架構。

未來若加入 Paging / Virtual Memory，可在 Task 與 Physical Memory 之間增加：

```text
Virtual Address Space
Page
Frame
Page Table
Swap
```

而不需要推翻 Task 本身的生命週期模型。

### 3.3 Visual Representation

UI 可以將一維 Memory 排成矩形，但底層仍然是一維連續 Memory，不採真正的 2D 配置演算法。

---

## 4. Task / Request Model

Task 必須採可擴充資料結構。

MVP 至少需要支援：

```text
id
size
duration
splittable
score-related properties
```

Runtime Task 另外需要保存模擬狀態，例如：

```text
status
remainingDuration
waitingTicks
fragment / allocation shape
```

Split 後仍然是同一個 Task，不建立 `A1`、`A2` 等獨立 Task。

### 4.1 Arrival Is an Event, Not a Persistent Status

`Incoming` 應視為 Request / Event 的概念，而不是 Task 長時間停留的 Runtime Status。

```text
Workload Generates Task
        ↓
Request Arrives
        ↓
Waiting
        ↓
Allocate / Begin Processing
        ↓
Processing
        ↓
Completed
```

Task 一旦由 Workload 生成，就已經是 Runtime Task；若尚未取得 Memory，則進入 Waiting List。

### 4.2 Extensibility

未來可擴充：

```text
priority
deadline
maxWait
type
movable
special constraints
resource requirements
other OS / scheduling concepts
```

Task 可允許多少 Fragment 的精確欄位形式（例如 `maxFragments` / `fragmentLimit`）尚未鎖死，列入 Prototype / Implementation Tuning。

---

## 5. Workload

MVP 使用固定 Workload。

```text
Tick 0 → Task A
Tick 1 → Task B
Tick 2 → Task C
...
```

每次 Reset 後 Workload 完全一致。

固定情境方便除錯、觀察、最佳化與比較不同 Rule Set，並可刻意設計 Fragmentation、Split、Compaction、Waiting 等問題。

Workload 定義尚未發生的 Task 輸入；它不是 Runtime Waiting List。

### 5.1 Preview

玩家可看到：

```text
Current Request
Next Request
Next + 1 Request
```

即：

> Current + Next 2

此 Preview 與已經生成的 Runtime Waiting Task 是不同概念。

---

## 6. Tick System

系統具有自己的離散 Tick。

MVP 的 Tick 不應理解為「每移動一次 AST Cursor 就扣一個 Tick」。

核心原則：

> Tick measures meaningful computation or world-changing work, not syntax traversal.

### 6.1 Zero-Cost Runtime Traversal

下列行為本身不額外消耗 Tick：

- AST / Statement 的單純 traversal。
- Literal 讀取。
- Reference 讀取，例如 `Task.Size`、`Split.Remaining`。
- Execution Cursor 在免費節點之間移動。

### 6.2 Cost-Bearing Execution Step

真正具有計算或 Runtime 效果的節點，依 Cost Model 消耗 Tick，例如：

```text
+
-
*
/
Math.Min(...)
Math.Max(...)
Math.Floor(...)
Math.Ceil(...)
Action Call
```

不同 Function / Action 未來可以有不同成本。

因此玩家使用較方便、較泛用但較複雜的 Expression / Function 時，需要付出執行時間的 Trade-off。

### 6.3 Simulation Phase Direction

高階 Simulation 仍包含：

1. Processing Task / Active Runtime Work 推進。
2. Workload Arrival。
3. Waiting Task / Rule Runtime 推進。
4. Waiting Metrics / State Validation。

Rule Runtime 可在某個 cost-bearing execution point 後暫停，並於後續 Tick 從保存的執行位置繼續。

MVP Runtime 同一時間只有一個 Execution Pivot。Pivot 可進入巢狀 Statement / Expression / Function / Action Frame，完成後回到上一層繼續；MVP 不處理多個獨立 Execution Context 並行推進。

---

## 7. Waiting List

MVP Runtime 需要 Waiting List，用來保存：

> 已經由 Workload 生成，但尚未取得 Memory、仍等待 Rule 處理的 Task。

Waiting List 保留 Arrival Order，但不採嚴格 Head-of-Line Blocking。

例如：

```text
Waiting:
A size=5
B size=2
```

若目前 Memory 無法處理 A，但能處理 B：

```text
scan A → remains waiting
scan B → Rule may process B
```

玩家不能任意重新排序 Waiting List。

當 Runtime 準備處理下一個 Waiting Task 時，MVP 預設依 Arrival Order 選擇下一個候選 Task，再交由該 Task 的 Rule 決定是否以及如何處理。

這不等同於自動 Allocate，也不表示前面的 Waiting Task 會阻塞後面的 Task。

MVP 追蹤：

```text
waitingTicks
```

Waiting Penalty 可參與 Score。

現有程式中的 `TaskQueue` 可暫時保留作為底層容器，改名 `WaitingList` 不應阻擋目前開發。

---

## 8. Rule System

MVP 不使用文字 DSL。

使用：

> 結構化／方塊化 Rule Editor

Rule Editor 是玩家操作的 UI；底層保存純資料形式的 Rule Program / AST。

MVP 由 Rule Editor 直接建立 Rule Program，不需要 Parser。

### 8.1 Trigger / Structural Blocks

Rule Runtime 的主要 MVP Context 為：

```text
WHEN [Task Waiting]
```

每個 Waiting Task 會建立對應 Rule Execution Context。

`Request Arrives` 可保留為未來 Event / Trigger。

### 8.2 Conditional Blocks

例如：

```text
IF [Size > 3]
IF [Splittable == True]
IF [Free Space < 4]
ELSE
...
```

既有 Condition Model 暫不因 Split Expression System 而整批重寫；後續若有實際需求，再評估是否統一成一般 Expression / Boolean Expression。

### 8.3 Action Blocks

例如：

```text
Allocate
Split
Compact
...
```

Action 是 Rule Program 要求 Runtime 執行的操作。

Action Call 必須具有 Runtime Cost；精確成本由 Cost Model / Action semantics 決定。

---

## 9. Rule Runtime / Execution Semantics

Rule System 採：

> Ordered / Stateful / Depth-First / Resumable AST Execution

它不是 First-Match，也不是先收集全部 Action 再一次執行。

### 9.1 Ordered / Stateful

Rule 依玩家排列順序執行。

Condition 在實際執行到該位置時讀取當時的 Runtime State。

已經完成並 commit 的前一個 Action，會影響之後 Condition / Action 所看到的狀態。

### 9.2 Depth-First

IF / ELSE 採一般程式控制流程語意。

```text
IF condition
    statements
ELSE
    statements
```

進入 Branch 後 Depth-First 執行；完成後回到上一層繼續下一個 Statement。

### 9.3 Execution Cursor / Frame

Runtime 必須能保存「目前執行到哪裡」。

概念上：

```text
Rule Program AST
      ↓
Execution Cursor
      ↓
Execution Frame Stack
```

當執行進入巢狀 Statement、Expression、Function Call 或 Action 時，Cursor 會進入對應子節點 / Frame；完成後回到上一層繼續。

MVP 同一時間只有一個 Execution Pivot。Frame Stack 保存「完成目前節點後要回到哪裡」，而不是代表多個 Context 同時執行。

因此 Pivot 可以在多層 Function / Expression / Action 之間 jump / return，但 Runtime 仍維持單一目前執行位置。

此模型先採可暫停的 Tree-walk Interpreter / Abstract Machine。

MVP 不需要先做：

```text
Compiler
Bytecode
Operand Stack VM
```

若未來 instruction-level execution 本身成為更深的 Gameplay，才評估加入 Compiler / Bytecode VM。

### 9.4 Action Execution

Rule Interpreter 負責：

- WHEN / IF / ELSE 控制流程。
- Statement / Expression 的執行位置。
- 保存可 Resume 的 Execution Context。

Action Executor 負責：

- Action 在目前 Runtime State 下是否合法。
- 建立 / 推進 Action 所需要的 Runtime Work。
- Action effect 完成時修改 Simulation State。

Action Executor 不負責玩家 Rule 的控制流程。

### 9.5 Rule Validity vs Runtime Failure

Rule 結構合法不代表實際執行一定成功。

能在 Run 前確認的錯誤應由 Program Validator 阻止，例如：

- 不存在的 Action / Function。
- 明顯的結構錯誤。
- Context-sensitive Reference 出現在不合法的 Scope。
- 靜態即可確認的型別錯誤。

只有 Runtime 才能確認的問題，在執行到該節點時產生 Runtime Failure。

Failure 發生時立即 Halt。

系統不 Rollback 已經 commit 的 Runtime State；但 Expression / SplitPlan 尚未 commit 的 local evaluation state 不算 Simulation State，不需要 rollback。

---

## 10. Expression Runtime

Split 為 MVP 第一個真正使用一般 Expression AST 的 Action。

Expression 應為純資料結構，至少可表示：

```text
Literal
Reference
Binary Expression
Function Call
```

概念上：

```text
Expression
   ↓
Evaluator / Runtime Execution
   ↓
RuntimeValue
```

RuntimeValue 與 Expression AST 分離。

MVP Split 需要的 RuntimeValue 至少包含：

```text
Number
Boolean（供未來共用；Split 本身不接受 Boolean fragment size）
```

### 10.1 Namespaces / References

MVP 至少需要：

```text
Task.Size
Split.Remaining
```

Math 類 Function 例如：

```text
Math.Min(...)
Math.Max(...)
Math.Floor(...)
Math.Ceil(...)
```

未來可擴充：

```text
Memory.*
Task.WaitingTicks
其他 Runtime Reference
```

`Memory.*` 表示 Memory namespace 下的 Runtime Reference，例如未來可能出現的 `Memory.FreeSpace`、`Memory.LargestFreeBlock`；它不是 C / C++ 的 pointer dereference 語法。

第一版 Split 不開放 `Memory.*`。Expression AST / Reference Model 只需預留 namespace 擴充能力。

### 10.2 Context-sensitive Reference

`Split.Remaining` 是 Expression Reference，不是 Split Parser 的特殊 token。

它屬於 Split Evaluation Context：

```text
Task.Split([
    3,
    Split.Remaining
])
```

合法。

若 `Split.Remaining` 出現在沒有 Split Context 的位置，則 Program Validator 應視為非法 Scope。

### 10.3 Expression Cost

Literal / Reference 本身為 zero-cost。

Arithmetic / Math Function / 其他真正執行計算的節點依 Cost Model 收費。

精確成本可在 Prototype Tuning 調整，但「便利 Function 可能換取額外 Runtime Cost」是核心設計方向。

---

## 11. Editing / Runtime Control

Run 開始後：

> 玩家不能修改 Rule。

執行控制由 Simulation Engine 上層的 Game Controller 負責。

至少支援：

```text
Run
Pause
Resume
Step
Stop / Reset
```

Pause / Resume 不應修改 Simulation State；它只決定是否繼續要求 Simulation Engine 推進。

`Step` 概念上只推進一個 Simulation Tick。

在該 Tick 內，Execution Cursor 可以免費穿過 zero-cost AST nodes，直到完成本 Tick 對應的 cost-bearing execution work。

若要修改 Rule：

```text
Stop / Reset
→ Edit
→ Run Again
```

不允許在即將 Failure 時 Pause、修改 Rule 後原地繼續。

---

## 12. Failure

MVP 採嚴格 Failure Model。

任何 Runtime Action、Expression 或 Runtime State 進入不可接受狀態時，都可造成：

```text
FAILURE
→ SYSTEM HALT
```

例如：

```text
Allocate 時沒有合法空間
對不能 Split 的 Task 執行 Split
Split fragment expression 得到非法型別
Split fragment size <= 0
Split fragment size 非整數
Split fragment 超過 Split.Remaining
Split 最後未完整覆蓋 Task.Size
前一 Action 已改變 State，導致後續節點非法
```

Failure 不只是懲罰，也是 Debug Feedback。

Log / Debug View 應能指出：

- Tick
- Task
- Rule / Action
- 目前 Execution Node / Expression（若可取得）
- Failure 原因

---

## 13. Split

Split 為 MVP 核心 Action。

### 13.1 Semantics

Split 不會順便 Allocate。

它只改變 Task 的 allocation shape。

完成後 Task 仍屬於 Waiting 狀態，之後必須由 Rule 再執行 Allocate，才真正配置進 Memory。

例如：

```text
Task.Size = 8

Task.Split([
    3,
    2,
    Split.Remaining
])
```

最後可得到：

```text
[3, 2, 3]
```

Split 後仍然是同一個 Task。

### 13.2 Multi-fragment Split

Split 一次可以指定最終 Fragment List，而不是只能固定切成兩半。

Fragment 數量的 Task-specific 上限形式尚未鎖死；MVP 必須保留限制能力，避免無限制 Fragmentation。

### 13.3 Left-to-right Evaluation

Fragment Expressions 由左至右 resolve。

`Split.Remaining` 表示：

> 目前這次 Split 中，前面已成功 resolve 的 fragment 扣除後，尚未被分配的 Task size。

例如：

```text
Task.Size = 10

Task.Split([
    3,
    Math.Floor(Split.Remaining / 2),
    Split.Remaining
])
```

概念流程：

```text
remaining = 10

3
→ fragment 3
→ remaining = 7

Math.Floor(7 / 2)
→ fragment 3
→ remaining = 4

Split.Remaining
→ fragment 4
→ remaining = 0

Result = [3, 3, 4]
```

同一個 Expression 求值期間看到的 `Split.Remaining` 應保持一致；只有一個 fragment 完整 resolve 成功後，才更新下一個 fragment 的 Remaining。

### 13.4 SplitPlan Validation

Split 在實際修改 Task 前，先於 local Split Evaluation Context 中建立完整 SplitPlan。

每個 fragment 最終必須：

```text
RuntimeValue.type == Number
finite
integer
> 0
<= current Split.Remaining
```

全部 fragment 完成後：

```text
Split.Remaining == 0
```

否則 Runtime Failure。

SplitPlan 尚未完整合法前，不修改 Task 的 fragment / allocation state。

### 13.5 Split Runtime Cost

原先「Split 固定 1 Tick」的設計取消。

Split 成本由兩部分組成：

```text
Split Cost
=
Expression Execution Cost
+
Physical Split Cost
```

其中：

```text
Physical Split Cost = fragmentCount - 1
```

也就是切成 N 個 Fragment，需要 N - 1 次切割工作。

例如：

```text
Task.Split([
    2,
    3,
    Split.Remaining
])
```

若所有 fragment expression 都只有 zero-cost Literal / Reference：

```text
Expression Cost = 0
Physical Split Cost = 3 - 1 = 2
Total = 2 Ticks
```

若使用：

```text
Math.Floor(Task.Size / 2)
```

則 `/`、`Math.Floor` 等 cost-bearing execution node 另外增加 Runtime Cost。

Split 在其 Execution / Split Context 內逐步執行；若中途遇到非法節點或非法結果，立即 Failure / Halt。

---

## 14. Compaction

Compaction 用於處理 External Fragmentation。

MVP 使用固定、簡化的 Dummy Compaction Algorithm。

### 14.1 Compaction Cost

Compaction 的 Tick Cost 由：

> 實際移動了多少個 Task

決定。

例如：

- A 沒移動
- B 移動
- C 移動

則：

```text
Compaction Cost = 2 Ticks
```

未來 Compaction 也應遵守相同的 Runtime 原則：Action / Function 的便利性應具有可觀察的時間成本，而不是免費立即完成。

---

## 15. Win Condition

MVP 勝利條件保持簡單：

> 完整跑完整個固定 Workload，所有必要 Task 完成，且 Failure = 0。

---

## 16. Score System

Score 與 Win Condition 分離。

### Layer 1 — Survival

先做到：

> 不 Failure，完整完成 Workload。

### Layer 2 — Optimization

完成後依處理品質計算 Score。

可能的評分項目：

```text
Base Completion
Task Difficulty
Special Constraint Bonus
Fast Handling Bonus
Waiting Penalty
Split Penalty
Compaction / Movement Cost
Execution Time / Tick Cost
Optional Requirement Penalty
Other Task-specific Penalties
```

具體權重屬於 Prototype Balancing，不在核心 MVP Engine Spec 中鎖死。

---

## 17. Prototype / First Workload Design

第一個 Prototype Workload 應刻意包含：

1. Fragmentation 問題。
2. Split 可以解決問題的情境。
3. 至少一個「切法不同會造成不同配置結果」的情境。
4. Compaction 可以救場，但不一定是最佳解的情境。
5. Waiting Task 存在，且後到 Task 有機會在前一 Task 仍 Waiting 時被處理。
6. 一個看似合理、但在後期會 Runtime Failure 的 Naive Strategy。
7. 至少一個穩定通關解。
8. 能讓玩家感受到「Rule 泛用性 / Function 便利性 vs Tick Cost」的最佳化空間。

Prototype 的目的不是設計「完美第一關」，而是測試：

> 這個核心玩法到底哪一部分最好玩？

---

## 18. UI Direction

暫定 UI：

```text
┌──────────────┬────────────────────┬──────────────┐
│ Upcoming     │                    │ Rule Editor  │
│ Current      │       Memory       │              │
│ Next         │                    │ WHEN ...     │
│ Next + 1     │   [ ][ ][ ][ ]     │ IF ...       │
│              │   [ ][ ][ ][ ]     │ DO ...       │
│ Waiting      │                    │              │
│ [A][B][C]    │                    │              │
├──────────────┴────────────────────┴──────────────┤
│ Run / Pause / Step / Tick / Log / Failure / Score│
└─────────────────────────────────────────────────┘
```

UI 應明確區分 Upcoming / Workload Preview 與 Runtime Waiting List。

未來 Debug View 可顯示目前 Execution Cursor 所在的 Rule / Expression Node，但第一版 UI 的詳細呈現方式尚未鎖死。

---

## 19. MVP Engineering Principles

### 19.1 Extensible, but Not Overengineered

核心資料結構、Rule Program、Expression AST 與 Runtime boundary 應可擴充。

但 MVP 不提前建立通用遊戲引擎、ECS、Bytecode VM 或其他未被 Gameplay 驗證的系統。

### 19.2 Future Work Is Not MVP

想到的新概念若不影響目前 Prototype：

> 放入 Future Work，不直接加入 MVP。

### 19.3 Gameplay First

MVP 最重要的產出不是完整 OS Simulation，也不是完整 Compiler / VM，而是回答：

> 「這個玩法值得繼續做嗎？」

### 19.4 Runtime Responsibility Boundary

目前責任方向：

```text
Rule Editor
→ Rule Program / AST
→ Program Validator
→ Rule Interpreter / Execution Context
→ Expression Runtime
→ Action Executor
→ Simulation State
```

Simulation Engine 負責 deterministic Tick / World progression。

Game Controller 位於 Simulation Engine 上層，負責：

```text
Run
Pause
Resume
Step
Reset
Tick scheduling / playback speed
```

Simulation Engine 不應依賴 UI 的 Pause / Resume 狀態。

### 19.5 No Compiler Yet

MVP 採可暫停的 AST Interpreter / Abstract Machine。

只要 AST 保持純資料，就可在未來需要時加入：

```text
AST
→ Semantic Analysis
→ IR / Bytecode Compiler
→ VM
```

但目前不因「看起來像編譯器」而提前實作 Compiler / VM。

---

## 20. Out of Scope / Future Work

可能的未來方向：

- Priority
- Deadline / Max Wait
- Priority Queue / Custom Scheduler
- 更多 WHEN Events
- 更多 IF Conditions
- Condition 統一成一般 Boolean Expression
- 更多 Action / Function
- 更多 Expression Namespace / Runtime Reference
- TRY / Runtime Failure Handling Blocks
- Text DSL / Lexer / Parser
- Semantic Type System 的進一步擴充
- Compiler / IR / Bytecode VM（僅在未來真的需要時）
- Paging / Page Replacement
- Virtual Memory
- Virtual Address Space / Page Table / Frame Mapping
- Swap / Working Set / Thrashing
- Cache / Memory Hierarchy
- I/O
- Thread / Process Scheduling
- Resource Locking
- Deadlock
- 更複雜的 Memory Allocation Strategy
- 玩家自訂 Compaction / Allocation Algorithm
- 隨機 Workload
- 多關卡
- Endless / Simulation Mode
- 更接近 Opus Magnum 的逐 Tick 動態盤面演出
- 更完整的視覺化 Debugger
- 更複雜 Score Metrics

### 20.1 Virtual Memory Architecture Direction

MVP 的 Contiguous Memory Arena 應視為最底層的 Physical-Memory-like Simulation。

未來 Virtual Memory 理想擴充方向：

```text
Task
 ↓
Virtual Address Space
 ↓
Page Table / Mapping Policy
 ↓
Physical Memory / Frames
```

Parser / Text DSL 若未來加入，應產生與 Rule Editor 相同的 Rule Program / AST，不改變後面的 Runtime architecture。

---

## 21. Prototype Tuning / Open Questions

以下內容尚未鎖死：

- Memory Capacity。
- Waiting List Capacity（是否需要上限）。
- Total Workload Length。
- Prototype 各 Task 的實際數值。
- Duration 分布。
- `waitingTicks` 是否只用於 Score，或會影響 Failure。
- Score 權重 / Waiting Penalty / Split Penalty / Compaction Score Cost。
- Dummy Compaction Algorithm 的精確移動順序。
- Task 對 Fragment 數量的限制欄位與預設上限（例如 `maxFragments` / `fragmentLimit`）。
- Arithmetic Operator / Math Function / Action 的精確 Tick Cost Table。
- Split 第一版實際開放哪些 Expression primitive。
- 未來 `Memory.*` namespace 實際開放哪些 Runtime Reference。
- 未來若引入多 Task / 多 Execution Context，該如何排程（不屬於目前 MVP）。
- Waiting List scan 與 resumable Rule Runtime 的細部互動順序。
- Execution Cursor / Frame 的精確 TypeScript Representation。
- `break` 等控制流程跳轉的完整 Scope / Semantics（Future Work）。
- TaskWaiting Trigger 的最終命名與 UI 呈現方式。
- 是否將 `TaskQueue` 重命名為 `WaitingList`。
- Debug View 要顯示到哪個 AST / Expression 粒度。
- UI 細節與動畫速度。

這些屬於 Content / Balance / UX / Implementation Tuning。MVP 的核心執行模型已確認為 single Execution Pivot + nested Frame Stack；未來真正的多 Context scheduling 不阻擋目前 Split / Expression Runtime 實作。

---

## 22. Current MVP Status

### 22.1 Specification / Design Confirmed

- [x] Core Gameplay Loop
- [x] Fixed Workload
- [x] 1D Contiguous Memory Model
- [x] Physical-Memory-like Managed Arena Interpretation
- [x] Task Lifecycle and Memory Residency Separation
- [x] Workload Preview and Runtime Waiting State Are Separate Concepts
- [x] Waiting List preserves Arrival Order but does not enforce Head-of-Line Blocking
- [x] Structured / Block-based Rule Editor Direction
- [x] WHEN / IF / ELSE / Action Concept
- [x] Ordered / Stateful / Depth-First Rule Execution
- [x] Resumable AST Execution / Execution Cursor Direction
- [x] Single Execution Pivot + Nested Frame Stack
- [x] Zero-cost Literal / Reference reads
- [x] Cost-bearing computation / Function / Action execution
- [x] Rule Interpreter / Action Executor Responsibility Boundary
- [x] Runtime Failure → Halt
- [x] No Rollback for committed Simulation State
- [x] No Rule Editing During Run
- [x] Expression AST / RuntimeValue separation direction
- [x] `Split.Remaining` is a context-sensitive Split namespace Reference
- [x] Split remains one Task after fragmentation
- [x] Split does not imply Allocate
- [x] Split supports multiple Fragment Expressions
- [x] Split Fragment Expressions evaluate left-to-right
- [x] Invalid / zero / negative / non-integer Fragment Result → Runtime Failure
- [x] Split must consume the full Task Size
- [x] Split Cost = Expression Cost + (Fragment Count - 1)
- [x] Dummy Compaction Design
- [x] Compaction Cost Based on Moved Task Count
- [x] Game Controller owns Run / Pause / Resume / Step scheduling
- [x] Compiler / Bytecode VM deferred until proven necessary
- [x] Current + Next 2 Preview
- [x] Win Condition
- [x] Score Philosophy
- [x] Prototype UI Direction
- [x] Parser / Text DSL remains Future Work
- [x] Paging / Virtual Memory remain Future Layers above current MVP

### 22.2 Engineering Implemented / Tested

- [x] Base Domain Objects (Task / Memory / TaskQueue / Workload)
- [x] Memory Allocation / Release / First-Fit Unit Tests
- [x] TaskQueue Unit Tests
- [x] Workload / Tick Arrival Unit Tests
- [x] Base Simulation Engine
- [x] SimulationEngine Unit Tests
- [x] Minimal Rule Program / AST Model
- [x] Ordered / Stateful / DFS Rule Interpreter
- [x] Allocate Runtime Action
- [x] `ActionExecutor` extracted from `RuleInterpreter`
- [x] ActionExecutor unit tests
- [x] Runtime Failure Result Model
- [x] Rule Interpreter ↔ SimulationEngine Integration
- [x] Integration Tests for Rule-driven Allocation
- [x] Integration Tests for Runtime Failure → Halt
- [x] Integration Tests for No Rollback
- [x] Runtime Task Lifecycle uses `waiting → processing → completed`
- [x] Workload Arrival → Waiting List
- [x] Rule Phase scans Waiting Tasks in Arrival Order
- [x] Unhandled Waiting Task remains Waiting for later Tick
- [x] Waiting Task can be re-evaluated on later Tick
- [x] Later Waiting Task may be processed while earlier Task remains Waiting
- [x] `waitingTicks`
- [x] `TaskWaiting` Rule Context / Trigger

### 22.3 Next Engineering Work

- [x] Define minimal Expression AST / RuntimeValue types for Split.
- [x] Define Evaluation Context and Split Evaluation Context.
- [x] Define single-pivot resumable Execution Cursor / Frame model.
- [x] Define Waiting Task candidate handoff into the single-pivot Rule Runtime.
- [x] Add minimal Program Validator boundary for Expression / Scope validation.
- [x] Implement zero-cost traversal vs cost-bearing execution-step semantics.
- [x] Implement Split Action AST shape.
- [x] Implement SplitPlan resolution / validation.
- [x] Implement Split Runtime work and fragmented allocation shape.
- [x] Update Allocate to support fragmented Task allocation.
- [ ] Implement Game Controller Run / Pause / Resume / Step when UI/runtime integration needs it.
- [ ] Implement Compaction Runtime Action.
- [ ] Functional Rule Editor UI.
- [ ] First Prototype Workload Data.
- [ ] Score Numbers / Balancing.
- [ ] Final UI Details.

---

## 23. Next Recommended Step

目前已完成：

```text
Base Domain Objects
→ Base Simulation
→ Rule AST / Program Model
→ Ordered / Stateful / DFS Interpreter
→ Allocate Action
→ Waiting Task Lifecycle
→ ActionExecutor extraction
```

下一階段為：

```text
feat/split-action
```

但在直接實作 Split 前，先完成其所依賴的最小 Runtime 基礎：

1. 定義 Expression AST / RuntimeValue。
2. 定義 `Task.Size`、`Split.Remaining` 與 Math Function 的最小 Evaluation Context。
3. 定義 single-pivot Execution Cursor / Frame，使 AST 執行可以在 cost-bearing node 後 suspend / resume，並支援巢狀 Function / Expression / Action 的 jump / return。
4. 定義 Waiting Task 依 Arrival Order 交給目前唯一 Execution Pivot 的 MVP handoff 流程。
5. 以 TDD 實作 SplitPlan：
   - left-to-right fragment resolution
   - type / integer / positive / remaining validation
   - final remaining = 0
6. 實作 Split 的 Runtime Cost：

```text
Expression Execution Cost
+
(fragmentCount - 1)
```

7. Split 完成後只改變 Task allocation shape；Task 仍 Waiting。
8. 再擴充 Allocate，使同一 Task 可以依 fragment shape 取得多個 Memory Region。

此階段仍不需要 Parser、Text DSL、Compiler 或 Bytecode VM。

核心目標是先證明：

> 玩家可以寫出可觀察、可逐步執行、具有時間成本 Trade-off 的 Memory Management Rule，並透過 Split 解決 Fragmentation 問題。


---

## 24. v1.1 Revision Notes

本版相對 2026-09-11 初版修訂：

- 確認 MVP Runtime 採單一 `Execution Pivot`。
- 巢狀 Function / Expression / Action 透過 Frame Stack 保存 return position；不代表多個 Context 同時執行。
- `Memory.*` 第一版 Split 不開放，但 Reference / namespace 架構保留擴充能力。
- Waiting Task 預設依 Arrival Order 選擇下一個候選 Task，再由玩家 Rule 決定處理方式。
- 多 Task / 多 Execution Context scheduling 移至 Future Work，不再阻擋 `feat/split-action`。
- `break` 等控制流程跳轉保留為 Future Work。
