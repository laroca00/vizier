import { useEffect, useRef, useState } from "react";
import { updateSettings, useSettings } from "./settings";
import { phaseLabel, type LcuStatus } from "./lcu";
import { useLang, useT } from "./i18n";
import { NavIcon, type IconName } from "./ui/NavIcon";
import { WindowControls } from "./WindowControls";

export type NavItem<V extends string> = {
  id: V;
  label: string;
  icon: IconName;
  /** Shown while the page only exists because something is happening right now. */
  live?: boolean;
  shortcut?: string;
};

export type NavGroup<V extends string> = { heading?: string; items: NavItem<V>[] };

type Props<V extends string> = {
  lcu: LcuStatus;
  groups: NavGroup<V>[];
  foot: NavItem<V>[];
  current: V;
  collapsed: boolean;
  onOpen: (id: V) => void;
  onSearch: () => void;
};

export function Sidebar<V extends string>({ lcu, groups, foot, current, collapsed, onOpen, onSearch }: Props<V>) {
  const t = useT();
  const { navFolded } = useSettings();
  const toggleGroup = (heading: string) =>
    updateSettings({ navFolded: navFolded.includes(heading) ? navFolded.filter((h) => h !== heading) : [...navFolded, heading] });

  const item = (entry: NavItem<V>) => (
    <button
      key={entry.id}
      type="button"
      className="side__item"
      aria-current={entry.id === current ? "page" : undefined}
      data-live={entry.live || undefined}
      title={[collapsed ? t(entry.label) : null, entry.shortcut].filter(Boolean).join(", ") || undefined}
      aria-keyshortcuts={entry.shortcut?.replace("Ctrl", "Control")}
      onClick={() => onOpen(entry.id)}
    >
      <NavIcon name={entry.icon} />
      <span className="side__label">{t(entry.label)}</span>
      {entry.live && <span className="side__live">{t("Canlı")}</span>}
    </button>
  );

  return (
    <aside className="side" data-collapsed={collapsed || undefined}>
      <div className="side__frame" data-tauri-drag-region>
        <WindowControls />
      </div>
      <Account lcu={lcu} collapsed={collapsed} onOpenSettings={() => onOpen("settings" as V)} />

      <button type="button" className="side__item side__search" aria-keyshortcuts="Control+K" title={collapsed ? t("Ara") : undefined} onClick={onSearch}>
        <NavIcon name="search" />
        <span className="side__label">{t("Ara")}</span>
        <kbd className="side__kbd">Ctrl K</kbd>
      </button>

      <nav className="side__nav" aria-label={t("Ana menü")}>
        {groups.map((group, index) => {
          if (group.items.length === 0) return null;
          // A folded group still shows the page that is open, so the player never loses their place.
          const folded = !collapsed && !!group.heading && navFolded.includes(group.heading);
          const visible = folded ? group.items.filter((entry) => entry.id === current) : group.items;
          return (
            <div className="side__group" key={group.heading ?? index} data-folded={folded || undefined}>
              {group.heading && (
                <button type="button" className="side__heading" aria-expanded={!folded} onClick={() => toggleGroup(group.heading!)}>
                  <span>{t(group.heading)}</span>
                  <NavIcon name="chevron" size={14} className="side__heading-chevron" />
                  {folded && <span className="side__heading-count">{group.items.length}</span>}
                </button>
              )}
              {visible.map(item)}
            </div>
          );
        })}
      </nav>

      <div className="side__foot">{foot.map(item)}</div>
    </aside>
  );
}

/** The signed-in summoner and the client connection, in the slot an admin
 * panel gives its workspace switcher. */
function Account({
  lcu,
  collapsed,
  onOpenSettings,
}: {
  lcu: LcuStatus;
  collapsed: boolean;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const name = summoner ? summoner.gameName : "Vizier";
  const detail =
    lcu.state === "connected"
      ? (phaseLabel(lcu.phase, lang) ?? (summoner ? `#${summoner.tagLine}` : t("League istemcisine bağlı")))
      : lcu.state === "connecting"
        ? t("İstemciye bağlanıyor")
        : t("İstemci kapalı");

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="account__card"
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? `${name}, ${detail}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account__avatar" aria-hidden="true">
          {summoner?.profileIconId ? <AccountIcon id={summoner.profileIconId} fallback={name.charAt(0).toUpperCase()} /> : name.charAt(0).toUpperCase()}
          <span className="account__dot" data-state={lcu.state} />
        </span>
        <span className="account__text" role="status">
          <span className="account__name">{name}</span>
          <span className="account__detail" key={detail}>
            {detail}
          </span>
        </span>
        <NavIcon name="chevron" className="account__chevron" size={16} />
      </button>

      {open && (
        <div className="account__menu" role="menu">
          <button type="button" role="menuitem" className="account__option" onClick={() => choose(onOpenSettings)}>
            <NavIcon name="settings" size={16} className="account__option-icon" />
            {t("Ayarlar")}
          </button>
          {!summoner && <p className="account__hint">{t("League istemcisini açınca hesabın burada görünür.")}</p>}
        </div>
      )}
    </div>
  );
}

// CommunityDragon has every icon by id, including ones newer than the cached Data Dragon version.
function AccountIcon({ id, fallback }: { id: number; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      className="account__icon"
      src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${id}.jpg`}
      alt=""
      width={36}
      height={36}
      onError={() => setFailed(true)}
    />
  );
}
