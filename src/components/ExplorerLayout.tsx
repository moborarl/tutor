import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';

const ExplorerTreeContext = createContext<() => void>(() => undefined);
export const useExplorerTreeControls = () => useContext(ExplorerTreeContext);

export function ExplorerLayout({ tree, children, mobileLabel = 'เมนูข้อมูล' }: {
  tree: ReactNode;
  children: ReactNode;
  mobileLabel?: string;
}) {
  const [treeOpen, setTreeOpen] = useState(false);

  return (
    <div className={`explorer-layout ${treeOpen ? 'tree-open' : ''}`}>
      <button
        className="explorer-tree-toggle cfs-button cfs-button-secondary"
        type="button"
        aria-controls="explorer-tree-panel"
        aria-expanded={treeOpen}
        onClick={() => setTreeOpen((open) => !open)}
      >
        {treeOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        {treeOpen ? `ซ่อน${mobileLabel}` : `แสดง${mobileLabel}`}
      </button>
      <ExplorerTreeContext.Provider value={() => setTreeOpen(false)}>
        <aside className="explorer-tree" id="explorer-tree-panel">{tree}</aside>
      </ExplorerTreeContext.Provider>
      <section className="explorer-workspace">{children}</section>
    </div>
  );
}
