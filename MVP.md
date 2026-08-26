# MVP Specification

## 1. MVP Goal

本 MVP 的目標不是一次決定遊戲的最終方向，而是建立一個可玩的 Prototype，用來驗證以下核心問題：

> 「讓玩家透過組裝規則，自動管理有限記憶體資源」這件事本身是否好玩？

MVP 先採固定 Workload、固定規則環境與單一 Prototype 情境。
未來是否發展成更偏向 Puzzle、Automation、OS Simulation，或其他形式，應在 MVP 實際遊玩與測試後再決定。

---

## 2. Core Gameplay Loop

核心循環：

1. 玩家觀察目前 Memory、Queue、Current Request 與未來兩個 Request。
2. 玩家使用結構化／方塊化 Rule Editor 組裝處理規則。
3. 玩家開始執行。
4. 系統依 Tick 自動運作。
5. 執行期間玩家不能修改 Rule。
6. 若發生非法操作、無法處理或規則衝突，立即 Failure 並停機。
7. 若玩家想修改 Rule，必須 Stop / Reset，再重新執行。
8. 若完整跑完 Workload 且無 Failure，則成功完成。
9. 成功後依 Task 處理品質計算 Score，鼓勵玩家最佳化解法。

概念上接近：

> Design → Run → Observe → Fail / Complete → Reset → Improve

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

### 3.2 Visual Representation

UI 可以將一維 Memory 排成矩形，例如：

```text
[A][A][ ][B]
[B][ ][C][ ]
```

但這只是顯示方式。

底層仍然是一維連續 Memory，不採真正的 2D 配置演算法。

此設計是為了接近真實記憶體工作流，同時保留較直觀的 UI 呈現方式。

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
- 可以刻意設計特定問題，例如 Fragmentation、Split、Compaction、Queue Waiting 等。

### 5.1 Preview

玩家可看到：

```text
Current Request
Next Request
Next + 1 Request
```

即：

> Current + Next 2

---

## 6. Tick System

系統具有自己的離散 Tick。

高階執行順序：

### Phase 1 — Memory / Active Operation Phase

執行目前 Memory 與系統中應進行的工作，例如：

- Task 執行進度
- Duration 更新
- Split 進度
- Compaction 進度
- 已完成 Task 結算
- 空間釋放

### Phase 2 — Workload / Request Phase

讀取本 Tick 的新 Request。

若 Request 無法立即進入處理流程，則可進入 FIFO Queue。

### Phase 3 — Rule Phase

依目前 Event 與玩家規則進行判斷與操作。

### Phase 4 — Validation

檢查所有嘗試執行的 Action。

若發生：

- 非法操作
- 無法完成的操作
- 資源衝突
- Rule Action 互相衝突
- 其他不可接受狀態

則：

```text
FAILURE
→ HALT
```

否則進入下一 Tick。

---

## 7. Queue

MVP 必須具有 Queue。

Queue 採：

> FIFO（First In, First Out）

基本模型：

```text
Incoming Request
       ↓
[ A ][ B ][ C ]  ← FIFO Queue
       ↓
     Memory
```

Queue 的存在允許系統在 Split、Compaction 或其他耗時操作期間繼續接收 Request。

MVP 階段：

- Queue 為 FIFO。
- 不允許任意重新排序。
- Queue Capacity 為 Prototype Tuning 項目。
- Priority Queue、Custom Scheduler 等留待 Future Work。

Queue Waiting 之後可參與 Score 計算，例如等待越久扣分越多。

---

## 8. Rule System

MVP 不使用文字 DSL。

使用：

> 結構化／方塊化 Rule Editor

部分合法數值與參數允許玩家自行輸入。

Rule 大致分為：

### 8.1 Trigger / Structural Blocks

例如：

```text
WHEN [Request Arrives]
```

WHEN 本身不是 Action。

其語意為：

> 當某個 Event 發生時，開始判斷此 Rule Branch。

