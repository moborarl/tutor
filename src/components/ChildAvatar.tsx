import type { Child } from '@shared/types';

export const CHILD_AVATAR_OPTIONS = [
  { key: 'flamingo', label: 'ฟลามิงโก', icon: '🦩', tone: 'rose' },
  { key: 'panda', label: 'แพนด้า', icon: '🐼', tone: 'yellow' },
  { key: 'sloth', label: 'สล็อต', icon: '🦥', tone: 'teal' },
  { key: 'tiger', label: 'เสือ', icon: '🐯', tone: 'orange' },
  { key: 'elephant', label: 'ช้าง', icon: '🐘', tone: 'stone' },
  { key: 'lemur', label: 'ลีเมอร์', icon: '🐒', tone: 'violet' },
  { key: 'panther', label: 'เสือดำ', icon: '🐈‍⬛', tone: 'amber' },
  { key: 'giraffe', label: 'ยีราฟ', icon: '🦒', tone: 'green' },
  { key: 'toucan', label: 'ทูแคน', icon: '🐧', tone: 'violet' },
  { key: 'horse', label: 'ม้า', icon: '🐴', tone: 'yellow' },
  { key: 'zebra', label: 'ม้าลาย', icon: '🦓', tone: 'teal' },
  { key: 'parrot', label: 'นกแก้ว', icon: '🦜', tone: 'rose' },
] as const;

const EMOJI_TO_KEY: Record<string, string> = {
  '🦁': 'tiger',
  '🐼': 'panda',
  '🚀': 'toucan',
  '⭐': 'horse',
  '🐣': 'flamingo',
  '🐻': 'panda',
  '🦊': 'tiger',
  '🐸': 'sloth',
  '🐬': 'zebra',
  '🦄': 'horse',
  '🌈': 'parrot',
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
  const option = normalizeAvatar(avatar ?? child?.avatar);
  const displayName = name ?? child?.name ?? option.label;
  return (
    <span className={`modern-child-avatar avatar-${option.tone} avatar-${size}`} title={displayName || option.label}>
      <span className="avatar-symbol">{option.icon}</span>
    </span>
  );
}
