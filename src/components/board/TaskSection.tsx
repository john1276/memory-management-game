import type { ReactNode } from 'react'

type TaskSectionProps = {
  title: string
  children: ReactNode
}

export function TaskSection({
  title,
  children,
}: TaskSectionProps) {
  return (
    <section className="task-section">
      <div className="task-section__heading">
        <h2>{title}</h2>
      </div>

      <div className="task-section__list">
        {children}
      </div>
    </section>
  )
}