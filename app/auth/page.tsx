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
      <div className="container-main flex min-h-screen items-center justify-center py-8 sm:py-12 md:py-16">
        <div className="grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[24px] border border-green-100 bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] lg:grid-cols-2 lg:rounded-[32px]">
          <div className="green-3d-card flex flex-col justify-between p-6 text-white md:p-10 lg:p-12">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-[0_8px_20px_rgba(16,24,40,0.12)]">
                  <img
                    src="/logo.png"
                    alt="Avitology logo"
                    className="h-11 w-11 object-cover sm:h-12 sm:w-12"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold sm:text-xl">
                    Авитология
                  </div>
                  <div className="text-xs text-white/75 sm:text-sm">
                    Avitology
                  </div>
                </div>
              </div>

              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                Единый аккаунт сервиса
              </div>

              <h1 className="mb-5 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
                Вход и регистрация
                <br />
                в Avitology
              </h1>

              <p className="max-w-xl text-sm leading-7 text-white/90 sm:text-base sm:leading-8">
                Создайте аккаунт, получите начальный уровень free и в дальнейшем
                активируйте подписку Basic для доступа к основным возможностям
                сервиса и браузерному расширению.
              </p>
            </div>

            <div className="mt-8 space-y-4 md:mt-10">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="font-bold">Free</div>
                <div className="text-sm text-white/80">
                  Просмотр сервиса и подготовка к покупке подписки
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="font-bold">Basic</div>
                <div className="text-sm text-white/80">
                  Доступ к масштабным услугам и функциям по подписке Basic
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 lg:p-12">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/"
                className="text-sm font-bold text-gray-500 hover:text-black"
              >
                ← На главную
              </Link>

              <div className="inline-flex w-full rounded-2xl border border-gray-200 bg-gray-50 p-1 sm:w-auto">
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition sm:px-5 ${
                    mode === "login"
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Вход
                </button>

                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition sm:px-5 ${
                    mode === "register"
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Регистрация
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                {mode === "login" ? "Добро пожаловать" : "Создание аккаунта"}
              </h2>
              <p className="mt-2 text-sm text-gray-500 sm:text-base">
                {mode === "login"
                  ? "Введите почту и пароль для входа в сервис"
                  : "Заполните данные для регистрации нового пользователя"}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {success}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Адрес почты
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Введите почту"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? "Выполняется вход..." : "Войти"}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="btn-secondary w-full"
                >
                  Перейти к регистрации
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Введите имя"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Адрес почты
                  </label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Введите почту"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Введите пароль"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Повторите пароль
                  </label>
                  <input
                    type="password"
                    value={registerRepeatPassword}
                    onChange={(e) => setRegisterRepeatPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-sm outline-none transition focus:border-green-500 sm:text-base"
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <input
                    type="checkbox"
                    checked={registerConsent}
                    onChange={(e) => setRegisterConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-green-600"
                  />
                  <span className="text-sm leading-6 text-gray-700">
                    Я даю согласие на обработку персональных данных и принимаю{" "}
                    <Link
                      href="/personal-data-consent"
                      className="font-bold text-green-700 hover:underline"
                    >
                      условия согласия
                    </Link>
                    , а также ознакомлен с{" "}
                    <Link
                      href="/privacy"
                      className="font-bold text-green-700 hover:underline"
                    >
                      Политикой конфиденциальности
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? "Создание аккаунта..." : "Зарегистрироваться"}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="btn-secondary w-full"
                >
                  Перейти ко входу
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}