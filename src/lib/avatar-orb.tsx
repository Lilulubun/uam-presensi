/**
 * avatar-orb.tsx
 * Shared dreamy pastel avatar placeholder component.
 * Palette: Green / Powder Blue / Blush Rose — matches DashboardPengurus hero cards.
 */

const ORB_GRADIENTS = [
  'radial-gradient(circle at 30% 30%, #E2F99C, #C8F06B 70%, #9BCF40)',   // Lime Green
  'radial-gradient(circle at 30% 30%, #E0F2FE, #BAE6FD 70%, #7DD3FC)',   // Powder Blue
  'radial-gradient(circle at 30% 30%, #FFE4E6, #FECDD3 70%, #FDA4AF)',   // Blush Rose
];

/**
 * Returns a dreamy glossy orb background style based on a deterministic index
 * derived from a name string (so the same person always gets the same color).
 */
export function getOrbStyle(name: string): { background: string } {
  const idx = name.charCodeAt(0) % ORB_GRADIENTS.length;
  return { background: ORB_GRADIENTS[idx] };
}

interface AvatarOrbProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-8 h-8 text-[12px]',
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-16 h-16 text-[24px]',
};

/**
 * AvatarOrb — dreamy pastel initials avatar.
 * Color is deterministic (same name = same color) and cycles through
 * the Green / Powder Blue / Blush Rose dreamy trio.
 */
export function AvatarOrb({ name, size = 'md', className = '' }: AvatarOrbProps) {
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-[#1A1A18] shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] ${SIZE_MAP[size]} ${className}`}
      style={getOrbStyle(name)}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
