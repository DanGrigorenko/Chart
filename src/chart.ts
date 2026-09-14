import Highcharts from "highcharts";

/** One of the four fixed display slots. `data` is `[timestampMs, value]` pairs. */
export type Slot = {
  name: string;
  color?: string;
  /** Digits after the decimal point in the tooltip. Defaults to 2. */
  decimals?: number;
  data: [number, number][];
};

export type ChartInput = {
  area: Slot;
  spline: Slot;
  line: Slot;
  bar: Slot;
};

/** Reference colors, sampled from `docs/reference/`. */
const COLORS = {
  area: "#FFE680",
  spline: "#0C8301",
  line: "#B400F7",
  bar: "#3A6AF6",
  plotBorder: "#D5C5C6",
  tooltipDate: "#8A8A8A",
} as const;

const DEFAULT_DECIMALS = 2;

/** Shape of `this` inside a shared-tooltip formatter (Highcharts populates `points`). */
type SharedTooltipContext = {
  x: number;
  points?: Highcharts.Point[];
};

/** Pad a two-digit calendar field. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a timestamp as `dd.mm.yyyy` (the gray heading in the shared tooltip). */
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

type SlotConfig = {
  slot: Slot;
  type: "area" | "spline" | "line" | "column";
  fallbackColor: string;
};

/**
 * Build the pure Highcharts options for the four-series chart. Kept separate
 * from `createChart` so it can be unit-tested without a DOM.
 */
export function buildOptions(input: ChartInput): Highcharts.Options {
  const configs: SlotConfig[] = [
    { slot: input.area, type: "area", fallbackColor: COLORS.area },
    { slot: input.spline, type: "spline", fallbackColor: COLORS.spline },
    { slot: input.line, type: "line", fallbackColor: COLORS.line },
    { slot: input.bar, type: "column", fallbackColor: COLORS.bar },
  ];

  // Independent scale: one hidden yAxis per slot so heights are not comparable.
  const yAxis: Highcharts.YAxisOptions[] = configs.map((cfg) => {
    const axis: Highcharts.YAxisOptions = { visible: false };
    if (cfg.type === "column") {
      // Keep the bars a few px tall at the bottom by giving the axis a big max.
      const maxValue = cfg.slot.data.reduce((m, [, v]) => Math.max(m, v), 0);
      axis.max = maxValue * 10;
      axis.min = 0;
    }
    return axis;
  });

  const series: Highcharts.SeriesOptionsType[] = configs.map((cfg, i) => {
    const color = cfg.slot.color ?? cfg.fallbackColor;
    const decimals = cfg.slot.decimals ?? DEFAULT_DECIMALS;
    const base = {
      type: cfg.type,
      name: cfg.slot.name,
      color,
      yAxis: i,
      data: cfg.slot.data,
      custom: { decimals },
    };

    switch (cfg.type) {
      case "area":
        return {
          ...base,
          type: "area",
          fillOpacity: 0.55,
          lineWidth: 0,
          marker: { enabled: false, states: { hover: { enabled: false } } },
          enableMouseTracking: true,
        } satisfies Highcharts.SeriesAreaOptions;
      case "spline":
        return {
          ...base,
          type: "spline",
          lineWidth: 3,
          marker: { enabled: false, symbol: "circle" },
          states: { hover: { lineWidth: 5 } },
        } satisfies Highcharts.SeriesSplineOptions;
      case "line":
        return {
          ...base,
          type: "line",
          lineWidth: 1,
          marker: { enabled: true, symbol: "square", radius: 4 },
        } satisfies Highcharts.SeriesLineOptions;
      case "column":
        return {
          ...base,
          type: "column",
          borderRadius: 3,
          borderWidth: 0,
          pointPadding: 0.1,
          groupPadding: 0.05,
        } satisfies Highcharts.SeriesColumnOptions;
    }
  });

  return {
    chart: {
      backgroundColor: "transparent",
      plotBorderColor: COLORS.plotBorder,
      plotBorderWidth: 1,
      spacing: [8, 8, 8, 8],
    },
    title: { text: "" },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { type: "datetime", visible: false },
    yAxis,
    plotOptions: {
      series: {
        states: { hover: { halo: { size: 6 } } },
        animation: false,
      },
    },
    tooltip: {
      shared: true,
      useHTML: true,
      followPointer: true,
      backgroundColor: "#FFFFFF",
      borderWidth: 0,
      borderRadius: 8,
      shadow: true,
      padding: 12,
      formatter: function (this: SharedTooltipContext): string {
        const points = this.points ?? [];
        const date = `<div style="color:${COLORS.tooltipDate};margin-bottom:4px">${formatDate(this.x)}</div>`;
        const rows = points
          .map((p) => {
            const decimals =
              (p.series.options as { custom?: { decimals?: number } }).custom?.decimals ??
              DEFAULT_DECIMALS;
            const value = Highcharts.numberFormat(p.y as number, decimals);
            return (
              `<div style="display:flex;align-items:center;gap:6px">` +
              `<span style="color:${p.color};font-size:14px">●</span>` +
              `<span>${p.series.name}: <b>${value}</b></span>` +
              `</div>`
            );
          })
          .join("");
        return date + rows;
      },
    },
    series,
  };
}

/** Render the chart into `container` and return the live `Highcharts.Chart`. */
export function createChart(container: HTMLElement, input: ChartInput): Highcharts.Chart {
  return Highcharts.chart(container, buildOptions(input));
}
