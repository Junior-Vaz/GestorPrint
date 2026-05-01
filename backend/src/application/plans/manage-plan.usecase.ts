import {
  Inject, Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import {
  IPlanRepository, PlanConfig, PLAN_REPOSITORY,
} from './plan-repository.interface';

@Injectable()
export class ManagePlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepo: IPlanRepository,
  ) {}

  findAll(): Promise<PlanConfig[]> {
    return this.planRepo.findAll();
  }

  async findOne(id: number): Promise<PlanConfig> {
    const plan = await this.planRepo.findById(id);
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async create(data: Omit<PlanConfig, 'id'>): Promise<PlanConfig> {
    const exists = await this.planRepo.findByName(data.name);
    if (exists) throw new BadRequestException(`Plano com nome "${data.name}" já existe`);
    return this.planRepo.create(data);
  }

  async update(id: number, data: Partial<Omit<PlanConfig, 'id' | 'name'>>): Promise<PlanConfig> {
    await this.findOne(id);
    return this.planRepo.update(id, data);
  }

  async deactivate(id: number): Promise<PlanConfig | null> {
    const plan = await this.findOne(id);
    const tenantsCount = await this.planRepo.countActiveTenantsOnPlan(plan.name);
    if (tenantsCount > 0) {
      return this.planRepo.update(id, { isActive: false });
    }
    return this.planRepo.deactivate(id);
  }
}
