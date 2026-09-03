"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatForDateTimeLocal } from "@/lib/dates";

type UserItem = {
  id: number;
  publicId: number | null;
  email: string;
  name: string;
  subscriptionLevel: "free" | "basic" | "admin";
  subscriptionPrice: number;
  subscriptionPaidAt: string | null;
  subscriptionEndsAt: string | null;
  usedFreeTrial: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
  notes: string | null;
};

type PaymentItem = {
  id: number;
  userId: number;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  planCode: string | null;
  durationMonths: number;
  externalPaymentId: string | null;
  confirmationUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  user: {
    id: number;
    publicId: number | null;
    name: string;
    email: string;
  } | null;
};

type ServiceSettings = {
  id: number;
  isYookassaEnabled: boolean;
  isFreeTrialEnabled: boolean;
};

type AdminSection =
  | "users"
  | "settings"
  | "create-user"
  | "payments"
  | null;

type Props = {
  users: UserItem[];
  payments: PaymentItem[];
  adminName: string;
  initialServiceSettings: ServiceSettings;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPaymentStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "canceled":
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/65";
  }
}

function getSubscriptionClass(level: UserItem["subscriptionLevel"]) {
  switch (level) {
    case "admin":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "basic":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    default:
      return "border-black/10 bg-black/[0.03] text-black/60";
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-bold text-black/65">
      {children}
    </label>
  );
}

function PaymentInfoCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-black/[0.025] p-4 ${className}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/40">
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function AdminUsersClient({
  users: initialUsers,
  payments,
  adminName,
  initialServiceSettings,
}: Props) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [activeSection, setActiveSection] = useState<AdminSection>("users");

  const [search, setSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(
    initialUsers[0] || null
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSubscriptionLevel, setCreateSubscriptionLevel] = useState<
    "free" | "basic" | "admin"
  >("free");

  const [serviceSettings, setServiceSettings] = useState(
    initialServiceSettings
  );
  const [serviceSettingsLoading, setServiceSettingsLoading] = useState(false);

  function toggleSection(section: Exclude<AdminSection, null>) {
    setError("");
    setMessage("");

    setActiveSection((current) =>
      current === section ? null : section
    );
  }

  function getUserSearchText(user: UserItem) {
    return [
      user.id,
      user.publicId,
      user.name,
      user.email,
      user.subscriptionLevel,
      user.subscriptionPrice,
      user.subscriptionPaidAt,
      user.subscriptionEndsAt,
      user.usedFreeTrial ? "trial used yes true использован" : "trial no false",
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt,
      user.isActive ? "активен да true" : "неактивен нет false",
      user.notes,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
  }

  function getPaymentSearchText(payment: PaymentItem) {
    return [
      payment.id,
      payment.userId,
      payment.provider,
      payment.status,
      payment.amount,
      payment.currency,
      payment.description,
      payment.planCode,
      payment.durationMonths,
      payment.externalPaymentId,
      payment.confirmationUrl,
      payment.paidAt,
      payment.createdAt,
      payment.expiresAt,
      payment.user?.id,
      payment.user?.publicId,
      payment.user?.name,
      payment.user?.email,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    const parts = query.split(/\s+/).filter(Boolean);

    return users.filter((user) => {
      const text = getUserSearchText(user);
      return parts.every((part) => text.includes(part));
    });
  }, [users, search]);

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();

    if (!query) return payments;

    const parts = query.split(/\s+/).filter(Boolean);

    return payments.filter((payment) => {
      const text = getPaymentSearchText(payment);
      return parts.every((part) => text.includes(part));
    });
  }, [payments, paymentSearch]);

  async function saveServiceSettings() {
    setServiceSettingsLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/service-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isYookassaEnabled: serviceSettings.isYookassaEnabled,
          isFreeTrialEnabled: serviceSettings.isFreeTrialEnabled,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения настроек");
        return;
      }

      setServiceSettings(data.settings);
      setMessage("Настройки сервиса сохранены");
    } catch (err) {
      console.error(err);
      setError("Ошибка сети");
    } finally {
      setServiceSettingsLoading(false);
    }
  }

  async function saveUser() {
    if (!selectedUser) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: selectedUser.email,
          name: selectedUser.name,
          subscriptionLevel: selectedUser.subscriptionLevel,
          subscriptionPrice: selectedUser.subscriptionPrice,
          subscriptionPaidAt: selectedUser.subscriptionPaidAt,
          subscriptionEndsAt: selectedUser.subscriptionEndsAt,
          isActive: selectedUser.isActive,
          notes: selectedUser.notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }

      setMessage("Пользователь успешно обновлён");

      setUsers((previous) =>
        previous.map((item) =>
          item.id === data.user.id ? data.user : item
        )
      );

      setSelectedUser(data.user);
    } catch (err) {
      console.error(err);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          subscriptionLevel: createSubscriptionLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка создания пользователя");
        return;
      }

      setMessage("Пользователь успешно создан");

      const updatedUsers = [...users, data.user].sort(
        (a, b) => a.id - b.id
      );

      setUsers(updatedUsers);
      setSelectedUser(data.user);

      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateSubscriptionLevel("free");
    } catch (err) {
      console.error(err);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function copyExternalPaymentId(value: string | null) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setMessage("Внешний ID платежа скопирован");
      setError("");
    } catch (err) {
      console.error(err);
      setError("Не удалось скопировать внешний ID");
    }
  }

  const menuItems: {
    id: Exclude<AdminSection, null>;
    title: string;
    description: string;
    index: string;
  }[] = [
    {
      id: "users",
      title: "Пользователи",
      description: "Поиск, выбор и редактирование аккаунтов",
      index: "01",
    },
    {
      id: "settings",
      title: "Настройки сервиса",
      description: "ЮKassa и пробный доступ",
      index: "02",
    },
    {
      id: "create-user",
      title: "Добавить пользователя",
      description: "Создание нового аккаунта",
      index: "03",
    },
    {
      id: "payments",
      title: "История платежей",
      description: "Операции, статусы и внешние ID",
      index: "04",
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell pb-12">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_24px_65px_rgba(16,24,40,0.2)] md:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src="/logo.png"
                  alt="HelpSell logo"
                  className="h-[132%] w-[132%] max-w-none object-cover"
                />
              </div>

              <div>
                <div className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/75">
                  Управление платформой
                </div>

                <h1 className="text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  Админ-
                  <span className="text-[#03bd48]">панель</span>
                </h1>

                <p className="mt-2 text-sm text-white/60">
                  Добро пожаловать, {adminName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn-secondary">
                В кабинет
              </Link>

              <Link href="/" className="btn-primary">
                На главную
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white">
              !
            </span>
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-5 py-4 text-sm font-semibold text-[#027a30]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#03bd48] text-xs text-white">
              ✓
            </span>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[30px] bg-black p-4 text-white shadow-[0_20px_50px_rgba(16,24,40,0.16)] lg:sticky lg:top-5">
            <div className="border-b border-white/10 px-3 pb-5 pt-3">
              <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/40">
                Разделы
              </div>
              <div className="mt-2 text-xl font-extrabold">Управление</div>
            </div>

            <div className="mt-3 space-y-2">
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSection(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition ${
                      isActive
                        ? "bg-[#03bd48] text-white shadow-[0_12px_26px_rgba(3,189,72,0.22)]"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                        isActive
                          ? "bg-black/20 text-white"
                          : "bg-white/10 text-white/65"
                      }`}
                    >
                      {item.index}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">
                        {item.title}
                      </span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          isActive ? "text-white/78" : "text-white/42"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>

                    <span className="text-lg font-light">
                      {isActive ? "−" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mx-3 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/40">
                В системе
              </div>

              <div className="mt-2 text-2xl font-extrabold text-[#03bd48]">
                {users.length}
              </div>

              <div className="mt-1 text-sm text-white/55">
                пользователей · {payments.length} платежей
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {activeSection === null && (
              <div className="flex min-h-[460px] items-center justify-center overflow-hidden rounded-[30px] bg-black p-8 text-center text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)]">
                <div className="max-w-md">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#03bd48] text-3xl font-extrabold">
                    +
                  </div>

                  <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em]">
                    Раздел закрыт
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-white/60">
                    Выберите нужный раздел слева, чтобы продолжить работу с
                    данными и настройками платформы.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "users" && (
              <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <section className="white-card h-fit p-6">
                  <div className="badge-green mb-4">Пользователи</div>

                  <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                    Поиск и выбор
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-black/50">
                    Ищите по ID, Public ID, имени, почте, подписке, заметкам и
                    другим данным аккаунта.
                  </p>

                  <div className="mt-5">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Поиск по всем данным..."
                      className="w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4 text-sm outline-none transition placeholder:text-black/35 focus:border-[#03bd48] focus:bg-white"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm font-semibold text-black/45">
                      Найдено: {filteredUsers.length}
                    </div>

                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-sm font-bold text-[#03bd48]"
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  <div className="mt-5 max-h-[590px] space-y-2 overflow-auto pr-1">
                    {filteredUsers.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-black/15 p-5 text-sm text-black/50">
                        Пользователи по этому запросу не найдены.
                      </div>
                    )}

                    {filteredUsers.map((user) => {
                      const isSelected = selectedUser?.id === user.id;

                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setError("");
                            setMessage("");
                          }}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-[#03bd48]/35 bg-[#03bd48]/10 shadow-[0_10px_24px_rgba(3,189,72,0.09)]"
                              : "border-black/8 bg-white hover:border-[#03bd48]/25 hover:bg-black/[0.015]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-extrabold text-black">
                                {user.name}
                              </div>

                              <div className="mt-1 truncate text-xs text-black/48">
                                {user.email}
                              </div>
                            </div>

                            <span className="text-xs font-bold text-black/45">
                              #{user.id}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-black/[0.05] px-2 py-1 text-[11px] font-bold text-black/55">
                              Public: {user.publicId ?? "—"}
                            </span>

                            <span
                              className={`rounded-lg border px-2 py-1 text-[11px] font-extrabold uppercase ${getSubscriptionClass(
                                user.subscriptionLevel
                              )}`}
                            >
                              {user.subscriptionLevel}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="white-card min-w-0 p-6 md:p-8">
                  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
                      <div className="badge-green mb-3">
                        Редактирование пользователя
                      </div>

                      <h2 className="truncate text-3xl font-extrabold tracking-[-0.04em] text-black">
                        {selectedUser
                          ? selectedUser.name
                          : "Выберите пользователя"}
                      </h2>
                    </div>

                    {selectedUser && (
                      <div className="rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white">
                        ID {selectedUser.id}
                      </div>
                    )}
                  </div>

                  {!selectedUser ? (
                    <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-black/50">
                      Выберите пользователя в списке слева, чтобы открыть его
                      данные.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <FieldLabel>ID</FieldLabel>
                        <input
                          value={selectedUser.id}
                          disabled
                          className="w-full rounded-2xl border border-black/8 bg-black/[0.04] px-4 py-4 text-black/55"
                        />
                      </div>

                      <div>
                        <FieldLabel>Public ID</FieldLabel>
                        <input
                          value={selectedUser.publicId ?? "—"}
                          disabled
                          className="w-full rounded-2xl border border-black/8 bg-black/[0.04] px-4 py-4 text-black/55"
                        />
                      </div>

                      <div>
                        <FieldLabel>Имя</FieldLabel>
                        <input
                          value={selectedUser.name}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              name: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div>
                        <FieldLabel>Почта</FieldLabel>
                        <input
                          value={selectedUser.email}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              email: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div>
                        <FieldLabel>Подписка</FieldLabel>
                        <select
                          value={selectedUser.subscriptionLevel}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              subscriptionLevel: event.target.value as
                                | "free"
                                | "basic"
                                | "admin",
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        >
                          <option value="free">free</option>
                          <option value="basic">basic</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>

                      <div>
                        <FieldLabel>Стоимость подписки</FieldLabel>
                        <input
                          type="number"
                          value={selectedUser.subscriptionPrice}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              subscriptionPrice: Number(event.target.value),
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div>
                        <FieldLabel>Активен</FieldLabel>
                        <select
                          value={selectedUser.isActive ? "true" : "false"}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              isActive: event.target.value === "true",
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        >
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </select>
                      </div>

                      <div>
                        <FieldLabel>Пробный период</FieldLabel>
                        <input
                          value={
                            selectedUser.usedFreeTrial
                              ? "Использован"
                              : "Не использован"
                          }
                          disabled
                          className="w-full rounded-2xl border border-black/8 bg-black/[0.04] px-4 py-4 text-black/55"
                        />
                      </div>

                      <div>
                        <FieldLabel>Дата оплаты</FieldLabel>
                        <input
                          type="datetime-local"
                          value={formatForDateTimeLocal(
                            selectedUser.subscriptionPaidAt
                          )}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              subscriptionPaidAt:
                                event.target.value || null,
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div>
                        <FieldLabel>Дата окончания</FieldLabel>
                        <input
                          type="datetime-local"
                          value={formatForDateTimeLocal(
                            selectedUser.subscriptionEndsAt
                          )}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              subscriptionEndsAt:
                                event.target.value || null,
                            })
                          }
                          className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel>Заметка администратора</FieldLabel>
                        <textarea
                          value={selectedUser.notes || ""}
                          onChange={(event) =>
                            setSelectedUser({
                              ...selectedUser,
                              notes: event.target.value,
                            })
                          }
                          rows={4}
                          className="w-full resize-y rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        />
                      </div>

                      <div className="mt-2 md:col-span-2">
                        <button
                          type="button"
                          onClick={saveUser}
                          disabled={loading}
                          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading
                            ? "Сохранение..."
                            : "Сохранить изменения"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeSection === "settings" && (
              <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                  <div>
                    <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                      Системные параметры
                    </div>

                    <h2 className="text-4xl font-extrabold tracking-[-0.05em]">
                      Настройки
                      <span className="text-[#03bd48]"> сервиса</span>
                    </h2>

                    <p className="mt-4 text-sm leading-7 text-white/62">
                      Настройте способ обработки оплат и доступность бесплатного
                      пробного периода для пользователей платформы.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="flex cursor-pointer gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={serviceSettings.isYookassaEnabled}
                        onChange={(event) =>
                          setServiceSettings({
                            ...serviceSettings,
                            isYookassaEnabled: event.target.checked,
                          })
                        }
                        className="mt-1 h-5 w-5 shrink-0 accent-[#03bd48]"
                      />

                      <span>
                        <span className="block text-lg font-extrabold">
                          Оплата через ЮKassa
                        </span>

                        <span className="mt-2 block text-sm leading-7 text-white/60">
                          Новые платежи направляются в сценарий оплаты через
                          ЮKassa. При отключении сохраняется текущая тестовая
                          активация подписки.
                        </span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={serviceSettings.isFreeTrialEnabled}
                        onChange={(event) =>
                          setServiceSettings({
                            ...serviceSettings,
                            isFreeTrialEnabled: event.target.checked,
                          })
                        }
                        className="mt-1 h-5 w-5 shrink-0 accent-[#03bd48]"
                      />

                      <span>
                        <span className="block text-lg font-extrabold">
                          Пробный доступ на 1 день
                        </span>

                        <span className="mt-2 block text-sm leading-7 text-white/60">
                          Авторизованные пользователи без оплаты и без
                          использованного пробного периода увидят предложение
                          получить доступ на один день.
                        </span>
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={saveServiceSettings}
                      disabled={serviceSettingsLoading}
                      className="btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {serviceSettingsLoading
                        ? "Сохранение..."
                        : "Сохранить настройки"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "create-user" && (
              <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
                <div className="rounded-[30px] bg-[#03bd48] p-6 text-white shadow-[0_20px_50px_rgba(3,189,72,0.2)] md:p-8">
                  <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                    Новый аккаунт
                  </div>

                  <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em]">
                    Добавить
                    <br />
                    пользователя
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-white/85">
                    После создания пользователь будет добавлен в общий список
                    и сразу станет доступен для редактирования.
                  </p>
                </div>

                <section className="white-card p-6 md:p-8">
                  <div className="badge-green mb-3">Создание аккаунта</div>

                  <h2 className="mb-7 text-3xl font-extrabold tracking-[-0.04em] text-black">
                    Данные пользователя
                  </h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Имя</FieldLabel>
                      <input
                        value={createName}
                        onChange={(event) =>
                          setCreateName(event.target.value)
                        }
                        className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        placeholder="Введите имя"
                      />
                    </div>

                    <div>
                      <FieldLabel>Почта</FieldLabel>
                      <input
                        type="email"
                        value={createEmail}
                        onChange={(event) =>
                          setCreateEmail(event.target.value)
                        }
                        className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        placeholder="name@example.com"
                      />
                    </div>

                    <div>
                      <FieldLabel>Пароль</FieldLabel>
                      <input
                        type="password"
                        value={createPassword}
                        onChange={(event) =>
                          setCreatePassword(event.target.value)
                        }
                        className="w-full rounded-2xl border border-black/10 px-4 py-4 outline-none transition focus:border-[#03bd48]"
                        placeholder="Введите пароль"
                      />
                    </div>

                    <div>
                      <FieldLabel>Уровень подписки</FieldLabel>
                      <select
                        value={createSubscriptionLevel}
                        onChange={(event) =>
                          setCreateSubscriptionLevel(
                            event.target.value as
                              | "free"
                              | "basic"
                              | "admin"
                          )
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                      >
                        <option value="free">free</option>
                        <option value="basic">basic</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>

                    <div className="mt-2 md:col-span-2">
                      <button
                        type="button"
                        onClick={createUser}
                        disabled={loading}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading
                          ? "Создание..."
                          : "Добавить пользователя"}
                      </button>
                    </div>
                  </div>
                </section>
              </section>
            )}

            {activeSection === "payments" && (
              <section className="white-card min-w-0 p-5 md:p-8">
                <div className="flex flex-col gap-5 border-b border-black/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="badge-green mb-3">Финансы</div>

                    <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                      История платежей
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-7 text-black/50">
                      Поиск по всем данным: пользователю, Public ID, сумме,
                      статусу, тарифу, описанию, датам и внешнему ID платежа.
                    </p>
                  </div>

                  <div className="w-full lg:max-w-md">
                    <input
                      value={paymentSearch}
                      onChange={(event) =>
                        setPaymentSearch(event.target.value)
                      }
                      placeholder="Поиск по платежам, ID, почте..."
                      className="w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4 text-sm outline-none transition placeholder:text-black/35 focus:border-[#03bd48] focus:bg-white"
                    />

                    <div className="mt-2 text-sm font-semibold text-black/42">
                      Найдено платежей: {filteredPayments.length}
                    </div>
                  </div>
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center text-black/50">
                    Платежи по этому запросу не найдены.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {filteredPayments.map((payment) => (
                      <article
                        key={payment.id}
                        className="overflow-hidden rounded-3xl border border-black/8 bg-white transition hover:border-[#03bd48]/30 hover:shadow-[0_14px_30px_rgba(16,24,40,0.08)]"
                      >
                        <div className="flex flex-col gap-4 border-b border-black/7 bg-black/[0.02] p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-xl bg-black px-3 py-1.5 text-xs font-extrabold text-white">
                                Платёж #{payment.id}
                              </span>

                              <span
                                className={`rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase ${getPaymentStatusClass(
                                  payment.status
                                )}`}
                              >
                                {payment.status}
                              </span>

                              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-extrabold uppercase text-black/55">
                                {payment.provider}
                              </span>
                            </div>

                            <div className="mt-4">
                              <div className="truncate text-lg font-extrabold text-black">
                                {payment.user?.name || "Пользователь удалён"}
                              </div>

                              <div className="mt-1 break-all text-sm text-black/48">
                                {payment.user?.email || "Почта недоступна"}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 rounded-2xl bg-[#03bd48] px-4 py-3 text-left text-white sm:text-right">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/70">
                              Сумма платежа
                            </div>

                            <div className="mt-1 text-xl font-extrabold">
                              {payment.amount} {payment.currency}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 md:p-5 xl:grid-cols-4">
                          <PaymentInfoCard title="Пользователь">
                            <div className="text-sm font-bold text-black">
                              Внутренний ID: {payment.userId}
                            </div>

                            <div className="mt-1 text-sm text-black/58">
                              Public ID:{" "}
                              <span className="font-extrabold text-[#028c36]">
                                {payment.user?.publicId ?? "—"}
                              </span>
                            </div>
                          </PaymentInfoCard>

                          <PaymentInfoCard title="Тариф">
                            <div className="text-sm font-bold text-black">
                              {payment.durationMonths} мес.
                            </div>

                            <div className="mt-1 break-all text-sm text-black/55">
                              {payment.planCode || "Тариф не указан"}
                            </div>
                          </PaymentInfoCard>

                          <PaymentInfoCard title="Создан">
                            <div className="text-sm font-bold leading-6 text-black">
                              {formatDateTime(payment.createdAt)}
                            </div>
                          </PaymentInfoCard>

                          <PaymentInfoCard title="Оплачен">
                            <div className="text-sm font-bold leading-6 text-black">
                              {formatDateTime(payment.paidAt)}
                            </div>
                          </PaymentInfoCard>

                          <PaymentInfoCard
                            title="Описание"
                            className="sm:col-span-2"
                          >
                            <div className="break-words text-sm leading-6 text-black/70">
                              {payment.description || "Описание отсутствует"}
                            </div>
                          </PaymentInfoCard>

                          <div className="rounded-2xl border border-[#03bd48]/20 bg-[#03bd48]/[0.06] p-4 md:col-span-2">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-[#027a30]/65">
                                Public ID пользователя
                              </div>

                              <code className="mt-2 inline-block rounded-xl border border-[#03bd48]/20 bg-white px-3 py-2 text-sm font-extrabold text-[#027a30]">
                                {payment.user?.publicId ?? "—"}
                              </code>
                            </div>

                            <div className="mt-4 border-t border-[#03bd48]/15 pt-4">
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-[#027a30]/65">
                                Внешний ID платежа
                              </div>

                              {payment.externalPaymentId ? (
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                                  <code className="min-w-0 flex-1 break-all rounded-xl border border-black/10 bg-white px-3 py-2 text-xs leading-5 text-black">
                                    {payment.externalPaymentId}
                                  </code>

                                  <button
                                    type="button"
                                    title="Скопировать внешний ID платежа"
                                    onClick={() =>
                                      copyExternalPaymentId(
                                        payment.externalPaymentId
                                      )
                                    }
                                    className="shrink-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black transition hover:border-[#03bd48] hover:text-[#028c36]"
                                  >
                                    Копировать
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 text-sm font-semibold text-black/45">
                                  Внешний ID отсутствует
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}