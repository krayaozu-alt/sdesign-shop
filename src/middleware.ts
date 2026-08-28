import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'sds_session';

/**
 * Premiere barriere : refuse l'acces aux espaces prives sans session valide.
 * Le controle fin des roles est refait cote serveur dans chaque layout
 * (admin/layout.tsx, espace/layout.tsx) - le middleware ne remplace pas la
 * verification metier, il evite juste le rendu inutile.
 */
const PROTECTED = ['/admin', '/espace'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const loginUrl = new URL('/connexion', request.url);
  loginUrl.searchParams.set('suite', pathname);

  if (!token) return NextResponse.redirect(loginUrl);

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '');
    await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/espace/:path*'],
};
