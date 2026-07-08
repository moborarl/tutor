import type { Child } from '@shared/types';

export const CHILD_AVATAR_OPTIONS = [
  { key: 'lion', label: 'สิงโต', icon: '♌', tone: 'amber' },
  { key: 'panda', label: 'แพนด้า', icon: '●●', tone: 'stone' },
  { key: 'rocket', label: 'จรวด', icon: '✦', tone: 'blue' },
  { key: 'star', label: 'ดาว', icon: '★', tone: 'yellow' },
  { key: 'bear', label: 'หมี', icon: '●', tone: 'brown' },
  { key: 'fox', label: 'ฟ็อกซ์', icon: '◆', tone: 'orange' },
  { key: 'frog', label: 'กบ', icon: '✿', tone: 'green' },
  { key: 'whale', label: 'วาฬ', icon: '≈', tone: 'teal' },
  { key: 'unicorn', label: 'ยูนิคอร์น', icon: '◇', tone: 'violet' },
  { key: 'rainbow', label: 'รุ้ง', icon: '◒', tone: 'rose' },
] as const;

const EMOJI_TO_KEY: Record<string, string> = {
  '🦁': 'lion',
  '🐼': 'panda',
  '🚀': 'rocket',
  '⭐': 'star',
  '🐣': 'star',
  '🐻': 'bear',
  '🦊': 'fox',
  '🐸': 'frog',
  '🐬': 'whale',
  '🦄': 'unicorn',
  '🌈': 'rainbow',
};

export function normalizeAvatar(value?: string) {
  if (!value) return CHILD_AVATAR_OPTIONS[0];
  return CHILD_AVATAR_OPTIONS.find((option) => option.key === value)
    ?? CHILD_AVATAR_OPTIONS.find((option) => option.key === EMOJI_TO_KEY[value])
    ?? CHILD_AVATAR_OPTIONS[0];
}

export function ChildAvatar({
  child,
  avatar,
  name,
  size = 'md',
}: {
  child?: Pick<Child, 'name' | 'avatar'>;
  avatar?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const displayName = name ?? child?.name ?? '';
  const option = normalizeAvatar(avatar ?? child?.avatar);
  const initials = displayName.trim().slice(0, 1).toUpperCase();
  return (
    <span className={`modern-child-avatar avatar-${option.tone} avatar-${size}`} title={displayName || option.label}>
      <span className="avatar-symbol">{option.icon}</span>
      {initials && <span className="avatar-initial">{initials}</span>}
    </span>
  );
}

