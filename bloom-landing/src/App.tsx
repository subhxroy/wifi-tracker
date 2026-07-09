import { WifiHigh, Bell, Activity, ArrowRight, Menu, X, Shield, Wind, Heart, Github } from "lucide-react";
import { useState } from "react";

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8C16 8 12 12 12 15C12 17.2 13.8 19 16 19C18.2 19 20 17.2 20 15C20 12 16 8 16 8Z" fill="currentColor" fillOpacity="0.8" />
      <path d="M10 20C10 20 12.5 23 16 23C19.5 23 22 20 22 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function FloatingCard({ icon, title, metric, metricLabel, description }: { icon: React.ReactNode; title: string; metric: string; metricLabel: string; description: string }) {
  return (
    <div className="rounded-[20px] bg-paper-white p-5 shadow-floating">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist-gray text-ink-black">{icon}</div>
        <span className="text-xs font-[430] text-slate-gray">{title}</span>
      </div>
      <p className="text-[22px] font-medium tracking-tight text-ink-black">{metric}</p>
      <p className="text-xs text-slate-gray">{metricLabel}</p>
      <div className="mt-3 h-10 w-full">
        <svg viewBox="0 0 120 32" className="h-full w-full">
          <path d="M0 28 Q15 24 30 18 T60 14 T90 8 T120 12" stroke="#5d2a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function NeutralCard({ category, title, description }: { category: string; title: string; description: string }) {
  return (
    <div className="rounded-[24px] bg-mist-gray p-8">
      <span className="text-sm font-[400] text-ash-gray">{category}</span>
      <h3 className="mt-2 text-[22px] font-medium text-ink-black">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-slate-gray">{description}</p>
      <button className="mt-4 flex items-center gap-1 bg-transparent px-0 py-5 text-base text-ink-black no-underline hover:underline">
        Learn more <ArrowRight size={14} className="inline" />
      </button>
    </div>
  );
}

