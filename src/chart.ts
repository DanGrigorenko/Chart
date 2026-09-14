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

/** Per-series data we stash on `series.custom` and read back in the tooltip. */
type SeriesCustom = {
  decimals?: number;
  tooltipOrder?: number;
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
  /** Row position in the shared tooltip (area, bar, spline, line — see issue #2). */
  tooltipOrder: number;
};

/** Hollow-marker fill so hovered points show a light centre, per the reference. */
const MARKER_CENTER = "#FFFFFF";

/**
 * Build the pure Highcharts options for the four-series chart. Kept separate
 * from `createChart` so it can be unit-tested without a DOM.
 */
export function buildOptions(input: ChartInput): Highcharts.Options {
  // Slots keep their rendering order (area, spline, line, column) for z-order and
  // yAxis indexing; `tooltipOrder` drives the reference tooltip order (area, bar,
  // spline, line = Cost, CPA, ROI confirmed, Conversions).
  const configs: SlotConfig[] = [
    { slot: input.area, type: "area", fallbackColor: COLORS.area, tooltipOrder: 0 },
    { slot: input.spline, type: "spline", fallbackColor: COLORS.spline, tooltipOrder: 2 },
    { slot: input.line, type: "line", fallbackColor: COLORS.line, tooltipOrder: 3 },
    { slot: input.bar, type: "column", fallbackColor: COLORS.bar, tooltipOrder: 1 },
  ];

  // Independent scale: one hidden yAxis per slot so heights are not comparable.
  const yAxis: Highcharts.YAxisOptions[] = configs.map((cfg) => {
    const axis: Highcharts.YAxisOptions = { visible: false };
    if (cfg.type === "column") {
      // Keep the bars tiny (~3-5px) nubs at the bottom by giving the axis a huge
      // max relative to the data, so even the tallest bar is a few px high.
      const maxValue = cfg.slot.data.reduce((m, [, v]) => Math.max(m, v), 0);
      axis.max = maxValue * 40;
      axis.min = 0;
    }
    return axis;
  });

  const series: Highcharts.SeriesOptionsType[] = configs.map((cfg, i) => {
    const color = cfg.slot.color ?? cfg.fallbackColor;
    const decimals = cfg.slot.decimals ?? DEFAULT_DECIMALS;
    // `type` is set per-branch below (each literal drives the `satisfies` narrowing).
    const base = {
      name: cfg.slot.name,
      color,
      yAxis: i,
      data: cfg.slot.data,
      custom: { decimals, tooltipOrder: cfg.tooltipOrder } satisfies SeriesCustom,
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
          // Thin at rest, noticeably thicker when the series is hovered (issue #2).
          lineWidth: 1.5,
          // Hover reveals a small hollow dot (light centre) on the hovered point.
          marker: {
            enabled: false,
            symbol: "circle",
            radius: 3,
            states: {
              hover: { enabled: true, radius: 4, fillColor: MARKER_CENTER, lineColor: color, lineWidth: 2 },
            },
          },
          states: { hover: { lineWidth: 4 } },
        } satisfies Highcharts.SeriesSplineOptions;
      case "line":
        return {
          ...base,
          type: "line",
          lineWidth: 1,
          // Square markers; hover swaps to a light centre (hollow square).
          marker: {
            enabled: true,
            symbol: "square",
            radius: 4,
            fillColor: color,
            lineColor: color,
            lineWidth: 1,
            states: {
              hover: { fillColor: MARKER_CENTER, lineColor: color, lineWidth: 2, radius: 5 },
            },
          },
        } satisfies Highcharts.SeriesLineOptions;
      case "column":
        return {
          ...base,
          type: "column",
          // Thin (~40px) rounded nubs at the bottom of the plot, not full-step bars.
          borderRadius: 2,
          borderWidth: 0,
          pointWidth: 40,
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
        // Large translucent halo around hovered points, as in the reference.
        states: { hover: { halo: { size: 16, opacity: 0.25 } } },
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
        const custom = (p: Highcharts.Point): SeriesCustom =>
          (p.series.options as { custom?: SeriesCustom }).custom ?? {};
        // Reorder rows to the reference order (area, bar, spline, line); Highcharts
        // hands us the points in rendering (series) order.
        const points = [...(this.points ?? [])].sort(
          (a, b) => (custom(a).tooltipOrder ?? 0) - (custom(b).tooltipOrder ?? 0),
        );
        const date = `<div style="color:${COLORS.tooltipDate};font-size:13px;margin-bottom:6px">${formatDate(this.x)}</div>`;
        const rows = points
          .map((p) => {
            const decimals = custom(p).decimals ?? DEFAULT_DECIMALS;
            const value = Highcharts.numberFormat(p.y as number, decimals);
            return (
              `<div style="display:flex;align-items:center;gap:8px;font-size:15px;line-height:20px">` +
              `<span style="width:13px;height:13px;border-radius:50%;background:${p.color};display:inline-block;flex:0 0 auto"></span>` +
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
