// Shimmer skeleton for KelolaPengajar loading state.
// Renders 12 rows — 8 card skeletons (mobile) + 8 table row skeletons (desktop).
export default function KelolaPengajarSkeleton() {
  return (
    <>
      {/* Mobile card skeleton */}
      <div className="lg:hidden flex flex-col gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-[24px] p-4 border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)] animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#F0F0EC]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-[#F0F0EC] rounded-md" />
                <div className="h-3 w-20 bg-[#F0F0EC] rounded-md" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 bg-[#F0F0EC] rounded-full" />
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-[#F0F0EC] rounded-full" />
                <div className="h-8 w-8 bg-[#F0F0EC] rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden lg:block bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EAEAE7] bg-[#F7F7F5]">
              {['Nama', 'NIM', 'Email', 'TPA', 'Status', 'Aksi'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAE7]">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="h-4 bg-[#F0F0EC] rounded-md animate-pulse" style={{ width: j === 0 ? '140px' : j === 2 ? '180px' : '80px' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
