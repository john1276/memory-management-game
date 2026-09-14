# GUI MVP

## 1. Purpose

本文件定義 `memory-management-game` 第一版可玩的 GUI / UX 範圍。

主 `MVP.md` 負責描述遊戲規則、Simulation / Runtime semantics 與核心系統；本文件只描述：

- 玩家如何看見 Simulation。
- 玩家如何編輯 Rule Program。
- 玩家如何在 Memory Board 與 Rule Program 之間切換視角。
- 執行中的 Rule Program 如何呈現 Current Execution。

本文件不試圖定義未來所有 UI 功能。

---

## 2. Design Goals

GUI 的核心目標是讓玩家能直覺理解：

> Rule Program 是原因，Memory Board 是結果。

整體介面應更接近 puzzle / programming game 的工作台，而不是一般管理 Dashboard。

核心視覺原則：

- Edit / Program-focused 時，Rule Program 是主角。
- Run / Board-focused 時，Memory Board 是主角。
- Memory Board 與 Rule Program 永遠屬於同一個 workspace，不是兩個獨立頁面。
- 玩家可以在「看程式」與「看結果」之間快速切換。
- 執行中的程式必須能讓玩家看出目前是哪個操作正在消耗 Tick。

---

## 3. Target Surface

第一版 GUI 以 Desktop Browser 為主要目標。

基準畫面：

- 1920 × 1080
- 16:9
- 橫向介面
- 主要內容固定於單一遊戲 workspace

MVP 不以手機版或完整 Responsive Layout 為主要目標。

---

## 4. Main Workspaces

GUI 由兩個主要視覺區域組成：

### 4.1 Memory Board

Memory Board 是 Simulation World 的主要呈現區域。

至少包含：

- Memory Arena
- Upcoming / Workload Preview
- Waiting List
- Processing Task 的必要狀態
- Tick / Simulation Status
- 基本 Run / Pause / Step / Reset 控制

Memory Arena 以 1D managed memory 的視覺模型呈現。

Task identity 使用：

- `Task0`
- `Task1`
- `Task2`
- ...

Memory cell 顯示 Task identity。

同一個 Task 出現在不連續區域時，即代表 fragmented allocation。

MVP 不需要額外建立 Fragment ID。

---

### 4.2 Rule Program

Rule Program 是玩家建立 allocation logic 的主要介面。

它不是文字 DSL，而是 Structured / Block-based Program。

第一版視覺至少需要能表達：

- Trigger
- IF / ELSE
- Action
- Split
- Nested Expression
- Allocate

Rule Program 在不同 Simulation 狀態下可以具有不同 presentation：

- Idle：Editor
- Running / Paused：Execution Viewer / Debugger
- Halted：Failure Inspection View

---

## 5. Simulation State and Workspace Layout

Simulation 狀態與畫面視角必須分離。

概念上：

```ts
type SimulationStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'halted'
  | 'completed'
```

Workspace layout 是另一個獨立狀態。

GUI 不應使用單一 `edit | run` mode 同時代表 Simulation 狀態與畫面位置。

因此可以存在：

- Idle + Program Focus
- Idle + Board Focus
- Idle + Split View
- Running + Program Focus
- Running + Board Focus
- Running + Split View
- Paused + Program Focus
- Halted + Program Focus
- Halted + Board Focus

Rule Program 是否可編輯，由 SimulationStatus 決定，而不是由目前畫面 Focus 決定。

MVP 中：

- `idle`：Rule Program 可編輯。
- 非 `idle`：Rule Program 為唯讀 execution / inspection view。

---

## 6. Workspace Transition

Memory Board 與 Rule Program 應視為同一張垂直工作台的兩個區域。

畫面切換不是瞬間換頁，而是連續的 Panel transition。

概念上使用：

```ts
workspaceProgress: number
```

其中：

