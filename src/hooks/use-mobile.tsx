import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    
    // Check on mount (only on client)
    checkIsMobile();
    
    // Add event listener
    window.addEventListener("resize", checkIsMobile);

    // Remove event listener on cleanup
    return () => {
        window.removeEventListener("resize", checkIsMobile);
    }
  }, [])

  return isMobile
}
