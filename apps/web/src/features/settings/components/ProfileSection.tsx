import { useState, type ReactNode } from 'react';
import { Bell, Check, Clock, Globe, ShieldAlert } from 'lucide-react';
import type { UserResponse } from '@fintrack/shared';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Switch';
import { Avatar } from '../../../components/ui/Avatar';
import { cn } from '../../../lib/utils';
import { useUiStore, type Theme } from '../../../stores/uiStore';
import { useUpdateProfile } from '../hooks/useSettings';

const TIME_ZONES = [
  { value: 'Asia/Tashkent', label: 'Toshkent', meta: 'UTC+5' },
  { value: 'Asia/Samarkand', label: 'Samarqand', meta: 'UTC+5' },
  { value: 'Asia/Almaty', label: 'Olmaota', meta: 'UTC+5' },
  { value: 'Europe/Moscow', label: 'Moskva', meta: 'UTC+3' },
  { value: 'Europe/Istanbul', label: 'Istanbul', meta: 'UTC+3' },
  { value: 'Asia/Dubai', label: 'Dubay', meta: 'UTC+4' },
  { value: 'Asia/Seoul', label: 'Seul', meta: 'UTC+9' },
  { value: 'Europe/London', label: 'London', meta: 'UTC+0' },
  { value: 'America/New_York', label: 'Nyu-York', meta: 'UTC−5' },
];

export function SettingsCard({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-4 rounded-[20px] border bg-card px-4 py-5 sm:p-6',
        danger ? 'border-[color-mix(in_oklab,var(--danger)_35%,var(--border))]' : 'border-border',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className={cn('text-[17px] font-semibold leading-6', danger && 'text-danger')}>{title}</h2>
        {description && <p className="text-[13.5px] leading-[19px] text-text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ProfileSection({ user }: { user: UserResponse }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [synced, setSynced] = useState(user);
  // A saved profile (or a refetch) becomes the new starting point of the form.
  if (synced !== user) {
    setSynced(user);
    setName(user.name);
    setTimezone(user.timezone);
  }

  const trimmed = name.trim();
  const dirty = name !== user.name || timezone !== user.timezone;
  const invalid = trimmed.length < 2 || trimmed.length > 100;
  const zones = TIME_ZONES.some((z) => z.value === user.timezone)
    ? TIME_ZONES
    : [{ value: user.timezone, label: user.timezone, meta: '' }, ...TIME_ZONES];

  return (
    <SettingsCard title="Profil">
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size={56} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="truncate text-[13px] text-text-muted">
            {user.telegramUsername ? `@${user.telegramUsername} · ` : ''}Telegram orqali
          </span>
        </div>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty || invalid) return;
          update.mutate({ name: trimmed, timezone });
        }}
      >
        <Input
          label="Ism"
          value={name}
          maxLength={100}
          showCounter
          onChange={(e) => setName(e.target.value)}
          error={dirty && invalid ? 'Ism 2 dan 100 belgigacha bo‘lishi kerak' : undefined}
        />
        <div className="flex flex-col gap-2">
          <Dropdown
            label="Vaqt zonasi"
            value={timezone}
            onChange={setTimezone}
            options={zones.map((z) => ({ value: z.value, label: z.label, meta: z.meta, icon: <Globe className="h-4 w-4" aria-hidden /> }))}
          />
          <p className="text-[12.5px] text-text-muted">“Bugun” shu zona bo‘yicha hisoblanadi.</p>
        </div>
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button
              variant="secondary"
              onClick={() => {
                setName(user.name);
                setTimezone(user.timezone);
              }}
            >
              Bekor qilish
            </Button>
          )}
          <Button type="submit" disabled={!dirty || invalid} loading={update.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function Tile({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-[10px]', className)}>{children}</span>;
}

export function PreferencesSection({ user }: { user: UserResponse }) {
  const update = useUpdateProfile();
  const rows = [
    {
      key: 'strictMode' as const,
      title: 'Qatʼiy rejim',
      text: 'Yoqilganda balansingizdan ortiq xarajat yozib bo‘lmaydi. O‘chirilganda balans manfiyga tushishi mumkin va qizil ko‘rsatiladi.',
      tile: (
        <Tile className="bg-warning-soft text-warning">
          <ShieldAlert className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: false,
    },
    {
      key: 'notifyTelegram' as const,
      title: 'Telegram bildirishnomalari',
      text: 'Byudjet, qarz muddati va takroriy to‘lovlar haqidagi ogohlantirishlar botga ham keladi.',
      tile: (
        <Tile className="bg-info-soft text-info">
          <Bell className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
    {
      key: 'dailyDigest' as const,
      title: 'Kunlik xulosa',
      text: 'Har kuni soat 21:00 da bugungi kirim-chiqim xulosasi Telegram’ga yuboriladi.',
      tile: (
        <Tile className="bg-secondary text-text">
          <Clock className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
  ];

  return (
    <SettingsCard title="Moliyaviy qoidalar va bildirishnomalar">
      <div className="flex flex-col">
        {rows.map((row, index) => (
          <Switch
            key={row.key}
            lead={row.tile}
            label={<span className="font-semibold">{row.title}</span>}
            description={<span className="text-pretty text-[13.5px] leading-[19px] text-text-muted">{row.text}</span>}
            checked={user[row.key]}
            disabled={update.isPending || (row.needsTelegram && !user.telegramLinked)}
            onChange={(value) => update.mutate({ [row.key]: value })}
            className={cn('items-start py-3.5', index > 0 && 'rounded-none border-t border-border')}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

const THEMES: Array<{ value: Theme; label: string; base: string; split?: string; ink: string; card: string; line: string }> = [
  { value: 'light', label: 'Yorug‘', base: '#EFEFEC', ink: '#151514', card: '#FFFFFF', line: '#E3E3DF' },
  { value: 'dark', label: 'Qorong‘i', base: '#0D0D0C', ink: '#F3F3F0', card: '#1B1B1A', line: '#2B2B29' },
  { value: 'system', label: 'Tizim', base: '#EFEFEC', split: '#0D0D0C', ink: '#7D8796', card: '#FFFFFF', line: '#E3E3DF' },
];

/** Light, dark or the device's; each card is a small picture of the app in that theme. */
export function AppearanceSection() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <SettingsCard title="Ko‘rinish" description="Mavzu shu qurilmada saqlanadi">
      <div role="radiogroup" aria-label="Mavzu" className="grid grid-cols-3 gap-2 sm:gap-3">
        {THEMES.map((t) => {
          const on = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex min-w-0 flex-col gap-2 rounded-2xl border-[1.5px] bg-card px-2 pb-2.5 pt-2 focus-ring',
                on ? 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]' : 'border-border',
              )}
            >
              {/* The app in miniature; fixed colours on purpose: each card shows its own theme. */}
              <span aria-hidden className="relative block h-14 overflow-hidden rounded-[10px] border border-black/10 sm:h-20" style={{ background: t.base }}>
                {t.split && <span className="absolute inset-0" style={{ background: t.split, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />}
                <span className="absolute left-[10%] top-[16%] h-2.5 w-[40%] rounded-full" style={{ background: t.ink }} />
                <span className="absolute left-[10%] right-[10%] top-[42%] h-[22%] rounded-md border" style={{ background: t.card, borderColor: t.line }} />
                <span className="absolute bottom-[12%] left-[10%] h-[12%] w-[28%] rounded-full bg-[#2F9E68]" />
              </span>
              <span className={cn('flex items-center justify-center gap-1.5 text-[14px]', on ? 'font-semibold' : 'font-medium')}>
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