- Program Focus：Rule Program 佔主要畫面。
- Split View：Memory Board 與 Rule Program 同時可見。
- Board Focus：Memory Board 佔主要畫面，Rule Program 收到底部。

實際 Progress 數值屬於 UI tuning，不是 gameplay semantics，可以依手感調整。

---

## 7. Mouse Wheel Interaction

滑鼠滾輪是主要 Workspace navigation 手勢之一。

當玩家操作 Workspace 外層區域時：

- 向下滾：逐步露出 Memory Board。
- 向上滾：逐步拉起 Rule Program。
- Panel 必須跟著滾輪連續移動，不可只在超過 threshold 後瞬間切換。
- 玩家停止滾動後，畫面可以吸附到最近的語意位置。

語意上的 Snap Targets：

1. Program Focus
2. Split View
3. Board Focus

Snap 應作為操作結束後的收尾，而不是與玩家的滾輪輸入互相拉扯。

---

## 8. Shared Transition Behavior

Run、Reset 與滑鼠滾輪應共用同一套 Workspace transition mechanism。

但按鈕不應偽造 Wheel Event。

概念上應呼叫共同的 transition function，例如：

```ts
animateWorkspaceTo(target)
```

預設行為：

### Run

- SimulationStatus → `running`
- Workspace transition → Board Focus

### Reset

- SimulationStatus → `idle`
- Workspace transition → Program Focus

若玩家固定 Split View，Run / Reset 可以維持 Split View。

---

## 9. Split / Pinned View

玩家可以選擇固定 Split View。

此模式下：

- Memory Board 保持可見。
- Rule Program 保持可見。
- Workspace 不再因一般 Wheel Event 自動切換 Focus。

Idle + Split：

- 上方顯示 Memory Board。
- 下方 Rule Program 仍可編輯。

Running + Split：

- 上方顯示 Simulation。
- 下方 Rule Program 變為唯讀 Execution Viewer。

MVP 只需要離散的 Pinned Split View。

自由拖曳任意 Panel 高度不屬於 MVP 必要功能。

---

## 10. Panel Scroll Ownership

GUI 必須清楚區分：

> Panel Header 控制 Panel，Panel Body 控制內容。

### Rule Program Header / Title

Rule Program 的 Title / Toolbar 位於 Edit Panel 內容之外。

滑鼠位於 Header / Toolbar 時：

- Wheel Event 可以控制整體 Workspace transition。
- 不應同時捲動 Rule Program 內容。

### Rule Program Body

Rule Program Body 是獨立 scroll region。

滑鼠位於 Body 時：

- Wheel Event 只控制 Rule Program 內部 scroll。
- 不應同時觸發外層 Workspace transition。
- Body 應形成明確的 wheel event boundary。

概念上可透過：

```tsx
onWheel={(event) => event.stopPropagation()}
```

以及：

```css
overscroll-behavior: contain;
```

避免 Scroll Chaining。

---

## 11. Current Execution Highlight

Run / Pause / Halted 狀態下，Rule Program 應顯示 Current Execution Highlight。

視覺語言類似 IDE / Debugger 的 current-line highlight。

例如：

```text
WHEN Task Waiting
  IF Task.Size > 8
    Split
      Fragment 1: Math.Floor(Task.Size / 2)
      Fragment 2: Split.Remaining
    Allocate
```

若目前執行 `Math.Floor(...)`：

```text
████ Fragment 1: Math.Floor(Task.Size / 2) ████
```

Current Execution Highlight 的語意：

- 主要對應目前正在消耗 Tick 的 cost-bearing execution。
- Zero-cost AST traversal 不需要逐節點閃動。
- Multi-tick Action 可以在同一個 block 上停留多個 Tick。
- Highlight 應能在 Program Focus、Split View 與 Board Focus 下保持一致。

MVP 不要求完整 compiler-style step-through debugger。

---

## 12. Runtime Observability Requirement

