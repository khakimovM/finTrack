import { Injectable } from '@nestjs/common';
import { Tag } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface TagWithCount extends Tag {
  _count: {
    transactions: number;
  };
}

export interface CreateTagData {
  name: string;
  color: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
}

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<TagWithCount[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { transactions: { where: { transaction: { deletedAt: null } } } },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findById(userId: string, id: string): Promise<TagWithCount | null> {
    return this.prisma.tag.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { transactions: { where: { transaction: { deletedAt: null } } } },
        },
      },
    });
  }

  async findByName(userId: string, name: string): Promise<Tag | null> {
    return this.prisma.tag.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async countOwned(userId: string, ids: string[]): Promise<number> {
    return this.prisma.tag.count({ where: { userId, id: { in: ids } } });
  }

  async create(userId: string, data: CreateTagData): Promise<Tag> {
    return this.prisma.tag.create({
      data: {
        userId,
        name: data.name,
        color: data.color,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateTagData): Promise<Tag> {
    return this.prisma.tag.update({
      where: { id, userId },
      data,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.prisma.tag.delete({
      where: { id, userId },
    });
  }
}
