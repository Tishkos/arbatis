'use client';

import { useEffect } from 'react';

/**
 * FontSizeProvider
 * Applies font size from localStorage to the document root on initial load
 * Defaults to 90% if no saved value exists
 */
export function FontSizeProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('app-font-size');
      const fontSize = savedFontSize ? parseInt(savedFontSize) : 90;
      
      // Apply font size immediately
      document.documentElement.style.fontSize = `${fontSize}%`;
      
      // If no saved value exists, save the default
      if (!savedFontSize) {
        localStorage.setItem('app-font-size', '90');
      }
    }
  }, []);

  return null;
}