未來正式接上 Simulation Runtime 時，GUI 不應直接讀取 Interpreter 的 private frame stack。

Runtime / Presentation 之間應提供 read-only execution information，例如：

- currentTaskId
- currentRuleId
- currentNode / block identity
- current action / expression
- optional failure information

Rule AST / UI block 未來需要穩定的 identity，才能可靠地映射 Current Execution Highlight。

此項是 Presentation / Observability requirement，不改變目前 Single Execution Pivot 的 runtime semantics。

---

## 13. Failure Presentation

Runtime Failure 發生時：

- Simulation 立即 Halt。
- Memory Board 保留 failure 發生時的 world state。
- Rule Program 保留 failure 發生位置。
- Current / Failed block 應有清楚視覺提示。
- 玩家可以切換到 Program Focus 查看失敗位置。
- 玩家也可以切換到 Board Focus 查看失敗時的 Memory 狀態。

完整 Runtime Diagnostics 不需要全部直接顯示在主要遊戲畫面。

Player-facing Failure Feedback 應保持簡潔。

---

## 14. GUI MVP Controls

第一版至少需要：

- Run
- Pause / Resume
- Step
- Reset
- Workspace scroll transition
- Program / Board / Split 的基本 navigation
- Pin / Unpin Split View

Step 的 gameplay semantics：

> 一次 Step = 一個 Simulation Tick。

GUI shell 階段可以先用 mock behavior；正式接 GameController 後由 Controller 提供真正的 Tick behavior。

---

## 15. GUI MVP Development Strategy

GUI 實作分兩個階段。

### Phase 1 — GUI Shell

先使用 mock data 驗證：

- Layout
- Workspace transition
- Scroll ownership
- Panel proportions
- Current Execution Highlight
- Edit / Execution presentation

此階段不要求接 SimulationEngine。

### Phase 2 — Runtime Integration

GUI shell 穩定後再接：

- SimulationState
- GameController
- Real Run / Pause / Step / Reset
- Runtime Task state
- Memory state
- Waiting / Upcoming
- Current Execution Snapshot
- Runtime Failure

---

## 16. MVP Non-goals

以下項目不屬於第一版 GUI MVP 必要範圍：

- Mobile-first layout
- 完整 Responsive Design
- 自由拖曳任意 Panel 高度
- 完整 Settings Page
- Rule Program Drag-and-Drop Editor
- 大型 Diagnostics Dashboard
- Call Stack Panel
- 完整 Event Log
- Runtime Score balancing
- Compaction 詳細 per-tick animation
- Fragment persistent identity
- Virtual Memory / Paging UI
- Fancy transition effects
- 大量 theme / skin customization

這些功能可以等 Playable Prototype 穩定後再重新評估。

---

## 17. GUI MVP Acceptance Criteria

GUI MVP 完成時，玩家應可以：

1. 在 16:9 Desktop Browser 中清楚看到 Memory Board 與 Rule Program。
2. 在 Idle 狀態編輯 Rule Program。
3. 在 Idle 狀態切換到 Memory Board 查看初始盤面。
4. 用滑鼠滾輪連續拉動 Rule Program / Memory Board 的 Workspace 比例。
5. 停止滾動後自然吸附到 Program、Split 或 Board 的合理位置。
6. 使用 Run 進入 Simulation，並自動將視覺焦點移向 Memory Board。
7. 使用 Reset 回到 Idle，並依目前 layout preference 回到合理位置。
8. 在 Split / Pinned View 中同時查看 Board 與 Rule Program。
9. 在 Rule Program Body 中滾動內容時，不同時移動整個 Workspace。
10. 在 Rule Program Header / Title 上滾動時，可以控制 Workspace。
11. 執行期間看到 Current Execution Highlight。
12. 在 Failure 後查看失敗時的 Board 與 Rule Program 狀態。
13. 不需要理解內部 Runtime Diagnostics，也能從主要畫面理解「目前正在發生什麼」。
