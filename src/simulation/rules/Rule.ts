export type Trigger =
  | 'requestArrived'
  | 'taskWaiting'

export type Condition =
  | {
      type: 'taskSizeGreaterThan'
      value: number
    }
  | {
      type: 'taskSizeLessThanOrEqual'
      value: number
    }
  | {
      type: 'taskSplittableIs'
      value: boolean
    }
  | {
      type: 'freeSpaceGreaterThanOrEqual'
      value: number
    }

export type Action =
  | {
      type: 'allocate'
    }

export type Statement =
  | {
      type: 'if'
      condition: Condition
      then: readonly Statement[]
      else?: readonly Statement[]
    }
  | {
      type: 'action'
      action: Action
    }

export interface Rule {
  readonly id: string
  readonly trigger: Trigger
  readonly body: readonly Statement[]
}

export type RuleProgram = readonly Rule[]
