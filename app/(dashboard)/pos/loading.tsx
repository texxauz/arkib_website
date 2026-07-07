export default function POSLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between pt-1 pb-2">
        <div className="space-y-2">
          <div className="h-5 w-28 bg-[#1A1A1E] rounded-lg" />
          <div className="h-3 w-36 bg-[#1A1A1E] rounded-lg" />
        </div>
        <div className="h-9 w-24 bg-[#1A1A1E] rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[100, 140].map((w, i) => (
          <div key={i} className="h-9 bg-[#1A1A1E] rounded-lg" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-4 space-y-3 h-28">
            <div className="h-3.5 w-16 bg-[#1A1A1E] rounded" />
            <div className="h-5 w-20 bg-[#1A1A1E] rounded-full" />
            <div className="h-3 w-12 bg-[#1A1A1E] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
