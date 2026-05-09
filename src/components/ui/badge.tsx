import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'orange' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-slate-100 text-slate-700': variant === 'default',
          'bg-orange-100 text-orange-700': variant === 'orange',
          'bg-green-100 text-green-700': variant === 'green',
          'bg-yellow-100 text-yellow-700': variant === 'yellow',
          'bg-red-100 text-red-700': variant === 'red',
          'bg-blue-100 text-blue-700': variant === 'blue',
          'bg-purple-100 text-purple-700': variant === 'purple',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
