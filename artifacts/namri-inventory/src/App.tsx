import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { arSA } from '@clerk/localizations';
import { shadcn } from '@clerk/themes';
import * as XLSX from 'xlsx';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowDownToLine, ArrowLeft, ArrowUpLeft,
  Boxes, BriefcaseBusiness, Building2, CalendarDays, Check, CircleAlert,
  ClipboardList, FileDown, FileText, Filter, LayoutDashboard, LogIn, LogOut, Menu,
  Package, Pencil, Plus, Printer, Search, ShieldCheck, SlidersHorizontal,
  Users, Warehouse, X,
} from 'lucide-react';
import {
  getGetBackupExportQueryKey, getGetDashboardQueryKey, getGetInventoryReportQueryKey,
  getGetMovementReportQueryKey, getGetCurrentUserQueryKey, getListItemsQueryKey,
  getListMovementsQueryKey, getListProjectsQueryKey, getListUsersQueryKey,
  getListWarehousesQueryKey, useCreateItem, useCreateMovement, useCreateProject,
  useCreateWarehouse, useGetBackupExport, useGetCurrentUser, useGetDashboard,
  useGetInventoryReport, useGetMovementReport, useListItems, useListMovements,
  useListProjects, useListUsers, useListWarehouses, useRecordStockCount,
  useUpdateItem, useUpdateMovementApproval, useUpdateProject, useUpdateUserRole,
} from '@workspace/api-client-react';
import type { AppUser, InventoryItem, Movement, MovementInput, Project, Warehouse as WarehouseType } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: true } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#17699a',
    colorForeground: '#17344d',
    colorMutedForeground: '#667b8d',
    colorDanger: '#ad5347',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#263f55',
    colorNeutral: '#dce5eb',
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-900 font-bold',
    headerSubtitle: 'text-slate-600',
    formFieldLabel: 'text-slate-700',
    footerActionText: 'text-slate-600',
    footerActionLink: 'text-sky-800 font-semibold',
    dividerText: 'text-slate-500',
    formButtonPrimary: 'bg-sky-800 hover:bg-sky-900 text-white',
    formFieldInput: 'border-slate-300 text-slate-900',
  },
};

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}
const routes = [
  { href: '/dashboard', label: 'لوحة المتابعة', icon: LayoutDashboard },
  { href: '/inventory', label: 'المخزون', icon: Boxes },
  { href: '/transactions/new', label: 'تسجيل حركة', icon: ArrowDownToLine },
  { href: '/history', label: 'سجل الحركات', icon: Activity },
  { href: '/reports', label: 'التقارير', icon: FileText },
  { href: '/approvals', label: 'اعتمادات الحركات', icon: Check, admin: true },
  { href: '/projects', label: 'المشاريع', icon: Building2 },
  { href: '/users', label: 'إدارة المستخدمين', icon: Users, admin: true },
];
const roleNames: Record<string, string> = { admin: 'مدير النظام', warehouse_manager: 'مدير مستودع', viewer: 'مشاهد' };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (value?: number | null) => new Intl.NumberFormat('ar-SA').format(value ?? 0);
const fmtMoney = (value?: number | null) => `${new Intl.NumberFormat('ar-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)} د.أ`;
const fmtDate = (value?: string | null) => value ? new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'landing-logo' : 'brand'} data-testid="brand-namri">
    <div className="brand-mark"><Warehouse size={22} strokeWidth={2.1} /></div>
    <div><div className="brand-name">مخزون نمري</div><div className="brand-sub">NAMRI CONSTRUCTION</div></div>
  </div>;
}

function Button({ children, kind = '', onClick, type = 'button', disabled, testId, className = '', title }: {
  children: ReactNode; kind?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; testId: string; className?: string; title?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} title={title} data-testid={testId} className={`btn ${kind} ${className}`}>{children}</button>;
}

function PageTitle({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="page-head"><div><h1 className="page-title" data-testid={`title-${title}`}>{title}</h1><p className="page-description" data-testid="text-page-description">{description}</p></div><div className="head-actions">{children}</div></div>;
}

function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby={`${testId}-title`} data-testid={testId}>
      <header className="modal-head"><h2 className="modal-title" id={`${testId}-title`}>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="إغلاق" data-testid={`close-${testId}`}><X size={17} /></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

function LoadingCards() {
  return <div className="metric-grid" aria-label="جار تحميل البيانات">{[0, 1, 2, 3].map(i => <div className="panel panel-pad skeleton-card" key={i} data-testid={`skeleton-metric-${i}`}><div className="skeleton" style={{ width: '44%' }} /><div className="skeleton" style={{ width: '60%', height: 30, marginTop: 22 }} /><div className="skeleton" style={{ width: '36%', marginTop: 12 }} /></div>)}</div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="error-box" data-testid="status-load-error"><div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 10 }}><CircleAlert size={18} /> تعذر تحميل البيانات. تحقق من اتصالك ثم أعد المحاولة.</div><Button onClick={onRetry} testId="button-retry" kind="btn-danger">إعادة المحاولة</Button></div>;
}

function NotFoundPage() {
  return <main className="auth-page" dir="rtl" data-testid="page-not-found"><section className="auth-card"><Brand compact /><div style={{ font: '800 56px Manrope,sans-serif', color: '#17699a', marginTop: 28 }}>404</div><h1 className="page-title">هذه الصفحة غير موجودة</h1><p className="page-description">قد يكون الرابط غير صحيح أو أن الصفحة نُقلت.</p><Link href="/" className="btn btn-primary" style={{ marginTop: 20 }} data-testid="link-not-found-home"><ArrowLeft size={15} /> العودة إلى الرئيسية</Link></section></main>;
}

function Empty({ icon: Icon = Package, title, detail, action }: { icon?: typeof Package; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="empty-state"><div className="empty-icon"><Icon size={21} /></div><h3 className="empty-title">{title}</h3><p className="empty-copy">{detail}</p>{action}</div>;
}

function Welcome() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && isSignedIn) setLocation('/dashboard'); }, [isLoaded, isSignedIn, setLocation]);
  if (isLoaded && isSignedIn) return null;
  return <main className="landing" dir="rtl" data-testid="page-welcome">
    <header className="landing-header"><Brand compact /><div style={{ display: 'flex', gap: 9 }}>
      <Link className="btn" href="/sign-in" data-testid="link-sign-in"><LogIn size={15} /> تسجيل الدخول</Link>
      <Link className="btn btn-primary" href="/sign-up" data-testid="link-sign-up">إنشاء حساب <ArrowLeft size={15} /></Link>
    </div></header>
    <section className="landing-hero">
      <div className="hero-copy"><div className="eyebrow">مساحة العمل التشغيلية لمخازن نمري</div>
        <h1 className="hero-title">كل قطعة في مكانها.<br /><span>وكل قرار في وقته.</span></h1>
        <p className="hero-desc">من استلام المواد إلى حركة الموقع — رؤية واضحة للمخزون والمستودعات والمشاريع، في مساحة واحدة يعتمد عليها فريق نمري كل يوم.</p>
        <div className="hero-ctas"><Link className="btn btn-primary" href="/sign-in" data-testid="link-start-work"><LogIn size={16} /> ابدأ العمل <ArrowLeft size={15} /></Link><a href="#capabilities" className="btn" data-testid="link-capabilities">اكتشف مساحة العمل <ArrowDownLeft size={15} /></a></div>
        <div className="landing-proof"><span className="proof-dash" /> مُصمم لوتيرة مواقع الإنشاءات — واضح، موثوق، ومباشر.</div>
      </div>
      <div className="hero-visual" aria-label="رسم توضيحي لمستودع منظم"><div className="warehouse-art" data-testid="visual-warehouse">
        <div className="art-grid" /><div className="art-rack"><div className="art-shelf s1" /><div className="art-shelf s2" /><div className="art-box box-a" /><div className="art-box box-b" /><div className="art-box box-c" /><div className="art-box box-d" /><div className="art-box box-e" /></div>
         <div className="floating-tag tag-stock">المخزون<b>حسب المستودع</b></div><div className="floating-tag tag-live">حركة المواد<b>تسجيل موثّق</b></div>
      </div></div>
    </section>
    <section className="landing-strip" id="capabilities">
      <div className="strip-item"><div className="strip-num">01</div><div className="strip-label">أرصدة دقيقة لكل مستودع ومادة</div></div>
      <div className="strip-item"><div className="strip-num">02</div><div className="strip-label">استلام وصرف موثق مرتبط بالمشروع</div></div>
      <div className="strip-item"><div className="strip-num">03</div><div className="strip-label">تنبيهات مبكرة قبل نقص المواد</div></div>
    </section>
    <footer className="landing-footer"><span>مخزون نمري · شركة نمري للمقاولات</span><span>مساحة عمل داخلية لفريق المستودع والمشاريع</span></footer>
  </main>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignIn = mode === 'sign-in';
  return <main className="auth-page" dir="rtl" data-testid={`page-${mode}`}>
    <div><Link href="/" className="auth-brand" data-testid="link-auth-home"><Brand compact /></Link>
      <div className="auth-card"><div style={{ textAlign: 'center', marginBottom: 18 }}><div style={{ color: '#203d54', fontWeight: 700, fontSize: 18 }}>{isSignIn ? 'مرحباً بعودتك' : 'انضم إلى مساحة نمري'}</div><div style={{ color: '#7c8d9c', fontSize: 11, marginTop: 5 }}>{isSignIn ? 'سجل الدخول لمتابعة عمليات المستودع' : 'أنشئ حسابك للوصول إلى مساحة العمل'}</div></div>
         <div className="auth-clerk"><div dir="ltr">{isSignIn ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} />}</div></div>
      </div>
      <div style={{ textAlign: 'center', color: '#8191a0', fontSize: 10, marginTop: 15 }}>وصول آمن لفريق نامري للإنشاءات</div>
    </div>
  </main>;
}

