import type { ReactNode } from 'react';
import type { Child } from '@shared/types';
import { ChildAvatar } from '../../../components/ChildAvatar';

export function ChildLearningShell({
  child,
  eyebrow,
  title,
  summary,
  actions,
  children,
}: {
  child: Child;
  eyebrow: string;
  title: string;
  summary?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={`child-learning child-learning--${child.ageBand}`}>
      <header className="child-dashboard-header">
        <div className="child-dashboard-identity">
          <ChildAvatar child={child} size="lg" />
          <div className="child-dashboard-copy">
            <p className="child-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {summary && <p className="child-dashboard-summary">{summary}</p>}
          </div>
        </div>
        {actions && (
          <nav className="child-dashboard-actions" aria-label="Child learning actions">
            {actions}
          </nav>
        )}
      </header>
      <div className="child-learning-content">{children}</div>
    </main>
  );
}
