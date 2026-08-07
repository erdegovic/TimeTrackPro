import * as React from "react"

/**
 * The application shell keeps the navigation in a drawer until there is room
 * for a 256px sidebar *and* a usable content column. Below 1024px an in-flow
 * sidebar leaves the time tracker rows too narrow to render without collapsing,
 * so the drawer breakpoint intentionally matches Tailwind's `lg`.
 */
const MOBILE_BREAKPOINT = 1024

/** Width at which the creative panel can dock without squeezing the content column. */
const CREATIVE_PANEL_BREAKPOINT = 1280

const readMatch = (breakpoint: number) => {
  if (typeof window === "undefined") return false
  return window.innerWidth < breakpoint
}

function useBreakpoint(breakpoint: number) {
  // Seeded synchronously so the first paint already matches the viewport.
  // Returning `false` on the first render made phones paint the desktop shell
  // for a frame before snapping to the drawer layout.
  const [isBelow, setIsBelow] = React.useState<boolean>(() => readMatch(breakpoint))

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setIsBelow(window.innerWidth < breakpoint)

    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isBelow
}

export function useIsMobile() {
  return useBreakpoint(MOBILE_BREAKPOINT)
}

/** True while the viewport is too narrow to dock the creative panel beside the content. */
export function useIsCreativePanelCompact() {
  return useBreakpoint(CREATIVE_PANEL_BREAKPOINT)
}
