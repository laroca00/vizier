import { phaseLabel, type LcuStatus } from "./lcu";
import { LiquidGlass } from "./ui/LiquidGlass";

function describe(status: LcuStatus): { title: string; detail: string | null } {
  switch (status.state) {
    case "disconnected":
      return { title: "League istemcisine bağlı değil", detail: null };
    case "connecting":
      return { title: "League istemcisine bağlanıyor", detail: null };
    case "connected":
      return {
        title: status.summoner ? `${status.summoner.gameName}#${status.summoner.tagLine}` : "League istemcisine bağlı",
        detail: phaseLabel(status.phase),
      };
  }
}

export function ClientStatus({ status, className }: { status: LcuStatus; className?: string }) {
  const { title, detail } = describe(status);

  return (
    <LiquidGlass className={`status ${className ?? ""}`} shape="pill" blur={3} role="status">
      <span className="status__dot" data-state={status.state} aria-hidden="true" />
      <span className="status__text" key={`${title}|${detail}`}>
        <span className="status__title">{title}</span>
        {detail && <span className="status__detail">{detail}</span>}
      </span>
    </LiquidGlass>
  );
}
