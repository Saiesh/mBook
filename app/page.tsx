import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage(): ReactElement {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f4ee] px-6 py-12 text-[#12343a] sm:px-8 lg:px-12">
      {/* Why: soft radial accents keep the light theme visually rich without adding heavy imagery or extra assets. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-[#dbe8df] blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute bottom-[-6rem] right-[-2rem] h-64 w-64 rounded-full bg-[#d8e4ea] blur-3xl sm:h-80 sm:w-80" />
      </div>

      {/* Why: the framed two-column hero makes the product feel more polished while keeping the CTA and message above the fold. */}
      <div className="animate-landing-fade-in relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <section className="grid w-full gap-8 rounded-[2rem] border border-[#d7ddd7] bg-white/80 p-8 shadow-[0_24px_80px_rgba(18,52,58,0.12)] backdrop-blur md:grid-cols-[1.15fr_0.85fr] md:p-12 lg:gap-12 lg:p-16">
          <div className="flex flex-col justify-center text-left">
            {/* Why: the eyebrow introduces the brand source early so the product headline can stay focused on business value. */}
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#4f6f74]">
              By Pragathi Landscapers
            </p>
            <h1 className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-[#12343a] sm:text-5xl lg:text-6xl">
              Run landscaping jobs with clearer measurements and faster billing.
            </h1>
            <p className="mt-5 max-w-xl text-balance text-lg leading-8 text-[#4d6468] sm:text-xl">
              A fully integrated solution for measurement, billing, and invoicing.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#5d7377]">
              mBook helps your team move from site capture to client-ready paperwork
              without juggling disconnected tools.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/measurements"
                className="inline-flex items-center justify-center rounded-full bg-[#12343a] px-7 py-3 text-base font-semibold text-white shadow-lg shadow-[#12343a]/20 transition-transform transition-colors hover:bg-[#0f2b31] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12343a]"
              >
                Get Started
              </Link>
              <p className="text-sm text-[#5d7377]">
                Built for fast field capture and polished office follow-through.
              </p>
            </div>
          </div>

          {/* Why: isolating the logo in a dedicated brand panel gives the new artwork more presence on larger screens. */}
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#d7ddd7] bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(231,238,234,0.88))] p-8 shadow-[0_20px_60px_rgba(18,52,58,0.10)]">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
              <div className="rounded-[1.4rem] border border-white/70 bg-white/80 p-8 shadow-inner shadow-[#12343a]/5">
                {/* Why: fixed box + object-contain preserves the uploaded logo artwork without guessing its intrinsic aspect ratio. */}
                <div className="relative mx-auto h-28 w-full max-w-[260px] shrink-0 sm:h-32">
                  <Image
                    src="/logo.jpg"
                    alt="mBook"
                    fill
                    className="object-contain object-center"
                    priority
                    sizes="(min-width: 1024px) 260px, 220px"
                  />
                </div>
              </div>
              <div className="mt-6 space-y-3 text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#4f6f74]">
                  Professional workflow
                </p>
                <p className="text-lg font-medium text-[#12343a]">
                  From measurement capture to invoice-ready output in one branded
                  workspace.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
