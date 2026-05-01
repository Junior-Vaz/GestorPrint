import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortDir?: string;
  @IsOptional() @IsString() type?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginateResult<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
