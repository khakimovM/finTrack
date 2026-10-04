import { useState, type ReactNode } from 'react';
import { ArrowLeftRight, Download, Moon, Pencil, Plus, Sun, Trash2, Undo2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, SearchInput } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { Select } from '../../components/ui/Select';
import { Dropdown } from '../../components/ui/Dropdown';
import { Segmented } from '../../components/ui/Segmented';
import { Tabs } from '../../components/ui/Tabs';
import { Switch } from '../../components/ui/Switch';
import { Checkbox } from '../../components/ui/Checkbox';
import { ChangeChip, Chip, CountBadge, DefaultChip, FilterChip, SystemChip, TagChip } from '../../components/ui/Chip';
import { Amount } from '../../components/ui/Amount';
import { KpiCard } from '../../components/ui/KpiCard';
import { Progress, budgetTone } from '../../components/ui/Progress';
import { EmojiTile } from '../../components/ui/EmojiTile';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { DatePicker } from '../../components/ui/DatePicker';
import { RangePicker } from '../../components/ui/RangePicker';
import { ChoiceGrid } from '../../components/ui/ChoiceGrid';
import { EmojiGrid, Swatches } from '../../components/ui/Pickers';
import { AccountPicker, CategoryPicker } from '../../components/ui/EntityPickers';
import { Modal } from '../../components/ui/Modal';
import { Sheet } from '../../components/ui/Sheet';
import { Menu } from '../../components/ui/Menu';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/brand/Logo';
import { AreaTrend } from '../../components/charts/AreaTrend';
import { Donut } from '../../components/charts/Donut';
import { BarList } from '../../components/charts/BarList';
import { GroupedBars } from '../../components/charts/GroupedBars';
import { toast } from '../../stores/toastStore';
import { useUiStore } from '../../stores/uiStore';
import { formatAmount } from '../../lib/money';

const ACCOUNTS = [
  { id: 'humo', name: 'Humo karta', icon: '💳', color: '#2f9e68', balance: '1255000000' },
  { id: 'uzcard', name: 'Uzcard', icon: '💳', color: '#3d7bd6', balance: '430000000' },
  { id: 'cash', name: 'Naqd pul', icon: '💵', color: '#e0a11b', balance: '120000000' },
  { id: 'save', name: 'Jamg‘arma', icon: '🏦', color: '#8a63d2', balance: '-2500000000' },
];
const CATEGORIES = [
  { id: 'food', name: 'Oziq-ovqat', icon: '🍔', color: '#ef4444', children: [] },
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚗',
    color: '#f97316',
    children: [{ id: 'taxi', name: 'Taksi', icon: '🚕', color: '#f97316' }],
  },
  { id: 'home', name: 'Uy-joy', icon: '🏠', color: '#84cc16', children: [] },
];
const TREND = ['1–5', '6–12', '13–19', '20–26', '27–31'].map((label, i) => ({
  label,
  title: `${label}-oktabr`,
  income: [8_650_000, 400_000, 650_000, 0, 0][i],
  expense: [1_820_000, 1_640_000, 1_450_000, 980_000, 490_000][i],
}));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[20px] font-semibold leading-7">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

