import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Activates the 'jwt' Passport strategy (JwtStrategy) to populate
// request.user from a valid Bearer token. MUST run BEFORE RolesGuard in
// @UseGuards(...) — Nest runs guards in array order, and RolesGuard
// assumes request.user is already populated by the time it runs.
//
// Found missing during a Docker Compose integration review (tracing
// actual request flows end to end, rather than reviewing each file in
// isolation): RolesGuard was applied on ArticlesController and
// TenantsController, but nothing anywhere ever activated the JWT strategy
// to populate request.user — every protected request would have failed
// with a 403 ("No authenticated user context found"), regardless of
// whether a valid token was sent. This guard closes that gap.
//
// Applied at the METHOD level on protected routes (not the controller
// class level) where a controller also has genuinely public endpoints
// (e.g. ArticlesController.findOne, the canonical-site article lookup) —
// applying it class-wide would incorrectly require a token on those too.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
