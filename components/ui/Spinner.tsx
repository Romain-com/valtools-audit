// Spinner de chargement
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'orange' | 'white' | 'navy'
}

const SIZE_MAP = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
}

const COLOR_MAP = {
  orange: 'text-brand-orange',
  white: 'text-white',
  navy: 'text-brand-navy',
}

export default function Spinner({ size = 'md', color = 'orange' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${SIZE_MAP[size]} ${COLOR_MAP[color]}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
