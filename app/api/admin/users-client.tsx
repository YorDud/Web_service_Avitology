"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type UserItem = {
  id: number;
  publicId: number | null;
  email: string;
  name: string;
  subscriptionLevel: "free" | "basic" | "admin";
  subscriptionPrice: number;
  subscriptionPaidAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
  notes: string | null;
};

type Props = {
  users: UserItem[];
  adminName: string;
};

function formatInputDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export default function AdminUsersClient({
  users: initialUsers,
  adminName,
}: Props) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState("");
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

  const filteredUsers = useMemo(() => {
  const q = search.trim().toLowerCase();

  if (!q) return users;

  return users.filter((user) => {
    return (
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.subscriptionLevel.toLowerCase().includes(q) ||
      String(user.id).includes(q) ||
      String(user.publicId ?? "").includes(q) ||
      (user.notes || "").toLowerCase().includes(q)
    );
  });
}, [users, search]);

  async function refreshUsers() {
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
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
        setLoading(false);
        return;
      }

      setMessage("Пользователь успешно обновлен");

      setUsers((prev) =>
        prev.map((item) => (item.id === data.user.id ? data.user : item))
      );

      setSelectedUser(data.user);
    } catch (e) {
      console.error(e);
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
        setLoading(false);
        return;
      }

      setMessage("Пользователь успешно создан");

      const updatedUsers = [...users, data.user].sort((a, b) => a.id - b.id);
      setUsers(updatedUsers);
      setSelectedUser(data.user);

      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateSubscriptionLevel("free");
    } catch (e) {
      console.error(e);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.08)]">
              <img
                src="/logo.png"
                alt="Avitology logo"
                className="h-12 w-12 object-cover"
              />
            </div>
            <div>
              <div className="text-2xl font-extrabold">Админ-панель</div>
              <div className="text-sm text-gray-500">
                Добро пожаловать, {adminName}
              </div>
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

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="white-card p-6">
            <div className="mb-6 text-lg font-extrabold">Разделы</div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-4 font-bold text-green-700">
                Пользователи
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 text-sm font-bold text-gray-700">
                Поиск по пользователям
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={refreshUsers}
                placeholder="ID, Public ID, почта, имя, подписка..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
              />
            </div>

            <div className="mt-8">
              <div className="mb-3 text-sm font-bold text-gray-700">
                Список пользователей
              </div>

              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                {filteredUsers.map((user) => (
                  <button
  key={user.id}
  onClick={() => {
    setSelectedUser(user);
    setError("");
    setMessage("");
  }}
  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
    selectedUser?.id === user.id
      ? "border-green-300 bg-green-50"
      : "border-gray-200 bg-white hover:border-green-200"
  }`}
>
  <div className="font-bold">
    {user.name} — ID {user.id}
  </div>
  <div className="mt-1 text-sm text-gray-500">
    Public ID: {user.publicId ?? "—"}
  </div>
  <div className="mt-1 text-sm text-gray-500">
    {user.email}
  </div>
  <div className="mt-2 text-xs font-bold uppercase text-green-700">
    {user.subscriptionLevel}
  </div>
</button>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="white-card p-8">
              <div className="mb-6 text-2xl font-extrabold">
                Редактирование пользователя
              </div>

              {!selectedUser ? (
  <div className="text-gray-500">Выберите пользователя слева.</div>
) : (
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        ID
      </label>
      <input
        value={selectedUser.id}
        disabled
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Public ID
      </label>
      <input
        value={selectedUser.publicId ?? ""}
        disabled
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Имя
      </label>
      <input
        value={selectedUser.name}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            name: e.target.value,
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Почта
      </label>
      <input
        value={selectedUser.email}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            email: e.target.value,
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Подписка
      </label>
      <select
        value={selectedUser.subscriptionLevel}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            subscriptionLevel: e.target.value as
              | "free"
              | "basic"
              | "admin",
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      >
        <option value="free">free</option>
        <option value="basic">basic</option>
        <option value="admin">admin</option>
      </select>
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Стоимость подписки
      </label>
      <input
        type="number"
        value={selectedUser.subscriptionPrice}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            subscriptionPrice: Number(e.target.value),
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Активен
      </label>
      <select
        value={selectedUser.isActive ? "true" : "false"}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            isActive: e.target.value === "true",
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      >
        <option value="true">Да</option>
        <option value="false">Нет</option>
      </select>
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Дата оплаты
      </label>
      <input
        type="datetime-local"
        value={formatInputDateTime(selectedUser.subscriptionPaidAt)}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            subscriptionPaidAt: e.target.value
              ? new Date(e.target.value).toISOString()
              : null,
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Дата окончания
      </label>
      <input
        type="datetime-local"
        value={formatInputDateTime(selectedUser.subscriptionEndsAt)}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            subscriptionEndsAt: e.target.value
              ? new Date(e.target.value).toISOString()
              : null,
          })
        }
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div className="md:col-span-2">
      <label className="mb-2 block text-sm font-bold text-gray-700">
        Заметка
      </label>
      <textarea
        value={selectedUser.notes || ""}
        onChange={(e) =>
          setSelectedUser({
            ...selectedUser,
            notes: e.target.value,
          })
        }
        rows={4}
        className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
      />
    </div>

    <div className="md:col-span-2 flex flex-wrap gap-4">
      <button
        onClick={saveUser}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? "Сохранение..." : "Сохранить изменения"}
      </button>
    </div>
  </div>
)}
            </div>

            <div className="soft-green-card p-8">
              <div className="mb-6 text-2xl font-extrabold">
                Добавить нового пользователя
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Имя
                  </label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
                    placeholder="Введите имя"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Почта
                  </label>
                  <input
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
                    placeholder="Введите почту"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
                    placeholder="Введите пароль"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Уровень подписки
                  </label>
                  <select
                    value={createSubscriptionLevel}
                    onChange={(e) =>
                      setCreateSubscriptionLevel(
                        e.target.value as "free" | "basic" | "admin"
                      )
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 outline-none transition focus:border-green-500"
                  >
                    <option value="free">free</option>
                    <option value="basic">basic</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <button
                    onClick={createUser}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "Создание..." : "Добавить пользователя"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}