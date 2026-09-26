import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        success:
          'bg-success/15 text-success border border-success/30 hover:bg-success/20',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20',
        warning:
          'bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
