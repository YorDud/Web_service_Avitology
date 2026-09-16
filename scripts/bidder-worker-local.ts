import { loadEnvConfig } from "@next/env";
import { runProductionBidderWorker } from "../lib/avito-bidder-worker";

loadEnvConfig(process.cwd());

function getIntervalMs() {
  const seconds = Number(
    process.env.BIDDER_LOCAL_WORKER_INTERVAL_SECONDS ?? "60",
  );

  const safeSeconds = Number.isInteger(seconds)
    ? Math.min(Math.max(seconds, 15), 3600)
    : 60;

  return safeSeconds * 1000;
}

function formatTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());
}

let isRunning = false;
let isStopping = false;
let timer: NodeJS.Timeout | null = null;

async function runWorkerOnce() {
  if (isRunning) {
    console.log(
      `[${formatTime()}] Предыдущий локальный worker ещё выполняется. Пропуск цикла.`,
    );
    return;
  }

  isRunning = true;

  try {
    console.log(
      `[${formatTime()}] Запуск автоматического локального bidder worker...`,
    );

    const result = await runProductionBidderWorker({
      source: "local",
      limit: 100,
    });

    if (result.ok && result.skippedBecauseLocked) {
      console.log(
        `[${formatTime()}] Worker пропущен: ${result.message}`,
      );
      return;
    }

    if (!result.ok) {
      console.error(
        `[${formatTime()}] Worker завершился с ошибкой: ${result.message}`,
      );
      return;
    }

    console.log(
      `[${formatTime()}] ${result.message}`,
    );
  } catch (error) {
    console.error(
      `[${formatTime()}] Критическая ошибка локального worker-а:`,
      error,
    );
  } finally {
    isRunning = false;
  }
}

async function start() {
  const intervalMs = getIntervalMs();

  console.log("");
  console.log("==============================================");
  console.log("  HelpSell / Avitology локальный bidder worker");
  console.log("==============================================");
  console.log(
    `Интервал запуска: ${Math.round(intervalMs / 1000)} сек.`,
  );
  console.log(
    "Обрабатываются все active bidder-ы всех пользователей.",
  );
  console.log(
    "CAPTCHA не ставит bidder на паузу: будет повторная попытка позже.",
  );
  console.log("Для остановки нажмите Ctrl+C.");
  console.log("");

  await runWorkerOnce();

  timer = setInterval(() => {
    if (!isStopping) {
      void runWorkerOnce();
    }
  }, intervalMs);
}

function stop(signal: string) {
  if (isStopping) return;

  isStopping = true;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  console.log("");
  console.log(
    `[${formatTime()}] Получен ${signal}. Локальный bidder worker остановлен.`,
  );

  if (!isRunning) {
    process.exit(0);
  }

  const waitForCurrentRun = setInterval(() => {
    if (!isRunning) {
      clearInterval(waitForCurrentRun);
      process.exit(0);
    }
  }, 250);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

void start();