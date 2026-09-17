import {LocaleEnum} from '@/definitions';
import {GeoNamesLocationSearcher} from '@colonial-collections/api';
import {getLocale} from 'next-intl/server';
import {NextRequest} from 'next/server';
import {env} from 'node:process';

// Constructed on first request, not at module load (see api/datahub/route.ts).
let geoNamesLocationSearcher: GeoNamesLocationSearcher | undefined;
function getSearcher() {
  geoNamesLocationSearcher ??= new GeoNamesLocationSearcher({
    username: env.GEONAMES_USERNAME as string,
  });
  return geoNamesLocationSearcher;
}

export async function GET(request: NextRequest) {
  const locale = (await getLocale()) as LocaleEnum;
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const result = await getSearcher().search({
    query: query || '',
    locale,
    limit: 10,
  });

  return Response.json(result.things);
}
