# MVP Specification

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
4. 系統依 Tick 自動運作：
   - Processing Task 推進並在完成時釋放 Memory。
   - Workload 生成新的 Task，加入 Waiting List。
   - Rule Interpreter 依序掃描 Waiting Task，依玩家 Rule 判斷目前應執行的 Action。
   - Action Executor 將 Action 套用到目前 Simulation State；若 Action 在當前狀態下無法執行，則產生 Runtime Failure。
5. 執行期間玩家不能修改 Rule。
6. 若發生非法操作、無法完成的 Action 或其他 Runtime Failure，立即 Failure 並停機。
7. 若玩家想修改 Rule，必須 Stop / Reset，再重新執行。
8. 若完整跑完 Workload，且所有必要 Task 均完成、Failure = 0，則成功完成。
9. 成功後依 Task 處理品質計算 Score，鼓勵玩家最佳化解法。

概念上接近：

> Design → Run → Observe → Fail / Complete → Reset → Improve

MVP 的核心決策空間不是 Queue Scheduling，而是：

> 玩家如何透過 Rule 有效利用有限的 Memory Arena，避免 Runtime Failure，並進一步最佳化配置品質。

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

MVP 只抽象最底層的有限實體資源配置問題：

- Task 對 Memory 產生需求。
- 玩家 Rule 決定何時與如何配置有限 Memory。
- 配置可能造成 External Fragmentation。
- Task 完成後釋放其使用的 Memory。

### 3.2 Task Lifecycle and Memory Residency

Task 的生命週期與 Memory Residency 應保持分離。

也就是：

> Task 的 Status 不應永久等同於「是否 Resident in Physical Memory」。

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

UI 可以將一維 Memory 排成矩形，例如：

```text
[A][A][ ][B]
[B][ ][C][ ]
```

但這只是顯示方式。

底層仍然是一維連續 Memory，不採真正的 2D 配置演算法。

此設計是為了保留直觀 UI，同時作為未來更高階 Memory Management Mechanism 的底層模擬基礎。

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
```

### 4.1 Arrival Is an Event, Not a Persistent Status

`Incoming` 應視為 Request / Event 的概念，而不是 Task 長時間停留的 Runtime Status。

高階流程為：

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
        ↓
Release Memory
```

Task 一旦由 Workload 生成，就已經是 Runtime Task。

若尚未取得 Memory，則進入 Waiting List。

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

其中：

- `waitingTicks` 可先作為 Runtime Metric 存在。
- `maxWait` / Deadline 是否造成 Failure，仍屬 Future Work / Prototype Tuning。
- Memory Residency 不應被硬編碼成 TaskStatus，以保留未來 Paging / Virtual Memory 的擴充空間。

MVP 不需要的欄位應放入 Future Work，而不是提前實作。

---

## 5. Workload

MVP 使用固定 Workload。

例如：

```text
Tick 0 → Task A
Tick 1 → Task B
Tick 2 → Task C
...
```

每次 Reset 後 Workload 完全一致。

原因：

- MVP 主要用於驗證核心玩法。
- 尚未確定遊戲最終方向。
- 固定情境方便除錯、觀察、最佳化與比較不同 Rule Set。
- 可以刻意設計特定問題，例如 Fragmentation、Split、Compaction、Waiting 等。

Workload 的角色是：

> 定義「未來何時會產生什麼 Task」。

它不是 Runtime Waiting List。

Task 到達指定 Tick 後，才會從 Workload / Generator 進入 Runtime Simulation。

### 5.1 Preview

玩家可看到：

```text
Current Request
Next Request
Next + 1 Request
```

即：

> Current + Next 2

此 Preview 是從尚未發生的 Workload 取得的 UI 資訊。

它與已經生成的 Runtime Waiting Task 是不同概念。

---

## 6. Tick System

系統具有自己的離散 Tick。

高階執行順序：

### Phase 1 — Memory / Processing Phase

執行目前已取得 Memory、正在處理中的 Task 與系統操作，例如：

- Task 執行進度
- Duration 更新
- Split 進度
- Compaction 進度
- 已完成 Task 結算
- 空間釋放

Task 完成後釋放其使用的 Memory。

### Phase 2 — Workload / Arrival Phase

讀取本 Tick 的新 Request。

每個到達的 Request：

