import { CheckCircle2, CircleAlert, Clock3, Info, MinusCircle } from 'lucide-react';
import type { ReactNode } from 'react';

const icons = {
  neutral: MinusCircle,
  success: CheckCircle2,
  warning: Clock3,
  danger: CircleAlert,
  info: Info,
};

export function StatusBadge({ tone = 'neutral', children }: {
  tone?: keyof typeof icons;
  children: ReactNode;
}) {
  const Icon = icons[tone];
  return <span className={`status-badge status-badge-${tone}`}><Icon aria-hidden="true" />{children}</span>;
}
