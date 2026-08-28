import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

/** Deconnexion : utilisee par le formulaire du menu (POST) et le lien direct (GET). */
function clear(request: Request) {
  const url = new URL('/', request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

export async function POST(request: Request) {
  return clear(request);
}

export async function GET(request: Request) {
  return clear(request);
}
