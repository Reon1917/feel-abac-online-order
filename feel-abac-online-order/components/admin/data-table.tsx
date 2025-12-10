import clsx from "clsx";

type DataTableProps = {
  children: React.ReactNode;
};

export function DataTable({ children }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  );
}

type DataTableHeaderProps = {
  children: React.ReactNode;
};

export function DataTableHeader({ children }: DataTableHeaderProps) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50">
      <tr>{children}</tr>
    </thead>
  );
}

type DataTableHeadProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTableHead({ children, className }: DataTableHeadProps) {
  return (
    <th
      className={clsx(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
        className
      )}
    >
      {children}
    </th>
  );
}

type DataTableBodyProps = {
  children: React.ReactNode;
};

export function DataTableBody({ children }: DataTableBodyProps) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

type DataTableRowProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTableRow({ children, className }: DataTableRowProps) {
  return (
    <tr className={clsx("transition hover:bg-slate-50", className)}>
      {children}
    </tr>
  );
}

type DataTableCellProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTableCell({ children, className }: DataTableCellProps) {
  return (
    <td className={clsx("px-4 py-3.5 text-sm text-slate-700", className)}>
      {children}
    </td>
  );
}

type DataTableEmptyProps = {
  message: string;
  colSpan: number;
};

export function DataTableEmpty({ message, colSpan }: DataTableEmptyProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-12 text-center text-sm text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}

type DataTablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
};

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: DataTablePaginationProps) {
  const hasItems = totalItems > 0;
  const startItem = hasItems ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = hasItems ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing {startItem} to {endItem} of {totalItems} results
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
