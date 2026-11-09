import { TimerCard } from "../Timers";
import type { WidgetContext } from "./context";
import { timerLabel } from "./shared";

// The card hides itself when it has nothing to count; manual timers live inside it.
export function TimersWidget({ t, objectives, game, time }: WidgetContext) {
  return <TimerCard objectives={objectives} objectiveLabel={(timer) => timerLabel(timer, t)} game={game} time={time} />;
}
