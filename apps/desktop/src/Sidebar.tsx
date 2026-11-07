import { useEffect, useRef, useState } from "react";
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
  onOpenOwnProfile: (() => void) | null;
};

export function Sidebar<V extends string>({ lcu, groups, foot, current, collapsed, onOpen, onSearch, onOpenOwnProfile }: Props<V>) {
  const t = useT();

  const item = (entry: NavItem<V>) => (
    <button
      key={entry.id}
      type="button"
      className="side__item"
      aria-current={entry.id === current ? "page" : undefined}
      data-live={entry.live || undefined}
      title={collapsed ? t(entry.label) : undefined}
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
      <Account lcu={lcu} collapsed={collapsed} onOpenOwnProfile={onOpenOwnProfile} onOpenSettings={() => onOpen("settings" as V)} />

      <button type="button" className="side__item side__search" aria-keyshortcuts="Control+K" title={collapsed ? t("Ara") : undefined} onClick={onSearch}>
        <NavIcon name="search" />
        <span className="side__label">{t("Ara")}</span>
        <kbd className="side__kbd">Ctrl K</kbd>
      </button>

      <nav className="side__nav" aria-label={t("Ana menü")}>
        {groups.map((group, index) =>
          group.items.length === 0 ? null : (
            <div className="side__group" key={group.heading ?? index}>
              {group.heading && <p className="side__heading">{t(group.heading)}</p>}
              {group.items.map(item)}
            </div>
          ),
        )}
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
  onOpenOwnProfile,
  onOpenSettings,
}: {
  lcu: LcuStatus;
  collapsed: boolean;
  onOpenOwnProfile: (() => void) | null;
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
          {name.charAt(0).toUpperCase()}
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
          {onOpenOwnProfile && (
            <button type="button" role="menuitem" className="account__option" onClick={() => choose(onOpenOwnProfile)}>
              <NavIcon name="profile" size={16} className="account__option-icon" />
              {t("Profilimi aç")}
            </button>
          )}
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
