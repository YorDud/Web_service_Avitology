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

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }

      setSuccess("Вход выполнен успешно");
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();

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
      const response = await fetch("/api/auth/register", {
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }

      setSuccess("Регистрация выполнена успешно");
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell pb-12">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_24px_65px_rgba(16,24,40,0.2)] md:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src="/logo.png"
                  alt="HelpSell logo"
                  className="h-[132%] w-[132%] max-w-none object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/75">
                  HelpSell
                </div>

                <h1 className="text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  Вход в
                  <span className="text-[#03bd48]"> платформу</span>
                </h1>

                <p className="mt-2 text-sm text-white/60">
                  Единый аккаунт для сервисов, подписки и личного кабинета.
                </p>
              </div>
            </div>

            <Link href="/" className="btn-secondary">
              На главную
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
              Единый аккаунт
            </div>

            <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.05em]">
              Всё необходимое
              <br />
              в <span className="text-[#03bd48]">одном месте</span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
              Войдите в свой аккаунт, чтобы управлять подпиской, пользоваться
              сервисами платформы и работать с аналитикой.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40">
                  01 · Личный кабинет
                </div>

                <div className="mt-2 text-lg font-extrabold">
                  Управление аккаунтом
                </div>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  Актуальные данные профиля, тариф и состояние доступа.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40">
                  02 · Инструменты
                </div>

                <div className="mt-2 text-lg font-extrabold">
                  Сервисы HelpSell
                </div>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  Поисковые позиции Авито, рабочие сценарии и аналитика.
                </p>
              </div>

              <div className="rounded-3xl bg-[#03bd48] p-5 text-white">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                  Безопасный доступ
                </div>

                <div className="mt-2 text-lg font-extrabold">
                  Ваши данные — в одном аккаунте
                </div>
              </div>
            </div>
          </section>

          <section className="white-card min-w-0 p-6 md:p-8">
            <div className="flex flex-col gap-5 border-b border-black/8 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative grid w-full grid-cols-2 rounded-2xl border border-black/10 bg-black/[0.035] p-1 sm:max-w-[300px]">
  {/* Плавно перемещающийся активный фон */}
  <div
    className={`pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-black shadow-[0_8px_18px_rgba(16,24,40,0.18)] transition-all duration-300 ease-out ${
      mode === "login"
        ? "left-1 translate-x-0"
        : "left-1 translate-x-full"
    }`}
  />

  <button
    type="button"
    onClick={() => switchMode("login")}
    className={`relative z-10 min-w-0 rounded-xl px-2 py-3 text-center text-[13px] font-extrabold whitespace-nowrap transition-colors duration-300 sm:px-4 sm:text-sm ${
      mode === "login"
        ? "text-white"
        : "text-black/45 hover:text-black"
    }`}
  >
    Вход
  </button>

  <button
    type="button"
    onClick={() => switchMode("register")}
    className={`relative z-10 min-w-0 rounded-xl px-2 py-3 text-center text-[13px] font-extrabold whitespace-nowrap transition-colors duration-300 sm:px-4 sm:text-sm ${
      mode === "register"
        ? "text-white"
        : "text-black/45 hover:text-black"
    }`}
  >
    Регистрация
  </button>
</div>

              <div className="text-sm font-semibold text-black/42">
                {mode === "login" ? "Уже есть аккаунт" : "Новый пользователь"}
              </div>
            </div>

            <div className="mb-7 mt-7">
              <div className="badge-green mb-3">
                {mode === "login" ? "Авторизация" : "Создание аккаунта"}
              </div>

              <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                {mode === "login" ? "Добро пожаловать" : "Начните работу"}
              </h2>

              <p className="mt-2 text-sm leading-7 text-black/50">
                {mode === "login"
                  ? "Введите почту и пароль, чтобы перейти в личный кабинет."
                  : "Заполните данные, чтобы создать аккаунт HelpSell."}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white">
                  !
                </span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-4 py-4 text-sm font-medium text-[#027a30]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#03bd48] text-xs text-white">
                  ✓
                </span>
                <span>{success}</span>
              </div>
            )}

            {mode === "login" ? (
  <form
    key="login-form"
    onSubmit={handleLogin}
    className="auth-form-enter space-y-4"
  >
                <div>
                  <label className="mb-2 block text-sm font-bold text-black/65">
                    Электронная почта
                  </label>

                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black/65">
                    Пароль
                  </label>

                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                    placeholder="Введите пароль"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Выполняется вход..." : "Войти в аккаунт"}
                </button>

                <p className="text-center text-sm text-black/45">
                  Нет аккаунта?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-extrabold text-[#028c36] transition hover:text-black"
                  >
                    Зарегистрироваться
                  </button>
                </p>
              </form>
            ) : (
              <form
  key="register-form"
  onSubmit={handleRegister}
  className="auth-form-enter space-y-4"
>
                <div>
                  <label className="mb-2 block text-sm font-bold text-black/65">
                    Имя
                  </label>

                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(event) => setRegisterName(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                    placeholder="Ваше имя"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-black/65">
                    Электронная почта
                  </label>

                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-black/65">
                      Пароль
                    </label>

                    <input
                      type="password"
                      required
                      value={registerPassword}
                      onChange={(event) =>
                        setRegisterPassword(event.target.value)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                      placeholder="Создайте пароль"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-black/65">
                      Повторите пароль
                    </label>

                    <input
                      type="password"
                      required
                      value={registerRepeatPassword}
                      onChange={(event) =>
                        setRegisterRepeatPassword(event.target.value)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition placeholder:text-black/35 focus:border-[#03bd48]"
                      placeholder="Повторите пароль"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/8 bg-black/[0.02] p-4 text-sm leading-6 text-black/65">
                  <input
                    type="checkbox"
                    checked={registerConsent}
                    onChange={(event) =>
                      setRegisterConsent(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#03bd48]"
                  />

                  <span>
                    Я соглашаюсь с обработкой персональных данных и принимаю{" "}
                    <Link
                      href="/privacy"
                      className="font-extrabold text-[#028c36] hover:text-black"
                    >
                      политику конфиденциальности
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
                </button>

                <p className="text-center text-sm text-black/45">
                  Уже зарегистрированы?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-extrabold text-[#028c36] transition hover:text-black"
                  >
                    Войти
                  </button>
                </p>
              </form>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .auth-form-enter {
          animation: authFormEnter 0.34s cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes authFormEnter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

    </main>
  );
}