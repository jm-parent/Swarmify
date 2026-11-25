import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import { FIT_PADDING_PX, formatZoom, RESET_ZOOM } from "./zoom";

export function ZoomBar() {
  const { zoom } = useViewport();
  const { zoomTo, fitView } = useReactFlow();

  return (
    <Panel position="bottom-center" className="zoom-bar">
      <span className="zoom-value">{formatZoom(zoom)}</span>
      <button type="button" onClick={() => zoomTo(RESET_ZOOM, { duration: 200 })}>
        100 %
      </button>
      <button type="button" onClick={() => fitView({ padding: FIT_PADDING_PX, duration: 200 })}>
        Ajuster
      </button>
    </Panel>
  );
}
