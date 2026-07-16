import type { ReactNode } from 'react';

export function DataToolbar({ search, filters, selection, actions }: {
  search?: ReactNode;
  filters?: ReactNode;
  selection?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="data-toolbar" role={search ? 'search' : undefined}>
      {search && <div className="data-toolbar-search">{search}</div>}
      {filters && <div className="data-toolbar-filters">{filters}</div>}
      {selection && <div className="data-toolbar-selection">{selection}</div>}
      {actions && <div className="data-toolbar-actions">{actions}</div>}
    </div>
  );
}
