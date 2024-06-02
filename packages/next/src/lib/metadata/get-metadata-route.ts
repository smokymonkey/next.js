import { isMetadataRoute } from './is-metadata-route'
import path from '../../shared/lib/isomorphic/path'
import { interpolateDynamicPath } from '../../server/server-utils'
import { getNamedRouteRegex } from '../../shared/lib/router/utils/route-regex'
import { djb2Hash } from '../../shared/lib/hash'
import { normalizeAppPath } from '../../shared/lib/router/utils/app-paths'
import { normalizePathSep } from '../../shared/lib/page-path/normalize-path-sep'

/*
 * If there's special convention like (...) or @ in the page path,
 * Give it a unique hash suffix to avoid conflicts
 *
 * e.g.
 * /app/opengraph-image.tsx -> /opengraph-image
 * /app/(post)/opengraph-image.tsx -> /opengraph-image-[0-9a-z]{6}
 */
function getMetadataRouteSuffix(page: string) {
  let suffix = ''

  if ((page.includes('(') && page.includes(')')) || page.includes('@')) {
    suffix = djb2Hash(page).toString(36).slice(0, 6)
  }
  return suffix
}

/**
 * Fill the dynamic segment in the metadata route
 *
 * Example:
 * fillMetadataSegment('/a/[slug]', { params: { slug: 'b' } }, 'open-graph') -> '/a/b/open-graph'
 *
 */
export function fillMetadataSegment(
  segment: string,
  params: any,
  imageSegment: string
) {
  const pathname = normalizeAppPath(segment)
  const routeRegex = getNamedRouteRegex(pathname, false)
  const route = interpolateDynamicPath(pathname, params, routeRegex)
  const suffix = getMetadataRouteSuffix(segment)
  const routeSuffix = suffix ? `-${suffix}` : ''

  const { name, ext } = path.parse(imageSegment)

  return normalizePathSep(path.join(route, `${name}${routeSuffix}${ext}`))
}

function isDynamicMetadataRoute(page: string) {
  return page.endsWith('[]')
}

/**
 * Map metadata page key to the corresponding route
 *
 * static file page key:    /app/robots.txt -> /robots.xml -> /robots.txt/route
 * dynamic route page key:  /app/robots.tsx -> /robots -> /robots.txt/route
 *
 * @param page
 * @returns
 */
export function normalizeMetadataRoute(page: string) {
  if (!isMetadataRoute(page)) {
    return page
  }
  let route = page
  let suffix = ''
  if (page === '/robots') {
    route += '.txt'
  } else if (page === '/manifest') {
    route += '.webmanifest'
  } else if (page.endsWith('/sitemap')) {
    route += '.xml'
  } else {
    // Remove the file extension,
    // e.g. /path/robots.txt -> /route-path
    // e.g. /path/opengraph-image.tsx -> /path/opengraph-image
    const pathnamePrefix = page.slice(0, -(path.basename(page).length + 1))
    suffix = getMetadataRouteSuffix(pathnamePrefix)
  }
  // Support both /<metadata-route.ext> and custom routes /<metadata-route>/route.ts.
  // If it's a metadata file route, we need to append /[id]/route to the page.
  if (!route.endsWith('/route')) {
    const { dir, name: baseName, ext } = path.parse(route)
    const isDynamicMultiMetadataRoute = isDynamicMetadataRoute(page)
    const normalizedBaseName = isDynamicMultiMetadataRoute
      ? baseName.slice(0, -2)
      : baseName

    // For multi-dynamic metadata routes, generate a sub-route segment.
    // e.g. /opengraph-image[].js -> /opengraph-image/[__metadata_id__]/route
    // e.g. /sitemap[].js -> /sitemap/[__metadata_id__]/route
    route = path.posix.join(
      dir,
      `${normalizedBaseName}${suffix ? `-${suffix}` : ''}${ext}`,
      isDynamicMultiMetadataRoute ? '[__metadata_id__]' : '',
      'route'
    )
  }

  return route
}
