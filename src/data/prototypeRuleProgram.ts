import type {
  RuleProgram,
} from '../simulation/rules/Rule'

export const prototypeRuleProgram:
  RuleProgram = [
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
