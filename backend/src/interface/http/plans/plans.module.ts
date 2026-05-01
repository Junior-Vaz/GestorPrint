import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { ManagePlanUseCase } from '../../../application/plans/manage-plan.usecase';
import { GetMyPlanUseCase } from '../../../application/plans/get-my-plan.usecase';
import { PrismaPlanRepository } from '../../../infrastructure/plans/prisma-plan.repository';
import { PLAN_REPOSITORY } from '../../../application/plans/plan-repository.interface';

@Module({
  controllers: [PlansController],
  providers: [
    PlansService,
    ManagePlanUseCase,
    GetMyPlanUseCase,
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
  ],
  exports: [PlansService, ManagePlanUseCase, GetMyPlanUseCase],
})
export class PlansModule {}