function Shell({ children, user }: { children: ReactNode; user?: AppUser }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const visibleRoutes = routes.filter(r => !r.admin || user?.role === 'admin');
  const active = (href: string) => href === '/transactions/new' ? location === href : location === href || (href !== '/dashboard' && location.startsWith(`${href}/`));
  const displayName = user?.name || 'مستخدم نمري';
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} data-testid="nav-sidebar">
      <Brand />
      <div className="nav-caption">مساحة العمل</div>
      <nav className="nav-list" aria-label="التنقل الرئيسي">{visibleRoutes.map(({ href, label, icon: Icon }) =>
        <Link href={href} key={href} onClick={() => setMenuOpen(false)} className={`nav-link ${active(href) ? 'active' : ''}`} data-testid={`link-nav-${href.replaceAll('/', '-').replace(/^-/, '')}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-foot"><div className="online-chip"><span className="online-dot" /> مساحة العمل متصلة</div>
        <div className="user-mini"><div className="avatar-initial" data-testid="avatar-current-user">{displayName.slice(0, 1)}</div><div style={{ minWidth: 0, flex: 1 }}><div className="user-name" data-testid="text-current-user">{displayName}</div><div className="user-role" data-testid="text-current-role">{roleNames[user?.role ?? 'viewer']}</div></div>
          <button onClick={() => signOut()} className="icon-btn" aria-label="تسجيل الخروج" title="تسجيل الخروج" data-testid="button-sign-out"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
    {menuOpen && <button aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20, border: 0, background: '#0b1e3055' }} data-testid="button-close-navigation" />}
     <div className="workspace"><header className="topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة" data-testid="button-open-navigation"><Menu size={20} /></button><span className="crumb">شركة نمري للمقاولات <span style={{ padding: '0 7px', color: '#b0bdc8' }}>/</span> {routes.find(r => active(r.href))?.label ?? 'مساحة العمل'}</span></div><div className="topbar-actions"><span className="live-badge"><span className="online-dot" /> نظام المخزون نشط</span><div className="avatar-initial">{displayName.slice(0, 1)}</div></div></header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="bottom-nav" aria-label="التنقل السريع">{routes.filter(r => !r.admin || user?.role === 'admin').slice(0, 5).map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`bottom-link ${active(href) ? 'active' : ''}`} data-testid={`mobile-nav-${href.replaceAll('/', '-').replace(/^-/, '')}`}><Icon size={18} /><span>{label.split(' ')[0]}</span></Link>)}</nav>
  </div>;
}

function Metric({ title, value, sub, icon: Icon, color, wash }: { title: string; value: number; sub: string; icon: typeof Package; color: string; wash: string }) {
  return <div className="metric-card" style={{ '--metric': color, '--wash': wash } as CSSProperties} data-testid={`metric-${title}`}><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-number" data-testid={`value-${title}`}>{fmt(value)}</div><div className="metric-note">{sub}</div></div>;
}

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  if (isLoading) return <><PageTitle title="لوحة المتابعة" description="صورة تشغيلية واضحة للمستودعات وحركة المواد." /><LoadingCards /><div className="panel skeleton skeleton-card" /></>;
  if (isError || !data) return <><PageTitle title="لوحة المتابعة" description="صورة تشغيلية واضحة للمستودعات وحركة المواد." /><ErrorState onRetry={() => { void refetch(); }} /></>;
  const max = Math.max(1, ...data.monthlyMovements.map(m => Math.max(m.inbound, m.outbound)));
  return <div data-testid="page-dashboard"><PageTitle title="لوحة المتابعة" description="ملخص المخزون وحركة المواد عبر مستودعات نمري." >
    <Link href="/transactions/new" className="btn btn-primary" data-testid="link-create-movement"><Plus size={15} /> تسجيل حركة</Link></PageTitle>
    <div className="metric-grid">
      <Metric title="إجمالي المواد" value={data.totalItems} sub="مادة مسجلة في النظام" icon={Package} color="#236f98" wash="#e5f3f8" />
      <Metric title="وارد هذا الشهر" value={data.monthlyInbound} sub="وحدة تم استلامها" icon={ArrowDownLeft} color="#398b76" wash="#e8f5f0" />
      <Metric title="صادر هذا الشهر" value={data.monthlyOutbound} sub="وحدة صُرفت للمشاريع" icon={ArrowUpLeft} color="#c27a3d" wash="#fff3e6" />
      <Metric title="مواد منخفضة" value={data.lowStockCount} sub="تحتاج متابعة وإعادة طلب" icon={CircleAlert} color="#b45a4d" wash="#fff0ed" />
    </div>
    <div className="dash-grid">
      <section className="panel panel-pad" data-testid="panel-movement-chart"><div className="panel-heading"><div><h2 className="panel-title">حركة المواد الشهرية</h2><div className="panel-subtitle">الوارد والصادر خلال الأشهر الأخيرة</div></div><div className="chart-legend"><span><i className="legend-dot" style={{ background: '#50b3d0' }} />وارد</span><span><i className="legend-dot" style={{ background: '#a5b6c8' }} />صادر</span></div></div>
        <div className="chart-area" aria-label="مخطط الحركة الشهرية">{data.monthlyMovements.map((m, i) => <div className="month-pair" key={`${m.month}-${i}`} data-testid={`chart-month-${i}`}><div className="bar" title={`وارد ${fmt(m.inbound)}`} style={{ height: `${Math.max(2, m.inbound / max * 88)}%` }} /><div className="bar out" title={`صادر ${fmt(m.outbound)}`} style={{ height: `${Math.max(2, m.outbound / max * 88)}%` }} /></div>)}</div>
        <div className="month-labels">{data.monthlyMovements.map((m, i) => <span key={`${m.month}-label-${i}`} data-testid={`label-chart-month-${i}`}>{m.month}</span>)}</div>
      </section>
      <section className="panel panel-pad" data-testid="panel-warehouse-distribution"><div className="panel-heading"><div><h2 className="panel-title">توزيع المستودعات</h2><div className="panel-subtitle">إجمالي الوحدات المخزنة</div></div><Warehouse size={17} color="#428aa5" /></div>
        {data.warehouseSummaries.length ? <div className="warehouse-list">{data.warehouseSummaries.map((w, i) => <div key={w.warehouseId} data-testid={`warehouse-summary-${w.warehouseId}`}><div className="warehouse-row-head"><span>{w.warehouseName}<small style={{ display: 'block', color: '#93a0ac', marginTop: 3 }}>{fmt(w.itemCount)} مادة</small></span><b>{fmt(w.totalUnits)}</b></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, w.totalUnits / Math.max(1, ...data.warehouseSummaries.map(x => x.totalUnits)) * 100)}%`, opacity: 1 - i * .1 }} /></div></div>)}</div> : <Empty icon={Warehouse} title="لا توجد مستودعات" detail="ستظهر هنا أرصدة المستودعات عند توفرها." />}
      </section>
    </div>
    <div className="content-grid">
      <section className="panel page-table-panel" data-testid="panel-recent-movements"><div className="panel-pad"><div className="panel-heading" style={{ marginBottom: 0 }}><div><h2 className="panel-title">أحدث الحركات</h2><div className="panel-subtitle">آخر ما تم تسجيله في المستودعات</div></div><Link href="/history" className="btn btn-soft" data-testid="link-all-movements">عرض السجل <ArrowLeft size={14} /></Link></div></div>
        {data.recentMovements.length ? <MovementTable movements={data.recentMovements.slice(0, 6)} /> : <Empty icon={Activity} title="لا توجد حركات بعد" detail="ابدأ بتسجيل استلام أو صرف للمخزون." action={<Link href="/transactions/new" className="btn btn-primary" data-testid="link-first-movement">تسجيل حركة <Plus size={14} /></Link>} />}
      </section>
      <section className="panel" data-testid="panel-low-stock"><div className="panel-pad"><div className="panel-heading"><div><h2 className="panel-title">تنبيهات انخفاض المخزون</h2><div className="panel-subtitle">مواد وصلت إلى حد إعادة الطلب</div></div><span className="status-pill warning">{fmt(data.lowStockCount)} مواد</span></div>
        {data.lowStockItems.length ? <div style={{ display: 'grid', gap: 2 }}>{data.lowStockItems.slice(0, 5).map(item => <LowStockRow item={item} key={item.id} />)}</div> : <Empty icon={Check} title="المخزون ضمن الحدود" detail="لا توجد مواد بحاجة إلى إعادة طلب حالياً." />}
       </div>
      </section>
    </div>
  </div>;
}

