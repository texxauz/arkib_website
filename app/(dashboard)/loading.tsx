export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* TopBar skeleton */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-[#1A1A1E] rounded-lg" />
          <div className="h-3 w-24 bg-[#1A1A1E] rounded-lg" />
        </div>
        <div className="h-9 w-28 bg-[#1A1A1E] rounded-lg" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-2">
        {[80, 60, 72, 56, 68].map((w, i) => (
          <div key={i} className="h-9 bg-[#1A1A1E] rounded-lg" style={{ width: w }} />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-[#1A1A1E] rounded" />
            <div className="h-7 w-14 bg-[#1A1A1E] rounded" />
            <div className="h-2.5 w-16 bg-[#1A1A1E] rounded" />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-4 flex items-center gap-4">
            <div className="h-4 w-4 bg-[#1A1A1E] rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-[#1A1A1E] rounded" style={{ width: `${55 + (i * 7) % 30}%` }} />
              <div className="h-2.5 w-24 bg-[#1A1A1E] rounded" />
            </div>
            <div className="h-3.5 w-16 bg-[#1A1A1E] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
