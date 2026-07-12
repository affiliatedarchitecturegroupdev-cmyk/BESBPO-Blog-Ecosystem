import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('healthz')
  health() {
    return { status: 'ok', service: 'besbpo-blog-cms-api', time: new Date().toISOString() };
  }
}
