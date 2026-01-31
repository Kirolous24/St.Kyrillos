'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: React.ReactNode
  href?: string
  external?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-900 text-white hover:bg-primary-950 active:bg-primary-950 focus-visible:ring-primary-900',
  secondary: 'bg-white text-primary-900 border-2 border-primary-900 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-900',
  ghost: 'bg-transparent text-primary-900 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-900',
  gold: 'bg-gold text-white hover:bg-gold-dark active:bg-gold-dark focus-visible:ring-gold',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      className,
      children,
      href,
      external,
      disabled,
      type = 'button',
      onClick,
      ...rest
    } = props

    const combinedClassName = cn(baseStyles, variantStyles[variant], sizeStyles[size], className)

    // If href is provided, render as Link
    if (href) {
      if (external) {
        return (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={combinedClassName}
            onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
            {...rest}
          >
            {children}
          </a>
        )
      }

      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={combinedClassName}
          onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
          {...rest}
        >
          {children}
        </Link>
      )
    }

    // Otherwise render as button
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        disabled={disabled}
        className={combinedClassName}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        {...rest}
      >
        {children}
      </button>
    )
  }
)
