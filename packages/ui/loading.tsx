import classNames from 'classnames';

interface Props {
  variant: 'blue' | 'green';
}

/**
 * The full-page loading screen.
 *
 * A plain circular spinner. What it replaced was the Colonial Collections
 * logo — the six-petal mark — which this fork inherited and which is not
 * Sawubona's to display, least of all as the first thing a visitor sees.
 */
export function Loading({variant}: Props) {
  const loadingClassName = classNames(
    'w-full min-h-[80vh] flex justify-center items-center',
    {
      'text-accent-600 bg-accent-300': variant === 'green',
      'text-accent-300 bg-ink-800': variant === 'blue',
    }
  );

  return (
    <div
      data-testid="loading-element"
      className={loadingClassName}
      role="status"
    >
      {/* A ring with one brighter quarter turning in it. Both strokes take
          the colour from the wrapper, so each variant keeps its own. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="w-10 h-10 animate-spin"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
