import {
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
} from 'echarts/charts';
import {
  DatasetComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import {
  LabelLayout,
  LegacyGridContainLabel,
  UniversalTransition,
} from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

// 注册必须的组件（地图 MapChart、GeoComponent 见 china-map.ts，按需加载）
echarts.use([
  TitleComponent,
  PieChart,
  RadarChart,
  SankeyChart,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  TransformComponent,
  BarChart,
  LineChart,
  FunnelChart,
  GaugeChart,
  LabelLayout,
  LegacyGridContainLabel,
  UniversalTransition,
  CanvasRenderer,
  LegendComponent,
  ToolboxComponent,
  VisualMapComponent,
  GraphicComponent,
]);

export default echarts;
