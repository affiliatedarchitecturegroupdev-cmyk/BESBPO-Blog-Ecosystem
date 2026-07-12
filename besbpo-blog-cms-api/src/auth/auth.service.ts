import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './jwt.strategy';
import { UsersService } from '../users/users.service';

// Mirrors besbpo-blog-syndication-svc's internal/middleware.ServiceClaims
// shape ({ service: string } + registered claims). Keep these two in sync
// if either changes — there's no shared schema between a NestJS and a Go
// repo, so this comment is the sync point.
export interface ServiceJwtPayload {
  service: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

// A syntactically valid bcrypt hash (correct $2b$<cost>$<53 chars> shape)
// that doesn't correspond to any real password — see login()'s comment
// for why this exists at all. Its exact characters are meaningless (a
// bcrypt hash reveals nothing about the input without also having the
// plaintext), only its SHAPE matters, so there's nothing sensitive about
// this being a literal in source.
const DUMMY_HASH_FOR_TIMING_SAFETY = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8O9Q9Q9Q9Q9Q9Q9Q9Q9Q9Q9Q9Q9Qy';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Real per-user login (Doc-01 Section 8 / Doc-04 Section 5) — replaces
   * the single shared admin JWT every service and the dashboard ran on
   * before this. Deliberately NOT SSO/OIDC against a specific external
   * identity provider (see UsersService's header comment for the full
   * reasoning); this is genuine per-account login with a hashed
   * password, which real SSO could sit on top of later without a
   * rewrite.
   *
   * Returns null uniformly for BOTH "no such user" and "wrong password"
   * — the caller (AuthController) must not be able to tell the two
   * apart from this return value, or it would let someone enumerate
   * which email addresses have accounts by trying logins and reading
   * the difference in the response.
   *
   * Also runs bcrypt.compare even when no user was found (against a
   * dummy hash), rather than short-circuiting immediately — bcrypt.compare
   * is deliberately slow (~100ms+), so returning instantly for "no such
   * user" while a real user's wrong-password attempt takes ~100ms longer
   * would leak the same enumeration signal through response TIMING even
   * with an identical return value. Constant-ish time either way, not
   * just constant output.
   */
  async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await this.usersService.findByEmailForAuth(email);

    const hashToCompare = user?.passwordHash ?? DUMMY_HASH_FOR_TIMING_SAFETY;
    const passwordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordValid) {
      return null;
    }

    const payload: JwtPayload = { sub: user.id, roles: user.roles, email: user.email, displayName: user.displayName };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles },
    };
  }

  // Placeholder issuance path for anything that still needs a bare,
  // hand-constructed payload signed directly (e.g. internal tooling) —
  // login() above is the real, actual authentication path now; this
  // remains for callers that aren't a human logging in.
  issueToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  // Issues a short-lived service-to-service token — used by WebhooksService
  // when it calls besbpo-blog-syndication-svc's publish webhook (Doc-02
  // Section 7), which verifies it via RequireServiceJWT
  // (internal/middleware/jwt.go in that repo).
  //
  // SHARED SECRET CAVEAT: this signs with the same JwtService/JWT_SECRET
  // used for admin tokens (see jwt.strategy.ts) — besbpo-blog-syndication-svc
  // currently expects that too (its ADMIN_JWT_SECRET and SERVICE_JWT_SECRET
  // must both match this service's JWT_SECRET until a distinct
  // service-signing key is introduced on both sides). See the header
  // comment in that repo's internal/middleware/jwt.go for the full
  // explanation — flagged there and here so neither side's comment goes
  // stale without the other being updated too.
  issueServiceToken(service: string): string {
    const payload: ServiceJwtPayload = { service };
    return this.jwtService.sign(payload, { expiresIn: '5m' });
  }
}
