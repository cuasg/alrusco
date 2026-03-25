import { useEffect, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

const DOTLOTTIE_SRC =
  'https://lottie.host/b11950b3-dce3-4b40-bb1e-ede0894ab66f/VDi80P0yAx.lottie'

/**
 * Hero visual when no banner image is set — Little Power Robot via LottieFiles dotLottie host.
 */
export function HomeHeroLottie() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <div className="home-hero-lottie">
      <div className="home-hero-lottie-frame">
        <DotLottieReact
          className="home-hero-lottie-player"
          src={DOTLOTTIE_SRC}
          loop={!reduceMotion}
          autoplay={!reduceMotion}
        />
      </div>
    </div>
  )
}
