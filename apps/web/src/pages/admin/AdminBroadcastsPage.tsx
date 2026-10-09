import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { BroadcastComposer } from '../../features/admin/components/BroadcastComposer';
import { BroadcastHistory } from '../../features/admin/components/BroadcastHistory';
import { useBroadcasts } from '../../features/admin/hooks/useBroadcasts';

/** A message to many people through the bot: write, test on yourself, confirm, watch it go out. */
export function AdminBroadcastsPage() {
  // The newest page shows whether one is still going out; only one can run at a time.
  const latest = useBroadcasts(1);
  const busy = latest.data?.data.some((b) => b.status !== 'DONE') ?? false;

  return (
    <>
      <AdminPageHeader title="Xabarlar" subtitle="Bot orqali foydalanuvchilarga xabar yuborish" />
      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <BroadcastComposer busy={busy} />
        </div>
        <div className="xl:col-span-5">
          <BroadcastHistory />
        </div>
      </div>
    </>
  );
}
