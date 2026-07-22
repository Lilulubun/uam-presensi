import { type ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps page content with a subtle CSS @starting-style entry animation.
 * Fades in from opacity 0 and slides up 6px over 200ms.
 * Respects prefers-reduced-motion: drops the translate, keeps only a fast opacity fade.
 */
export default function PageTransition({ children }: PageTransitionProps) {
  return <div className="page-enter">{children}</div>;
}
