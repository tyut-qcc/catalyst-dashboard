// EChart React wrapper (compatible with light theme)
function EChart({ option, style, onReady }) {
  const ref = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(el);
    if (onReady) onReady(chart);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, []);

  React.useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return (
    <div ref={ref} style={{ width: '100%', minHeight: 280, ...style }} />
  );
}

// Chart palette for light theme
const CHART_COLORS = {
  primary: '#1e6fff',
  primaryLight: '#60a5fa',
  teal: '#14b8a6',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  rose: '#f43f5e',
  emerald: '#10b981',
  orange: '#f97316',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  gray: '#94a3b8',
  gridLine: '#e2e8f0',
  axisLabel: '#64748b',
  tooltipBg: 'rgba(255,255,255,0.97)',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#1e293b',
  areaPrimary: ['rgba(30, 111, 255, 0.22)', 'rgba(30, 111, 255, 0.02)'],
  areaTeal: ['rgba(20, 184, 166, 0.18)', 'rgba(20, 184, 166, 0.02)'],
  areaAmber: ['rgba(245, 158, 11, 0.18)', 'rgba(245, 158, 11, 0.02)'],
};

const DEFAULT_TOOLTIP = {
  backgroundColor: CHART_COLORS.tooltipBg,
  borderColor: CHART_COLORS.tooltipBorder,
  borderWidth: 1,
  textStyle: { color: CHART_COLORS.tooltipText, fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 12px rgba(15,23,42,0.08); border-radius: 6px;',
};

Object.assign(window, { EChart, CHART_COLORS, DEFAULT_TOOLTIP });
