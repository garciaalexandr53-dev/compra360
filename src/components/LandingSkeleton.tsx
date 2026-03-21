const LandingSkeleton = () => (
  <div className="min-h-screen bg-background animate-pulse">
    {/* Nav */}
    <div className="h-14 border-b flex items-center justify-between px-6">
      <div className="h-6 w-28 bg-muted rounded" />
      <div className="h-8 w-20 bg-muted rounded" />
    </div>

    {/* Hero */}
    <div className="flex flex-col items-center gap-4 pt-20 px-6">
      <div className="h-4 w-48 bg-muted rounded" />
      <div className="h-10 w-72 bg-muted rounded" />
      <div className="h-10 w-56 bg-muted rounded" />
      <div className="h-4 w-64 bg-muted rounded mt-2" />
      <div className="flex gap-3 mt-4">
        <div className="h-10 w-32 bg-muted rounded-lg" />
        <div className="h-10 w-32 bg-muted rounded-lg" />
      </div>
    </div>

    {/* Benefits bar */}
    <div className="mt-16 border-y py-6 flex justify-center gap-8 px-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-4 w-40 bg-muted rounded" />
      ))}
    </div>
  </div>
);

export default LandingSkeleton;
