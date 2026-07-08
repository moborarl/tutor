import type { Child } from '@shared/types';

export const CHILD_AVATAR_OPTIONS = [
  { key: 'flamingo', label: 'ฟลามิงโก', tone: 'rose' },
  { key: 'panda', label: 'แพนด้า', tone: 'yellow' },
  { key: 'sloth', label: 'สล็อต', tone: 'teal' },
  { key: 'tiger', label: 'เสือ', tone: 'orange' },
  { key: 'elephant', label: 'ช้าง', tone: 'stone' },
  { key: 'lemur', label: 'ลีเมอร์', tone: 'violet' },
  { key: 'panther', label: 'เสือดำ', tone: 'amber' },
  { key: 'giraffe', label: 'ยีราฟ', tone: 'green' },
  { key: 'toucan', label: 'ทูแคน', tone: 'violet' },
  { key: 'horse', label: 'ม้า', tone: 'yellow' },
  { key: 'zebra', label: 'ม้าลาย', tone: 'teal' },
  { key: 'parrot', label: 'นกแก้ว', tone: 'rose' },
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

function Eye({ x, y, r = 3 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#2f3430" />;
}

function AvatarArt({ type }: { type: AvatarKey }) {
  switch (type) {
    case 'flamingo':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#9670a4" />
          <path d="M24 74c10-29 28-44 49-45 12-1 20 7 20 18 0 15-12 27-29 27H24Z" fill="#f2a0a3" />
          <path d="M38 71c7-23 20-34 36-34 8 0 13 5 13 12 0 10-8 17-22 17H38Z" fill="#ffd1c6" />
          <path d="M70 38c13 1 18 10 16 19l-17-4 8-7-12-3Z" fill="#2d2f31" />
          <Eye x={67} y={42} r={2.5} />
          <path d="M19 73c8 3 18 3 29 1-9 7-20 10-32 8Z" fill="#101214" />
        </>
      );
    case 'panda':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#f0c968" />
          <circle cx="34" cy="28" r="13" fill="#2b2d2d" />
          <circle cx="66" cy="28" r="13" fill="#2b2d2d" />
          <circle cx="50" cy="54" r="35" fill="#f4f3ee" />
          <ellipse cx="38" cy="48" rx="11" ry="13" fill="#2b2d2d" transform="rotate(-20 38 48)" />
          <ellipse cx="62" cy="48" rx="11" ry="13" fill="#2b2d2d" transform="rotate(20 62 48)" />
          <Eye x={40} y={48} r={2.4} />
          <Eye x={60} y={48} r={2.4} />
          <ellipse cx="50" cy="59" rx="6" ry="4" fill="#2b2d2d" />
          <path d="M42 68c6 6 12 6 18 0" stroke="#2b2d2d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'sloth':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#bfc4c0" />
          <path d="M28 28c17-17 40-18 57-3-8 4-17 5-27 4-17 0-30 8-39 23 0-9 3-17 9-24Z" fill="#6cb49c" />
          <ellipse cx="52" cy="58" rx="31" ry="24" fill="#e7e2d8" transform="rotate(-12 52 58)" />
          <ellipse cx="39" cy="56" rx="12" ry="9" fill="#3c4440" transform="rotate(-20 39 56)" />
          <ellipse cx="64" cy="51" rx="12" ry="9" fill="#3c4440" transform="rotate(-20 64 51)" />
          <Eye x={41} y={55} r={2.4} />
          <Eye x={63} y={51} r={2.4} />
          <path d="M46 66c5 3 11 2 15-3" stroke="#3c4440" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'tiger':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#ffbd65" />
          <path d="M27 22l12 12-17 4Z" fill="#222" />
          <path d="M73 22 61 34l17 4Z" fill="#222" />
          <circle cx="50" cy="55" r="31" fill="#ee8b3f" />
          <path d="M23 20h14M68 15l14 6M20 43l17 5M64 42l18-6M29 74l12-10M71 74 59 64" stroke="#232323" strokeWidth="6" strokeLinecap="round" />
          <Eye x={39} y={50} r={3} />
          <Eye x={61} y={50} r={3} />
          <ellipse cx="50" cy="60" rx="7" ry="5" fill="#242424" />
          <path d="M38 70c8 6 17 6 25 0" stroke="#242424" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'elephant':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#d2d6d0" />
          <path d="M22 48c-6-14 1-27 14-26 10 1 16 9 16 20v31H29c-2-8-1-16 4-24Z" fill="#aeb7af" />
          <path d="M78 48c6-14-1-27-14-26-10 1-16 9-16 20v31h23c2-8 1-16-4-24Z" fill="#aeb7af" />
          <circle cx="50" cy="50" r="29" fill="#c5ccc5" />
          <path d="M48 55c-10 20-7 34 6 38 5-11 6-24 1-38Z" fill="#aeb7af" />
          <Eye x={39} y={45} r={2.5} />
          <Eye x={61} y={45} r={2.5} />
          <path d="M31 66c10 2 18 1 25-4" stroke="#f4f1e8" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'lemur':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#81639f" />
          <path d="M73 16c16 22 11 45-14 70l-9-10c20-20 25-38 15-55Z" fill="#2f3332" />
          <path d="M66 24c4 6 6 11 5 17" stroke="#d8d8d3" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="55" r="31" fill="#d9d9d2" />
          <path d="M25 29l18 13-20 8Z" fill="#f1f0ea" />
          <path d="M75 29 57 42l20 8Z" fill="#f1f0ea" />
          <circle cx="39" cy="53" r="9" fill="#f0ca55" />
          <circle cx="61" cy="53" r="9" fill="#f0ca55" />
          <Eye x={39} y={53} r={4} />
          <Eye x={61} y={53} r={4} />
          <ellipse cx="50" cy="65" rx="6" ry="4" fill="#333" />
        </>
      );
    case 'panther':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#f0c45d" />
          <path d="M24 31l14 8-17 11Z" fill="#111" />
          <path d="M76 31l-14 8 17 11Z" fill="#111" />
          <circle cx="50" cy="56" r="32" fill="#101312" />
          <circle cx="39" cy="53" r="5" fill="#e6b835" />
          <circle cx="61" cy="53" r="5" fill="#e6b835" />
          <Eye x={39} y={53} r={2.2} />
          <Eye x={61} y={53} r={2.2} />
          <ellipse cx="50" cy="63" rx="6" ry="4" fill="#d8b18d" />
          <path d="M36 72c9 7 19 7 28 0" stroke="#d8b18d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'giraffe':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#70bba3" />
          <path d="M38 18h8v17h-8ZM58 18h8v17h-8Z" fill="#d39b57" />
          <circle cx="42" cy="17" r="5" fill="#d39b57" />
          <circle cx="62" cy="17" r="5" fill="#d39b57" />
          <path d="M31 43c0-17 10-27 24-27s24 10 24 27v25c0 15-12 24-24 24S31 83 31 68Z" fill="#f1c071" />
          <circle cx="42" cy="45" r="5" fill="#c48342" />
          <circle cx="62" cy="58" r="5" fill="#c48342" />
          <circle cx="50" cy="74" r="4" fill="#c48342" />
          <Eye x={43} y={49} r={2.7} />
          <Eye x={63} y={49} r={2.7} />
          <path d="M49 60c4 3 8 3 12 0" stroke="#8c5d37" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'toucan':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#9d80bb" />
          <path d="M35 34c21-15 42-7 47 17-17 1-29 5-38 17-11-7-15-18-9-34Z" fill="#111" />
          <path d="M16 53c17-25 39-30 61-21-6 8-18 14-35 17-10 2-18 5-26 4Z" fill="#f3d14b" />
          <path d="M18 54c8-3 14-3 22-1-6 4-13 6-22 6Z" fill="#f1f1ea" />
          <Eye x={57} y={39} r={3} />
        </>
      );
    case 'horse':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#efd36f" />
          <path d="M31 25l14 12-16 7Z" fill="#d5d6cd" />
          <path d="M69 25 55 37l16 7Z" fill="#d5d6cd" />
          <path d="M31 39c5-16 33-17 39 0l-5 43c-6 10-24 10-30 0Z" fill="#e6e4d4" />
          <path d="M47 25c-8 15-8 34-2 57" stroke="#bfc3ba" strokeWidth="8" strokeLinecap="round" />
          <Eye x={41} y={52} r={2.7} />
          <Eye x={61} y={52} r={2.7} />
          <path d="M45 71c5 3 10 3 15 0" stroke="#7d8078" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'zebra':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#58957d" />
          <path d="M32 18l14 19-20 5Z" fill="#f0f1eb" />
          <path d="M68 18 54 37l20 5Z" fill="#f0f1eb" />
          <path d="M30 43c0-17 10-27 22-27s22 10 22 27v25c0 15-11 24-22 24S30 83 30 68Z" fill="#f0f1eb" />
          <path d="M42 22c11 11 21 18 34 21M29 49c15 4 28 12 40 24M35 78c13-2 24 0 35 6M56 18c-3 20-1 40 8 61" stroke="#222" strokeWidth="5" fill="none" strokeLinecap="round" />
          <Eye x={43} y={51} r={2.5} />
          <Eye x={61} y={51} r={2.5} />
        </>
      );
    case 'parrot':
      return (
        <>
          <circle cx="50" cy="50" r="48" fill="#9c78b1" />
          <path d="M37 26c20-11 42 2 42 28 0 21-14 35-34 35-18 0-30-13-30-29 0-16 8-28 22-34Z" fill="#7bb486" />
          <path d="M52 20c12 0 20 7 24 19-8-5-17-6-27-4Z" fill="#f0d755" />
          <path d="M20 57c11-11 23-16 38-15-7 10-17 16-31 17Z" fill="#efe7d3" />
          <circle cx="56" cy="48" r="9" fill="#f2b4b5" />
          <Eye x={61} y={39} r={3} />
          <path d="M76 49c7 6 8 13 1 20-4-7-8-12-15-16Z" fill="#e7d35f" />
        </>
      );
  }
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
      <svg className="avatar-art" viewBox="0 0 100 100" aria-hidden="true">
        <AvatarArt type={option.key} />
      </svg>
    </span>
  );
}