function LowStockRow({ item }: { item: InventoryItem }) {
  return <div className="item-cell" data-testid={`low-stock-item-${item.id}`} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f4' }}><div className="item-symbol"><Package size={15} /></div><div style={{ flex: 1 }}><div className="item-primary">{item.name}</div><div className="item-secondary">{item.code} · الحد الأدنى {fmt(item.minStock)}</div></div><span className="status-pill warning">{fmt(item.totalStock)} {item.unit}</span></div>;
}

function MovementTable({ movements }: { movements: Movement[] }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>المادة</th><th>نوع الحركة</th><th>المستودع</th><th>الكمية</th><th>القيمة</th><th>التاريخ</th></tr></thead><tbody>{movements.map(m => <tr key={m.id} data-testid={`row-movement-${m.id}`}><td><div className="item-primary">{m.itemName}</div><div className="item-secondary">{m.itemCode}</div></td><td><MovementBadge type={m.type} /></td><td>{m.warehouseName}</td><td dir="ltr" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(m.quantity)}</td><td>{fmtMoney(m.totalValue)}</td><td>{fmtDate(m.occurredOn)}</td></tr>)}</tbody></table></div>;
}

function MovementBadge({ type }: { type: Movement['type'] }) {
  const label = type === 'in' ? 'استلام' : type === 'out' ? 'صرف' : 'تسوية';
  const Icon = type === 'in' ? ArrowDownLeft : type === 'out' ? ArrowUpLeft : SlidersHorizontal;
  return <span className={`move-type ${type}`} data-testid={`movement-type-${type}`}><Icon size={13} />{label}</span>;
}

function ApprovalBadge({ status }: { status: Movement['approvalStatus'] }) {
  const label = status === 'pending' ? 'قيد المراجعة' : status === 'approved' ? 'معتمد' : 'مرفوض';
  return <span className={`status-pill ${status === 'pending' ? 'warning' : status === 'rejected' ? 'neutral' : ''}`} data-testid={`approval-status-${status}`}>{label}</span>;
}

function InventoryPage() {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState<'new' | 'edit' | 'stocktake' | null>(null);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const { data: warehouses = [] } = useListWarehouses();
  const params = useMemo(() => ({ q: search || undefined, warehouseId: warehouseId ? Number(warehouseId) : undefined, category: category || undefined }), [search, warehouseId, category]);
  const { data: items = [], isLoading, isError, refetch } = useListItems(params);
  const { data: allItems = [] } = useListItems();
  const { data: user } = useGetCurrentUser();
  const canWrite = user?.role === 'admin' || user?.role === 'warehouse_manager';
  const canCreateWarehouse = user?.role === 'admin';
  const open = (kind: 'edit' | 'stocktake', item: InventoryItem) => { setSelected(item); setModal(kind); };
  return <div data-testid="page-inventory"><PageTitle title="المخزون" description="أرصدة المواد المسجلة موزعة حسب المستودع." >
    {canCreateWarehouse && <Button onClick={() => setShowWarehouseForm(true)} testId="button-create-warehouse"><Warehouse size={15} /> مستودع جديد</Button>}
    {canWrite && <><Button onClick={() => { setSelected(null); setModal('new'); }} kind="btn-primary" testId="button-add-item"><Plus size={15} /> إضافة مادة</Button><Link className="btn" href="/transactions/new" data-testid="link-stock-movement"><ArrowDownLeft size={15} /> تسجيل حركة</Link></>}
  </PageTitle>
    <div className="filters"><div className="search-wrap"><Search size={16} /><input className="field search-field" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرمز..." aria-label="البحث في المخزون" data-testid="input-inventory-search" /></div>
      <select className="select-field" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} aria-label="تصفية حسب المستودع" data-testid="select-inventory-warehouse"><option value="">كل المستودعات</option>{warehouses.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select>
      <select className="select-field" value={category} onChange={e => setCategory(e.target.value)} aria-label="تصفية حسب الفئة" data-testid="select-inventory-category"><option value="">كل الفئات</option>{Array.from(new Set(allItems.map(item => item.category))).sort().map(value => <option value={value} key={value}>{value}</option>)}</select>
      <span className="live-badge"><Package size={13} /> {fmt(items.length)} مادة</span>
    </div>
    <section className="panel page-table-panel" data-testid="panel-inventory-table">
      {isLoading ? <div className="panel-pad" style={{ display: 'grid', gap: 14 }}>{[0,1,2,3,4].map(i => <div className="skeleton" key={i} style={{ height: 38 }} />)}</div>
        : isError ? <div className="panel-pad"><ErrorState onRetry={() => { void refetch(); }} /></div>
        : items.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>المادة</th><th>الفئة</th><th>الرصيد الكلي</th><th>الحد الأدنى</th><th>المستودعات</th><th>الحالة</th>{canWrite && <th>إجراءات</th>}</tr></thead><tbody>{items.map(item => <tr key={item.id} data-testid={`row-item-${item.id}`}><td><div className="item-cell"><span className="item-symbol"><Package size={15} /></span><span><span className="item-primary">{item.name}</span><span className="item-secondary">{item.code} · {item.unit}</span></span></div></td><td>{item.category}</td><td><b style={{ color: '#27445a' }}>{fmt(item.totalStock)}</b> <span className="item-secondary">{item.unit}</span><div className="item-secondary">{fmtMoney(item.totalValue)}</div></td><td>{fmt(item.minStock)} {item.unit}</td><td>{item.warehouseStocks.map(s => <div key={s.warehouseId} className="item-secondary" data-testid={`warehouse-stock-${item.id}-${s.warehouseId}`}>{s.warehouseName}: <b>{fmt(s.quantity)}</b></div>)}</td><td><span className={`status-pill ${item.totalStock <= item.minStock ? 'warning' : ''}`} data-testid={`status-stock-${item.id}`}>{item.totalStock <= item.minStock ? 'منخفض' : 'متوفر'}</span></td>{canWrite && <td><div style={{ display: 'flex', gap: 6 }}><button className="icon-btn" title="تعديل بيانات المادة" aria-label={`تعديل ${item.name}`} onClick={() => open('edit', item)} data-testid={`button-edit-item-${item.id}`}><Pencil size={14} /></button><button className="icon-btn" title="الجرد الفعلي" aria-label={`جرد ${item.name}`} onClick={() => open('stocktake', item)} data-testid={`button-stocktake-item-${item.id}`}><ClipboardList size={14} /></button></div></td>}</tr>)}</tbody></table></div>
        : <Empty icon={Package} title="لا توجد مواد مطابقة" detail={search ? 'جرّب تغيير عبارة البحث أو المستودع.' : 'أضف أول مادة إلى سجل المخزون.'} action={canWrite && <Button onClick={() => setModal('new')} kind="btn-primary" testId="button-empty-add-item"><Plus size={14} /> إضافة مادة</Button>} />}
    </section>
    {modal === 'new' && <ItemForm warehouses={warehouses} onClose={() => setModal(null)} />}
    {modal === 'edit' && selected && <ItemForm item={selected} warehouses={warehouses} onClose={() => setModal(null)} />}
     {modal === 'stocktake' && selected && <StocktakeForm item={selected} warehouses={warehouses} onClose={() => setModal(null)} />}
     {showWarehouseForm && <WarehouseForm onClose={() => setShowWarehouseForm(false)} />}
  </div>;
}

