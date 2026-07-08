import { Badge, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

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
  return (
    <div className="folder-tree">
      <Text as="div" size="1" weight="bold" color="gray" className="tree-label">{label}</Text>
      {items.map((item) => (
        <button
          key={item.id}
          className={`tree-node ${item.depth ? 'child' : ''} ${item.danger ? 'danger' : ''} ${activeId === item.id ? 'active' : ''}`}
          style={{ marginLeft: item.depth ? item.depth * 12 : 0 }}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <span className="tree-icon">{item.icon ?? '•'}</span>
          <span>{item.label}</span>
          {item.count != null && <Badge variant="soft">{item.count}</Badge>}
        </button>
      ))}
    </div>
  );
}

