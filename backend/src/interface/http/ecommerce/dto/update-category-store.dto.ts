import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsInt } from 'class-validator';

export class UpdateCategoryStoreDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  visibleInStore?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storeIcon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  storeOrder?: number;
}