```text
Workload Entry
→ Create Runtime Task
→ Append to Waiting List
```

Arrival 本身是一個事件，但 Task 不會長時間停留在 `incoming` 狀態。

### Phase 3 — Waiting Task / Rule Execution Phase

Rule Phase 依 Waiting List 的 arrival order 掃描尚未處理的 Task。

對每個 Waiting Task：

1. 建立 / 觸發對應的 Waiting Task Rule Context。
2. 依玩家 Rule Program 的順序執行。
3. Condition 在實際執行到該位置時讀取最新 Simulation State。
4. Action 成功後立即更新 State。
5. 若 Task 成功取得 Memory 並開始處理，則離開 Waiting List。
6. 若目前沒有任何 Rule 對該 Task 產生有效處置，Task 可保留在 Waiting List，等待後續 Tick 再次被掃描。

前面的 Waiting Task 若未被處理：

> 不會阻止系統繼續掃描後面的 Waiting Task。

因此 Waiting List 保留 Arrival Order，但不採嚴格 Head-of-Line Blocking 的 FIFO Dequeue Semantics。

若 Action 執行時發生非法操作、資源不足或其他 Runtime Failure：

```text
FAILURE
→ HALT
```

### Phase 4 — Waiting / State Validation Phase

Rule Phase 正常完成後：

- 更新仍在 Waiting List 中 Task 的 Waiting Metrics（例如 `waitingTicks`）。
- 檢查 Simulation State 是否仍符合系統基本限制與 invariant。
- 未來若啟用 `maxWait` / Deadline，可在此檢查是否超時。

若發生不可接受狀態：

```text
FAILURE
→ HALT
```

否則進入下一 Tick。

---

## 7. Waiting List

MVP Runtime 需要一個 Waiting List，用來保存：

> 已經由 Workload 生成，但尚未取得 Memory、仍等待 Rule 處理的 Task。

基本模型：

```text
Workload / Generator
        ↓
Waiting List
[ A ][ B ][ C ]
        ↓
Rule Interpreter scans tasks in arrival order
        ↓
Managed Memory Arena
```

### 7.1 Waiting List vs Workload Preview

兩者必須分離：

- Workload / Generator：定義尚未發生的 Task 輸入。
- Current + Next 2：尚未發生 Request 的預覽。
- Waiting List：已經生成、目前仍等待 Memory 處理的 Runtime Task。

### 7.2 Ordering Semantics

Waiting List 保留 Task 的 Arrival Order。

但它不是嚴格 FIFO Queue：

> A 沒有被處理，不代表 B、C 一定不能被 Rule 掃描與處理。

例如：

```text
Waiting:
A size=5
B size=2
```

若目前 Memory 無法處理 A，但能處理 B：

```text
scan A → remains waiting
scan B → Rule may Allocate B
```

這是刻意設計。

MVP 的主要 Puzzle 應聚焦在：

> 有限 Memory 如何被 Rule 有效利用。

而不是強迫所有問題都變成 Head-of-Line Blocking / Queue Scheduling。

### 7.3 Waiting Metrics

MVP 追蹤：

```text
waitingTicks
```

Waiting Penalty 可參與 Score。

`maxWait`、Deadline 或超時 Failure 暫不鎖死，保留給 Prototype Tuning / Future Work。

### 7.4 Engineering Note

現有程式中的 `TaskQueue` 可暫時保留作為底層容器。

若後續語意穩定，建議再視需要改名為：

```text
WaitingList
```

避免名稱讓人誤以為必須採嚴格 FIFO dequeue。

此改名不應阻擋下一階段 Action Architecture 開發。

---

## 8. Rule System

MVP 不使用文字 DSL。

使用：

> 結構化／方塊化 Rule Editor

部分合法數值與參數允許玩家自行輸入。

Rule Editor 是玩家操作的 UI；底層保存的是結構化的 Rule Program。MVP 由 Rule Editor 直接建立 Rule Program，不需要 Parser。

Rule 大致分為：

### 8.1 Trigger / Structural Blocks

Rule Runtime 的主要 MVP Context 為：

```text
WHEN [Task Waiting]
```

概念上：

> 每個 Rule Phase 對 Waiting List 中的 Task 依序建立一次 Rule Execution Context。

`Request Arrives` 可保留為未來 Event / Trigger，但不應成為唯一能處理 Task 的入口。

