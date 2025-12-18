import React from 'react'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({ className = '', showText = true, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl'
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo SVG - Interlocking arrows with rounded pill shapes */}
      <svg
        className={sizeClasses[size]}
        viewBox="0 0 40 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left arrow shape - top segment (light blue) */}
        <rect x="2" y="4" width="12" height="6" rx="3" fill="#60A5FA" />
        <path d="M14 7 L18 4 L18 10 Z" fill="#60A5FA" />
        
        {/* Left arrow shape - bottom segment (light green) */}
        <rect x="2" y="14" width="12" height="6" rx="3" fill="#34D399" />
        <path d="M14 17 L18 20 L18 14 Z" fill="#34D399" />
        
        {/* Right arrow shape - top segment (light green) */}
        <rect x="18" y="2" width="12" height="6" rx="3" fill="#34D399" />
        <path d="M30 5 L34 2 L34 8 Z" fill="#34D399" />
        
        {/* Right arrow shape - bottom segment (light blue) */}
        <rect x="18" y="12" width="12" height="6" rx="3" fill="#60A5FA" />
        <path d="M30 15 L34 18 L34 12 Z" fill="#60A5FA" />
      </svg>

      {/* Text */}
      {showText && (
        <div className={`flex items-baseline ${textSizes[size]}`}>
          <span className="text-white font-semibold">EHealthMed</span>
          <span className="text-teal-400 font-semibold relative inline-block">
            .a
            <span className="relative inline-block">
              i
              {/* Square dot above 'i' */}
              <span className="absolute -top-0.5 left-0.5 w-1 h-1 bg-teal-400 transform rotate-45"></span>
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

