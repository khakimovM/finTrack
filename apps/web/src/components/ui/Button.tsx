import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring',
        // Old name for primary, kept while pages move over.
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring',
        secondary: 'bg-secondary text-text hover:bg-secondary-hover focus-visible:ring-ring',
        outline:
          'border border-input bg-card text-text hover:bg-secondary focus-visible:ring-ring',
        ghost: 'text-text-secondary hover:bg-secondary hover:text-text focus-visible:ring-ring',
        destructive: 'bg-danger text-danger-foreground hover:bg-danger-hover focus-visible:ring-danger',
        'destructive-ghost': 'text-danger hover:bg-danger-soft focus-visible:ring-danger',
        link: 'h-auto rounded-sm px-0 text-text underline decoration-input underline-offset-[3px] hover:decoration-text focus-visible:ring-ring',
      },
      size: {
        // 44 on touch screens, 40 from the tablet breakpoint (design: "md 40/44").
        md: 'h-11 px-[18px] text-[14px] sm:h-10',
        default: 'h-11 px-[18px] text-[14px] sm:h-10',
        sm: 'h-9 px-3.5 text-[13px]',
        xs: 'h-8 px-3 text-[13px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
        'icon-sm': 'h-9 w-9',
        'icon-xs': 'h-8 w-8',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Keeps the button's width and swaps its content for a spinner. */
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, asChild = false, disabled, children, type, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), loading && 'disabled:cursor-progress disabled:opacity-[.85]', className);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
        className: cn(classes, (children.props as { className?: string }).className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center gap-2">{children}</span>
            <LoaderCircle className="absolute h-[18px] w-[18px] animate-ft-spin" aria-hidden />
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { buttonVariants };