function NavLink({ label, href = "#" }: { label: string; href?: string }) {
  return (
    <a href={href} className="text-sm text-ink-black no-underline transition-opacity hover:opacity-70">
      {label}
    </a>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-paper-white font-sohne text-ink-black antialiased">
      <nav className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-lg font-medium tracking-tighter">sentira</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <NavLink label="Features" />
            <NavLink label="Resources" />
            <NavLink label="Pricing" />
            <div className="ml-6 flex items-center gap-3">
              <a href="#" className="rounded-[9999px] bg-transparent px-4 py-2 text-sm text-ink-black no-underline transition-colors hover:bg-mist-gray">
                Sign in
              </a>
              <a href="#" className="rounded-[9999px] bg-ink-black px-5 py-2 text-sm text-paper-white no-underline transition-opacity hover:opacity-90">
                Get started
              </a>
            </div>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-gray md:hidden">
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-hairline bg-paper-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              <NavLink label="Features" />
              <NavLink label="Resources" />
              <NavLink label="Pricing" />
              <hr className="border-hairline" />
              <a href="#" className="text-sm text-ink-black">Sign in</a>
              <a href="#" className="inline-flex items-center justify-center rounded-[9999px] bg-ink-black px-5 py-2.5 text-sm text-paper-white">Get started</a>
            </div>
          </div>
        )}
      </nav>

      <section className="relative px-6 pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="font-signifier text-5xl font-[400] leading-[1.3] tracking-[-0.025em] text-ink-black md:text-7xl lg:text-[5.5rem]">
            Your{" "}
            <span className="italic">silent</span>{" "}
            guardian for elder care
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-slate-gray">
            Camera-free WiFi sensing that monitors breathing, movement, and presence — then alerts caregivers when something's wrong. No cameras. No wearables. Just privacy.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button className="rounded-[9999px] bg-ink-black px-7 py-3 text-sm text-paper-white transition-all hover:opacity-90 active:scale-[0.97]">
              Get started
            </button>
            <button className="rounded-[9999px] border border-ink-black bg-transparent px-7 py-3 text-sm text-ink-black transition-all hover:bg-mist-gray active:scale-[0.97]">
              Learn more <span className="ml-1">→</span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-24 grid max-w-5xl grid-cols-1 gap-6 px-0 md:grid-cols-3">
          <FloatingCard
            icon={<WifiHigh size={20} />}
            title="Passive Sensing"
            metric="99.7%"
            metricLabel="uptime"
            description="Real-time detection through existing WiFi signals."
          />
          <FloatingCard
            icon={<Bell size={20} />}
            title="Smart Escalation"
            metric="<30s"
            metricLabel="alert time"
            description="Multi-channel alerts to every caregiver."
          />
          <FloatingCard
            icon={<Activity size={20} />}
            title="Vital Trends"
            metric="5 rules"
            metricLabel="detection"
            description="Breathing, heart rate, activity anomaly detection."
          />
        </div>
      </section>

      <section className="bg-fog-white px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <span className="text-sm font-[430] text-ash-gray">Features</span>
          <h2 className="mt-2 font-signifier text-4xl font-[400] leading-[1.3] tracking-[-0.015em] text-ink-black md:text-5xl">
            Privacy-first monitoring
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-slate-gray">
            Everything works through standard WiFi. No cameras, no wearables, no setup beyond plugging in a sensor.
          </p>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            <NeutralCard
              category="Sensing"
              title="Passive Sensing"
              description="ESP32-S3 nodes analyze WiFi Channel State Information to detect presence, motion, and breathing patterns — all without any device worn by the resident."
            />
            <NeutralCard
              category="Alerts"
              title="Smart Escalation"
              description="When a fall or anomaly is detected, alerts cascade through SMS, WhatsApp, and push notifications. Escalate to secondary contacts if unacknowledged."
            />
            <NeutralCard
              category="Analytics"
              title="Vital Trend Analysis"
              description="Breathing and heart rate trends with anomaly detection. Labeled as trend estimates — never presented as clinical readings."
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[24px] bg-blush-peach px-10 py-14 text-center md:px-16 md:py-20">
            <blockquote className="font-signifier text-[28px] font-[400] leading-[1.3] tracking-[-0.01em] text-sienna-brown md:text-[36px]">
              "We envisioned a world where{" "}
              <span className="italic">safety</span>{" "}
              has no eyes."
            </blockquote>
            <div className="mt-8 flex items-center justify-center gap-3 text-sm tracking-widest uppercase text-sienna-brown">
              <span className="h-px w-8 bg-sienna-brown/30" />
              Sentira Labs
              <span className="h-px w-8 bg-sienna-brown/30" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-fog-white px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-[430] text-ash-gray">Try it</span>
          <h2 className="mt-2 font-signifier text-4xl font-[400] leading-[1.3] tracking-[-0.015em] text-ink-black md:text-5xl">
            Ask anything about your home
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-gray">
            The dashboard surfaces real-time data from every sensor. Check in from anywhere.
          </p>
          <div className="mx-auto mt-10 flex max-w-lg items-center gap-2 rounded-[16px] border border-hairline bg-paper-white px-4 py-3 text-left shadow-soft">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mist-gray text-xs font-medium text-slate-gray">@</span>
            <span className="flex-1 text-sm text-smoke-gray">Ask anything…</span>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-black text-paper-white transition-opacity hover:opacity-90">
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-sm font-medium tracking-tighter">sentira</span>
          </div>
          <p className="text-xs text-slate-gray">
            Built by{" "}
            <a href="https://github.com/subhxroy" target="_blank" rel="noopener noreferrer" className="text-ink-black underline underline-offset-2 hover:opacity-70">
              Subhankar Roy
            </a>
          </p>
          <p className="text-xs text-slate-gray">Camera-free elder monitoring &mdash; supplemental, not medical</p>
        </div>
      </footer>
    </div>
  );
}
