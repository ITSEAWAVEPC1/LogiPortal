import Link from "next/link";

interface PortalPaginationProps {
  basePath: string;
  query: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}

function href(basePath: string, query: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function PortalPagination({ basePath, query, page, pageSize, total }: PortalPaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(basePath, query, page - 1)} className="rounded-md border border-border-subtle px-3 py-1 hover:bg-surface">
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-border-subtle px-3 py-1 opacity-40">Previous</span>
        )}
        {page < lastPage ? (
          <Link href={href(basePath, query, page + 1)} className="rounded-md border border-border-subtle px-3 py-1 hover:bg-surface">
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-border-subtle px-3 py-1 opacity-40">Next</span>
        )}
      </div>
    </div>
  );
}
