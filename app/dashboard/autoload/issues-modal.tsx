"use client";

import { useEffect, useState } from "react";
import { MESSAGE_KIND, fixHint, kindOf } from "@/lib/autoload/hints";
import type { IssueGroup, IssuesResponse } from "@/lib/autoload/types";
import { Icon, Modal, Pill, Spinner, api, errorText, ghostButton } from "./ui";

/* Окно «Что исправить»: замечания Авито по последней загрузке простым языком. */

const TONE = { error: "red", warning: "amber", alarm: "gray", info: "gray" } as const;

export default function IssuesModal({
  onClose,
  onOpenAd,
}: {
  onClose: () => void;
  onOpenAd: (feedId: number, adKey: string) => void;
}) {
  const [data, setData] = useState<IssuesResponse | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<IssuesResponse>("/api/autoload/issues")
      .then((result) => {
        if (!alive) return;
        setData(result);
        if (result.groups[0]) setOpen(keyOf(result.groups[0]));
      })
      .catch((err) => alive && setError(errorText(err)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Modal
      wide
      title="Что исправить в таблице"
      subtitle="Сообщения Авито по последней загрузке — по причинам, с подсказками."
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className="btn-primary !px-6 !py-3 text-sm">Закрыть</button>}
    >
      {!data && !error && (
        <div className="flex items-center gap-2.5 text-sm font-bold text-black/50">
          <Spinner /> Загружаем замечания у Авито…
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}

      {data && (
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 text-sm leading-6 text-black/65">
            <b className="text-black">Как это читать.</b> «Загружено, есть замечания» значит, что Авито принял файл, но по части
            объявлений есть сообщения. Они бывают трёх видов:
            <ul className="mt-2 space-y-1.5">
              {(["error", "warning", "alarm"] as const).map((kind) => (
                <li key={kind} className="flex items-start gap-2">
                  <Pill tone={TONE[kind]} className="shrink-0">{MESSAGE_KIND[kind].label}</Pill>
                  <span className="min-w-0">{MESSAGE_KIND[kind].meaning}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Исправьте данные в таблице → нажмите «Сохранить» → Авито заберёт файл при следующей загрузке (или нажмите «Запустить сейчас»
              в профиле автозагрузки) → затем «Обновить статусы из отчёта» во вкладке «Подключение».
            </p>
          </div>

          {!data.upload && (
            <div className="rounded-2xl bg-black/[0.03] p-5 text-sm font-bold text-black/45">У Авито пока нет загрузок по вашим файлам.</div>
          )}

          {data.upload && data.groups.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#03bd48]/30 bg-[#03bd48]/[0.06] p-4 text-sm font-extrabold text-[#027a30]">
              <Icon name="check" className="h-5 w-5 shrink-0" /> В загрузке №{data.upload.id} замечаний по объявлениям нет.
            </div>
          )}

          {data.upload && data.groups.length > 0 && (
            <>
              <div className="text-sm font-bold text-black/55">
                Загрузка №{data.upload.id}: объявлений с сообщениями — {data.adsWithIssues} из {data.totalAds}.
                {data.partial && " Загрузка ещё идёт, данные могут измениться."}
              </div>

              <div className="space-y-2.5">
                {data.groups.map((group) => (
                  <GroupCard
                    key={keyOf(group)}
                    group={group}
                    expanded={open === keyOf(group)}
                    onToggle={() => setOpen((current) => (current === keyOf(group) ? null : keyOf(group)))}
                    onOpenAd={onOpenAd}
                    onClose={onClose}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

const keyOf = (group: IssueGroup) => `${group.type}:${group.code}:${group.title}`;

function GroupCard({
  group,
  expanded,
  onToggle,
  onOpenAd,
  onClose,
}: {
  group: IssueGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenAd: (feedId: number, adKey: string) => void;
  onClose: () => void;
}) {
  const kind = kindOf(group.type);
  const hint = fixHint(group.title, group.description);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-black/[0.02]">
        <Pill tone={TONE[kind]} className="mt-0.5 shrink-0">{MESSAGE_KIND[kind].label}</Pill>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-black">{group.title || `Сообщение ${group.code}`}</span>
          <span className="mt-0.5 block text-xs font-semibold text-black/45">Объявлений: {group.count}</span>
        </span>
        <Icon name="chevron" className={`mt-1 h-4 w-4 shrink-0 text-black/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="al-pop space-y-3 border-t border-black/[0.06] p-4">
          {group.description && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">Что пишет Авито</div>
              <p className="mt-1 text-sm leading-6 text-black/70">{group.description}</p>
            </div>
          )}
          <div className="rounded-xl border border-[#03bd48]/25 bg-[#03bd48]/[0.06] p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#027a30]">Как исправить</div>
            <p className="mt-1 text-sm leading-6 text-black/75">
              {hint ?? "Прочитайте сообщение Авито выше и поправьте соответствующее поле у этих объявлений. Список полей вашей категории — в «Каталоге» (кнопка рядом с полем «Категория»)."}
            </p>
          </div>

          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">Объявления</div>
            <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.08]">
              {group.ads.slice(0, 50).map((ad) => (
                <li key={`${ad.adKey}-${ad.feedId}`} className="flex flex-wrap items-center gap-2 bg-white px-3 py-2.5">
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block truncate text-sm font-extrabold text-black" title={ad.adKey}>{ad.title || ad.adKey}</span>
                    <span className="block truncate text-xs font-semibold text-black/40">
                      ID {ad.adKey}{ad.feedName ? ` · ${ad.feedName}` : " · не из таблиц HelpSell"}
                    </span>
                  </span>
                  {ad.feedId !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAd(ad.feedId as number, ad.adKey);
                      }}
                      className={`${ghostButton} !px-3 !py-1.5 !text-xs`}
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" /> Исправить
                    </button>
                  )}
                  {ad.url && (
                    <a href={ad.url} target="_blank" rel="noopener noreferrer" className="text-xs font-extrabold text-[#028c36] hover:underline">
                      На Авито
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {group.count > 50 && <p className="mt-2 text-xs font-semibold text-black/40">Показаны первые 50 из {group.count}.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
