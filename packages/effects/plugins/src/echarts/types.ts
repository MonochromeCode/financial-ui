import type {
  BarSeriesOption,
  LineSeriesOption,
  MapSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
  SankeySeriesOption,
} from 'echarts/charts';
import type {
  DatasetComponentOption,
  DataZoomComponentOption,
  GeoComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  ToolboxComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts/core';

export type ECOption = ComposeOption<
  | BarSeriesOption
  | DatasetComponentOption
  | DataZoomComponentOption
  | GeoComponentOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | MapSeriesOption
  | PieSeriesOption
  | RadarSeriesOption
  | SankeySeriesOption
  | TitleComponentOption
  | ToolboxComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
>;
