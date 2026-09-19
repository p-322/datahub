import classNames from 'classnames';

interface Props {
  /** Optional second line, e.g. "Datahub". */
  tagline?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Sawubona Commons has no logo mark; the site sets the name as a light,
 * widely tracked uppercase wordmark. This mirrors that treatment.
 */
export function Wordmark({tagline, size = 'md', className}: Props) {
  return (
    <span
      className={classNames(
        'inline-flex flex-col leading-none uppercase text-current no-underline',
        className
      )}
    >
      <span
        className={classNames('font-medium tracking-heading', {
          'text-base': size === 'sm',
          'text-xl sm:text-2xl': size === 'md',
          'text-4xl sm:text-6xl lg:text-7xl tracking-[0.08em]': size === 'lg',
        })}
      >
        Sawubona Commons
      </span>
      {tagline && (
        <span
          className={classNames('font-bold tracking-kicker opacity-80', {
            'text-[0.55rem] mt-0.5': size === 'sm',
            'text-[0.6rem] sm:text-xs mt-1': size === 'md',
            'text-xs sm:text-sm mt-3': size === 'lg',
          })}
        >
          {tagline}
        </span>
      )}
    </span>
  );
}
