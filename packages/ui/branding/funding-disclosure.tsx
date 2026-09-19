import Image from 'next/image';
import classNames from 'classnames';
import euEmblem from './partners/eu-emblem-official.png';
import ukriEmblem from './partners/ukri-emblem-official.png';

interface Props {
  className?: string;
}

/**
 * EU / UKRI funding disclosure required under the ECHOES cascading grant.
 * The text is a legal formula and is deliberately not translated.
 */
export function FundingDisclosure({className}: Props) {
  return (
    <div
      aria-label="Funding disclosure"
      className={classNames(
        'grid gap-4 sm:grid-cols-[300px_minmax(0,1fr)] items-start text-sm leading-relaxed',
        className
      )}
    >
      <div className="grid gap-3">
        <Image
          src={euEmblem}
          alt="European Union emblem"
          className="w-[250px] h-auto"
        />
        <Image
          src={ukriEmblem}
          alt="UK Research and Innovation emblem"
          className="w-[150px] h-auto"
        />
      </div>
      <div className="flex flex-col gap-3">
        <p>
          Sawubona Commons has received support through a cascading grant from
          ECHOES, which is funded by the European Union under Grant Agreement
          No. 101157364, with the support of UK Research and Innovation (UKRI)
          under the UK Government’s Horizon Europe funding guarantee No.
          10110142 and No. 10110466.
        </p>
        <p>
          Funded by the European Union. Views and opinions expressed are however
          those of the author(s) only and do not necessarily reflect those of
          the European Union or ECHOES. Neither the European Union nor the
          granting authority can be held responsible for them.
        </p>
      </div>
    </div>
  );
}