未來可加入更多 Event。

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
Enqueue
...
```

---

## 9. Multi-Rule Execution Semantics

同一個 Event 發生時：

> 所有符合條件的 Rule 都會嘗試執行。

不是 First-Match。

例如：

```text
WHEN Request Arrives
IF Size > 3
DO Allocate
```

以及：

```text
WHEN Request Arrives
IF Splittable
DO Split
```

若一個 Task 同時符合兩者，兩條規則都會嘗試執行。

因此玩家必須使用：

```text
IF
ELSE
其他互斥條件
```

來避免不希望發生的重疊操作。

若多個 Action 最終互相衝突：

```text
FAILURE
→ HALT
```

Rule 設計本身因此也是 Puzzle 的一部分。

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

任何無法處理或衝突的嘗試都視為 Failure。

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
多條 Rule 對同一資源產生互斥 Action
```

結果皆為：

```text
FAILURE
→ SYSTEM HALT
```

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

> 完整跑完整個固定 Workload，且 Failure = 0。

例如：

```text
Workload Complete
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
4. Queue Waiting。
5. 一個看似合理、但在後期會 Failure 的 Naive Strategy。
6. 至少一個穩定通關解。
7. 多個可進一步最佳化 Score 的空間。

Prototype 的目的不是設計「完美第一關」，而是測試：

> 這個核心玩法到底哪一部分最好玩？

---

## 17. UI Direction

暫定 UI：

```text
┌────────────┬────────────────────┬──────────────┐
│ Incoming   │                    │ Rule Editor  │
│ / Queue    │       Memory       │              │
│            │                    │ WHEN ...     │
│ Current    │   [ ][ ][ ][ ]     │ IF ...       │
│ Next       │   [ ][ ][ ][ ]     │ DO ...       │
│ Next + 1   │                    │              │
├────────────┴────────────────────┴──────────────┤
│ Tick / Log / Failure Reason / Score           │
└───────────────────────────────────────────────┘
```

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

---

## 19. Out of Scope / Future Work

可能的未來方向：

- Priority
- Deadline / Max Wait
- Priority Queue
- Custom Scheduler
- 更多 WHEN Events
- 更多 IF Conditions
- 更多 Action
- Paging / Page Replacement
- Virtual Memory
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

以上內容均不應阻擋 MVP 完成。

---

## 20. Prototype Tuning / Open Questions

以下內容尚未需要鎖死，可在 Prototype 實作與測試時決定：

- Memory Capacity
- Queue Capacity
- Total Workload Length
- Prototype 各 Task 的實際數值
- Duration 分布
- Score 權重
- Waiting Penalty
- Split Penalty
- Compaction Score Cost
- Dummy Compaction Algorithm 的精確移動順序
- MVP 第一版實際開放哪些 WHEN / IF / Action Blocks
- UI 細節與動畫速度

這些屬於 Content / Balance / UX Tuning，不應阻擋核心 Engine 開發。

---

## 21. Current MVP Status

目前已確定：

- [x] Core Gameplay Loop
- [x] Fixed Workload
- [x] 1D Memory Model
- [x] Rectangular UI Representation
- [x] Tick-based System
- [x] Extensible Task Model
- [x] FIFO Queue
- [x] Structured / Block-based Rule Editor
- [x] WHEN / IF / ELSE / Action Concept
- [x] All Matching Rules Attempt Execution
- [x] Conflict → Failure → Halt
- [x] No Rule Editing During Run
- [x] Split
- [x] Split Cost = 1 Tick
- [x] Dummy Compaction
- [x] Compaction Cost Based on Moved Task Count
- [x] Current + Next 2 Preview
- [x] Win Condition
- [x] Score Philosophy
- [x] Prototype UI Direction
- [x] Prototype Workload Design Philosophy

尚待 Prototype 階段決定：

- [ ] Exact Task Schema
- [ ] Exact Rule Primitive List
- [ ] Memory / Queue Capacity
- [ ] First Prototype Workload Data
- [ ] Score Numbers / Balancing
- [ ] Final UI Details

---

## 22. Next Recommended Step

下一步不需要再擴大遊戲概念討論。

建議依序處理：

1. 定義 MVP 的精確 Task Schema。
2. 列出第一版可用的 Rule Primitive。
3. 設計第一個 Prototype Workload。
4. 定義最小可執行 Simulation Engine。
5. 製作可玩的第一版 UI。
6. 實際遊玩並記錄：
   - 哪些地方有趣？
   - 哪些地方只是麻煩？
   - 玩家是否真的會想最佳化？
   - Fragmentation / Queue / Rule Debugging 哪一塊最有樂趣？
7. 再決定 Future Work 的優先方向。
