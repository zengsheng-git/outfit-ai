import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { config as loadEnv } from 'dotenv'

// 显式指定 .env 的位置，不依赖进程启动目录，
// 否则从仓库根目录启动后端会静默读不到配置
loadEnv({ path: join(__dirname, '..', '.env') })

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.enableCors()
  app.useStaticAssets(join(__dirname, '..', 'public'))
  await app.listen(3000)
  console.log('Server running on http://localhost:3000')
}
bootstrap()
