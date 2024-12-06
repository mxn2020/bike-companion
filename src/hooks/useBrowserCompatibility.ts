import { useEffect, useState } from "react";

// hooks/useBrowserCompatibility.ts
export function useBrowserCompatibility() {
    const [isCompatible, setIsCompatible] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
    useEffect(() => {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        setErrorMessage(
          "Your browser doesn't support Bluetooth functionality. " + 
          "Please use Chrome, Edge, or another compatible browser. " +
          "iOS Safari is currently not supported."
        );
        return;
      }
      setIsCompatible(true);
    }, []);
  
    return { isCompatible, errorMessage };
  }
  