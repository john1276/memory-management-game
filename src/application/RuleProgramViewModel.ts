import type {
  BinaryOperator,
  Expression,
} from '../simulation/expressions/Expression'
import type {
  Action,
  Condition,
  RuleProgram,
  Statement,
  Trigger,
} from '../simulation/rules/Rule'

export interface RuleProgramLineViewModel {
  readonly id: string
  readonly depth: number
  readonly label: string
  readonly value: string
}

export function createRuleProgramViewModel(
  program: RuleProgram,
): readonly RuleProgramLineViewModel[] {
  const lines: RuleProgramLineViewModel[] = []

  for (const rule of program) {
    lines.push({
      id: `${rule.id}:when`,
      depth: 0,
      label: 'WHEN',
      value: formatTrigger(rule.trigger),
    })

    appendStatements(
      lines,
      rule.body,
      rule.id,
      'body',
      1,
    )
  }

  return lines
}

function appendStatements(
  lines: RuleProgramLineViewModel[],
  statements: readonly Statement[],
  ruleId: string,
  path: string,
  depth: number,
): void {
  statements.forEach((statement, index) => {
    const statementPath =
      `${path}.${index}`

    if (statement.type === 'if') {
      lines.push({
        id: `${ruleId}:${statementPath}`,
        depth,
        label: 'IF',
        value:
          formatCondition(
            statement.condition,
          ),
      })

      appendStatements(
        lines,
        statement.then,
        ruleId,
        `${statementPath}.then`,
        depth + 1,
      )

      if (statement.else) {
        lines.push({
          id:
            `${ruleId}:${statementPath}.else`,
          depth,
          label: 'ELSE',
          value: '',
        })

        appendStatements(
          lines,
          statement.else,
          ruleId,
          `${statementPath}.else`,
          depth + 1,
        )
      }

      return
    }

    appendAction(
      lines,
      statement.action,
      ruleId,
      statementPath,
      depth,
    )
  })
}

function appendAction(
  lines: RuleProgramLineViewModel[],
  action: Action,
  ruleId: string,
  path: string,
  depth: number,
): void {
  switch (action.type) {
    case 'allocate':
      lines.push({
        id: `${ruleId}:${path}`,
        depth,
        label: 'Allocate',
        value: '',
      })
      return

    case 'compact':
      lines.push({
        id: `${ruleId}:${path}`,
        depth,
        label: 'Compact',
        value: '',
      })
      return

    case 'split':
      lines.push({
        id: `${ruleId}:${path}`,
        depth,
        label: 'Split',
        value: '',
      })

      action.fragments.forEach(
        (fragment, index) => {
          lines.push({
            id:
              `${ruleId}:${path}.fragment.${index}`,
            depth: depth + 1,
            label:
              `Fragment ${index + 1}`,
            value:
              formatExpression(fragment),
          })
        },
      )
      return
  }
}

function formatTrigger(
  trigger: Trigger,
): string {
  switch (trigger) {
    case 'requestArrived':
      return 'Request Arrived'

    case 'taskWaiting':
      return 'Task Waiting'
  }
}

function formatCondition(
  condition: Condition,
): string {
  switch (condition.type) {
    case 'taskSizeGreaterThan':
      return `Task.Size > ${condition.value}`

    case 'taskSizeLessThanOrEqual':
      return `Task.Size <= ${condition.value}`

    case 'taskSplittableIs':
      return (
        `Task.Splittable == ` +
        String(condition.value)
      )

    case 'freeSpaceGreaterThanOrEqual':
      return (
        `Memory.FreeSpace >= ` +
        String(condition.value)
      )
  }
}

function formatExpression(
  expression: Expression,
): string {
  switch (expression.type) {
    case 'literal':
      return String(expression.value)

    case 'reference':
      if (expression.namespace === 'task') {
        return 'Task.Size'
      }

      return 'Split.Remaining'

    case 'binary':
      return [
        formatExpression(expression.left),
        formatBinaryOperator(
          expression.operator,
        ),
        formatExpression(expression.right),
      ].join(' ')

    case 'call':
      return (
        `Math.${capitalize(expression.function)}` +
        `(` +
        expression.arguments
          .map(formatExpression)
          .join(', ') +
        `)`
      )
  }
}

function formatBinaryOperator(
  operator: BinaryOperator,
): string {
  switch (operator) {
    case 'add':
      return '+'
    case 'subtract':
      return '-'
    case 'multiply':
      return '*'
    case 'divide':
      return '/'
  }
}

function capitalize(
  value: string,
): string {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  )
}
