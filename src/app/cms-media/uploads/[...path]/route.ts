// Resolve the CMS origin at request time: Docker injects STRAPI_URL at runtime.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    path.some(
      (segment) =>
        !segment ||
        /[\\/]/.test(segment) ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return new Response(null, { status: 400 });
  }

  const origin = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(
    /\/$/,
    "",
  );
  const url = new URL(
    `${origin}/uploads/${path.map(encodeURIComponent).join("/")}`,
  );
  url.search = new URL(request.url).search;

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    if (!upstream.ok) {
      return new Response(null, { status: upstream.status });
    }

    const headers = new Headers();
    for (const name of [
      "content-type",
      "cache-control",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { headers });
  } catch (error) {
    console.error("Strapi media request failed", error);
    return new Response(null, { status: 502 });
  }
}
