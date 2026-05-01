import { resolvePublicMediaUrl } from '../lib/apiBase'

type Props = {
  className?: string
  variant?: 'light' | 'dark'
  /** Uploaded or external logo; when set, replaces the SVG mark. */
  imageSrc?: string
  alt?: string
}

export function LogoMark({
  className = '',
  variant = 'light',
  imageSrc,
  alt = '',
}: Props) {
  const resolved = imageSrc?.trim()
    ? resolvePublicMediaUrl(imageSrc.trim())
    : ''
  if (resolved) {
    return (
      <img
        src={resolved}
        alt={alt}
        className={`${className} object-contain`}
        decoding="async"
      />
    )
  }

  const fill = variant === 'light' ? '#fffbeb' : '#b45309'
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        width="40"
        height="40"
        rx="8"
        fill={variant === 'light' ? '#d97706' : '#fffbeb'}
      />
      <path
        fill={fill}
        d="M10 28V12h2.8l3.9 9h.1L20.6 12h2.8v16h-2.2V17.5h-.1L17 28h-1.8l-3.5-10.5h-.1V28H10zm15.5 0V12h4.6v16h-4.6z"
      />
    </svg>
  )
}