/** Every primitive on one page, for checking the design system in both themes and widths. */
export function UiGallery() {
  const { resolvedTheme, toggleTheme } = useUiStore();
  const [name, setName] = useState('Asosiy karta');
  const [money, setMoney] = useState('150000000');
  const [note, setNote] = useState('');
  const [sort, setSort] = useState('new');
  const [filter, setFilter] = useState('');
  const [period, setPeriod] = useState<'bugun' | 'hafta' | 'oy' | 'yil' | 'oraliq'>('oy');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [strict, setStrict] = useState(true);
  const [checked, setChecked] = useState(false);
  const [page, setPage] = useState(6);
  const [date, setDate] = useState('2026-10-03');
  const [due, setDue] = useState('');
  const [choice, setChoice] = useState('CARD');
  const [emoji, setEmoji] = useState('💳');
  const [color, setColor] = useState('#2f9e68');
  const [account, setAccount] = useState('humo');
  const [category, setCategory] = useState('taxi');
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirmDialog, confirm] = useConfirm();

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo size={32} wordmarkClassName="text-[19px]" />
        <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Mavzuni almashtirish">
          {resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
      </header>

      <Section title="Tugmalar">
        <Button>
          <Plus className="h-[18px] w-[18px]" /> Qo‘shish
        </Button>
        <Button variant="secondary">Bekor qilish</Button>
        <Button variant="outline">
          <Download className="h-[18px] w-[18px]" /> Eksport
        </Button>
        <Button variant="ghost">Barchasi</Button>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" /> O‘chirish
        </Button>
        <Button variant="destructive-ghost">Chiqish</Button>
        <Button variant="link">Kodni qayta yuborish</Button>
        <Button size="sm">Kichik</Button>
        <Button size="lg">Telegram orqali boshlash</Button>
        <Button loading>Saqlash</Button>
        <Button disabled>Disabled</Button>
        <Button variant="outline" size="icon" aria-label="Tahrirlash">
          <Pencil className="h-4 w-4" />
        </Button>
      </Section>

      <Section title="Maydonlar">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Input label="Hisob nomi" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} showCounter />
          <Input label="Xato bilan" defaultValue="Humo karta" error="Bunday nomli hisob allaqachon mavjud" />
          <Input label="Disabled" defaultValue="UZS" disabled hint="Balans tranzaksiyalar orqali o‘zgaradi" />
          <SearchInput value={name} onChange={setName} placeholder="Izoh bo‘yicha qidiruv..." />
          <MoneyInput label="Summa" value={money} onChange={setMoney} size="lg" autoFocus={false} />
          <MoneyInput
            label="To‘lov summasi"
            value={money}
            onChange={setMoney}
            error="To‘lov summasi qoldiq qarzdan oshib ketdi"
            chips={[{ label: 'Hammasi · 900 000', value: '90000000' }]}
          />
          <Textarea label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Masalan: Bozorlik, oylik..." />
          <Select label="Vaqt zonasi (native)" options={[{ value: 'tash', label: 'Toshkent (UTC+5)' }]} />
          <Dropdown
            label="Saralash"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'new', label: 'Eng yangi' },
              { value: 'old', label: 'Eng eski' },
              { value: 'big', label: 'Eng katta summa' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-2">
            <Dropdown
              variant="pill"
              placeholder="Hisob"
              emptyValue=""
              value={filter}
              onChange={setFilter}
              aria-label="Hisob"
              options={[{ value: '', label: 'Barcha hisoblar' }, ...ACCOUNTS.map((a) => ({ value: a.id, label: a.name, icon: a.icon }))]}
            />
            <Dropdown variant="pill" placeholder="Tur" emptyValue="" value="" onChange={() => undefined} aria-label="Tur" options={[{ value: '', label: 'Barcha turlar' }]} />
          </div>
        </div>
      </Section>

      <Section title="Tanlash">
        <Segmented
          aria-label="Davr"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'bugun', label: 'Bugun' },
            { value: 'hafta', label: 'Shu hafta' },
            { value: 'oy', label: 'Shu oy' },
            { value: 'yil', label: 'Shu yil' },
            { value: 'oraliq', label: 'Oraliq' },
          ]}
        />
        <Segmented
          aria-label="Tur"
          size="lg"
          value={type}
          onChange={setType}
          options={[
            { value: 'EXPENSE', label: 'Chiqim', tone: 'expense' },
            { value: 'INCOME', label: 'Kirim', tone: 'income' },
          ]}
        />
        <Segmented aria-label="Tur" size="lg" value="EXPENSE" onChange={() => undefined} locked lockedHint="Tahrirlashda turini o‘zgartirib bo‘lmaydi" options={[{ value: 'EXPENSE', label: 'Chiqim kategoriyasi', tone: 'expense' }, { value: 'INCOME', label: 'Kirim kategoriyasi' }]} />
        <Tabs aria-label="Hisoblar" value={tab} onChange={setTab} items={[{ value: 'active', label: 'Faol', count: 4 }, { value: 'archive', label: 'Arxiv', count: 1 }]} />
        <div className="w-full max-w-md">
          <Switch label="Qatʼiy rejim" description="Yoqilganda balansingizdan ortiq xarajat yozib bo‘lmaydi." checked={strict} onChange={setStrict} />
        </div>
        <Checkbox checked={checked} onChange={setChecked} aria-label="Tanlash" />
        <Checkbox checked={false} indeterminate onChange={() => undefined} aria-label="Hammasi" />
      </Section>

      <Section title="Chip va summalar">
        <Chip tone="success" dot>Meʼyorida</Chip>
        <Chip tone="warning" dot>80% dan oshdi</Chip>
        <Chip tone="danger" dot>Oshib ketdi</Chip>
        <Chip tone="info">3 ta yangi</Chip>
        <Chip tone="debt">Qisman to‘langan</Chip>
        <ChangeChip value={8.4} upIsGood />
        <ChangeChip value={12} upIsGood={false} />
        <ChangeChip value={null} upIsGood />
        <ChangeChip value={0} upIsGood />
        <TagChip name="oila" />
        <FilterChip label="Kategoriya" value="Oziq-ovqat" onRemove={() => undefined} />
        <DefaultChip />
        <SystemChip />
        <CountBadge count={12} />
        <div className="flex w-full flex-wrap gap-6 text-[15px]">
          <Amount value="970000000" type="INCOME" />
          <Amount value="638000000" type="EXPENSE" />
          <Amount value="100000000" type="TRANSFER_OUT" />
          <Amount value="200000000" type="LOAN_GIVEN" />
          <Amount value="-2500000000" />
          <Amount value="4305000000" unit="muted" className="text-[25px] tracking-[-0.02em]" />
        </div>
      </Section>

      <Section title="KPI, progress, plitkalar">
        <div className="grid w-full grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="Umumiy balans" value={<Amount value="4305000000" unit="muted" />} change={<ChangeChip value={4.2} upIsGood />} vsText="o‘tgan oyga nisbatan" sub="Barcha hisoblar jami" />
          <KpiCard label="Kirim" value={<Amount value="970000000" type="INCOME" unit="muted" />} change={<ChangeChip value={8.4} upIsGood />} vsText="o‘tgan oyga nisbatan" />
          <KpiCard label="Chiqim" value={<Amount value="638000000" type="EXPENSE" unit="muted" />} change={<ChangeChip value={12} upIsGood={false} />} vsText="o‘tgan oyga nisbatan" />
          <KpiCard label="Qarz saldosi" loading value={null} />
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          {[56, 86, 124].map((p) => (
            <Progress key={p} value={p} tone={budgetTone(p)} size="thin" aria-label={`${p}%`} />
          ))}
          <Progress value={65.8} tone="success" size="lg" marker={70} aria-label="Kirimga nisbatan xarajat" />
        </div>
        <div className="flex items-center gap-2">
          {CATEGORIES.map((c) => (
            <EmojiTile key={c.id} emoji={c.icon} color={c.color} size={40} />
          ))}
          <EmojiTile emoji="⇄" variant="transfer" size={40} />
          <EmojiTile emoji="🤝" variant="debt" size={40} />
          <Avatar name="Aziz Karimov" />
          <Avatar name="Jasur Karimov" letters={2} tone="debt" />
        </div>
      </Section>

      <Section title="Holatlar">
        <Card className="w-full max-w-sm">
          <EmptyState icon={<Plus />} title="Hali tranzaksiyalar yo‘q" description="Kirim yoki chiqimni qo‘shing — u shu yerda paydo bo‘ladi." action={<Button>Birinchi tranzaksiyani qo‘shish</Button>} />
        </Card>
        <Card className="w-full max-w-sm">
          <ErrorState title="Tranzaksiyalarni yuklab bo‘lmadi" onRetry={() => undefined} />
        </Card>
        <Card className="w-full max-w-sm p-4">
          <ErrorState variant="widget" title="Grafikni yuklab bo‘lmadi" message="Boshqa bo‘limlar ishlayapti. Faqat shu grafikni qayta yuklang." onRetry={() => undefined} />
        </Card>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
        <Pagination page={page} totalPages={13} total={248} limit={20} onPageChange={setPage} className="w-full" />
      </Section>

      <Section title="Sana va tanlagichlar">
        <div className="grid w-full gap-6 sm:grid-cols-2">
          <DatePicker label="Sana" value={date} onChange={setDate} chips={['today', 'yesterday']} max="2026-10-03" today="2026-10-03" />
          <DatePicker label="Qaytarish muddati (ixtiyoriy)" value={due} onChange={setDue} chips={['none']} today="2026-10-03" />
          <Card className="p-3">
            <RangePicker value={{ from: '2026-10-01', to: '2026-10-15' }} max="2026-10-03" onApply={(r) => toast.success(`${r.from} – ${r.to}`)} onCancel={() => undefined} />
          </Card>
          <ChoiceGrid
            label="Hisob turi"
            columns={2}
            phoneColumns={2}
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'CARD', label: 'Bank kartasi', emoji: '💳', color: '#3d7bd6' },
              { value: 'CASH', label: 'Naqd pul', emoji: '💵', color: '#e0a11b' },
              { value: 'BANK', label: 'Bank hisob raqami', emoji: '🏦', color: '#22a3a3' },
              { value: 'SAVINGS', label: 'Jamg‘arma / Depozit', emoji: '🐷', color: '#cf5c9c', sub: 'Byudjet bor', disabled: true },
            ]}
          />
          <EmojiGrid emojis={['💳', '💵', '🏦', '💰', '🪙', '💎', '📱', '💼', '🏠', '🚗']} value={emoji} onChange={setEmoji} color={color} />
          <Swatches count={8} value={color} onChange={setColor} />
          <AccountPicker label="Hisob" accounts={ACCOUNTS} value={account} onChange={setAccount} />
          <CategoryPicker label="Kategoriya" categories={CATEGORIES} value={category} onChange={setCategory} />
        </div>
      </Section>

      <Section title="Grafiklar">
        <Card className="w-full p-5 lg:max-w-[640px]">
          <AreaTrend
            ariaLabel="Kirim va chiqim dinamikasi"
            data={TREND}
            series={[
              { key: 'income', label: 'Kirim', color: 'var(--income)' },
              { key: 'expense', label: 'Chiqim', color: 'var(--expense)' },
            ]}
            formatValue={(v, s) => formatAmount(BigInt(v) * 100n, { sign: s.key === 'income' ? '+' : '-' })}
          />
        </Card>
        <Card className="flex items-center gap-6 p-5">
          <Donut
            ariaLabel="Xarajatlar taqsimoti"
            data={[
              { name: 'Uy-joy', value: 3_000_000, color: 'var(--chart-2)', detail: '47%' },
              { name: 'Oziq-ovqat', value: 1_400_000, color: 'var(--chart-1)', detail: '22%' },
              { name: 'Transport', value: 690_000, color: 'var(--chart-3)', detail: '11%' },
              { name: 'Boshqalar', value: 1_290_000, color: 'var(--chart-9)', detail: '20%' },
            ]}
            center={
              <>
                <span className="text-[11.5px] text-text-muted">Jami chiqim</span>
                <span className="text-[17px] font-semibold leading-[22px]">6,4 mln</span>
                <span className="text-[11.5px] text-text-muted">so‘m</span>
              </>
            }
          />
        </Card>
        <Card className="w-full p-5 lg:max-w-[520px]">
          <BarList
            items={[
              { key: 'home', label: 'Uy-joy', value: 3_000_000, display: '3 000 000 so‘m', color: 'var(--chart-2)' },
              { key: 'food', label: 'Oziq-ovqat', value: 1_400_000, display: '1 400 000 so‘m', color: 'var(--chart-1)' },
              { key: 'tr', label: 'Transport', value: 690_000, display: '690 000 so‘m', color: 'var(--chart-3)' },
            ]}
          />
        </Card>
        <Card className="w-full p-5 lg:max-w-[640px]">
          <GroupedBars
            ariaLabel="Davrlar solishtiruvi"
            currentColor="var(--expense)"
            formatValue={(v) => formatAmount(BigInt(v) * 100n)}
            data={['1–7', '8–14', '15–21', '22–28', '29–30'].map((label, i) => ({
              label,
              title: `${label}-sentabr / avgust`,
              current: [1_200_000, 1_800_000, 900_000, 1_500_000, 300_000][i],
              previous: [1_000_000, 1_400_000, 1_300_000, 1_100_000, 500_000][i],
            }))}
          />
        </Card>
      </Section>

      <Section title="Overlay">
        <Button onClick={() => setModal(true)}>Modal / sheet</Button>
        <Button variant="outline" onClick={() => setSheet(true)}>Bottom sheet</Button>
        <Button
          variant="outline"
          onClick={() =>
            void confirm({
              title: 'Tranzaksiya o‘chirilsinmi?',
              description: 'O‘chirilgan yozuv balans va hisobotlardan chiqariladi.',
              confirmLabel: 'O‘chirish',
              destructive: true,
            })
          }
        >
          Tasdiqlash oynasi
        </Button>
        <Menu
          label="Qator amallari"
          trigger={(props) => (
            <Button variant="outline" {...props}>
              Menyu
            </Button>
          )}
          items={[
            { label: 'Tahrirlash', icon: Pencil, onSelect: () => toast.success('Tahrirlash') },
            { label: 'O‘tkazmani bekor qilish', icon: ArrowLeftRight, onSelect: () => undefined, disabled: true },
            { label: 'O‘chirish', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => undefined },
          ]}
        />
        <Button variant="outline" onClick={() => toast.success('O‘zgarishlar saqlandi')}>Toast</Button>
        <Button variant="outline" onClick={() => toast.undo('Tranzaksiya o‘chirildi', () => toast.info('Qaytarildi'))}>
          <Undo2 className="h-4 w-4" /> Undo toast
        </Button>
        <Button variant="outline" onClick={() => toast.error('Server bilan bog‘lanib bo‘lmadi')}>Xato toast</Button>
      </Section>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="Yangi tranzaksiya"
        description="Kirim yoki chiqimni qayd etish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Bekor qilish</Button>
            <Button onClick={() => setModal(false)}>Saqlash</Button>
          </>
        }
      >
        <Segmented aria-label="Tur" size="lg" fullWidth value={type} onChange={setType} options={[{ value: 'EXPENSE', label: 'Chiqim', tone: 'expense' }, { value: 'INCOME', label: 'Kirim', tone: 'income' }]} />
        <MoneyInput label="Summa" value={money} onChange={setMoney} size="lg" />
        <AccountPicker label="Hisob" accounts={ACCOUNTS} value={account} onChange={setAccount} />
        <CategoryPicker label="Kategoriya" categories={CATEGORIES} value={category} onChange={setCategory} />
        <DatePicker label="Sana" value={date} onChange={setDate} chips={['today', 'yesterday']} today="2026-10-03" max="2026-10-03" />
        <Textarea label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Modal>
      <Sheet isOpen={sheet} onClose={() => setSheet(false)} title="Qo‘shish">
        <p className="py-6 text-text-secondary">Sheet mazmuni</p>
      </Sheet>
      {confirmDialog}
    </div>
  );
}
