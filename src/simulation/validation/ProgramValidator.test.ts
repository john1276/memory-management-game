import { describe, expect, it } from 'vitest'

import type {
  RuleProgram,
} from '../rules/Rule'

import {
  validateRuleProgram,
} from './ProgramValidator'

describe('ProgramValidator', () => {
  it('rejects invalid Math arity inside Split expressions', () => {
    const program: RuleProgram = [
      {
        id: 'rule-1',
        trigger: 'taskWaiting',

        body: [
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
                      type: 'literal',
                      value: 1,
                    },
                    {
                      type: 'literal',
                      value: 2,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ]

    expect(
      validateRuleProgram(program),
    ).toEqual([
      {
        ruleId: 'rule-1',
        message:
          'Math.floor expects exactly 1 argument, got 2',
      },
    ])
  })

  it('rejects a statically boolean Split fragment', () => {
    const program: RuleProgram = [
      {
        id: 'rule-1',
        trigger: 'taskWaiting',

        body: [
          {
            type: 'action',
            action: {
              type: 'split',
              fragments: [
                {
                  type: 'literal',
                  value: true,
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
      },
    ]

    expect(
      validateRuleProgram(program),
    ).toEqual([
      {
        ruleId: 'rule-1',
        message:
          'Split fragment cannot be a boolean literal',
      },
    ])
  })
  it('accepts a valid complex Split program', () => {
  const program: RuleProgram = [
    {
      id: 'rule-1',
      trigger: 'taskWaiting',

      body: [
        {
          type: 'action',
          action: {
            type: 'split',
            fragments: [
              {
                type: 'literal',
                value: 3,
              },
              {
                type: 'call',
                namespace: 'math',
                function: 'floor',
                arguments: [
                  {
                    type: 'binary',
                    operator: 'divide',
                    left: {
                      type: 'reference',
                      namespace: 'split',
                      member: 'remaining',
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
    },
  ]

  expect(
    validateRuleProgram(program),
  ).toEqual([])
})
  it('returns all validation errors in the program', () => {
  const program: RuleProgram = [
    {
      id: 'rule-1',
      trigger: 'taskWaiting',

      body: [
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
                    type: 'literal',
                    value: 1,
                  },
                  {
                    type: 'literal',
                    value: 2,
                  },
                ],
              },
            ],
          },
        },
      ],
    },

    {
      id: 'rule-2',
      trigger: 'taskWaiting',

      body: [
        {
          type: 'action',
          action: {
            type: 'split',
            fragments: [
              {
                type: 'literal',
                value: true,
              },
            ],
          },
        },
      ],
    },
  ]

  expect(
    validateRuleProgram(program),
  ).toEqual([
    {
      ruleId: 'rule-1',
      message:
        'Math.floor expects exactly 1 argument, got 2',
    },
    {
      ruleId: 'rule-2',
      message:
        'Split fragment cannot be a boolean literal',
    },
  ])
})
})