import type { ModelDef } from "../config";
import { formatLatency, formatPollen, formatTokens } from "../lib/format";
import type { Runs } from "../types";

function ComparisonBar({
  value,
  maximum,
  color,
}: {
  value: number | undefined;
  maximum: number;
  color: string;
}) {
  if (value === undefined) return null;
  return (
    <span className="metrics-bar" aria-hidden="true">
      <span
        style={{
          width: `${Math.min(100, Math.max(0, (value / maximum) * 100))}%`,
          background: color,
        }}
      />
    </span>
  );
}

export function MetricsComparison({ models, runs }: { models: ModelDef[]; runs: Runs }) {
  const maxLatency = Math.max(1, ...models.map((model) => runs[model.id]?.latencyMs ?? 0));
  const maxCost = Math.max(Number.EPSILON, ...models.map((model) => runs[model.id]?.cost ?? 0));
  return (
    <section
      id="metrics-comparison"
      className="metrics-comparison"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need focus to scroll the wide table.
      tabIndex={0}
      aria-label="Scroll comparison metrics"
    >
      <div className="metrics-heading">
        <h3>Comparison metrics</h3>
        <p>Shorter bars mean less time or Pollen.</p>
      </div>
      <table>
        <caption className="sr-only">
          Timing, tokens and estimated Pollen for this comparison
        </caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Latency</th>
            <th scope="col">First token</th>
            <th scope="col">Tokens</th>
            <th scope="col">Est. Pollen</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
            const run = runs[model.id];
            return (
              <tr key={model.id}>
                <th scope="row" title={run?.error}>
                  <span className="flex items-center gap-2">
                    <span className="provider-dot" style={{ background: model.color }} />
                    {model.name}
                  </span>
                  {run?.status === "error" ? (
                    <span className="mt-0.5 block pl-3.5 font-normal text-orange">Unavailable</span>
                  ) : null}
                  {run?.status === "pending" ? (
                    <span className="mt-0.5 block pl-3.5 font-normal text-quiet">Pending</span>
                  ) : null}
                </th>
                <td>
                  {formatLatency(run?.latencyMs)}
                  <ComparisonBar value={run?.latencyMs} maximum={maxLatency} color={model.color} />
                </td>
                <td>{formatLatency(run?.ttftMs)}</td>
                <td>
                  {run?.imageTokens !== undefined
                    ? `${formatTokens(run.imageTokens)} image`
                    : formatTokens(run?.usage?.total_tokens)}
                </td>
                <td>
                  {formatPollen(run?.cost)}
                  <ComparisonBar value={run?.cost} maximum={maxCost} color={model.color} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