這樣 Waiting Task 才能在後續 Tick 被再次評估，而不是只在出生當下得到一次機會。

WHEN 本身不是 Action。

未來可加入更多 Event，例如：

```text
Request Arrives
Task Completed
Page Fault
...
```

### 8.2 Conditional Blocks

例如：

```text
IF [Size > 3]
IF [Splittable == True]
IF [Free Space < 4]
ELSE
...
```

玩家可以在合法範圍內輸入部分數值。

### 8.3 Action Blocks

例如：

```text
Allocate
Split
Compact
...
```

Action 是 Rule Program 要求 Runtime 執行的操作。

`Enqueue` 不再是核心必要 Action，因為新生成 Task 會自然進入 Waiting List。

若未來需要顯式 Waiting / Defer 行為，再依 Prototype 需求加入。

---

## 9. Rule Execution Semantics

Rule System 採用：

> Ordered / Stateful / Depth-First Execution

概念上接近一個簡化的直譯器。

Rule Editor / Program Validator 可以保證玩家建立的是結構合法、參數合法的 Rule Program；但不保證該 Program 在實際 Workload 上一定能成功執行。

### 9.1 Event / Rule Order

當某個 Event 發生時，系統會從對應的 Rule / WHEN Branch 開始，依玩家排列的順序逐一執行。

不是 First-Match。

前一條 Rule 成功執行，不代表後面的 Rule 不再處理；系統會繼續往下執行，直到該 Event 的 Rule Program 結束，或發生 Failure。

若同一 Event 有多個 Rule / Branch，則依玩家設定的順序處理。

### 9.2 Stateful Condition Evaluation

Condition 不會在 Event 發生瞬間一次預先計算。

每一個 IF 都在「實際執行到該 Statement 時」讀取最新的 Simulation State。

例如：

```text
Free Space = 5
Task Size = 3

IF Free Space >= Task Size
    Allocate

IF Free Space >= 4
    ...
```

第一個 IF 成立並成功 Allocate 後：

```text
Free Space = 2
```

因此第二個 IF 會使用：

```text
Free Space = 2
```

重新判斷，並因條件不成立而跳過。

也就是：

> 前面的 Action 會立即影響後面的 Condition。

### 9.3 Depth-First Conditional Execution

IF / ELSE 採一般程式控制流程語意。

```text
IF condition
    statements
ELSE
    statements
```

若 Condition 為 True：

> Depth-First 執行該 Branch 內的 Statements。

Branch 執行完成後，回到上一層並繼續下一個 Statement。

若 Condition 為 False：

> 跳過該 Branch，執行 ELSE（若存在）或下一個 Statement。

因此 Rule 執行更接近直譯器的循序 / DFS 流程，而不是 BFS 或一次性收集所有 Matching Rule。

### 9.4 Action Execution

Rule Interpreter 負責 WHEN / IF / ELSE 與 Statement 的執行順序。

當 Interpreter 執行到 Action 時，由 Action Executor 負責該 Action 的 Runtime 行為，例如：

```text
Allocate
Split
Compact
...
```

Action 成功後產生的 Memory / Task / Waiting List 狀態改變，會立即成為後續 Statement 所看到的狀態。

因此 Action Executor 與 Rule Interpreter 分開責任，但仍採逐步執行，不先批次收集所有 Action。

### 9.5 Rule Validity vs Runtime Failure

Rule 結構合法：

> 不代表執行一定成功。

Run 前可以檢查的問題，例如：

```text
缺少 IF 參數
ELSE 沒有對應 IF
使用不存在的 Action
輸入值不在合法格式
```

屬於 Rule Program / 結構錯誤，應在開始執行前阻止。

但下列情況屬於 Runtime Behavior：

```text
Allocate 4，但當下沒有合法連續空間

對目前不能 Split 的 Task 執行 Split

前一個 Action 改變 State，導致後續 Action 變得非法
```

這些 Rule 本身仍然可以是合法程式。

實際執行到失敗位置時：

```text
FAILURE
→ SYSTEM HALT
```

系統不 Rollback。

Failure 發生前已成功執行的 Action，其 State 變更保留，讓玩家可以直接觀察系統「跑到哪裡炸掉」。

Rule 設計與 Runtime Behavior 本身因此就是 Puzzle / Debugging 的一部分。