function ItemForm({ item, warehouses, onClose }: { item?: InventoryItem; warehouses: WarehouseType[]; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateItem(); const update = useUpdateItem();
  const defaultWarehouse = warehouses.find(w => w.isDefault) ?? warehouses[0];
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const common = { code: String(f.get('code')), name: String(f.get('name')), category: String(f.get('category')), unit: String(f.get('unit')), minStock: Number(f.get('minStock')) };
    if (item) update.mutate({ id: item.id, data: common }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListItemsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); await qc.invalidateQueries({ queryKey: getGetInventoryReportQueryKey() }); onClose(); } });
    else create.mutate({ data: { ...common, warehouseId: Number(f.get('warehouseId')), initialStock: Number(f.get('initialStock')), initialUnitCost: Number(f.get('initialUnitCost') || 0) } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListItemsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); await qc.invalidateQueries({ queryKey: getGetInventoryReportQueryKey() }); onClose(); } });
  }
  const busy = create.isPending || update.isPending;
  return <Modal title={item ? 'تعديل بيانات المادة' : 'إضافة مادة جديدة'} onClose={onClose} testId="modal-item-form"><form onSubmit={submit} data-testid="form-item">
    <div className="form-grid">
      <Field label="رمز المادة" name="code" required defaultValue={item?.code} placeholder="مثال: MAT-023" />
      <Field label="اسم المادة" name="name" required defaultValue={item?.name} placeholder="اسم واضح للمادة" />
      <Field label="الفئة" name="category" required defaultValue={item?.category} placeholder="مثال: مواد كهربائية" />
      <Field label="وحدة القياس" name="unit" required defaultValue={item?.unit} placeholder="قطعة، كيس، متر..." />
      <Field label="حد إعادة الطلب" name="minStock" required type="number" min="0" defaultValue={item?.minStock ?? 0} />
      {!item && <Field label="الرصيد الافتتاحي" name="initialStock" required type="number" min="0" defaultValue="0" />}
      {!item && <Field label="تكلفة الوحدة الافتتاحية (د.أ)" name="initialUnitCost" required type="number" min="0" step="0.0001" defaultValue="0" />}
      {!item && <label className="field-block span-two"><span className="field-label">المستودع</span><select className="select-field" name="warehouseId" defaultValue={defaultWarehouse?.id ?? ''} required data-testid="select-item-warehouse">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' · افتراضي' : ''}</option>)}</select></label>}
    </div>
    {(create.isError || update.isError) && <div className="field-hint" role="alert" data-testid="status-item-save-error" style={{ color: '#ae5149', marginTop: 12 }}>تعذر حفظ المادة. راجع البيانات أو صلاحياتك وحاول مجدداً.</div>}
    <div className="form-actions"><Button type="submit" kind="btn-primary" disabled={busy} testId="button-save-item">{busy ? 'جارٍ الحفظ...' : 'حفظ المادة'}</Button><Button onClick={onClose} testId="button-cancel-item">إلغاء</Button></div>
  </form></Modal>;
}

function WarehouseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateWarehouse();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate(
      {
        data: {
          name: String(form.get('name')).trim(),
          location: String(form.get('location')).trim(),
        },
      },
      {
        onSuccess: async () => {
          await qc.invalidateQueries({ queryKey: getListWarehousesQueryKey() });
          onClose();
        },
      },
    );
  }
  return <Modal title="إضافة مستودع" onClose={onClose} testId="modal-warehouse-form">
    <form onSubmit={submit} data-testid="form-warehouse">
      <div className="form-grid">
        <div className="span-two"><Field label="اسم المستودع" name="name" required placeholder="مثال: مستودع المشروع" /></div>
        <div className="span-two"><Field label="المدينة أو الموقع" name="location" required placeholder="المفرق أو عمان" /></div>
      </div>
      {create.isError && <div className="field-hint" role="alert" data-testid="status-warehouse-save-error" style={{ color: '#ae5149', marginTop: 12 }}>تعذر حفظ المستودع. قد يكون الاسم مستخدماً مسبقاً.</div>}
      <div className="form-actions"><Button type="submit" kind="btn-primary" disabled={create.isPending} testId="button-save-warehouse">{create.isPending ? 'جارٍ الحفظ...' : 'حفظ المستودع'}</Button><Button onClick={onClose} testId="button-cancel-warehouse">إلغاء</Button></div>
    </form>
  </Modal>;
}

function Field({ label, name, required, defaultValue, placeholder, type = 'text', min, step }: { label: string; name: string; required?: boolean; defaultValue?: string | number; placeholder?: string; type?: string; min?: string; step?: string }) {
  return <label className="field-block"><span className="field-label">{label}</span><input className="field" name={name} required={required} type={type} min={min} step={step} defaultValue={defaultValue} placeholder={placeholder} data-testid={`input-${name}`} /></label>;
}

function StocktakeForm({ item, warehouses, onClose }: { item: InventoryItem; warehouses: WarehouseType[]; onClose: () => void }) {
  const qc = useQueryClient(); const count = useRecordStockCount();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    count.mutate({ data: { itemId: item.id, warehouseId: Number(f.get('warehouseId')), countedStock: Number(f.get('countedStock')), notes: String(f.get('notes') || ''), occurredOn: String(f.get('occurredOn')) } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListItemsQueryKey() }); await qc.invalidateQueries({ queryKey: getListMovementsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); await qc.invalidateQueries({ queryKey: getGetInventoryReportQueryKey() }); onClose(); } });
  }
  const firstStock = item.warehouseStocks[0]; return <Modal title={`جرد فعلي · ${item.name}`} onClose={onClose} testId="modal-stocktake"><form onSubmit={submit} data-testid="form-stocktake"><div className="form-grid">
    <label className="field-block span-two"><span className="field-label">المستودع</span><select className="select-field" name="warehouseId" required defaultValue={firstStock?.warehouseId ?? warehouses[0]?.id} data-testid="select-stocktake-warehouse">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <Field label="الرصيد الفعلي" name="countedStock" required type="number" min="0" defaultValue={firstStock?.quantity ?? 0} />
    <Field label="تاريخ الجرد" name="occurredOn" required type="date" defaultValue={today()} />
    <label className="field-block span-two"><span className="field-label">ملاحظات الجرد</span><textarea className="field" name="notes" placeholder="اكتب ملاحظات عند وجود فرق..." data-testid="input-notes" /></label>
  </div>{count.isError && <div role="alert" className="field-hint" data-testid="status-stocktake-error" style={{ color: '#ae5149' }}>تعذر تسجيل الجرد. تحقق من الرصيد المدخل.</div>}
  <div className="form-actions"><Button type="submit" kind="btn-primary" disabled={count.isPending} testId="button-save-stocktake">{count.isPending ? 'جارٍ التسجيل...' : 'تسجيل نتيجة الجرد'}</Button><Button onClick={onClose} testId="button-cancel-stocktake">إلغاء</Button></div></form></Modal>;
}

