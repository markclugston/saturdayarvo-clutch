import { useState } from 'react'
import { Button } from '@/components/ui/button'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'

const ticks =
  "relative w-full before:absolute before:-top-[4.5px] before:left-0 before:border-5 before:border-transparent before:border-l-border after:absolute after:-top-[4.5px] after:right-0 after:border-5 after:border-transparent after:border-r-border"

const linkClass =
  "flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-base text-secondary-foreground transition-shadow hover:shadow-md lg:w-auto"

const sectionClass = "flex-1 p-5 lg:p-8"

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex min-h-svh flex-col">
      <section className="flex grow flex-col place-content-center items-center gap-[18px] px-5 pt-8 pb-6 lg:gap-[25px] lg:p-0">
        <div className="relative">
          <img
            src={heroImg}
            className="relative z-0 mx-auto w-[170px]"
            width="170"
            height="179"
            alt=""
          />
          <img
            src={reactLogo}
            className="absolute inset-x-0 top-[34px] z-10 mx-auto h-7 [transform:perspective(2000px)_rotateZ(300deg)_rotateX(44deg)_rotateY(39deg)_scale(1.4)]"
            alt="React logo"
          />
          <img
            src={viteLogo}
            className="absolute inset-x-0 top-[107px] z-0 mx-auto h-[26px] w-auto [transform:perspective(2000px)_rotateZ(300deg)_rotateX(40deg)_rotateY(39deg)_scale(0.8)]"
            alt="Vite logo"
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-medium">Get started</h1>
          <p className="text-muted-foreground">
            Edit <code className="font-mono">src/App.tsx</code> and save to test{' '}
            <code className="font-mono">HMR</code>
          </p>
        </div>
        <Button
          type="button"
          className="mb-6"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </Button>
      </section>

      <div className={ticks}></div>

      <section className="flex flex-col border-t text-center lg:flex-row lg:text-left">
        <div className={`${sectionClass} border-b lg:border-r lg:border-b-0`}>
          <svg
            className="mb-4 size-[22px] max-lg:mx-auto"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2 className="text-lg font-medium">Documentation</h2>
          <p className="text-muted-foreground">Your questions, answered</p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:mt-8 lg:justify-start">
            <li className="max-lg:flex-[1_1_calc(50%-8px)] lg:flex-none">
              <a href="https://vite.dev/" target="_blank" className={linkClass}>
                <img className="h-[18px]" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li className="max-lg:flex-[1_1_calc(50%-8px)] lg:flex-none">
              <a href="https://react.dev/" target="_blank" className={linkClass}>
                <img className="size-[18px]" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div className={sectionClass}>
          <svg
            className="mb-4 size-[22px] max-lg:mx-auto"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2 className="text-lg font-medium">Connect with us</h2>
          <p className="text-muted-foreground">Join the Vite community</p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:mt-8 lg:justify-start">
            {[
              ['https://github.com/vitejs/vite', 'github-icon', 'GitHub'],
              ['https://chat.vite.dev/', 'discord-icon', 'Discord'],
              ['https://x.com/vite_js', 'x-icon', 'X.com'],
              ['https://bsky.app/profile/vite.dev', 'bluesky-icon', 'Bluesky'],
            ].map(([href, icon, label]) => (
              <li
                key={label}
                className="max-lg:flex-[1_1_calc(50%-8px)] lg:flex-none"
              >
                <a href={href} target="_blank" className={linkClass}>
                  <svg
                    className="size-[18px]"
                    role="presentation"
                    aria-hidden="true"
                  >
                    <use href={`/icons.svg#${icon}`}></use>
                  </svg>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={ticks}></div>
      <section className="h-12 border-t lg:h-[88px]"></section>
    </div>
  )
}

export default App
