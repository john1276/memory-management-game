import {
  describe,
  expect,
  it,
} from 'vitest'

import type {
  RuleProgram,
} from '../simulation/rules/Rule'

import {
  createRuleProgramViewModel,
} from './RuleProgramViewModel'

describe('createRuleProgramViewModel', () => {
  it('renders a simple allocate rule', () => {
    const program: RuleProgram = [
      {
        id: 'allocate-waiting-task',
        trigger: 'taskWaiting',
        body: [
          {
            type: 'action',
            action: {
              type: 'allocate',
            },
          },
        ],
      },
    ]

    expect(
      createRuleProgramViewModel(
        program,
      ),
    ).toEqual([
      {
        id:
          'allocate-waiting-task:when',
        depth: 0,
        label: 'WHEN',
        value: 'Task Waiting',
      },
      {
        id:
          'allocate-waiting-task:body.0',
        depth: 1,
        label: 'Allocate',
        value: '',
      },
    ])
  })

  it('renders nested conditions and split expressions', () => {
    const program: RuleProgram = [
      {
        id: 'split-large-task',
        trigger: 'taskWaiting',
        body: [
          {
            type: 'if',
            condition: {
              type:
                'taskSizeGreaterThan',
              value: 8,
            },
            then: [
              {
                type: 'action',
                action: {
                  type: 'split',
                  fragments: [
                    {
                      type: 'call',
                      namespace: 'math',
                      function: 'floor',
                      arguments: [
                        {
                          type: 'binary',
                          operator: 'divide',
                          left: {
                            type:
                              'reference',
                            namespace: 'task',
                            member: 'size',
                          },
                          right: {
                            type: 'literal',
                            value: 2,
                          },
                        },
                      ],
                    },
                    {
                      type: 'reference',
                      namespace: 'split',
                      member: 'remaining',
                    },
                  ],
                },
              },
            ],
            else: [
              {
                type: 'action',
                action: {
                  type: 'allocate',
                },
              },
            ],
          },
        ],
      },
    ]

    const view =
      createRuleProgramViewModel(
        program,
      )

    expect(
      view.map(
        ({ depth, label, value }) => ({
          depth,
          label,
          value,
        }),
      ),
    ).toEqual([
      {
        depth: 0,
        label: 'WHEN',
        value: 'Task Waiting',
      },
      {
        depth: 1,
        label: 'IF',
        value: 'Task.Size > 8',
      },
      {
        depth: 2,
        label: 'Split',
        value: '',
      },
      {
        depth: 3,
        label: 'Fragment 1',
        value:
          'Math.Floor(Task.Size / 2)',
      },
      {
        depth: 3,
        label: 'Fragment 2',
        value:
          'Split.Remaining',
      },
      {
        depth: 1,
        label: 'ELSE',
        value: '',
      },
      {
        depth: 2,
        label: 'Allocate',
        value: '',
      },
    ])
  })
})