---

## 10. Editing During Execution

Run 開始後：

> 玩家不能修改 Rule。

允許：

```text
Run
Observe
Stop
Reset
```

若要修改：

```text
Stop / Reset
→ Edit
→ Run Again
```

不允許在即將 Failure 時 Pause 並修改 Rule 後繼續。

---

## 11. Failure

MVP 採嚴格 Failure Model。

任何 Runtime Action 無法完成或 Runtime State 進入不可接受狀態時，都可視為 Failure。

例如：

```text
要求 Allocate 4 格
但沒有合法空間
```

或：

```text
對 Unsplittable Task 執行 Split
```

或：

```text
前一 Action 已改變 Runtime State，導致後續 Action 無法執行
```

結果皆為：

```text
FAILURE
→ SYSTEM HALT
```

Program 結構錯誤則應在 Run 前由 Program Validator 阻止，不屬於遊戲 Runtime Failure。

Failure 不只是懲罰，也是 Debug Feedback。

Log 必須能清楚指出：

- 發生在哪一個 Tick
- 哪個 Task
- 哪條 Rule / Action
- Failure 原因

---

## 12. Split

Split 為 MVP 核心 Action。

Task 具有：

```text
splittable = true / false
```

Split Action：

> 執行一次固定消耗 1 Tick。

例如：

```text
AAAAAA
```

Split：

```text
AAA + AAA
```

Split 後仍視為同一個 Task，只是該 Task 可以使用多個 Memory Fragment；不建立 `A1`、`A2` 等獨立 Task。

整個 Split Operation：

```text
Cost = 1 Tick
```

不是每個 Fragment 各自消耗 1 Tick。

Split 的 Score Penalty 與 Tick Cost 是兩個不同概念：

- Tick Cost：系統規則。
- Score Penalty：關卡平衡／評分規則。

---

## 13. Compaction

Compaction 用於處理 External Fragmentation。

例如：

```text
Before:
[A][A][ ][B][B][ ][C][C]

After:
[A][A][B][B][C][C][ ][ ]
```

MVP 使用固定、簡化的 Dummy Compaction Algorithm。

系統不保證此演算法為最佳解。

### 13.1 Compaction Cost

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

不是依移動多少格計算。

### 13.2 Design Philosophy

系統提供的便利 Action 不保證最佳化。

如果玩家認為 Dummy Compaction 太昂貴，應透過更好的配置規則避免 Fragmentation，而不是期待系統自動找最佳解。

---

## 14. Win Condition

MVP 勝利條件保持簡單：

> 完整跑完整個固定 Workload，所有必要 Task 完成，且 Failure = 0。

例如：

```text
Workload Complete
Tasks Complete
Failures: 0

→ SUCCESS
```

---

## 15. Score System

Score 與 Win Condition 分離。

### Layer 1 — Survival

先做到：

> 不 Failure，完整完成 Workload。

### Layer 2 — Optimization

完成後依處理品質計算 Score。

Task 成功完成時，可依 Task 的「龜毛程度」給予 Base Score。

可能的評分項目：

```text
Base Completion
Task Difficulty
Special Constraint Bonus
Fast Handling Bonus
Waiting Penalty
Split Penalty
Compaction / Movement Cost
Optional Requirement Penalty
Other Task-specific Penalties
```

例如：

```text
Base Completion       +300
Hard Constraint       +100
Fast Handling          +50

Used Split             -30
Waited 2 Ticks         -40
Optional Goal Failed  -120
```

Task Score 可以低於 0。

也就是：

> 成功處理 Task ≠ 一定得到正分。

具體 Score 權重屬於 Prototype Balancing，不在核心 MVP Engine Spec 中鎖死。

---

## 16. Prototype / First Workload Design

第一個 Prototype Workload 應刻意包含：

1. Fragmentation 問題。
2. Split 可以解決問題的情境。
3. Compaction 可以救場，但不一定是最佳解的情境。
4. Waiting Task 存在，且後到 Task 有機會在前一 Task 仍 Waiting 時被處理。
5. 一個看似合理、但在後期會 Runtime Failure 的 Naive Strategy。
6. 至少一個穩定通關解。
7. 多個可進一步最佳化 Score 的空間。

Prototype 的目的不是設計「完美第一關」，而是測試：

