import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;          // user id
  roles: string[];
  divisionId?: string;
  /** Denormalized display fields — included so a consumer (the
   * Editorial Dashboard's session cookie, specifically) can show "logged
   * in as X" without a separate lookup call. Accepted tradeoff: these
   * can go stale if a user's email/display name changes before their
   * token expires (bounded by JWT_EXPIRES_IN, 15m by default) — fine for
   * an internal tool's display purposes, never used for any
   * access-control decision (roles/sub are what matters for that). */
  email?: string;
  displayName?: string;
}

// Validates the admin JWT described in Doc-02 Section 4 ("adminJwt" security
// scheme in openapi/syndication-api.yaml). Issued elsewhere (e.g. an SSO
// callback handler) — this strategy only verifies and shapes `request.user`.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      roles: payload.roles ?? [],
      divisionId: payload.divisionId,
      email: payload.email,
      displayName: payload.displayName,
    };
  }
}
