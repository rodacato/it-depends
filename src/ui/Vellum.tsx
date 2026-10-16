import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  x: number;
  y: number;
  w: number;
  h?: number;
  rotate?: number;
  children: ReactNode;
  className?: string;
  label?: string;
  testId?: string;
  from?: 'right' | 'left' | 'top';
  style?: CSSProperties;
}

// Drafting film taped over the blueprint at an angle. It slides on and off; it never floats.
const MECHANICAL = [0.2, 0.7, 0.2, 1] as const;

export function Vellum({ x, y, w, h, rotate = -1.2, children, className = '', label, testId, from = 'right', style }: Props) {
  const reduced = useReducedMotion();
  const offset = from === 'right' ? { x: 520 } : from === 'left' ? { x: -520 } : { y: -420 };
  return (
    <motion.section
      className={`vellum ${className}`}
      aria-label={label}
      data-testid={testId}
      style={{ left: x, top: y, width: w, height: h, ...style }}
      initial={reduced ? { rotate } : { ...offset, rotate: rotate + 3 }}
      animate={{ x: 0, y: 0, rotate }}
      exit={reduced ? { opacity: 0 } : { ...offset, rotate: rotate + 3 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: MECHANICAL }}
    >
      <span className="tape tape-l" aria-hidden="true" />
      <span className="tape tape-r" aria-hidden="true" />
      <div className="vellum-body">{children}</div>
    </motion.section>
  );
}
