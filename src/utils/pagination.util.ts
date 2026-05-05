import type { PaginationQuery } from "../types/api.types";

export interface ParsedPagination {
  skip: number;
  take: number;
  page: number;
  limit: number;
  orderBy: Record<string, "asc" | "desc">;
}

export const parsePagination = (
  query: PaginationQuery,
  defaultSortBy = "createdAt",
): ParsedPagination => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? defaultSortBy;
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  return { skip, take: limit, page, limit, orderBy: { [sortBy]: sortOrder } };
};
