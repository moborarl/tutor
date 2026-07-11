import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export function ExplorerLayout({ tree, children }: { tree: ReactNode; children: ReactNode }) {
  const [treeOpen, setTreeOpen] = useState(false);

  return (
    <div className={`explorer-layout ${treeOpen ? 'tree-open' : ''}`}>
      <button
        className="explorer-tree-toggle secondary"
        type="button"
        aria-expanded={treeOpen}
        onClick={() => setTreeOpen((open) => !open)}
      >
        {treeOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        {treeOpen ? 'ซ่อนเมนู' : 'แสดงเมนู'}
      </button>
      <aside className="explorer-tree">{tree}</aside>
      <section className="explorer-workspace">{children}</section>
    </div>
  );
}
