import type { Child } from '@shared/types';

export const CHILD_AVATAR_OPTIONS = [
  { key: 'flamingo', label: 'Flamingo' },
  { key: 'panda', label: 'Panda' },
  { key: 'sloth', label: 'Sloth' },
  { key: 'tiger', label: 'Tiger' },
  { key: 'elephant', label: 'Elephant' },
  { key: 'lemur', label: 'Lemur' },
  { key: 'panther', label: 'Panther' },
  { key: 'giraffe', label: 'Giraffe' },
  { key: 'toucan', label: 'Toucan' },
  { key: 'horse', label: 'Horse' },
  { key: 'zebra', label: 'Zebra' },
  { key: 'parrot', label: 'Parrot' },
] as const;

type AvatarOption = (typeof CHILD_AVATAR_OPTIONS)[number];
type AvatarKey = AvatarOption['key'];

const EMOJI_TO_KEY: Record<string, AvatarKey> = {
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
    <span className={`modern-child-avatar avatar-${size}`} title={displayName || option.label}>
      <img className="avatar-art" src={`/avatars/${option.key}.png`} alt="" aria-hidden="true" />
    </span>
  );
}
