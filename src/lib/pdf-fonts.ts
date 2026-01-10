/**
 * PDF Font Utilities
 * Helper functions for rendering text in jsPDF with proper Kurdish/Arabic support
 * Uses canvas rendering for RTL languages to ensure proper font rendering
 */

/**
 * Check if text contains Kurdish/Arabic characters
 */
export function containsRTLText(text: string): boolean {
  // Check for Kurdish/Arabic Unicode ranges
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(text)
}

/**
 * Render text to canvas and return as data URL
 * This ensures proper Kurdish/Arabic font rendering using browser fonts
 */
export async function renderTextToImage(
  text: string,
  fontSize: number,
  fontFamily: string = 'Arial',
  fontWeight: string = 'normal',
  textColor: string = '#000000',
  backgroundColor: string = 'transparent',
  direction: 'ltr' | 'rtl' = 'ltr',
  padding: number = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary element to get the actual computed font
      const tempEl = document.createElement('div')
      if (fontFamily.includes('var(--font-kurdish)') || fontFamily.includes('--font-kurdish')) {
        tempEl.className = 'font-kurdish'
      }
      tempEl.style.position = 'absolute'
      tempEl.style.visibility = 'hidden'
      tempEl.style.fontSize = `${fontSize}px`
      tempEl.style.fontWeight = fontWeight
      tempEl.style.fontFamily = fontFamily
      document.body.appendChild(tempEl)
      
      const computedStyle = window.getComputedStyle(tempEl)
      const actualFontFamily = computedStyle.fontFamily
      document.body.removeChild(tempEl)
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Use the actual computed font family
      ctx.font = `${fontWeight} ${fontSize}px ${actualFontFamily}`
      ctx.direction = direction
      ctx.textAlign = direction === 'rtl' ? 'right' : 'left'
      ctx.textBaseline = 'top'
      
      // Measure text
      const metrics = ctx.measureText(text)
      const textWidth = Math.ceil(metrics.width)
      const textHeight = fontSize
      
      // Set canvas size with padding
      canvas.width = textWidth + (padding * 2)
      canvas.height = textHeight + (padding * 2)
      
      // Clear and set background
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      
      // Reset font and settings after resize
      ctx.font = `${fontWeight} ${fontSize}px ${actualFontFamily}`
      ctx.direction = direction
      ctx.textAlign = direction === 'rtl' ? 'right' : 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = textColor
      
      // Draw text
      const x = direction === 'rtl' ? canvas.width - padding : padding
      ctx.fillText(text, x, padding)
      
      // Convert to data URL
      resolve(canvas.toDataURL('image/png'))
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Get font family based on language
 * For canvas rendering, we need the actual computed font name, not CSS variables
 */
export function getFontFamily(language: 'ku' | 'en' | 'ar'): string {
  if (typeof window === 'undefined') {
    // Server-side: return fallback
    if (language === 'ku' || language === 'ar') {
      return '"Noto Sans Arabic", "Arial Unicode MS", Arial, sans-serif'
    }
    return 'Arial, sans-serif'
  }
  
  if (language === 'ku') {
    // Get the actual computed font from CSS variable
    // Create a temporary element to get the computed font
    const tempEl = document.createElement('div')
    tempEl.className = 'font-kurdish'
    tempEl.style.position = 'absolute'
    tempEl.style.visibility = 'hidden'
    tempEl.style.fontSize = '16px'
    document.body.appendChild(tempEl)
    
    const computedFont = window.getComputedStyle(tempEl).fontFamily
    document.body.removeChild(tempEl)
    
    // Extract the first font family (before comma)
    const firstFont = computedFont.split(',')[0].trim().replace(/['"]/g, '')
    
    // Return the actual font name or fallback
    return firstFont || '"Noto Sans Arabic", "Arial Unicode MS", Arial, sans-serif'
  } else if (language === 'ar') {
    return '"Noto Sans Arabic", "Arial Unicode MS", Arial, sans-serif'
  } else {
    return 'Arial, sans-serif'
  }
}

/**
 * Load and register Kurdish font for jsPDF
 * Note: The font must be converted using jsPDF's font converter tool first
 */
export async function loadKurdishFont(doc: any): Promise<boolean> {
  try {
    // Import the font file - it registers itself via jsPDF.API.events
    await import('../../public/assets/fonts/ku-font.js')
    
    // The font file registers the font via jsPDF.API.events
    // The font name is 'ku' based on the font file structure
    // Wait a bit for the event to fire, then try to use the font
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      // Try to use the font - if it works, it's registered
      doc.setFont('ku', 'normal')
      return true
    } catch (e) {
      // Font might not be registered yet, but that's okay
      // The events should handle it
      return false
    }
  } catch (error) {
    console.warn('Kurdish font not available:', error)
    return false
  }
}

/**
 * Get the appropriate font for the PDF language
 */
export function getPDFFont(language: 'ku' | 'en' | 'ar', customFontAvailable: boolean = false): string {
  if (language === 'ku' && customFontAvailable) {
    // Use custom Kurdish font if available (font name is 'ku')
    return 'ku'
  } else if (language === 'ku' || language === 'ar') {
    // Use 'times' for Kurdish/Arabic - has better Unicode support than 'helvetica'
    // Note: This still won't render Kurdish perfectly, but is better than helvetica
    return 'times'
  } else {
    // Use 'helvetica' for English
    return 'helvetica'
  }
}

