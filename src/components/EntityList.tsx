import type { ReactNode } from 'react';

export function EntityList({ label, children, empty, isEmpty = false }: {
  label: string;
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
}) {
  if (isEmpty) return <div className="entity-list-empty">{empty}</div>;
  return <div className="entity-list" role="list" aria-label={label}>{children}</div>;
}

export function EntityRow({ selected = false, selection, title, metadata, status, actions }: {
  selected?: boolean;
  selection?: ReactNode;
  title: ReactNode;
  metadata?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`entity-row ${selected ? 'is-selected' : ''}`} role="listitem">
      {selection && <div className="entity-row-selection">{selection}</div>}
      <div className="entity-row-copy">
        <div className="entity-row-title">{title}</div>
        {metadata && <div className="entity-row-metadata">{metadata}</div>}
      </div>
      {status && <div className="entity-row-status">{status}</div>}
      {actions && <div className="entity-row-actions">{actions}</div>}
    </div>
  );
}
