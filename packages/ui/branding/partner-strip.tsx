import Image from 'next/image';
import classNames from 'classnames';
import echoes from './partners/echoes-eccch.png';
import wereldmuseum from './partners/wereldmuseum.png';
import plimpton from './partners/plimpton-322-mail-footer.png';

const partners = [
  {name: 'ECHOES-ECCCH', href: 'https://www.echoes-eccch.eu', image: echoes},
  {
    name: 'Wereldmuseum',
    href: 'https://welkom.wereldmuseum.nl',
    image: wereldmuseum,
  },
  {name: 'Plimpton 322', href: 'https://p-322.com', image: plimpton},
];

interface Props {
  direction?: 'row' | 'column';
  className?: string;
}

/** The three project partners, as on sawubona-commons.eu. */
export function PartnerStrip({direction = 'row', className}: Props) {
  return (
    <div
      aria-label="Partners"
      className={classNames(
        'flex gap-x-6 gap-y-3',
        direction === 'row' ? 'flex-row flex-wrap items-center' : 'flex-col',
        className
      )}
    >
      {partners.map(partner => (
        <a
          key={partner.href}
          href={partner.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={partner.name}
          className="no-underline transition hover:-translate-y-px hover:opacity-90"
        >
          <Image
            src={partner.image}
            alt={partner.name}
            className="h-9 w-auto max-w-[7.6rem] object-contain object-left"
          />
        </a>
      ))}
    </div>
  );
}
