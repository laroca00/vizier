import { useState } from "react";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { groupJournal, journalEntries, type JournalEntry } from "../journal";
import { setNote, usePersonal } from "../personal";
import { Button } from "../ui/Button";
import { SearchInput } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import "./JournalPage.css";
import { guessPosition } from "./matchupRoute";

type Props = {
  onOpenChampion: (championId: number) => void;
  onOpenMatchup: (championId: number, opponentId: number, position: string) => void;
};

/** Every champion and matchup note in one place. */
export function JournalPage({ onOpenChampion, onOpenMatchup }: Props) {
  const t = useT();
  const lang = useLang();
  const { notes } = usePersonal();
  const [query, setQuery] = useState("");
  const [data, retry] = useAsync("journal-data", async () => ({ version: await latestVersion(), champions: await champions() }));
  const entries = journalEntries(notes);

  return (
    <LiquidGlass className="panel tiers journal-page" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Günlük")}
        subtitle={t("Şampiyon ve eşleşme notların, yalnızca bu bilgisayarda · {count} not", { count: entries.length })}
        toolbar={<SearchInput label={t("Notlarda ara")} value={query} onChange={setQuery} />}
      />
      {data.status !== "done" && data.status !== "error" ? (
        <Skeleton lines={5} label={t("Yükleniyor")} />
      ) : data.status === "error" ? (
        <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />
      ) : entries.length === 0 ? (
        <EmptyState title={t("Henüz notun yok")}>{t("Şampiyon sayfasında, eşleşme sayfasında veya şampiyon seçiminde not yaz; hepsi burada toplanır.")}</EmptyState>
      ) : (
        <Groups data={data.value} entries={entries} query={query} lang={lang} onOpenChampion={onOpenChampion} onOpenMatchup={onOpenMatchup} />
      )}
    </LiquidGlass>
  );
}

type Loaded = { version: string; champions: Awaited<ReturnType<typeof champions>> };

function Groups({ data, entries, query, lang, onOpenChampion, onOpenMatchup }: Props & { data: Loaded; entries: JournalEntry[]; query: string; lang: "tr" | "en" }) {
  const t = useT();
  const nameOf = (id: number) => data.champions.get(id)?.name ?? `#${id}`;
  const groups = groupJournal(entries, nameOf, query, lang);
  if (groups.length === 0) return <EmptyState title={t("Eşleşen not yok")}>{t("Başka bir sözcük dene.")}</EmptyState>;
  return (
    <div className="journal-page__groups">
      {groups.map((group) => {
        const champion = data.champions.get(group.championId);
        return (
          <section key={group.championId} aria-label={group.name}>
            <div className="journal-page__head">
              {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={36} height={36} />}
              <h2 className="section-title">{group.name}</h2>
              <Button size="small" variant="ghost" onClick={() => onOpenChampion(group.championId)}>
                {t("Şampiyon sayfası")}
              </Button>
            </div>
            <ul className="journal-page__notes">
              {group.champion && (
                <Note entry={group.champion} label={t("{champion} notun", { champion: group.name })} onOpen={() => onOpenChampion(group.championId)} />
              )}
              {group.matchups.map((entry) => (
                <Note
                  key={entry.key}
                  entry={entry}
                  label={t("{opponent} karşısında", { opponent: nameOf(entry.opponentId!) })}
                  onOpen={() => champion && onOpenMatchup(group.championId, entry.opponentId!, guessPosition(champion))}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Note({ entry, label, onOpen }: { entry: JournalEntry; label: string; onOpen: () => void }) {
  const t = useT();
  return (
    <li className="journal-page__note">
      <span className="journal-page__label">{label}</span>
      <p className="journal-page__text">{entry.text}</p>
      <div className="journal-page__actions">
        <Button size="small" variant="ghost" onClick={onOpen}>
          {t("Aç")}
        </Button>
        <Button size="small" variant="ghost" onClick={() => setNote(entry.key, "")}>
          {t("Sil")}
        </Button>
      </div>
    </li>
  );
}
