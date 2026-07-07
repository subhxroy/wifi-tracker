export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-primary"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
