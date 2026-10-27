import { useState, type ReactNode } from 'react';
import { AlarmClock, Bell, CalendarCheck, Check, Clock, Globe, ShieldAlert } from 'lucide-react';
import type { UserResponse } from '@fintrack/shared';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Switch';
import { Avatar } from '../../../components/ui/Avatar';
import { cn } from '../../../lib/utils';
import { useUiStore, type Theme } from '../../../stores/uiStore';
import { useUpdateProfile } from '../hooks/useSettings';
import { t, type TextKey } from '../../../lib/i18n';

const TIME_ZONES: Array<{ value: string; label: TextKey; meta: string }> = [
  { value: 'Asia/Tashkent', label: 'settings.zones.tashkent', meta: 'UTC+5' },
  { value: 'Asia/Samarkand', label: 'settings.zones.samarkand', meta: 'UTC+5' },
  { value: 'Asia/Almaty', label: 'settings.zones.almaty', meta: 'UTC+5' },
  { value: 'Europe/Moscow', label: 'settings.zones.moscow', meta: 'UTC+3' },
  { value: 'Europe/Istanbul', label: 'settings.zones.istanbul', meta: 'UTC+3' },
  { value: 'Asia/Dubai', label: 'settings.zones.dubai', meta: 'UTC+4' },
  { value: 'Asia/Seoul', label: 'settings.zones.seoul', meta: 'UTC+9' },
  { value: 'Europe/London', label: 'settings.zones.london', meta: 'UTC+0' },
  { value: 'America/New_York', label: 'settings.zones.newYork', meta: 'UTC−5' },
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
  const known = TIME_ZONES.map((z) => ({ ...z, label: t(z.label) }));
  const zones = TIME_ZONES.some((z) => z.value === user.timezone)
    ? known
    : [{ value: user.timezone, label: user.timezone, meta: '' }, ...known];

  return (
    <SettingsCard title={t('settings.profile.title')}>
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size={56} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="truncate text-[13px] text-text-muted">
            {user.telegramUsername ? `@${user.telegramUsername} · ` : ''}{t('nav.viaTelegram')}
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
          label={t('settings.profile.name')}
          value={name}
          maxLength={100}
          showCounter
          onChange={(e) => setName(e.target.value)}
          error={dirty && invalid ? t('settings.profile.nameLength') : undefined}
        />
        <div className="flex flex-col gap-2">
          <Dropdown
            label={t('settings.profile.timezone')}
            value={timezone}
            onChange={setTimezone}
            options={zones.map((z) => ({ value: z.value, label: z.label, meta: z.meta, icon: <Globe className="h-4 w-4" aria-hidden /> }))}
          />
          <p className="text-[12.5px] text-text-muted">{t('settings.profile.timezoneHint')}</p>
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
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={!dirty || invalid} loading={update.isPending}>
            {t('common.save')}
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
      title: t('common.strictMode'),
      text: t('settings.prefs.strictModeText'),
      tile: (
        <Tile className="bg-warning-soft text-warning">
          <ShieldAlert className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: false,
    },
    {
      key: 'notifyTelegram' as const,
      title: t('settings.prefs.notifyTelegram'),
      text: t('settings.prefs.notifyTelegramText'),
      tile: (
        <Tile className="bg-info-soft text-info">
          <Bell className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
    {
      key: 'dailyReminders' as const,
      title: t('settings.prefs.dailyReminders'),
      text: t('settings.prefs.dailyRemindersText'),
      tile: (
        <Tile className="bg-success-soft text-success">
          <AlarmClock className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
    {
      key: 'dailyDigest' as const,
      title: t('settings.prefs.dailyDigest'),
      text: t('settings.prefs.dailyDigestText'),
      tile: (
        <Tile className="bg-secondary text-text">
          <Clock className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
    {
      key: 'monthlyReport' as const,
      title: t('settings.prefs.monthlyReport'),
      text: t('settings.prefs.monthlyReportText'),
      tile: (
        <Tile className="bg-info-soft text-info">
          <CalendarCheck className="h-[18px] w-[18px]" aria-hidden />
        </Tile>
      ),
      needsTelegram: true,
    },
  ];

  return (
    <SettingsCard title={t('settings.prefs.title')}>
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

const THEMES: Array<{ value: Theme; label: TextKey; base: string; split?: string; ink: string; card: string; line: string }> = [
  { value: 'light', label: 'nav.themeLight', base: '#EFEFEC', ink: '#151514', card: '#FFFFFF', line: '#E3E3DF' },
  { value: 'dark', label: 'nav.themeDark', base: '#0D0D0C', ink: '#F3F3F0', card: '#1B1B1A', line: '#2B2B29' },
  { value: 'system', label: 'settings.appearance.system', base: '#EFEFEC', split: '#0D0D0C', ink: '#7D8796', card: '#FFFFFF', line: '#E3E3DF' },
];

/** Light, dark or the device's; each card is a small picture of the app in that theme. */
export function AppearanceSection() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <SettingsCard title={t('settings.appearance.title')} description={t('settings.appearance.description')}>
      <div role="radiogroup" aria-label={t('nav.theme')} className="grid grid-cols-3 gap-2 sm:gap-3">
        {THEMES.map((option) => {
          const on = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex min-w-0 flex-col gap-2 rounded-2xl border-[1.5px] bg-card px-2 pb-2.5 pt-2 focus-ring',
                on ? 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]' : 'border-border',
              )}
            >
              {/* The app in miniature; fixed colours on purpose: each card shows its own theme. */}
              <span aria-hidden className="relative block h-14 overflow-hidden rounded-[10px] border border-black/10 sm:h-20" style={{ background: option.base }}>
                {option.split && <span className="absolute inset-0" style={{ background: option.split, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />}
                <span className="absolute left-[10%] top-[16%] h-2.5 w-[40%] rounded-full" style={{ background: option.ink }} />
                <span className="absolute left-[10%] right-[10%] top-[42%] h-[22%] rounded-md border" style={{ background: option.card, borderColor: option.line }} />
                <span className="absolute bottom-[12%] left-[10%] h-[12%] w-[28%] rounded-full bg-[#2F9E68]" />
              </span>
              <span className={cn('flex items-center justify-center gap-1.5 text-[14px]', on ? 'font-semibold' : 'font-medium')}>
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                {t(option.label)}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
