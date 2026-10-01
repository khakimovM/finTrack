import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Fail fast: serving traffic without a database only produces 500s and hides the real outage.
    await this.$connect();
    this.logger.log('Connected to PostgreSQL database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
