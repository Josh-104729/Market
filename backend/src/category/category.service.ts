import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Service, ServiceStatus } from '../entities/service.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category & { serviceCount: number }> {
    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);
    const serviceCount = await this.serviceRepository.count({
      where: {
        categoryId: savedCategory.id,
        status: ServiceStatus.ACTIVE,
        deletedAt: null,
      },
    });
    return {
      ...savedCategory,
      serviceCount,
    };
  }

  async findAll(): Promise<(Category & { serviceCount: number })[]> {
    const categories = await this.categoryRepository.find({
      where: { deletedAt: null },
      order: { createdAt: 'DESC' },
    });
    
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const serviceCount = await this.serviceRepository.count({
          where: {
            categoryId: category.id,
            status: ServiceStatus.ACTIVE,
            deletedAt: null,
          },
        });
        return {
          ...category,
          serviceCount,
        };
      }),
    );
    
    return categoriesWithCounts;
  }

  async findOne(id: string): Promise<Category & { serviceCount: number }> {
    const category = await this.categoryRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const serviceCount = await this.serviceRepository.count({
      where: {
        categoryId: category.id,
        status: ServiceStatus.ACTIVE,
        deletedAt: null,
      },
    });

    return {
      ...category,
      serviceCount,
    };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category & { serviceCount: number }> {
    const category = await this.categoryRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    Object.assign(category, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.save(category);
    
    const serviceCount = await this.serviceRepository.count({
      where: {
        categoryId: updatedCategory.id,
        status: ServiceStatus.ACTIVE,
        deletedAt: null,
      },
    });
    
    return {
      ...updatedCategory,
      serviceCount,
    };
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.softDelete(id);
  }
}

