import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, newUser } from './helpers/api-client';
import { OWNER, registerOwner, signInAsAdmin } from './helpers/admin';
import { BroadcastDeliveryService } from '../src/modules/admin/broadcasts/broadcast-delivery.service';

/** docs/09, J6: a message from the owner to many people through the bot. */
describe('Admin broadcasts (e2e)', () => {
  let ctx: TestApp;
  let admin: ApiClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    await registerOwner(ctx);
    admin = await signInAsAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  let seq = 0;
  /** A text no earlier run has sent, so "got it once" can be counted exactly. */
  const uniqueText = () => `📢 FinTrack yangiligi #${Date.now()}-${++seq}\nYangi hisobotlar qo‘shildi.`;

  const timesGot = (chatId: number, text: string) => ctx.telegram.messagesTo(chatId).filter((m) => m === text).length;

  async function preview(segment = 'ALL', includeOptedOut = false) {
    const res = await admin.post('/admin/broadcasts/preview', { segment, includeOptedOut });
    expect(res.status).toBe(200);
    return res.body.data as { recipients: number; excluded: { botBlocked: number; optedOut: number } };
  }

  async function tested(text: string): Promise<void> {
    expect((await admin.post('/admin/broadcasts/test', { text })).status).toBe(200);
  }

  async function waitUntilDone(id: string) {
    for (let i = 0; i < 240; i++) {
      const res = await admin.get(`/admin/broadcasts/${id}`);
      if (res.body.data.status === 'DONE') return res.body.data;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`broadcast ${id} did not finish`);
  }

  async function finishEverything(): Promise<void> {
    // Earlier tests may leave a broadcast sending; one runs at a time.
    for (const b of await ctx.prisma.broadcast.findMany({ where: { status: { not: 'DONE' } } })) await waitUntilDone(b.id);
  }

  it('counts who will get it, by segment, and who is left out', async () => {
    const before = await preview();
    const optedOut = await newUser(ctx, 'Bildirishnomasiz');
    expect((await optedOut.patch('/users/me', { notifyTelegram: false })).status).toBe(200);
    const blocker = await newUser(ctx, 'Bloklagan');
    await ctx.prisma.user.update({ where: { id: blocker.userId }, data: { telegramBlockedAt: new Date() } });
    await newUser(ctx, 'Oddiy');

    const after = await preview();
    expect(after.recipients).toBe(before.recipients + 1);
    expect(after.excluded).toEqual({ botBlocked: before.excluded.botBlocked + 1, optedOut: before.excluded.optedOut + 1 });

    const everyone = await preview('ALL', true);
    expect(everyone.recipients).toBe(after.recipients + after.excluded.optedOut);
    expect(everyone.excluded.optedOut).toBe(0);

    const [active, inactive] = await Promise.all([preview('ACTIVE_30D'), preview('INACTIVE_30D')]);
    expect(active.recipients + inactive.recipients).toBe(after.recipients);
    expect(active.recipients).toBeGreaterThanOrEqual(1);
  });

  it('sends the test to the owner alone, and will not broadcast a text that was not tested', async () => {
    const text = uniqueText();
    const bystander = await newUser(ctx, 'Begona');
    await tested(text);
    expect(timesGot(OWNER.id, text)).toBe(1);
    expect(timesGot(bystander.telegramUser!.id, text)).toBe(0);

    const { recipients } = await preview();
    const other = await admin.post('/admin/broadcasts', { text: `${text} (o‘zgartirilgan)`, segment: 'ALL', expectedRecipients: recipients });
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe('BROADCAST_NOT_TESTED');
  });

  it('refuses when the confirmed count is no longer right, and creates nothing', async () => {
    await finishEverything();
    const text = uniqueText();
    await tested(text);
    const { recipients } = await preview();
    const count = await ctx.prisma.broadcast.count();

    const res = await admin.post('/admin/broadcasts', { text, segment: 'ALL', expectedRecipients: recipients + 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RECIPIENTS_CHANGED');
    expect(res.body.error.details).toEqual({ recipients });
    expect(await ctx.prisma.broadcast.count()).toBe(count);
  });

  it('delivers once to everyone: blocked people are marked, opted-out people skipped, and it is audited', async () => {
    await finishEverything();
    const reader = await newUser(ctx, 'O‘quvchi');
    const quiet = await newUser(ctx, 'Jim');
    await quiet.patch('/users/me', { notifyTelegram: false });
    const leaver = await newUser(ctx, 'Ketuvchi');
    ctx.telegram.block(leaver.telegramUser!.id);

    const text = uniqueText();
    await tested(text);
    const { recipients } = await preview();
    const created = await admin.post('/admin/broadcasts', { text, segment: 'ALL', expectedRecipients: recipients });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'QUEUED', total: recipients, pending: recipients, admin: { name: 'Ega' } });

    const done = await waitUntilDone(created.body.data.id);
    expect(done.sent + done.blocked + done.failed).toBe(recipients);
    expect(done.blocked).toBeGreaterThanOrEqual(1);
    expect(done.pending).toBe(0);
    expect(timesGot(reader.telegramUser!.id, text)).toBe(1);
    expect(timesGot(quiet.telegramUser!.id, text)).toBe(0);
    // The owner had the test and then the real one.
    expect(timesGot(OWNER.id, text)).toBe(2);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: leaver.userId } })).telegramBlockedAt).not.toBeNull();

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'BROADCAST' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.meta).toEqual({ broadcastId: done.id, segment: 'ALL', includeOptedOut: false, recipients });

    // Running it again (a retried job) sends nothing more.
    await ctx.app.get(BroadcastDeliveryService).deliver(done.id);
    expect(timesGot(reader.telegramUser!.id, text)).toBe(1);

    const list = await admin.get('/admin/broadcasts');
    expect(list.body.data[0]).toMatchObject({ id: done.id, status: 'DONE', text });
  }, 120_000);

  it('never sends twice even with several senders at once, and never resends a send cut short', async () => {
    // Built directly, without a queued job, so only the senders started here touch it.
    const cutShort = await newUser(ctx, 'Uzilgan');
    const waiting = await Promise.all(['Birinchi', 'Ikkinchi', 'Uchinchi'].map((name) => newUser(ctx, name)));
    const text = uniqueText();
    const broadcast = await ctx.prisma.broadcast.create({
      data: { adminUserId: 'test', text, segment: 'ALL', total: 4 },
    });
    await ctx.prisma.broadcastRecipient.createMany({
      data: [
        // A crashed run took this person five minutes ago: maybe sent, maybe not, so never again.
        {
          broadcastId: broadcast.id,
          userId: cutShort.userId,
          telegramId: BigInt(cutShort.telegramUser!.id),
          status: 'SENDING',
          claimedAt: new Date(Date.now() - 5 * 60_000),
        },
        ...waiting.map((u) => ({ broadcastId: broadcast.id, userId: u.userId, telegramId: BigInt(u.telegramUser!.id) })),
      ],
    });

    const delivery = ctx.app.get(BroadcastDeliveryService);
    await Promise.all([delivery.deliver(broadcast.id), delivery.deliver(broadcast.id), delivery.deliver(broadcast.id)]);

    for (const u of waiting) expect(timesGot(u.telegramUser!.id, text)).toBe(1);
    expect(timesGot(cutShort.telegramUser!.id, text)).toBe(0);
    const row = await ctx.prisma.broadcastRecipient.findUniqueOrThrow({
      where: { broadcastId_userId: { broadcastId: broadcast.id, userId: cutShort.userId } },
    });
    expect(row).toMatchObject({ status: 'FAILED', error: 'interrupted' });
    expect(await ctx.prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } })).toMatchObject({
      status: 'DONE',
      sent: 3,
      failed: 1,
      blocked: 0,
    });
  }, 120_000);

  it('sends one broadcast at a time', async () => {
    await finishEverything();
    const text = uniqueText();
    await tested(text);
    const unfinished = await ctx.prisma.broadcast.create({
      data: { adminUserId: 'someone', text: 'kutmoqda', segment: 'ALL', total: 0, status: 'SENDING' },
    });
    const { recipients } = await preview();
    const res = await admin.post('/admin/broadcasts', { text, segment: 'ALL', expectedRecipients: recipients });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BROADCAST_IN_PROGRESS');
    await ctx.prisma.broadcast.update({ where: { id: unfinished.id }, data: { status: 'DONE' } });
  });

  it('is invisible to anyone without an admin session', async () => {
    const user = await newUser(ctx, 'Tarqatuvchi emas');
    expect((await user.post('/admin/broadcasts/preview', { segment: 'ALL' })).status).toBe(404);
    expect((await user.post('/admin/broadcasts/test', { text: 'salom' })).status).toBe(404);
    expect((await user.post('/admin/broadcasts', { text: 'salom', segment: 'ALL', expectedRecipients: 1 })).status).toBe(404);
    expect((await user.get('/admin/broadcasts')).status).toBe(404);
  });
});
