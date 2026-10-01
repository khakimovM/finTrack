import { useEffect, useState } from 'react';
import { UserResponse } from '@fintrack/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Switch';
import { useUpdateProfile } from '../hooks/useSettings';

const TIME_ZONES = [
  { value: 'Asia/Tashkent', label: 'Toshkent (UTC+5)' },
  { value: 'Asia/Samarkand', label: 'Samarqand (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Olmaota (UTC+5)' },
  { value: 'Europe/Moscow', label: 'Moskva (UTC+3)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubay (UTC+4)' },
  { value: 'Asia/Seoul', label: 'Seul (UTC+9)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'America/New_York', label: 'Nyu-York' },
];

export function ProfileSection({ user }: { user: UserResponse }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);

  useEffect(() => {
    setName(user.name);
    setTimezone(user.timezone);
  }, [user.name, user.timezone]);

  const dirty = name.trim() !== user.name || timezone !== user.timezone;
  const zones = TIME_ZONES.some((z) => z.value === user.timezone)
    ? TIME_ZONES
    : [{ value: user.timezone, label: user.timezone }, ...TIME_ZONES];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Ism va vaqt zonangiz. “Bugun” shu zona bo‘yicha hisoblanadi.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ name: name.trim(), timezone });
          }}
        >
          <Input label="Ism" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          <Select label="Vaqt zonasi" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={zones} />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={!dirty || name.trim().length < 2} loading={update.isPending}>
              Saqlash
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PreferencesSection({ user }: { user: UserResponse }) {
  const update = useUpdateProfile();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moliyaviy qoidalar va bildirishnomalar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Switch
          id="strict-mode"
          label="Qatʼiy rejim"
          description="Yoqilganda balansingizdan ortiq xarajat yozib bo‘lmaydi. O‘chirilganda balans manfiyga tushishi mumkin va qizil ko‘rsatiladi."
          checked={user.strictMode}
          disabled={update.isPending}
          onChange={(strictMode) => update.mutate({ strictMode })}
        />
        <Switch
          id="notify-telegram"
          label="Telegram bildirishnomalari"
          description="Byudjet, qarz muddati va takroriy to‘lovlar haqidagi ogohlantirishlar botga ham keladi."
          checked={user.notifyTelegram}
          disabled={update.isPending || !user.telegramLinked}
          onChange={(notifyTelegram) => update.mutate({ notifyTelegram })}
        />
        <Switch
          id="daily-digest"
          label="Kunlik xulosa"
          description="Har kuni kechqurun bugungi kirim-chiqim xulosasi Telegramga yuboriladi."
          checked={user.dailyDigest}
          disabled={update.isPending || !user.telegramLinked}
          onChange={(dailyDigest) => update.mutate({ dailyDigest })}
        />
      </CardContent>
    </Card>
  );
}
