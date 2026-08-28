import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();

  const protocol = forwardedProto || url.protocol.replace(":", "");
  let host = forwardedHost || request.headers.get("host") || url.host;

  if (host.endsWith(".app.github.dev:3000")) {
    host = host.replace(/:3000$/, "");
  }

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");

  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";

  const publicOrigin = getPublicOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${publicOrigin}/login?error=auth_callback`
  );
}