function TransactionPage() {
  const qc = useQueryClient(); const create = useCreateMovement();
  const { data: items = [] } = useListItems(); const { data: warehouses = [] } = useListWarehouses(); const { data: projects = [] } = useListProjects({ status: 'active' });
  const { data: user } = useGetCurrentUser(); const canWrite = user?.role === 'admin' || user?.role === 'warehouse_manager';
  const [type, setType] = useState<'in' | 'out'>('in');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const movement: MovementInput = { itemId: Number(f.get('itemId')), warehouseId: Number(f.get('warehouseId')), type, quantity: Number(f.get('quantity')), unitCost: type === 'in' ? Number(f.get('unitCost')) : undefined, occurredOn: String(f.get('occurredOn')), supplier: String(f.get('supplier') || '') || undefined, invoiceNumber: String(f.get('invoiceNumber') || '') || undefined, projectId: f.get('projectId') ? Number(f.get('projectId')) : undefined, recipient: String(f.get('recipient') || '') || undefined, notes: String(f.get('notes') || '') || undefined };
    create.mutate({ data: movement }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListMovementsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetMovementReportQueryKey() }); form.reset(); setType('in'); } });
  }
  if (!canWrite) return <AccessDenied />;
  return <div data-testid="page-transaction-new"><PageTitle title="تسجيل حركة مخزون" description="وثّق استلام المواد أو صرفها إلى أحد المشاريع." />
    <div className="content-grid"><section className="panel panel-pad" style={{ maxWidth: 800 }}><div className="panel-heading"><div><h2 className="panel-title">تفاصيل الحركة</h2><div className="panel-subtitle">تُحدّث الأرصدة مباشرة بعد الحفظ</div></div><ClipboardList size={17} color="#438aa6" /></div>
      {!items.length ? <Empty title="لا توجد مواد مسجلة" detail="أضف مادة إلى المخزون قبل إنشاء حركة." action={<Link className="btn btn-primary" href="/inventory" data-testid="link-add-item-before-movement"><Plus size={14} /> الذهاب للمخزون</Link>} /> :
      <form onSubmit={submit} data-testid="form-new-movement">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}><button type="button" className={`btn ${type === 'in' ? 'btn-primary' : ''}`} onClick={() => setType('in')} data-testid="button-movement-in"><ArrowDownLeft size={15} /> استلام وارد</button><button type="button" className={`btn ${type === 'out' ? 'btn-primary' : ''}`} onClick={() => setType('out')} data-testid="button-movement-out"><ArrowUpLeft size={15} /> صرف للمشروع</button></div>
        <div className="form-grid">
          <label className="field-block span-two"><span className="field-label">المادة</span><select className="select-field" name="itemId" required defaultValue="" data-testid="select-movement-item"><option value="" disabled>اختر المادة</option>{items.map(i => <option key={i.id} value={i.id}>{i.code} — {i.name} ({fmt(i.totalStock)} {i.unit})</option>)}</select></label>
          <label className="field-block"><span className="field-label">المستودع</span><select className="select-field" name="warehouseId" required defaultValue={warehouses.find(w => w.isDefault)?.id ?? ''} data-testid="select-movement-warehouse"><option value="" disabled>اختر المستودع</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <Field label="الكمية" name="quantity" required type="number" min="0.01" />
          <Field label="تاريخ الحركة" name="occurredOn" required type="date" defaultValue={today()} />
          {type === 'in' ? <><Field label="تكلفة الوحدة (د.أ)" name="unitCost" required type="number" min="0" step="0.0001" defaultValue="0" /><Field label="المورّد" name="supplier" placeholder="اسم المورّد" /><Field label="رقم الفاتورة" name="invoiceNumber" placeholder="اختياري" /></> :
            <><label className="field-block"><span className="field-label">المشروع</span><select className="select-field" name="projectId" required defaultValue="" data-testid="select-movement-project"><option value="" disabled>اختر المشروع</option>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><Field label="مستلم المواد" name="recipient" placeholder="اسم المستلم" /></>}
          <label className="field-block span-two"><span className="field-label">ملاحظات</span><textarea className="field" name="notes" placeholder="تفاصيل إضافية عن الحركة..." data-testid="input-movement-notes" /></label>
        </div>
        {create.isError && <div className="error-box" role="alert" data-testid="status-movement-error" style={{ marginTop: 14 }}>لم تُسجل الحركة. تأكد من توفر الرصيد وصحة التفاصيل.</div>}
        {create.isSuccess && <div className="status-pill" data-testid="status-movement-success" style={{ marginTop: 12 }}><Check size={13} /> تم إرسال الحركة للاعتماد. لن يتغير الرصيد حتى يوافق عليها مدير النظام.</div>}
        <div className="form-actions"><Button type="submit" kind="btn-primary" disabled={create.isPending} testId="button-submit-movement">{create.isPending ? 'جارٍ الإرسال...' : 'إرسال للاعتماد'} <ArrowLeft size={14} /></Button></div>
      </form>}
    </section><aside className="panel panel-pad"><div className="panel-heading"><div><h2 className="panel-title">قبل تسجيل الحركة</h2><div className="panel-subtitle">تحقق من المعلومات الأساسية</div></div><ShieldCheck size={18} color="#438a78" /></div>
      <div style={{ display: 'grid', gap: 15, color: '#64798a', fontSize: 11, lineHeight: 1.9 }}><div><b style={{ color: '#315168' }}>الاستلام الوارد</b><br />يسجل المواد المستلمة من المورد ويضيفها إلى رصيد المستودع.</div><div><b style={{ color: '#315168' }}>الصرف للمشروع</b><br />يخصم الكمية من الرصيد ويربطها بالمشروع والمستلم.</div><div style={{ padding: 12, borderRadius: 9, background: '#edf7fa', color: '#527386' }}>يُحفظ اسم المستخدم ووقت التسجيل تلقائياً في سجل الحركة.</div></div>
    </aside></div>
  </div>;
}

function AccessDenied() {
  return <div data-testid="page-access-denied"><PageTitle title="ليس لديك صلاحية" description="هذه العملية متاحة لمدير النظام أو مدير المستودع." /><section className="panel"><Empty icon={ShieldCheck} title="صلاحية العرض فقط" detail="يمكنك مراجعة البيانات والتقارير، لكن لا يمكنك إجراء تغييرات." /></section></div>;
}

