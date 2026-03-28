/**
 * House mark aligned with PWA icons (see scripts/generate-pwa-icons.mjs).
 */
export function HorpayHouseMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="HORPAY"
    >
      <title>HORPAY</title>
      <rect width="512" height="512" fill="#10b981" />
      <rect x="28" y="28" width="456" height="456" rx="54" fill="#6ee7b7" />
      <polygon points="256,64 64,268 448,268" fill="#ffffff" />
      <rect x="88" y="268" width="336" height="208" rx="16" fill="#ffffff" />
      <rect x="216" y="352" width="80" height="124" rx="14" fill="#10b981" />
    </svg>
  )
}
