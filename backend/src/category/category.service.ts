import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category & { serviceCount: number }> {
    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);
    return {
      ...savedCategory,
      serviceCount: 0,
    };
  }

  async findAll(): Promise<(Category & { serviceCount: number })[]> {
    const categories = await this.categoryRepository.find({
      where: { deletedAt: null },
      order: { createdAt: 'DESC' },
    });
    
    // TODO: When services entity is created, count actual services per category
    // For now, return 0 as placeholder
    return categories.map((category) => ({
      ...category,
      serviceCount: 0,
    }));
  }

  async findOne(id: string): Promise<Category & { serviceCount: number }> {
    const category = await this.categoryRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // TODO: When services entity is created, count actual services for this category
    // For now, return 0 as placeholder
    return {
      ...category,
      serviceCount: 0,
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
    
    // TODO: When services entity is created, count actual services for this category
    return {
      ...updatedCategory,
      serviceCount: 0,
    };
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.softDelete(id);
  }
}

