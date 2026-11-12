import { Module } from '@nestjs/common'
import { GenerationController } from './generation.controller'
import { GenerationService } from './generation.service'
import { BailianProvider } from './bailian.provider'
import { MiniMaxProvider } from './minimax.provider'
import { LocalRenderProvider } from './local-render.provider'
import { AssetSeeder } from './asset-seeder'

@Module({
  controllers: [GenerationController],
  providers: [
    GenerationService,
    BailianProvider,
    MiniMaxProvider,
    LocalRenderProvider,
    AssetSeeder,
  ],
})
export class GenerationModule {}
