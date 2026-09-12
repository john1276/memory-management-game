import type {
  Expression,
} from '../expressions/Expression'

import type {
  Action,
  RuleProgram,
  Statement,
} from '../rules/Rule'

export interface ProgramValidationError {
  readonly ruleId: string
  readonly message: string
}

export function validateRuleProgram(
  program: RuleProgram,
): readonly ProgramValidationError[] {
  const errors: ProgramValidationError[] = []

  for (const rule of program) {
    validateStatements(
      rule.body,
      rule.id,
      errors,
    )
  }

  return errors
}

function validateStatements(
  statements: readonly Statement[],
  ruleId: string,
  errors: ProgramValidationError[],
): void {
  for (const statement of statements) {
    if (statement.type === 'if') {
      validateStatements(
        statement.then,
        ruleId,
        errors,
      )

      if (statement.else) {
        validateStatements(
          statement.else,
          ruleId,
          errors,
        )
      }

      continue
    }

    validateAction(
      statement.action,
      ruleId,
      errors,
    )
  }
}

function validateAction(
  action: Action,
  ruleId: string,
  errors: ProgramValidationError[],
): void {
  if (action.type !== 'split') {
    return
  }

  for (const fragment of action.fragments) {
    /*
     * In the current Expression AST, the only
     * statically known Boolean-valued fragment is
     * a Boolean literal.
     */
    if (
      fragment.type === 'literal' &&
      typeof fragment.value === 'boolean'
    ) {
      errors.push({
        ruleId,
        message:
          'Split fragment cannot be a boolean literal',
      })
    }

    validateExpression(
      fragment,
      ruleId,
      errors,
    )
  }
}

function validateExpression(
  expression: Expression,
  ruleId: string,
  errors: ProgramValidationError[],
): void {
  switch (expression.type) {
    case 'literal':
    case 'reference':
      return

    case 'binary':
      validateExpression(
        expression.left,
        ruleId,
        errors,
      )

      validateExpression(
        expression.right,
        ruleId,
        errors,
      )

      return

    case 'call': {
      validateMathArity(
        expression,
        ruleId,
        errors,
      )

      for (const argument of expression.arguments) {
        validateExpression(
          argument,
          ruleId,
          errors,
        )
      }

      return
    }
  }
}

function validateMathArity(
  expression: Extract<
    Expression,
    { type: 'call' }
  >,
  ruleId: string,
  errors: ProgramValidationError[],
): void {
  const actual =
    expression.arguments.length

  switch (expression.function) {
    case 'min':
    case 'max': {
      const expected = 2

      if (actual !== expected) {
        errors.push({
          ruleId,
          message:
            `Math.${expression.function} ` +
            `expects exactly ${expected} arguments, ` +
            `got ${actual}`,
        })
      }

      return
    }

    case 'floor':
    case 'ceil': {
      const expected = 1

      if (actual !== expected) {
        errors.push({
          ruleId,
          message:
            `Math.${expression.function} ` +
            `expects exactly ${expected} argument, ` +
            `got ${actual}`,
        })
      }

      return
    }
  }
}