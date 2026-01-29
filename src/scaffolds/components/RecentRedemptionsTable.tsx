import React from 'react';
import { cn, tokens } from '../theme/config';

interface RedemptionRow {
  id: string;
  item: string;
  ts: string;
  qty?: number;
}

interface RecentRedemptionsTableProps {
  rows: RedemptionRow[];
  onDelete: (id: string) => void;
}

export const RecentRedemptionsTable: React.FC<RecentRedemptionsTableProps> = ({ rows, onDelete }) => {
  const fmt = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {(!rows || rows.length === 0) ? (
          <div className={cn(tokens.card.base, 'text-center text-neutral-400')}>No recent redemptions.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className={cn(tokens.card.base, 'flex flex-col gap-3 text-neutral-100')}>
              <div className="font-medium">{r.item}</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-neutral-400 mr-1">When:</span>
                  <span className="text-neutral-100">{fmt(r.ts)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 mr-1">Qty:</span>
                  <span className="text-neutral-100">{r.qty ?? 1}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => onDelete(String(r.id))}
                  className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table (hidden on small screens) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className={cn(tokens.table.table)}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th}>Item</th>
              <th className={tokens.table.th}>When</th>
              <th className={tokens.table.th}>Qty</th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) ? (
              <tr>
                <td colSpan={4} className={tokens.table.empty_state}>No recent redemptions.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={tokens.table.td}>{r.item}</td>
                  <td className={tokens.table.td}>{fmt(r.ts)}</td>
                  <td className={tokens.table.td}>{r.qty ?? 1}</td>
                  <td className={tokens.table.td}>
                    <button
                      onClick={() => onDelete(String(r.id))}
                      className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentRedemptionsTable;


