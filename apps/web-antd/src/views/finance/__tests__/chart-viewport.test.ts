import { describe, expect, it, vi } from 'vitest';

import { useChartViewport } from '../use-chart-viewport';

function setup() {
  const viewport = useChartViewport();
  const element = document.createElement('div');
  Object.defineProperties(element, {
    clientWidth: { value: 800 },
    clientHeight: { value: 400 },
  });
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  element.setPointerCapture = setPointerCapture;
  element.hasPointerCapture = vi.fn(() => true);
  element.releasePointerCapture = releasePointerCapture;
  viewport.viewportRef.value = element;
  return { ...viewport, element, setPointerCapture, releasePointerCapture };
}

describe('桑基图平移缩放', () => {
  it('以鼠标位置为缩放中心，并限制缩放范围', () => {
    const viewport = setup();
    const event = new WheelEvent('wheel', {
      deltaY: -100,
      cancelable: true,
    });
    Object.defineProperties(event, {
      clientX: { value: 200 },
      clientY: { value: 100 },
    });
    viewport.onWheel(event);
    const scale = Math.exp(0.2);
    expect(event.defaultPrevented).toBe(true);
    expect(viewport.transform.value).toBe(
      `translate(${200 - 200 * scale}px, ${100 - 100 * scale}px) scale(${scale})`,
    );
    viewport.zoomAt(100);
    expect(viewport.zoomLabel.value).toBe('300%');
    expect(viewport.canZoomIn.value).toBe(false);
    viewport.zoomAt(0.001);
    expect(viewport.zoomLabel.value).toBe('50%');
    expect(viewport.canZoomOut.value).toBe(false);
    viewport.resetView();
    expect(viewport.transform.value).toBe('translate(0px, 0px) scale(1)');
  });

  it('捕获指针实现双向拖动，忽略其他指针并在取消时结束', () => {
    const viewport = setup();
    viewport.onPointerDown(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(viewport.setPointerCapture).toHaveBeenCalledWith(1);
    expect(viewport.dragging.value).toBe(true);
    viewport.onPointerMove(
      new PointerEvent('pointermove', {
        pointerId: 2,
        clientX: 900,
        clientY: 900,
      }),
    );
    expect(viewport.transform.value).toBe('translate(0px, 0px) scale(1)');
    viewport.onPointerMove(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 160,
        clientY: 70,
      }),
    );
    expect(viewport.transform.value).toBe('translate(60px, -30px) scale(1)');
    viewport.onPointerEnd(new PointerEvent('pointercancel', { pointerId: 1 }));
    expect(viewport.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(viewport.dragging.value).toBe(false);
    viewport.onPointerMove(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 300,
        clientY: 300,
      }),
    );
    expect(viewport.transform.value).toBe('translate(60px, -30px) scale(1)');
  });

  it('键盘支持移动、缩放和复位，并且不拦截其他按键', () => {
    const viewport = setup();
    viewport.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    viewport.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(viewport.transform.value).toBe('translate(-40px, 40px) scale(1)');
    viewport.onKeydown(new KeyboardEvent('keydown', { key: '+' }));
    expect(viewport.zoomLabel.value).toBe('120%');
    viewport.onKeydown(new KeyboardEvent('keydown', { key: '0' }));
    expect(viewport.transform.value).toBe('translate(0px, 0px) scale(1)');
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    viewport.onKeydown(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
