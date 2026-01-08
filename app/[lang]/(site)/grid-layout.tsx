'use client'

interface GridLayoutProps {
  children: React.ReactNode
  className?: string
}

export const GridLayout = ({ children, className = '' }: GridLayoutProps) => {
  return (
    <div className={`relative ${className}`}>
      {/* Background Grid Lines Container */}
      <div className='pointer-events-none fixed inset-0 z-10' aria-hidden='true'>
        <div className='mx-auto h-full max-w-6xl px-4 sm:px-6'>
          <div className='relative h-full'>
            {/* Left vertical line */}
            <div className='absolute left-0 top-0 h-full w-px bg-[#E4E4E7]' />
            {/* Right vertical line */}
            <div className='absolute right-0 top-0 h-full w-px bg-[#E4E4E7]' />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='relative z-20'>{children}</div>
    </div>
  )
}

interface SectionDividerProps {
  className?: string
}

export const SectionDivider = ({ className = '' }: SectionDividerProps) => {
  return (
    <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>
      <div className='h-px w-full bg-[#E4E4E7]' />
    </div>
  )
}
