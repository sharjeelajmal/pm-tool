const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_CACHE_HEADERS });
}