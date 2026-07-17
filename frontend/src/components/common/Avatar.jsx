import { getInitials, getAvatarPalette } from '../../utils/memberHelpers';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-2xl',
};

/**
 * Shows a member/staff photo if available, otherwise a deterministic
 * initials avatar so the same person always renders the same color.
 */
const Avatar = ({ firstName = '', lastName = '', photo, size = 'md', ring = false, className = '' }) => {
  const sizeClass = SIZES[size] || SIZES.md;
  const ringClass = ring ? 'ring-4 ring-white dark:ring-gray-900' : '';

  if (photo) {
    return (
      <img
        src={photo}
        alt={`${firstName} ${lastName}`.trim() || 'Photo'}
        className={`${sizeClass} ${ringClass} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const palette = getAvatarPalette(`${firstName}${lastName}`);

  return (
    <div
      className={`${sizeClass} ${ringClass} ${palette.bg} ${palette.text} flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${className}`}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
};

export default Avatar;
