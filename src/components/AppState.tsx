import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function AppState({ tone, title, description, action }: {
  tone: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = tone === 'loading' ? LoaderCircle : tone === 'error' ? CircleAlert : Inbox;
  return (
    <section
      className={`app-state app-state-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Icon className={tone === 'loading' ? 'app-state-spinner' : undefined} aria-hidden="true" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="app-state-action">{action}</div>}
    </section>
  );
}