function HistoryPage() {
  const [search, setSearch] = useState(''); const [type, setType] = useState(''); const [warehouse, setWarehouse] = useState(''); const [project, setProject] = useState('');
  const { data: warehouses = [] } = useListWarehouses(); const { data: projects = [] } = useListProjects();
  const params = useMemo(() => ({ q: search || undefined, type: type ? type as 'in' | 'out' | 'adjustment' : undefined, warehouseId: warehouse ? Number(warehouse) : undefined, projectId: project ? Number(project) : undefined, limit: 250 }), [search, type, warehouse, project]);
  const { data: movements = [], isLoading, isError, refetch } = useListMovements(params);
  return <div data-testid="page-history"><PageTitle title="سجل الحركات" description="تتبّع موثق لكل عملية استلام وصرف وتسوية." ><Button onClick={() => window.print()} testId="button-print-history"><Printer size={15} /> طباعة السجل</Button></PageTitle>
    <div className="filters"><div className="search-wrap"><Search size={16} /><input className="field search-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالمادة أو المورد أو رقم الفاتورة..." data-testid="input-history-search" /></div>
      <select className="select-field" value={type} onChange={e => setType(e.target.value)} data-testid="select-history-type"><option value="">كل الحركات</option><option value="in">استلام وارد</option><option value="out">صرف</option><option value="adjustment">تسوية</option></select>
      <select className="select-field" value={warehouse} onChange={e => setWarehouse(e.target.value)} data-testid="select-history-warehouse"><option value="">كل المستودعات</option>{warehouses.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select>
      <select className="select-field" value={project} onChange={e => setProject(e.target.value)} data-testid="select-history-project"><option value="">كل المشاريع</option>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select><span className="live-badge"><Filter size={13} /> {fmt(movements.length)} حركة</span></div>
    <section className="panel page-table-panel" data-testid="panel-history-table">{isLoading ? <div className="panel-pad" style={{ display: 'grid', gap: 13 }}>{[0,1,2,3,4,5].map(i => <div className="skeleton" key={i} style={{ height: 36 }} />)}</div> : isError ? <div className="panel-pad"><ErrorState onRetry={() => { void refetch(); }} /></div> : movements.length ? <MovementDetailTable movements={movements} /> : <Empty icon={Activity} title="لا توجد حركات مطابقة" detail="غيّر عوامل التصفية أو سجل حركة جديدة." action={<Link href="/transactions/new" className="btn btn-primary" data-testid="link-history-create"><Plus size={14} /> تسجيل حركة</Link>} />}</section>
  </div>;
}

function ApprovalsPage() {
  const { data: user } = useGetCurrentUser();
  const { data: pending = [], isLoading, isError, refetch } =
    useListMovements({ approvalStatus: 'pending', limit: 1000 });
  const update = useUpdateMovementApproval();
  const qc = useQueryClient();
  if (user?.role !== 'admin') return <AccessDenied />;

  function decide(id: number, decision: 'approve' | 'reject') {
    if (decision === 'reject' && !window.confirm('هل تريد رفض هذه الحركة؟')) return;
    update.mutate(
      { id, data: { decision } },
      {
        onSuccess: async () => {
          await qc.invalidateQueries({ queryKey: getListMovementsQueryKey() });
          await qc.invalidateQueries({ queryKey: getGetMovementReportQueryKey() });
          await qc.invalidateQueries({ queryKey: getListItemsQueryKey() });
          await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          await qc.invalidateQueries({ queryKey: getGetInventoryReportQueryKey() });
        },
      },
    );
  }

  return <div data-testid="page-approvals">
    <PageTitle title="اعتمادات الحركات" description="راجع طلبات الاستلام والصرف. لا يتغير الرصيد قبل اعتماد الحركة." />
    <div className="filters"><span className="live-badge"><ClipboardList size={13} /> {fmt(pending.length)} طلب بانتظار المراجعة</span></div>
    {update.isError && <div className="error-box" role="alert" data-testid="status-approval-error">تعذر اعتماد الحركة. قد يكون الرصيد المتاح تغيّر أو عولج الطلب مسبقاً.</div>}
    <section className="panel page-table-panel" data-testid="panel-pending-approvals">
      {isLoading ? <div className="panel-pad"><div className="skeleton" style={{ height: 150 }} /></div>
        : isError ? <div className="panel-pad"><ErrorState onRetry={() => { void refetch(); }} /></div>
        : pending.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>المادة</th><th>الطلب</th><th>المستودع</th><th>التفاصيل</th><th>مقدم الطلب</th><th className="no-print">القرار</th></tr></thead><tbody>{pending.map(m => <tr key={m.id} data-testid={`row-pending-${m.id}`}>
          <td><div className="item-primary">{m.itemName}</div><div className="item-secondary">{m.itemCode}</div></td>
          <td><MovementBadge type={m.type} /><div style={{ marginTop: 5 }}><b>{fmt(m.quantity)}</b></div></td>
          <td>{m.warehouseName}</td>
          <td>{m.projectName || m.supplier || '—'}{m.invoiceNumber && <div className="item-secondary">فاتورة {m.invoiceNumber}</div>}</td>
          <td>{m.actorName}<div className="item-secondary">{fmtDate(m.createdAt)}</div></td>
          <td className="no-print"><div style={{ display: 'flex', gap: 6 }}><Button kind="btn-primary" disabled={update.isPending} onClick={() => decide(m.id, 'approve')} testId={`button-approve-${m.id}`}><Check size={14} /> اعتماد</Button><Button kind="btn-danger" disabled={update.isPending} onClick={() => decide(m.id, 'reject')} testId={`button-reject-${m.id}`}>رفض</Button></div></td>
        </tr>)}</tbody></table></div>
        : <Empty icon={Check} title="لا توجد طلبات معلّقة" detail="ستظهر هنا حركات الاستلام والصرف بعد إرسالها للمراجعة." />}
    </section>
  </div>;
}

function MovementDetailTable({ movements }: { movements: Movement[] }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>التاريخ</th><th>المادة</th><th>النوع</th><th>حالة الاعتماد</th><th>المستودع</th><th>الكمية</th><th>قيمة الحركة</th><th>المشروع / المورّد</th><th>المستخدم</th></tr></thead><tbody>{movements.map(m => <tr key={m.id} data-testid={`row-history-movement-${m.id}`}><td>{fmtDate(m.occurredOn)}</td><td><div className="item-primary">{m.itemName}</div><div className="item-secondary">{m.itemCode}</div></td><td><MovementBadge type={m.type} /></td><td><ApprovalBadge status={m.approvalStatus} /></td><td>{m.warehouseName}</td><td><b>{fmt(m.quantity)}</b></td><td>{fmtMoney(m.totalValue)}</td><td>{m.projectName || m.supplier || '—'}{m.invoiceNumber && <div className="item-secondary">فاتورة {m.invoiceNumber}</div>}</td><td>{m.actorName}</td></tr>)}</tbody></table></div>;
}

function ReportsPage() {
  const [warehouseId, setWarehouseId] = useState(''); const [voucher, setVoucher] = useState<Movement | null>(null);
  const [backupStatus, setBackupStatus] = useState('');
  const reportParams = useMemo(() => ({ warehouseId: warehouseId ? Number(warehouseId) : undefined }), [warehouseId]);
  const { data: rows = [], isLoading, isError, refetch } = useGetInventoryReport(reportParams);
  const { data: warehouses = [] } = useListWarehouses();
  const { data: movements = [], isLoading: movementsLoading, isError: movementsError } = useGetMovementReport(reportParams);
  const { data: user } = useGetCurrentUser();
  const backup = useGetBackupExport({ query: { enabled: false, queryKey: getGetBackupExportQueryKey() } });
  async function exportBackup() {
    setBackupStatus('');
    const result = await backup.refetch();
    if (!result.data) {
      setBackupStatus('تعذر تنزيل النسخة الاحتياطية. تحقق من صلاحية حسابك ثم حاول مجدداً.');
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `namri-inventory-backup-${today()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus('تم تنزيل نسخة احتياطية كاملة من بيانات المستودعات.');
  }
  const exportInventory = () => downloadXlsx('مخزون-نمري.xlsx', 'المخزون', rows.map(r => ({
    'رمز المادة': r.code,
    'اسم المادة': r.name,
    'الفئة': r.category,
    'الوحدة': r.unit,
    'المستودع': r.warehouseName,
    'الرصيد': r.quantity,
    'متوسط تكلفة الوحدة (د.أ)': r.averageUnitCost,
    'قيمة الرصيد (د.أ)': r.stockValue,
    'حد إعادة الطلب': r.minStock,
    'الحالة': r.lowStock ? 'منخفض' : 'متوفر',
  })));
  const exportMovements = () => downloadXlsx('حركات-نمري.xlsx', 'الحركات', movements.map(m => ({
    'رقم الحركة': m.id,
    'التاريخ': m.occurredOn,
    'رمز المادة': m.itemCode,
    'اسم المادة': m.itemName,
    'نوع الحركة': m.type === 'in' ? 'استلام' : m.type === 'out' ? 'صرف' : 'تسوية',
    'حالة الاعتماد': m.approvalStatus === 'pending' ? 'قيد المراجعة' : m.approvalStatus === 'approved' ? 'معتمد' : 'مرفوض',
    'المستودع': m.warehouseName,
    'الكمية': m.quantity,
    'تكلفة الوحدة (د.أ)': m.unitCost,
    'قيمة الحركة (د.أ)': m.totalValue,
    'المشروع': m.projectName || '',
    'المورّد': m.supplier || '',
    'رقم الفاتورة': m.invoiceNumber || '',
    'مقدم الطلب': m.actorName,
    'المعتمد': m.approverName || '',
    'ملاحظات الاعتماد': m.approvalNotes || '',
  })));
  return <div data-testid="page-reports"><PageTitle title="التقارير" description="استخرج الأرصدة والقيم المالية وسجل الحركات بصيغة Excel أو للطباعة." ><Button onClick={() => window.print()} testId="button-print-report"><Printer size={15} /> طباعة التقرير</Button>{user?.role === 'admin' && <Button onClick={() => void exportBackup()} disabled={backup.isFetching} testId="button-export-backup"><FileDown size={15} /> {backup.isFetching ? 'جارٍ تجهيز النسخة...' : 'تنزيل نسخة احتياطية'}</Button>}</PageTitle>
    {backupStatus && <div className={backup.isError ? 'error-box' : 'status-pill'} role={backup.isError ? 'alert' : 'status'} data-testid="status-backup-export" style={{ marginBottom: 12 }}>{backupStatus}</div>}
    <div className="filters no-print"><select className="select-field" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} data-testid="select-report-warehouse"><option value="">كل المستودعات</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><span className="live-badge"><CalendarDays size={13} /> تاريخ استخراج التقرير: {fmtDate(today())}</span></div>
    <div className="content-grid" style={{ marginBottom: 16 }}>
      <section className="panel panel-pad"><div className="panel-heading"><div><h2 className="panel-title">تقرير رصيد المخزون</h2><div className="panel-subtitle">الرصيد الحالي والقيمة التقديرية وحالة إعادة الطلب</div></div><Package size={18} color="#438aa5" /></div><div className="head-actions no-print"><Button kind="btn-primary" onClick={exportInventory} testId="button-export-inventory"><FileDown size={15} /> تصدير المخزون Excel</Button></div>
        {isLoading ? <div style={{ display: 'grid', gap: 12, marginTop: 15 }}>{[0,1,2].map(i => <div className="skeleton" key={i} style={{ height: 26 }} />)}</div> : isError ? <div style={{ marginTop: 15 }}><ErrorState onRetry={() => { void refetch(); }} /></div> : <div style={{ marginTop: 14 }}><div className="live-badge" data-testid="text-report-count">{fmt(rows.length)} صف · قيمة المخزون {fmtMoney(rows.reduce((sum, row) => sum + row.stockValue, 0))}</div></div>}
      </section>
      <section className="panel panel-pad"><div className="panel-heading"><div><h2 className="panel-title">تقرير حركة المواد</h2><div className="panel-subtitle">سجل كامل يشمل حالات الاعتماد والقيم المالية</div></div><Activity size={18} color="#438aa5" /></div><Button kind="btn-primary" onClick={exportMovements} disabled={movementsLoading || movementsError} testId="button-export-movements"><FileDown size={15} /> تصدير الحركات Excel</Button><div className="field-hint" style={{ marginTop: 12 }} data-testid="text-movements-report-count">{movementsError ? 'تعذر تحميل سجل الحركات' : `${fmt(movements.length)} حركة متاحة للتصدير`}</div></section>
    </div>
    <section className="panel page-table-panel" data-testid="panel-report-inventory"><div className="panel-pad"><div className="panel-heading" style={{ margin: 0 }}><div><h2 className="panel-title">كشف المواد والأرصدة</h2><div className="panel-subtitle">تقرير جاهز للطباعة · {fmt(rows.length)} بند</div></div></div></div>
      {rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>الرمز</th><th>المادة</th><th>الفئة</th><th>الوحدة</th><th>المستودع</th><th>الرصيد</th><th>متوسط التكلفة</th><th>قيمة الرصيد</th><th>حد الطلب</th><th>الحالة</th><th className="no-print">سند</th></tr></thead><tbody>{rows.map((r,i) => <tr key={`${r.code}-${r.warehouseName}-${i}`} data-testid={`row-report-${i}`}><td>{r.code}</td><td><b>{r.name}</b></td><td>{r.category}</td><td>{r.unit}</td><td>{r.warehouseName}</td><td>{fmt(r.quantity)}</td><td>{fmtMoney(r.averageUnitCost)}</td><td>{fmtMoney(r.stockValue)}</td><td>{fmt(r.minStock)}</td><td><span className={`status-pill ${r.lowStock ? 'warning' : ''}`}>{r.lowStock ? 'منخفض' : 'متوفر'}</span></td><td className="no-print"><button className="icon-btn" title="إنشاء سند صرف" onClick={() => setVoucher({ id: 0, itemId: 0, itemCode: r.code, itemName: r.name, warehouseId: 0, warehouseName: r.warehouseName, type: 'out', approvalStatus: 'approved', quantity: r.quantity, unitCost: r.averageUnitCost, totalValue: r.stockValue, approvedAt: null, approverName: null, approvalNotes: null, supplier: null, invoiceNumber: null, projectId: null, projectName: null, recipient: null, notes: null, occurredOn: today(), actorName: '', createdAt: '' })} data-testid={`button-voucher-${r.code}`}><FileText size={14} /></button></td></tr>)}</tbody></table></div> : !isLoading && !isError && <Empty icon={FileText} title="التقرير خالٍ من البيانات" detail="لا توجد أرصدة لعرضها في المستودع المحدد." />}
    </section>
    <section className="panel page-table-panel" style={{ marginTop: 16 }}><div className="panel-pad"><div className="panel-heading" style={{ margin: 0 }}><div><h2 className="panel-title">أحدث الحركات</h2><div className="panel-subtitle">انقر على السند لعرض تفاصيل الحركة</div></div></div></div>{movements.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>التاريخ</th><th>المادة</th><th>الحركة</th><th>الكمية</th><th>المستلم / المورد</th><th className="no-print">سند</th></tr></thead><tbody>{movements.slice(0,10).map(m => <tr key={m.id} data-testid={`row-report-movement-${m.id}`}><td>{fmtDate(m.occurredOn)}</td><td>{m.itemName}</td><td><MovementBadge type={m.type} /></td><td>{fmt(m.quantity)}</td><td>{m.recipient || m.supplier || '—'}</td><td className="no-print"><button className="icon-btn" onClick={() => setVoucher(m)} aria-label={`عرض سند الحركة ${m.id}`} data-testid={`button-view-voucher-${m.id}`}><FileText size={14} /></button></td></tr>)}</tbody></table></div> : <Empty icon={Activity} title="لا توجد حركات مسجلة" detail="ستظهر الحركات في هذا القسم بعد تسجيلها." />}</section>
    {voucher && <Modal title="سند حركة مخزون" onClose={() => setVoucher(null)} testId="modal-voucher"><div className="print-only" style={{ textAlign: 'center', marginBottom: 22 }}><Brand compact /></div><div style={{ textAlign: 'center', padding: '10px 0 20px', borderBottom: '1px solid #e6ebef' }}><div className="eyebrow" style={{ justifyContent: 'center' }}>شركة نمري للمقاولات</div><h2 style={{ color: '#173750', margin: '12px 0 4px' }}>سند {voucher.type === 'in' ? 'استلام' : 'صرف'} مواد</h2><span className="field-hint">رقم الحركة: {voucher.id || 'سند رصيد'}</span></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, padding: '22px 0', fontSize: 12 }}><div><span className="field-hint">المادة</span><div className="item-primary">{voucher.itemName}</div></div><div><span className="field-hint">رمز المادة</span><div>{voucher.itemCode}</div></div><div><span className="field-hint">المستودع</span><div>{voucher.warehouseName}</div></div><div><span className="field-hint">الكمية</span><div className="item-primary">{fmt(voucher.quantity)}</div></div><div><span className="field-hint">المشروع / المورد</span><div>{voucher.projectName || voucher.supplier || '—'}</div></div><div><span className="field-hint">التاريخ</span><div>{fmtDate(voucher.occurredOn)}</div></div><div><span className="field-hint">المستلم</span><div>{voucher.recipient || '—'}</div></div><div><span className="field-hint">المستخدم</span><div>{voucher.actorName || '—'}</div></div></div><div className="form-actions no-print"><Button kind="btn-primary" onClick={() => window.print()} testId="button-print-voucher"><Printer size={15} /> طباعة السند</Button><Button onClick={() => setVoucher(null)} testId="button-close-voucher">إغلاق</Button></div></Modal>}
  </div>;
}

function downloadXlsx(
  fileName: string,
  sheetName: string,
  rows: Array<Record<string, string | number>>,
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ الحالة: 'لا توجد بيانات' }],
  );
  worksheet['!cols'] = Object.keys(rows[0] ?? { الحالة: '' }).map(() => ({
    wch: 20,
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function ProjectsPage() {
  const [filter, setFilter] = useState(''); const [showCreate, setShowCreate] = useState(false);
  const params = useMemo(() => ({ status: filter ? filter as 'active' | 'completed' : undefined }), [filter]);
  const { data: projects = [], isLoading, isError, refetch } = useListProjects(params);
  const { data: user } = useGetCurrentUser(); const canWrite = user?.role === 'admin' || user?.role === 'warehouse_manager';
  return <div data-testid="page-projects"><PageTitle title="المشاريع" description="المشاريع النشطة والوجهات المرتبطة بصرف المواد." >{canWrite && <Button kind="btn-primary" onClick={() => setShowCreate(true)} testId="button-create-project"><Plus size={15} /> مشروع جديد</Button>}</PageTitle>
    <div className="filters"><select className="select-field" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-project-status"><option value="">كل المشاريع</option><option value="active">نشط</option><option value="completed">مكتمل</option></select><span className="live-badge"><BriefcaseBusiness size={13} /> {fmt(projects.length)} مشروع</span></div>
    {isLoading ? <div className="metric-grid">{[0,1,2].map(i => <div className="panel skeleton skeleton-card" key={i} />)}</div> : isError ? <ErrorState onRetry={() => { void refetch(); }} /> : projects.length ? <div style={{ display: 'grid', gap: 11 }}>{projects.map(p => <ProjectRow project={p} canWrite={canWrite} key={p.id} />)}</div> : <section className="panel"><Empty icon={Building2} title="لا توجد مشاريع بعد" detail="أضف مشروعاً لربط حركات الصرف بمواقع التنفيذ." action={canWrite && <Button kind="btn-primary" onClick={() => setShowCreate(true)} testId="button-empty-create-project"><Plus size={14} /> إضافة مشروع</Button>} /></section>}
    {showCreate && <ProjectForm onClose={() => setShowCreate(false)} />}
  </div>;
}

function ProjectRow({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const qc = useQueryClient();
  const update = useUpdateProject();
  const nextStatus = project.status === 'active' ? 'completed' : 'active';
  function toggleStatus() {
    update.mutate(
      { id: project.id, data: { status: nextStatus } },
      {
        onSuccess: async () => {
          await qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        },
      },
    );
  }
  return <article className="panel panel-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }} data-testid={`card-project-${project.id}`}><div style={{ display: 'flex', alignItems: 'center', gap: 13 }}><div className="item-symbol" style={{ width: 42, height: 42 }}><Building2 size={18} /></div><div><div className="item-primary" style={{ fontSize: 13 }}>{project.name}</div><div className="item-secondary">{project.location || 'الموقع غير محدد'} · أُضيف {fmtDate(project.createdAt)}</div></div></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className={`status-pill ${project.status === 'completed' ? 'neutral' : ''}`} data-testid={`status-project-${project.id}`}>{project.status === 'active' ? 'نشط' : 'مكتمل'}</span>{canWrite && <Button disabled={update.isPending} onClick={toggleStatus} testId={`button-toggle-project-${project.id}`}>{project.status === 'active' ? 'إكمال' : 'إعادة فتح'}</Button>}</div></article>;
}

function ProjectForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient(); const create = useCreateProject();
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ data: { name: String(f.get('name')), location: String(f.get('location') || '') || undefined } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); } }); }
  return <Modal title="إضافة مشروع" onClose={onClose} testId="modal-project-form"><form onSubmit={submit} data-testid="form-project"><div className="form-grid"><div className="span-two"><Field label="اسم المشروع" name="name" required placeholder="مثال: مجمع الواجهة السكني" /></div><div className="span-two"><Field label="الموقع" name="location" placeholder="المدينة أو الموقع" /></div></div>{create.isError && <div className="field-hint" role="alert" data-testid="status-project-save-error" style={{ color: '#ae5149' }}>تعذر حفظ المشروع.</div>}<div className="form-actions"><Button type="submit" kind="btn-primary" disabled={create.isPending} testId="button-save-project">{create.isPending ? 'جارٍ الحفظ...' : 'حفظ المشروع'}</Button><Button onClick={onClose} testId="button-cancel-project">إلغاء</Button></div></form></Modal>;
}

function UsersPage() {
  const { data: currentUser } = useGetCurrentUser(); const { data: users = [], isLoading, isError, refetch } = useListUsers({ query: { enabled: currentUser?.role === 'admin', queryKey: getListUsersQueryKey() } }); const qc = useQueryClient(); const update = useUpdateUserRole();
  if (currentUser?.role !== 'admin') return <AccessDenied />;
  const roleLabels: Record<string, string> = { admin: 'مدير النظام', warehouse_manager: 'مدير مستودع', viewer: 'مشاهد' };
  function changeRole(id: string, role: AppUser['role']) {
    update.mutate({ id, data: { role } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); await qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); } });
  }
  return <div data-testid="page-users"><PageTitle title="إدارة المستخدمين" description="تعيين صلاحية الوصول المناسبة لفريق المستودع والمشاريع." /><div className="panel page-table-panel">{isLoading ? <div className="panel-pad" style={{ display: 'grid', gap: 12 }}>{[0,1,2].map(i => <div className="skeleton" key={i} style={{ height: 40 }} />)}</div> : isError ? <div className="panel-pad"><ErrorState onRetry={() => { void refetch(); }} /></div> : users.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>المستخدم</th><th>البريد الإلكتروني</th><th>الدور الحالي</th><th>تاريخ الإضافة</th><th>تحديث الصلاحية</th></tr></thead><tbody>{users.map(u => <tr key={u.id} data-testid={`row-user-${u.id}`}><td><div className="item-cell"><span className="avatar-initial">{u.name.slice(0,1)}</span><b>{u.name}</b></div></td><td dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td><td><span className="status-pill neutral" data-testid={`role-user-${u.id}`}>{roleLabels[u.role]}</span></td><td>{fmtDate(u.createdAt)}</td><td><select className="select-field" value={u.role} disabled={update.isPending} onChange={e => changeRole(u.id, e.target.value as AppUser['role'])} aria-label={`تغيير صلاحية ${u.name}`} data-testid={`select-role-${u.id}`}><option value="admin">مدير النظام</option><option value="warehouse_manager">مدير مستودع</option><option value="viewer">مشاهد</option></select></td></tr>)}</tbody></table></div> : <Empty icon={Users} title="لا يوجد مستخدمون" detail="سيظهر أعضاء مساحة العمل هنا بعد تسجيل الدخول." />}</div>
    {update.isError && <div className="error-box" role="alert" data-testid="status-role-update-error" style={{ marginTop: 12 }}>تعذر تحديث الدور. تأكد من صلاحيتك وحاول مجدداً.</div>}
  </div>;
}

function ProtectedWorkspace() {
  const { isLoaded, isSignedIn } = useAuth(); const { user: clerkUser } = useUser(); const [path, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetCurrentUser({ query: { enabled: !!isSignedIn, queryKey: getGetCurrentUserQueryKey() } });
  useEffect(() => { if (isLoaded && !isSignedIn) setLocation('/sign-in'); }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded || !isSignedIn) return <div className="auth-page"><div className="auth-card"><div className="skeleton" style={{ height: 22, width: '62%', margin: '0 auto' }} /><div className="skeleton" style={{ height: 120, marginTop: 18 }} /></div></div>;
  return <Shell user={user || (clerkUser ? { id: clerkUser.id, name: clerkUser.fullName || clerkUser.firstName || 'مستخدم نمري', email: clerkUser.primaryEmailAddress?.emailAddress || '', role: 'viewer', createdAt: '' } : undefined)}>
    {isLoading ? <div className="panel panel-pad"><div className="skeleton" style={{ height: 30, width: '40%' }} /><div className="skeleton" style={{ height: 180, marginTop: 20 }} /></div> :
    isError ? <><PageTitle title="تعذر التحقق من الصلاحيات" description="تعذر جلب ملف المستخدم من مساحة العمل." /><ErrorState onRetry={() => { void refetch(); }} /></> :
    path === '/dashboard' ? <DashboardPage /> : path === '/inventory' ? <InventoryPage /> : path === '/transactions/new' ? <TransactionPage /> : path === '/history' ? <HistoryPage /> : path === '/reports' ? <ReportsPage /> : path === '/approvals' ? <ApprovalsPage /> : path === '/projects' ? <ProjectsPage /> : path === '/users' ? <UsersPage /> : <NotFoundPage />}
  </Shell>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Welcome} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
    <Route path="/dashboard" component={ProtectedWorkspace} />
    <Route path="/inventory" component={ProtectedWorkspace} />
    <Route path="/transactions/new" component={ProtectedWorkspace} />
    <Route path="/history" component={ProtectedWorkspace} />
    <Route path="/reports" component={ProtectedWorkspace} />
    <Route path="/approvals" component={ProtectedWorkspace} />
    <Route path="/projects" component={ProtectedWorkspace} />
    <Route path="/users" component={ProtectedWorkspace} />
    <Route component={NotFoundPage} />
  </Switch></ErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      qc.clear();
    }
    previousUserId.current = userId;
  }), [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    localization={arSA}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider><Router /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

function NoClerkRouter() {
  const [location] = useLocation();
  if (location === '/sign-in' || location.startsWith('/sign-in/')) return <AuthPage mode="sign-in" />;
  if (location === '/sign-up' || location.startsWith('/sign-up/')) return <AuthPage mode="sign-up" />;
  if (location === '/') return <NoClerkWelcome />;
  return <main className="auth-page" dir="rtl"><section className="auth-card"><Brand compact /><h2 className="page-title" style={{ marginTop: 20 }}>المصادقة غير مهيأة</h2><p className="page-description">أضف مفتاح Clerk إلى إعدادات التطبيق لتفعيل مساحة العمل.</p><Link className="btn btn-primary" style={{ marginTop: 18 }} href="/" data-testid="link-return-home">العودة للرئيسية</Link></section></main>;
}

function NoClerkWelcome() {
  return <main className="landing" dir="rtl"><header className="landing-header"><Brand compact /><Link className="btn btn-primary" href="/sign-in" data-testid="link-sign-in"><LogIn size={15} /> تسجيل الدخول</Link></header><section className="landing-hero"><div className="hero-copy"><div className="eyebrow">مساحة العمل التشغيلية لمخازن نمري</div><h1 className="hero-title">كل قطعة في مكانها.<br /><span>وكل قرار في وقته.</span></h1><p className="hero-desc">من استلام المواد إلى حركة الموقع — رؤية واضحة للمخزون والمستودعات والمشاريع، في مساحة واحدة يعتمد عليها فريق نمري كل يوم.</p><Link className="btn btn-primary" href="/sign-in" data-testid="link-start-work"><LogIn size={16} /> ابدأ العمل <ArrowLeft size={15} /></Link></div><div className="hero-visual"><div className="warehouse-art"><div className="art-grid" /><div className="art-rack"><div className="art-shelf s1" /><div className="art-shelf s2" /><div className="art-box box-a" /><div className="art-box box-b" /><div className="art-box box-c" /><div className="art-box box-d" /><div className="art-box box-e" /></div><div className="floating-tag tag-stock">مواد مسجلة<b dir="ltr">01 — 24</b></div><div className="floating-tag tag-live">حركة اليوم<b>متابعة مباشرة</b></div></div></div></section><section className="landing-strip"><div className="strip-item"><div className="strip-num">01</div><div className="strip-label">أرصدة دقيقة لكل مستودع ومادة</div></div><div className="strip-item"><div className="strip-num">02</div><div className="strip-label">استلام وصرف موثق مرتبط بالمشروع</div></div><div className="strip-item"><div className="strip-num">03</div><div className="strip-label">تنبيهات مبكرة قبل نقص المواد</div></div></section></main>;
}

export default App;
