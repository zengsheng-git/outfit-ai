import { Controller, Post, Body, Get } from '@nestjs/common'
import { GenerationService } from './generation.service'

@Controller('api/generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('outfit')
  async generateOutfit(@Body() body: { items: Record<string, unknown>; prompt?: string }) {
    return this.generationService.generateOutfit(body)
  }

  /** 当前可用的出图渠道，便于确认密钥是否配置成功 */
  @Get('status')
  status() {
    return this.generationService.getStatus()
  }
}
