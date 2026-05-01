import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import { FeatureGuard } from '../guards/feature.guard';

export const FEATURE_KEY = 'required_feature';

/**
 * @RequireFeature — declara que o endpoint exige uma feature específica do plano.
 *
 * Uso:
 *   @Get(':id/pdf')
 *   @RequireFeature(FeatureKey.PDF_GENERATION)
 *   async getPdf() { ... }
 *
 * O FeatureGuard é aplicado automaticamente via applyDecorators.
 * Não é necessário adicionar @UseGuards(FeatureGuard) separadamente.
 *
 * Requer que JwtAuthGuard já tenha rodado (request.user.tenantId disponível).
 */
export const RequireFeature = (feature: FeatureKey) =>
  applyDecorators(
    SetMetadata(FEATURE_KEY, feature),
    UseGuards(FeatureGuard),
  );
