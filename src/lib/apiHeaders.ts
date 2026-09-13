const NO_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
};

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_CACHE_HEADERS });
}