> 這個核心玩法到底哪一部分最好玩？

尤其要觀察：

- Memory Fragmentation 是否真的帶來有趣決策？
- Waiting Task 的存在是否增加規則設計空間，而不是變成單純排隊麻煩？
- 玩家是否會自然產生「先能跑，再最佳化」的 Rule Programming 行為？

---

## 17. UI Direction

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
│ Tick / Log / Failure Reason / Score             │
└─────────────────────────────────────────────────┘
```

UI 應明確區分：

```text
Upcoming / Workload Preview
```

與：

```text
Runtime Waiting List
```

避免玩家將「尚未生成的 Task」與「已生成但尚未取得 Memory 的 Task」混為一談。

Rule Editor 只負責建立 / 編輯 Rule Program，不應直接包含 Simulation Runtime Logic。

此 Layout 先作為 Prototype 基準。

若實際使用後有問題，再調整。

---

## 18. MVP Engineering Principles

### 18.1 Extensible, but Not Overengineered

核心資料結構與 Rule System 應可擴充。

但 MVP 不提前實作未驗證功能。

### 18.2 Future Work Is Not MVP

想到的新概念若不影響目前 Prototype：

> 放入 Future Work，不直接加入 MVP。

### 18.3 Gameplay First

MVP 最重要的產出不是完整 OS Simulation，而是回答：

> 「這個玩法值得繼續做嗎？」

### 18.4 Runtime Responsibility Boundary

目前責任先切為：

```text
Rule Editor
→ Rule Program
→ Program Validator
→ Rule Interpreter
→ Action Executor
→ Simulation State
```

Simulation Engine 負責 Tick 與世界狀態的推進。

Rule Interpreter 負責控制流程；Action Executor 負責 Action 的 Runtime 行為。Simulation Core 不依賴 Rule Editor 的 UI 表示。

此階段先保持簡單，不因責任切分而提前建立大量 Class / Factory / Registry。

---

## 19. Out of Scope / Future Work

可能的未來方向：

- Priority
- Deadline / Max Wait
- Priority Queue / Custom Scheduler
- 更多 WHEN Events
- 更多 IF Conditions
- 更多 Action
- TRY / Runtime Failure Handling Blocks
- Text DSL / Lexer / Parser
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

### 19.1 Virtual Memory Architecture Direction

MVP 的 Contiguous Memory Arena 應視為：

> 最底層的 Physical-Memory-like Simulation。

未來 Virtual Memory 不應要求推翻現有 Task / Workload / Rule Runtime。

理想擴充方向為：

```text
Task
 ↓
Virtual Address Space
 ↓
Page Table / Mapping Policy
 ↓
