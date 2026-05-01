import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsArray, IsInt, IsNumber, Min, Max, MaxLength } from 'class-validator';

export class UpdateProductStoreDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  visibleInStore?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  storeOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightGrams?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pixDiscountPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storePrice?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  productionDays?: number;
}
