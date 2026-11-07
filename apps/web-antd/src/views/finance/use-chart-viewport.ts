import { computed, ref } from 'vue';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export function useChartViewport() {
  const viewportRef = ref<HTMLElement>();
  const zoom = ref(1);
  const offset = ref({ x: 0, y: 0 });
  const dragging = ref(false);
  let drag: undefined | { pointerId: number; x: number; y: number };

  const transform = computed(
    () =>
      `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoom.value})`,
  );
  const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`);
  const canZoomIn = computed(() => zoom.value < MAX_ZOOM);
  const canZoomOut = computed(() => zoom.value > MIN_ZOOM);

  function setViewportRef(element: unknown) {
    viewportRef.value = element instanceof HTMLElement ? element : undefined;
  }

  function zoomAt(factor: number, anchor?: { x: number; y: number }) {
    const viewport = viewportRef.value;
    if (!viewport) return;
    const point = anchor ?? {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    };
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom.value * factor),
    );
    const ratio = nextZoom / zoom.value;
    offset.value = {
      x: point.x - (point.x - offset.value.x) * ratio,
      y: point.y - (point.y - offset.value.y) * ratio,
    };
    zoom.value = nextZoom;
  }

  function resetView() {
    zoom.value = 1;
    offset.value = { x: 0, y: 0 };
  }

  function onWheel(event: WheelEvent) {
    const viewport = viewportRef.value;
    if (!viewport) return;
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    let unit = 1;
    if (event.deltaMode === 1) unit = 16;
    if (event.deltaMode === 2) unit = viewport.clientHeight;
    zoomAt(
      Math.exp(-Math.max(-100, Math.min(100, event.deltaY * unit)) * 0.002),
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
    );
  }

  function onPointerDown(event: PointerEvent) {
    const viewport = viewportRef.value;
    if (!viewport || event.button !== 0 || drag) return;
    event.preventDefault();
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dragging.value = true;
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    offset.value = {
      x: offset.value.x + event.clientX - drag.x,
      y: offset.value.y + event.clientY - drag.y,
    };
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  function onPointerEnd(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = undefined;
    dragging.value = false;
    const viewport = viewportRef.value;
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const movement: Record<string, { x: number; y: number }> = {
      ArrowDown: { x: 0, y: 40 },
      ArrowLeft: { x: -40, y: 0 },
      ArrowRight: { x: 40, y: 0 },
      ArrowUp: { x: 0, y: -40 },
    };
    const delta = movement[event.key];
    if (delta) {
      offset.value = {
        x: offset.value.x + delta.x,
        y: offset.value.y + delta.y,
      };
    } else if (event.key === '+' || event.key === '=') {
      zoomAt(1.2);
    } else if (event.key === '-') {
      zoomAt(1 / 1.2);
    } else if (event.key === '0' || event.key === 'Home') {
      resetView();
    } else {
      return;
    }
    event.preventDefault();
  }

  return {
    viewportRef,
    setViewportRef,
    transform,
    zoomLabel,
    canZoomIn,
    canZoomOut,
    dragging,
    zoomAt,
    resetView,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onKeydown,
  };
}
