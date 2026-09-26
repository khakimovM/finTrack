import { Injectable } from '@nestjs/common';
import { Tag } from '@prisma/client';
import { TagResponse } from '@fintrack/shared';
import { TagsRepository, TagWithCount } from './tags.repository';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import {
  NotFoundDomainException,
  ConflictDomainException,
} from '../../common/exceptions/domain.exception';

@Injectable()
export class TagsService {
  constructor(private readonly repository: TagsRepository) {}

  async list(userId: string): Promise<TagResponse[]> {
    const tags = await this.repository.findAll(userId);
    return tags.map((t) => this.mapToResponse(t));
  }

  async getById(userId: string, id: string): Promise<TagResponse> {
    const tag = await this.repository.findById(userId, id);
    if (!tag) {
      throw new NotFoundDomainException('Teg topilmadi');
    }
    return this.mapToResponse(tag);
  }

  async create(userId: string, dto: CreateTagDto): Promise<TagResponse> {
    const duplicate = await this.repository.findByName(userId, dto.name);
    if (duplicate) {
      throw new ConflictDomainException('TAG_EXISTS', 'Ushbu nomdagi teg allaqachon mavjud');
    }

    const created = await this.repository.create(userId, {
      name: dto.name,
      color: dto.color ?? '#94a3b8',
    });

    return this.mapToResponse({
      ...created,
      _count: { transactions: 0 },
    });
  }

  async update(userId: string, id: string, dto: UpdateTagDto): Promise<TagResponse> {
    const tag = await this.repository.findById(userId, id);
    if (!tag) {
      throw new NotFoundDomainException('Teg topilmadi');
    }

    if (dto.name && dto.name !== tag.name) {
      const duplicate = await this.repository.findByName(userId, dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictDomainException('TAG_EXISTS', 'Ushbu nomdagi teg allaqachon mavjud');
      }
    }

    const updated = await this.repository.update(userId, id, {
      name: dto.name,
      color: dto.color,
    });

    return this.mapToResponse({
      ...updated,
      _count: tag._count,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const tag = await this.repository.findById(userId, id);
    if (!tag) {
      throw new NotFoundDomainException('Teg topilmadi');
    }

    await this.repository.delete(userId, id);
  }

  private mapToResponse(tag: TagWithCount | (Tag & { _count?: { transactions: number } })): TagResponse {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      transactionCount: tag._count?.transactions ?? 0,
      createdAt: tag.createdAt.toISOString(),
    };
  }
}
