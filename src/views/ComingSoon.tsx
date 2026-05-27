/** Placeholder for views not yet built (Week, Today sub-views, Map, More). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-svh w-full flex-col items-center justify-center gap-2 bg-[#0a0f1c] px-6 text-center">
      <div className="text-base font-medium text-neutral-300">{title}</div>
      <div className="text-xs text-neutral-500">Coming soon</div>
    </div>
  );
}
