import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260803_192301_9231ed6b-c55c-4a48-909c-4ebe11cf2e11.mp4'



const GRADIENT = '[background:linear-gradient(to_bottom,#2B2B2B,#101010)]'

function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M 128 128 C 128 198.692 70.692 256 0 256 C 0 185.308 57.308 128 128 128 Z M 128 128 C 198.692 128 256 185.308 256 256 C 185.308 256 128 198.692 128 128 Z M 0 0 C 70.692 0 128 57.308 128 128 C 57.308 128 0 70.692 0 0 Z M 256 0 C 256 70.692 198.692 128 128 128 C 128 57.308 185.308 0 256 0 Z"
      />
    </svg>
  )
}

export default function App() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Top bar */}
        <nav className="px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 text-[#010101] lg:text-white">
              <Logo className="h-6 w-6" />
              <span className="text-lg font-semibold">umbra</span>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:block">
              <button
                className={`rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 ${GRADIENT}`}
              >
                Get started
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`relative z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-lg transition-colors md:hidden ${
                open ? 'text-white' : 'text-[#010101]'
              } lg:text-white`}
            >
              <Menu
                className={`absolute h-5 w-5 transition-all duration-300 ${
                  open ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                }`}
              />
              <X
                className={`absolute h-5 w-5 transition-all duration-300 ${
                  open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
                }`}
              />
            </button>
          </div>
        </nav>

        {/* Mobile slide-in drawer */}
        <div
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-md transition-opacity duration-300 ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />
        <aside
          className={`fixed right-0 top-0 z-40 flex h-full w-72 flex-col bg-black/90 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mt-auto px-6 pb-10">
            <button
              className={`w-full rounded-full py-3.5 text-sm font-medium text-white transition-[opacity,transform] duration-[400ms] hover:opacity-90 ${GRADIENT} ${
                open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ transitionDelay: open ? '300ms' : '0ms' }}
            >
              Get started
            </button>
          </div>
        </aside>

        {/* Bottom-anchored content */}
        <main className="mt-auto px-5 pb-8 sm:px-8 sm:pb-12 lg:px-12 lg:pb-16">
          <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-end lg:justify-between">
            {/* Left: headline + email CTA */}
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-[#010101] sm:text-4xl lg:text-[3.5rem] lg:text-white">
                Ship AI workers that grind while you rest
              </h1>

              <form className="mt-6 flex flex-col gap-3 sm:mt-8 sm:inline-flex sm:flex-row sm:items-center sm:rounded-full sm:bg-white sm:p-1.5">
                <input
                  type="email"
                  placeholder="Type your email"
                  className="rounded-full bg-white px-5 py-3 text-sm text-gray-900 outline-none placeholder-gray-400 sm:w-64 sm:rounded-none sm:bg-transparent sm:px-4 sm:py-2"
                />
                <button
                  type="submit"
                  className={`rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:py-2.5 ${GRADIENT}`}
                >
                  Get started
                </button>
              </form>
            </div>

            {/* Right: glass cards */}
            <div className="flex flex-col gap-4 sm:flex-row lg:w-auto lg:gap-5">
              {/* Stats card */}
              <div className="flex flex-col justify-between rounded-2xl bg-white/10 p-5 backdrop-blur-lg sm:w-64 sm:p-6">
                <div>
                  <p className="font-silkscreen text-3xl font-normal tracking-tight text-[#010101] sm:text-4xl lg:text-white">
                    42,500+
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#010101]/70 sm:mt-4 lg:text-white/70">
                    Teams run Umbra to handle recurring ops daily.
                  </p>
                </div>
              </div>

              {/* Testimonial card */}
              <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-lg sm:w-64 sm:p-6">
                <div className="mb-3 flex items-center gap-2 sm:mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black">
                    <span className="text-sm font-bold text-white">S</span>
                  </div>
                  <span className="text-sm font-semibold text-[#010101] lg:text-white">Stratify</span>
                </div>
                <p className="text-sm leading-relaxed text-[#010101]/80 lg:text-white/80">
                  &ldquo;With Umbra we went from converting tedious operational work to having AI agents
                  that handle everything.&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3 sm:mt-5">
                  <img
                    src="https://i.pravatar.cc/72?img=12"
                    alt="Sara Klein"
                    className="h-9 w-9 rounded-full bg-white/20 object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#010101] lg:text-white">Sara Klein</p>
                    <p className="text-xs text-[#010101]/60 lg:text-white/60">Dir of Operations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}