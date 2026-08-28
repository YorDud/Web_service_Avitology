"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_KEY = "avitology_cookie_accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = window.localStorage.getItem(COOKIE_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    window.localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] px-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[24px] border border-green-100 bg-white p-4 shadow-[0_16px_40px_rgba(16,24,40,0.14)] md:flex-row md:items-center md:justify-between md:p-5">
        <div className="text-sm leading-6 text-gray-700">
          Мы используем cookie-файлы и технические данные для корректной работы
          сайта, улучшения сервиса и сохранения пользовательской сессии.
          Продолжая пользоваться сайтом, вы соглашаетесь с{" "}
          <Link href="/privacy" className="font-bold text-green-700 hover:underline">
            Политикой конфиденциальности
          </Link>
          .
        </div>

        <button onClick={handleAccept} className="btn-primary shrink-0 md:w-auto">
          Принять
        </button>
      </div>
    </div>
  );
}