Physical Memory / Frames
```

也就是在 Task 與目前 Memory Layer 之間增加新的 Address Translation / Paging Layer。

MVP 現階段只需要避免把：

```text
Task = 永久等同一整段 Contiguous Physical Memory
```

寫死成不可替換的架構。

若未來加入文字 DSL，Parser 應輸出與 Rule Editor 相同的 Rule Program，不改變後面的 Runtime。

以上 Future Work 均不應阻擋 MVP 完成。

---

## 20. Prototype Tuning / Open Questions

以下內容尚未需要鎖死，可在 Prototype 實作與測試時決定：

- Memory Capacity
- Waiting List Capacity（是否需要上限）
- Total Workload Length
- Prototype 各 Task 的實際數值
- Duration 分布
- `waitingTicks` 是否只用於 Score，或會影響 Failure
- 是否在 MVP 啟用 `maxWait` / Deadline
- Score 權重
- Waiting Penalty
- Split Penalty
- Compaction Score Cost
- Dummy Compaction Algorithm 的精確移動順序
- Split Action 的第一版參數形式（固定切半 / 指定 Split Point / 其他最小形式）
- Fragment Runtime Data Structure 的精確 TypeScript 表示
- Runtime Operation 是否允許並行，或 MVP 僅允許單一 Active Operation
- MVP 第一版實際開放哪些 WHEN / IF / Action Blocks
- TaskWaiting Trigger 的最終命名與 UI 呈現方式
- 是否將 `TaskQueue` 重命名為 `WaitingList`
- UI 細節與動畫速度

這些屬於 Content / Balance / UX / Implementation Tuning，不應阻擋核心架構前進。

---

## 21. Current MVP Status

### 21.1 Specification / Design Confirmed

- [x] Core Gameplay Loop
- [x] Fixed Workload
- [x] 1D Contiguous Memory Model
- [x] Physical-Memory-like Managed Arena Interpretation
- [x] Task Lifecycle and Memory Residency Separation
- [x] Rectangular UI Representation
- [x] Tick-based System
- [x] Extensible Task Model
- [x] Workload Preview and Runtime Waiting State Are Separate Concepts
- [x] Waiting List preserves Arrival Order but does not enforce Head-of-Line Blocking
- [x] Structured / Block-based Rule Editor Direction
- [x] WHEN / IF / ELSE / Action Concept
- [x] Ordered / Stateful / Depth-First Rule Execution Semantics
- [x] Rule Interpreter / Action Executor Responsibility Boundary
- [x] Runtime Failure → Halt
- [x] No Rollback Semantics
- [x] No Rule Editing During Run
- [x] Split remains one Task after fragmentation
- [x] Split Design
- [x] Split Cost = 1 Tick
- [x] Dummy Compaction Design
- [x] Compaction Cost Based on Moved Task Count
- [x] Current + Next 2 Preview
- [x] Win Condition
- [x] Score Philosophy
- [x] Prototype UI Direction
- [x] Prototype Workload Design Philosophy
- [x] Parser / Text DSL remains Future Work
- [x] Paging / Virtual Memory Remain Future Layers Above Current Physical-Memory-like MVP

### 21.2 Engineering Implemented / Tested

- [x] Base Domain Objects (Task / Memory / TaskQueue / Workload)
- [x] Memory Allocation / Release / First-Fit Unit Tests
- [x] TaskQueue Unit Tests
- [x] Workload / Tick Arrival Unit Tests
- [x] Base Simulation Engine
- [x] SimulationEngine Unit Tests
- [x] Minimal Rule Program / AST Model
- [x] Ordered / Stateful / DFS Rule Interpreter
- [x] Allocate Runtime Action
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

### 21.3 Next Engineering Work

- [ ] Extract Allocate Runtime Logic from `RuleInterpreter` into `ActionExecutor`
- [ ] Keep Ordered / Stateful / DFS semantics after the refactor
- [ ] Add minimal Program Validator boundary
- [ ] Implement Runtime Operation support for Tick-cost Actions
- [ ] Implement Split Runtime Action
- [ ] Implement fragmented allocation for one Task
- [ ] Implement Compaction Runtime Action
- [ ] Decide whether to rename TaskQueue → WaitingList
- [ ] Functional Rule Editor UI
- [ ] First Prototype Workload Data
- [ ] Score Numbers / Balancing
- [ ] Final UI Details

---

## 22. Next Recommended Step

目前已完成：

```text
Base Domain Objects
→ Base Simulation
→ Rule AST / Program Model
→ Ordered / Stateful / DFS Interpreter
→ Allocate Action
→ Waiting Task Lifecycle
→ Waiting List Re-evaluation
→ Runtime Failure / No Rollback Tests
```

下一步先整理 Runtime 的責任邊界，而不是直接增加更多 Rule Primitive。

建議依序處理：

1. 抽出 `ActionExecutor`：
   - Rule Interpreter 保留 WHEN / IF / ELSE 與 Statement Traversal。
   - Allocate 的 Runtime State 修改移到 Action Executor。
   - Action 成功後的 State 仍立即影響後續 Condition。
2. 加入最小 Program Validator：
   - Run 前只檢查 Rule Program 的結構與參數形式是否合法。
   - Runtime 是否能成功仍由實際執行決定。
3. 建立耗時 Action 共用的 Runtime Operation 基礎。
4. 實作 Split：
   - 同一 Task 可使用多個 Fragment。
   - Split Cost = 1 Tick。
5. 實作 Compaction：
   - Cost = moved Task count。
6. 底層穩定後，再接 First Prototype Workload、Rule Editor 與 Score。

Parser / Text DSL 不屬於目前 MVP；未來若加入，只需產生同一套 Rule Program。

此階段最重要的目標是讓：

```text
Rule Program
→ Rule Interpreter
→ Action Executor
→ Simulation State
```

與 Simulation Engine 的 Tick 推進責任保持清楚，方便後續加入 Split 與 Compaction。
