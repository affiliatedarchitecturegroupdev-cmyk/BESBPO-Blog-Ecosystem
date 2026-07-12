import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { Role } from '../common/enums/role.enum';

interface RequestWithOptionalUser {
  user?: { id: string; roles: string[]; divisionId?: string };
}

// Real per-user login (Doc-01 Section 8 / Doc-04 Section 5) — replaces
// the single shared admin JWT every service and the dashboard ran on
// before this. See UsersService's header comment for why this is
// genuine per-account login rather than SSO against a specific external
// identity provider.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body('email') email: string, @Body('password') password: string) {
    if (!email || !password) {
      // Same generic failure as a wrong password below — a missing
      // field shouldn't be distinguishable from a wrong credential
      // either, on principle, even though in practice a client sending
      // no email/password at all is virtually always its own bug, not
      // an enumeration attempt.
      throw new UnauthorizedException('Email and password are required.');
    }

    const result = await this.authService.login(email, password);
    if (!result) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return result;
  }

  /**
   * Registers a new user. Two modes, decided by how many users already
   * exist — a deliberate, common pattern for the chicken-and-egg problem
   * a SUPER_ADMIN-gated registration endpoint otherwise has (a
   * SUPER_ADMIN has to already exist to create the first SUPER_ADMIN):
   *
   *  - Zero users exist: open, no auth required, and the new account is
   *    automatically granted SUPER_ADMIN regardless of what (if
   *    anything) was requested — otherwise the very first registration
   *    could create an account with no way to ever grant itself the
   *    access needed to register anyone else.
   *  - One or more users already exist: requires an already-authenticated
   *    SUPER_ADMIN caller. Checked manually in the handler body (not via
   *    @UseGuards(JwtAuthGuard)/@Roles on the method) because the
   *    bootstrap branch above must not require auth at all, and Nest's
   *    guards run before the handler body — a guard can't conditionally
   *    skip itself based on something only the handler can check (the
   *    user count). OptionalJwtAuthGuard still runs (so a real token, if
   *    one WAS sent, gets validated and populates req.user) but never
   *    rejects the request outright for a missing one.
   */
  @Post('register')
  @UseGuards(OptionalJwtAuthGuard)
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('displayName') displayName: string,
    @Body('roles') roles: string[] | undefined,
    @Req() req: RequestWithOptionalUser,
  ) {
    const userCount = await this.usersService.count();

    if (userCount === 0) {
      const user = await this.usersService.create(email, password, displayName, [Role.SUPER_ADMIN]);
      return { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles };
    }

    const callerRoles = req.user?.roles ?? [];
    if (!req.user || !callerRoles.includes(Role.SUPER_ADMIN)) {
      throw new UnauthorizedException('Only a super admin can register additional users.');
    }

    const user = await this.usersService.create(email, password, displayName, roles ?? []);
    return { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles };
  }
}
