export default function LeagueLoading() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="h-7 w-48 skeleton" />
      <div className="h-[28rem] skeleton rounded-2xl" />
    </div>
  );
}
