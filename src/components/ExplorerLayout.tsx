import type { ReactNode } from 'react';

export function ExplorerLayout({ tree, children }: { tree: ReactNode; children: ReactNode }) {
  return (
    <div className="explorer-layout">
      <aside className="explorer-tree">{tree}</aside>
      <section className="explorer-workspace">{children}</section>
    </div>
  );
}

