"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRepeatPassword, setRegisterRepeatPassword] = useState("");
  const [registerConsent, setRegisterConsent] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }

      setSuccess("Вход выполнен успешно");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!registerConsent) {
      setError(
        "Для регистрации необходимо согласиться с обработкой персональных данных"
      );
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          repeatPassword: registerRepeatPassword,
          consentToPersonalData: registerConsent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }

      setSuccess("Регистрация выполнена успешно");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main page-shell">
        <div className="page-header">
          <div className="page-header-row">
            <div className="brand-badge">
              <div className="brand-logo-wrap">
                <img src="/logo.png" alt="HelpSell logo" />
              </div>
              <div className="brand-copy">
                <div className="brand-title">HelpSell</div>
                <div className="brand-subtitle">Вход и регистрация</div>
              </div>
            </div>

            <Link href="/" className="page-back-link">
              ← На главную
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="green-3d-card p-8 text-white md:p-10 lg:p-12 reveal-on-scroll revealed">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              Единый аккаунт сервиса
            </div>

            <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">
              Вход в платформу
              <br />
              HelpSell
            </h1>

            <p className="max-w-xl text-sm leading-7 text-white/90 sm:text-base sm:leading-8">
              Один аккаунт для личного кабинета, подписки, сервисных модулей,
              аналитики и дальнейших инструментов платформы.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/16 bg-white/10 p-5">
                <div className="text-sm font-bold uppercase tracking-[0.14em] text-white/70">
                  Доступ
                </div>
                <div className="mt-2 text-2xl font-extrabold">Личный кабинет</div>
                <div className="mt-2 text-sm text-white/80">
                  Управление доступом и рабочими сценариями
                </div>
              </div>

              <div className="rounded-3xl border border-white/16 bg-white/10 p-5">
                <div className="text-sm font-bold uppercase tracking-[0.14em] text-white/70">
                  Платформа
                </div>
                <div className="mt-2 text-2xl font-extrabold">HelpSell</div>
                <div className="mt-2 text-sm text-white/80">
                  Сервис для продавцов и команд
                </div>
              </div>
            </div>
          </div>

          <div className="white-card p-6 md:p-10 lg:p-12 reveal-on-scroll revealed">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex w-full rounded-2xl border border-black/8 bg-black/[0.03] p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className={`min-h-[48px] min-w-[132px] flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold whitespace-nowrap transition sm:flex-none ${
                    mode === "login"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/50"
                  }`}
                >
                  Вход
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setSuccess("");
                  }}
                  className={`min-h-[48px] min-w-[132px] flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold whitespace-nowrap transition sm:flex-none ${
                    mode === "register"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/50"
                  }`}
                >
                  Регистрация
                </button>
              </div>

              <div className="text-sm font-semibold text-black/45">
                {mode === "login" ? "Уже есть аккаунт" : "Новый пользователь"}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-black">
                {mode === "login" ? "Добро пожаловать" : "Создание аккаунта"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-black/55 sm:text-base">
                {mode === "login"
                  ? "Введите данные аккаунта для входа в платформу."
                  : "Заполните только основные поля для быстрого старта."}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Пароль
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="Введите пароль"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? "Входим..." : "Войти"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Имя
                  </label>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="Ваше имя"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Пароль
                  </label>
                  <input
                    type="password"
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="Создайте пароль"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black">
                    Повторите пароль
                  </label>
                  <input
                    type="password"
                    required
                    value={registerRepeatPassword}
                    onChange={(e) => setRegisterRepeatPassword(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 outline-none transition focus:border-[#03bd48]"
                    placeholder="Повторите пароль"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-black/[0.02] p-4 text-sm text-black/70">
                  <input
                    type="checkbox"
                    checked={registerConsent}
                    onChange={(e) => setRegisterConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#03bd48]"
                  />
                  <span>
                    Я соглашаюсь с обработкой персональных данных и принимаю{" "}
                    <Link href="/privacy" className="font-bold text-[#03bd48]">
                      политику конфиденциальности
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? "Создаем аккаунт..." : "Создать аккаунт"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}