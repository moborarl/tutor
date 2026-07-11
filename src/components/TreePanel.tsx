import { Badge, Text } from '@radix-ui/themes';
import {
  BookOpen,
  ChevronRight,
  Circle,
  Database,
  FolderClosed,
  Grid2X2,
  Home,
  KeyRound,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export interface TreeNodeItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  depth?: number;
  danger?: boolean;
}

export function TreePanel({
  label,
  items,
  activeId,
  onSelect,
}: {
  label: string;
  items: TreeNodeItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  function iconFor(item: TreeNodeItem) {
    if (item.danger) return <Trash2 aria-hidden="true" />;
    if (typeof item.icon !== 'string') return item.icon ?? <Circle aria-hidden="true" />;

    const icons: Record<string, ReactNode> = {
      '⌂': <Home aria-hidden="true" />,
      '◎': <UserRound aria-hidden="true" />,
      '◇': <KeyRound aria-hidden="true" />,
      '▣': <Grid2X2 aria-hidden="true" />,
      '▤': <Database aria-hidden="true" />,
      '●': <UserRound aria-hidden="true" />,
      '▸': item.depth ? <ChevronRight aria-hidden="true" /> : <FolderClosed aria-hidden="true" />,
      '•': item.depth ? <ChevronRight aria-hidden="true" /> : <BookOpen aria-hidden="true" />,
      '!': <Trash2 aria-hidden="true" />,
    };
    return icons[item.icon] ?? <Circle aria-hidden="true" />;
  }

  return (
    <nav className="folder-tree" aria-label={label}>
      <Text as="div" size="1" weight="bold" color="gray" className="tree-label">{label}</Text>
      {items.map((item) => {
        const depth = item.depth ?? 0;
        const style = depth
          ? ({ '--tree-indent': `${depth * 12}px` } as CSSProperties)
          : undefined;
        return (
          <button
            key={item.id}
            className={`tree-node ${depth ? 'child' : ''} ${item.danger ? 'danger' : ''} ${activeId === item.id ? 'active' : ''}`}
            style={style}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="tree-icon">{iconFor(item)}</span>
            <span>{item.label}</span>
            {item.count != null && <Badge variant="soft">{item.count}</Badge>}
          </button>
        );
      })}
    </nav>
  );
}
