import {LocaleEnum} from '@/definitions';
import {DatahubConstituentSearcher} from '@colonial-collections/api';
import {getLocale} from 'next-intl/server';
import {NextRequest} from 'next/server';
import {env} from 'node:process';

// Constructed on first request, not at module load: the constructor validates
// its options, and `next build` imports route modules while collecting page
// data — in the container image build no runtime env exists yet.
let datahubConstituentSearcher: DatahubConstituentSearcher | undefined;
function getSearcher() {
  datahubConstituentSearcher ??= new DatahubConstituentSearcher({
    endpointUrl: env.SEARCH_ENDPOINT_URL as string,
  });
  return datahubConstituentSearcher;
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
