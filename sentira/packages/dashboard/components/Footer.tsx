import { Shield } from "@phosphor-icons/react";

export function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <Shield size={16} weight="fill" className="text-ink" />
          <span className="text-sm font-medium tracking-tighter text-ink">sentira</span>
        </div>
        <p className="text-xs text-mid-gray">
          Built by{" "}
          <a href="https://github.com/subhxroy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:opacity-70">
            Subhankar Roy
          </a>
        </p>
        <p className="text-xs text-mid-gray">Camera-free elder monitoring &mdash; supplemental, not medical</p>
      </div>
    </footer>
  );
}
