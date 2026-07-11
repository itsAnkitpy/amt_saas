/**
 * Pagination query-param parsing for API routes.
 *
 * NaN-safe: non-numeric params fall back to defaults instead of leaking
 * NaN into Prisma skip/take (which throws and 500s the request).
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function parsePagination(searchParams: URLSearchParams): {
    page: number;
    pageSize: number;
} {
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawPageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

    return {
        page: Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage),
        pageSize: Number.isNaN(rawPageSize)
            ? DEFAULT_PAGE_SIZE
            : Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize)),
    };
}
