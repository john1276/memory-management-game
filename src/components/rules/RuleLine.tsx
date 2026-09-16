import type { CSSProperties } from 'react'

type RuleLineProps = {
  depth: number
  label: string
  value: string
  highlighted?: boolean
}

export function RuleLine({
  depth,
  label,
  value,
  highlighted = false,
}: RuleLineProps) {
  return (
    <div
      className={[
        'rule-line',
        highlighted
          ? 'rule-line--current'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--rule-depth': depth,
        } as CSSProperties
      }
    >
      <span className="rule-line__rail" />

      <span className="rule-line__label">
        {label}
      </span>

      {value && (
        <span className="rule-line__value">
          {value}
        </span>
      )}

      {highlighted && (
        <span className="rule-line__current-label">
          CURRENT
        </span>
      )}
    </div>
  )
}