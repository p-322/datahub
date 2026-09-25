import {PostalAddress} from '@p-322/api';

interface Props {
  address?: PostalAddress;
}

/**
 * The data provider's location on a map. Not rendered: the object page no
 * longer mounts this, and the geocoding request below is commented out so
 * nothing reaches Nominatim even if something does mount it.
 *
 * Three things were wrong with the request, kept here because they all have
 * to be answered before this comes back:
 *
 * 1. No `User-Agent`. OpenStreetMap's Nominatim policy requires one that
 *    identifies the application, and refuses requests without it — which is
 *    what "Access denied" in the journal was. The Wikidata searcher in
 *    packages/api/src/enrichments does this correctly and is the example to
 *    follow.
 * 2. One request per page render. The object page is `force-dynamic`, so a
 *    museum's unchanging address was resolved afresh for every visitor to
 *    every object. That is the systematic querying the rate limit exists to
 *    stop. An explicit `next: {revalidate}` survives `force-dynamic` (Next
 *    reads `fetchCache`, which this app never sets), so caching is available
 *    — but the real answer is coordinates in the index, resolved once by the
 *    pipeline.
 * 3. One `catch` for everything. A blocked request, an address that matches
 *    nothing, and `responseData[0]` being undefined all returned null in
 *    silence, so a missing map looked like an object with no location.
 */
export default async function MapByAddress({address}: Props) {
  if (!address) {
    return null;
  }

  return null;

  /* Kept verbatim for whoever brings this back.

  const addressString = [
    address.streetAddress,
    address.postalCode,
    address.addressLocality,
    address.addressCountry,
  ]
    .filter(n => n)
    .join(',');

  try {
    // The map component needs longitude and latitude to display the location.
    // We can use the OpenStreetMap API to get these coordinates from the address.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        addressString
      )}`
    );

    const responseData = await response.json();
    const location = responseData[0];

    return <Map lat={location.lat} lon={location.lon} />;
  } catch (error) {
    console.error('Error fetching location data:', error);
    return null;
  }
  */
}
