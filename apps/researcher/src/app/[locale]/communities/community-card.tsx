import {Community} from '@/lib/community/definitions';
import {getTranslations} from 'next-intl/server';
import {useTranslations} from 'next-intl';
import {Link} from '@/navigation';
import Image from 'next/image';
import {Suspense} from 'react';
import {objectList} from '@p-322/database';

interface MembershipCountProps {
  communityId: string;
}

async function ObjectListCount({communityId}: MembershipCountProps) {
  const t = await getTranslations('Communities');

  try {
    const objectListCount = await objectList.countByCommunityId(communityId);
    return (
      <>
        {t.rich('objectListCount', {
          count: objectListCount,
        })}
      </>
    );
  } catch (err) {
    console.error(err);
    return <>{t('objectListCountError')}</>;
  }
}

interface CommunityCardProps {
  community: Community;
}

export default function CommunityCard({community}: CommunityCardProps) {
  const t = useTranslations('Communities');

  // The same surface as the frosted search card on the home page: rounded,
  // lightly shaded, lifting to the full card shadow on hover. The avatar sits
  // inside the card, small and in greyscale, so a row of cards reads as text
  // first and pictures second.
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="frost-card shadow-card-sm hover:shadow-card transition-shadow group flex flex-col gap-4 p-6 text-ink-800 no-underline"
      tabIndex={0}
    >
      <div className="flex items-center gap-4">
        <Image
          width={56}
          height={56}
          src={community.imageUrl}
          alt=""
          className="w-14 h-14 shrink-0 rounded-full object-cover grayscale"
        />
        <h2 className="text-lg leading-snug">
          {t.rich('communityName', {
            name: () => (
              <strong
                className="font-semibold"
                data-testid="community-item-name"
              >
                {community.name}
              </strong>
            ),
          })}
        </h2>
      </div>

      {community.description && (
        <p className="text-ink-600 line-clamp-3">{community.description}</p>
      )}

      <ul className="mt-auto flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-600">
        <li>
          {t.rich('membershipCount', {
            count: community.membershipCount,
          })}
        </li>
        <li>
          <Suspense>
            <ObjectListCount communityId={community.id} />
          </Suspense>
        </li>
      </ul>
    </Link>
  );
}
