import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but never rejects a request for a missing or
 * invalid token — it just leaves `req.user` unset in that case, rather
 * than throwing. Used only by AuthController.register, which needs to
 * know WHETHER a valid token was presented (to decide if this is the
 * bootstrap case — zero users exist yet — or a real, SUPER_ADMIN-gated
 * registration) without unconditionally requiring one; the bootstrap
 * case, by definition, has no token to present yet, since no user (and
 * so no SUPER_ADMIN) exists to have issued one.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    _info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    // Deliberately swallow any error / missing-user case instead of
    // throwing (the default AuthGuard behavior) — always let the
    // request through regardless; the controller itself inspects
    // req.user and decides what its absence or presence means.
    return user || undefined as TUser;
  }
}
