/* eslint-disable max-lines */
import * as React from "react";
import { v4 as uuid } from "uuid";
import {
  useContainerRect,
  useGraphState,
  useGraphTouchHandler,
  useSafariScale,
  useSelectBox,
  useTheme,
  useUpdateViewportCallback,
  useWheelHandler
} from "../../hooks";
import { useGraphConfig, useGraphController } from "../../hooks/context";
import { useConst } from "../../hooks/useConst";
import { useEventChannel } from "../../hooks/useEventChannel";
import { useFeatureControl } from "../../hooks/useFeatureControl";
import { GraphCanvasEvent, GraphContextMenuEvent, ICanvasCommonEvent, ICanvasKeyboardEvent } from "../../models/event";
import type { IContainerRect, IViewport } from "../../models/geometry";
import { GraphBehavior } from "../../models/state";
import { isSelected, isSupported, isViewportComplete } from "../../utils";
import { defaultGetNodeAriaLabel, defaultGetPortAriaLabel } from "../../utils/a11yUtils";
import { constantEmptyArray } from "../../utils/empty";
import { getOffsetLimit } from "../../utils/getOffsetLimit";
import { AlignmentLines } from "../AlignmentLines";
import { AnimatingNodeGroup } from "../AnimatingNodeGroup";
import { Connecting } from "../Connecting";
import { GraphContextMenu } from "../GraphContextMenu";
import { GraphGroupsRenderer } from "../Group/GraphGroupsRenderer";
import { NodeTooltips } from "../NodeTooltips";
import { PortTooltips } from "../PortTooltips";
import { Scrollbar } from "../Scrollbar";
import { Transform } from "../Transform";
import { EdgeTree } from "../tree/EdgeTree";
import { NodeTree } from "../tree/NodeTree";
import { VirtualizationProvider } from "../VirtualizationProvider";
import { getGraphStyles } from "./Graph.styles";
import type { IGraphProps } from "./IGraphProps";
import { SelectBox } from "./SelectBox";

export function Graph<NodeData = unknown, EdgeData = unknown, PortData = unknown>(
  props: IGraphProps<NodeData, EdgeData, PortData>
): React.ReactElement | null {
  const [focusedWithoutMouse, setFocusedWithoutMouse] = React.useState<boolean>(false);

  const graphController = useGraphController();
  const { state, dispatch } = useGraphState();
  const data = state.data.present;
  const { viewport } = state;

  const { eventChannel } = graphController;

  const graphId = useConst(() => `graph-${uuid()}`);
  const defaultSVGRef = React.useRef<SVGSVGElement>(null);

  const {
    focusCanvasAccessKey = "f",
    zoomSensitivity = 0.1,
    scrollSensitivity = 0.5,
    svgRef = defaultSVGRef,
    virtualizationDelay = 500
  } = props;

  const { theme } = useTheme();
  const graphConfig = useGraphConfig();
  const featureControl = useFeatureControl(state.settings.features);

  const [curHoverNode, setCurHoverNode] = React.useState<string>();
  const [curHoverPort, setCurHoverPort] = React.useState<[string, string] | undefined>(undefined);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const rectRef = React.useRef<IContainerRect | undefined>(undefined);

  const updateViewport = useUpdateViewportCallback(rectRef, svgRef, eventChannel);

  useEventChannel({
    props,
    dispatch,
    rectRef,
    svgRef,
    setFocusedWithoutMouse,
    containerRef,
    featureControl,
    graphConfig,
    setCurHoverNode,
    setCurHoverPort,
    updateViewport,
    eventChannel,
    graphController
  });

  useContainerRect(svgRef, containerRef, updateViewport);

  const {
    isNodesDraggable,
    isNodeResizable,
    isPanDisabled,
    isMultiSelectDisabled,
    isLassoSelectEnable,
    isNodeEditDisabled,
    isVerticalScrollDisabled,
    isHorizontalScrollDisabled,
    isA11yEnable,
    isCtrlKeyZoomEnable,
    isLimitBoundary,
    isVirtualizationEnabled
  } = featureControl;

  useSelectBox(dispatch, state.selectBoxPosition);

  const canvasEventHandler = <T extends (ICanvasCommonEvent | ICanvasKeyboardEvent)["type"]>(type: T) => (
    rawEvent: T extends ICanvasCommonEvent["type"] ? React.SyntheticEvent : React.KeyboardEvent
  ) => {
    rawEvent.persist();
    eventChannel.trigger({
      type,
      rawEvent
    } as ICanvasCommonEvent | ICanvasKeyboardEvent);
  };

  const classes = getGraphStyles(
    props,
    state,
    theme,
    isPanDisabled,
    isNodesDraggable,
    focusedWithoutMouse,
    state.behavior === GraphBehavior.multiSelect
  );

  useWheelHandler({
    containerRef,
    svgRef,
    rectRef,
    zoomSensitivity,
    scrollSensitivity,
    dispatch,
    isHorizontalScrollDisabled,
    isVerticalScrollDisabled,
    isCtrlKeyZoomEnable,
    eventChannel,
    graphConfig
  });

  const onContextMenuClick = React.useCallback(
    (evt: React.MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();

      eventChannel.trigger({
        type: GraphContextMenuEvent.Close
      });

      if (svgRef.current) {
        // to prevent: the keyboard events will be disabled after using the context menu (because the context menu is not the element of svg)
        svgRef.current.focus({ preventScroll: true });
      }
    },
    [eventChannel, svgRef]
  );

  const onFocusButtonClick: React.MouseEventHandler<HTMLButtonElement> = React.useCallback(() => {
    setFocusedWithoutMouse(true);

    if (svgRef.current) {
      svgRef.current.focus({ preventScroll: true });
    }
  }, [svgRef]);

  useSafariScale({
    rectRef,
    svgRef,
    eventChannel
  });

  const accessKey = isA11yEnable ? focusCanvasAccessKey : undefined;
  const touchHandlers = useGraphTouchHandler(rectRef, eventChannel);

  if (!isSupported()) {
    const { onBrowserNotSupported = () => <p>Your browser is not supported</p> } = props;
    return <>{onBrowserNotSupported()}</>;
  }

  const renderPortTooltip = () => {
    if (!curHoverPort || !isViewportComplete(state.viewport)) {
      return null;
    }
    const [nodeId, portId] = curHoverPort;
    const node = data.nodes.get(nodeId);
    if (!node) {
      return null;
    }
    const port = node.getPort(portId);
    if (!port) {
      return null;
    }
    return <PortTooltips port={port} parentNode={node} data={data} viewport={state.viewport} />;
  };

  const renderNodeTooltip = () => {
    if (!curHoverNode || !isViewportComplete(state.viewport)) {
      return null;
    }

    // do not show tooltip if current node has contextmenu
    const curHoverNodeHasContextMenu =
      state.contextMenuPosition && curHoverNode === state.data.present.nodes.find(isSelected)?.id;

    if (curHoverNodeHasContextMenu) {
      return null;
    }

    return <NodeTooltips node={data.nodes.get(curHoverNode)} viewport={state.viewport} />;
  };

  return (
    <div
      ref={containerRef}
      role="application"
      id={graphId}
      className={classes.container}
      {...touchHandlers}
      onDoubleClick={canvasEventHandler(GraphCanvasEvent.DoubleClick)}
      onMouseDown={canvasEventHandler(GraphCanvasEvent.MouseDown)}
      onMouseUp={canvasEventHandler(GraphCanvasEvent.MouseUp)}
      onContextMenu={canvasEventHandler(GraphCanvasEvent.ContextMenu)}
      onMouseMove={canvasEventHandler(GraphCanvasEvent.MouseMove)}
      onMouseOver={canvasEventHandler(GraphCanvasEvent.MouseOver)}
      onMouseOut={canvasEventHandler(GraphCanvasEvent.MouseOut)}
      onFocus={canvasEventHandler(GraphCanvasEvent.Focus)}
      onBlur={canvasEventHandler(GraphCanvasEvent.Blur)}
      onKeyDown={canvasEventHandler(GraphCanvasEvent.KeyDown)}
      onKeyUp={canvasEventHandler(GraphCanvasEvent.KeyUp)}
    >
      <button className={classes.buttonA11y} onClick={onFocusButtonClick} accessKey={accessKey} hidden={true} />
      <svg
        tabIndex={0}
        // for IE and Edge
        focusable="true"
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        className={classes.svg}
        data-graph-id={graphId}
      >
        <title>{props.title}</title>
        <desc>{props.desc}</desc>
        <Transform matrix={viewport.transformMatrix}>
          {state.viewport.rect && (
            <VirtualizationProvider
              viewport={state.viewport as Required<IViewport>}
              isVirtualizationEnabled={isVirtualizationEnabled}
              virtualizationDelay={virtualizationDelay}
              eventChannel={eventChannel}
            >
              <GraphGroupsRenderer data={data} groups={data.groups ?? constantEmptyArray()} />
              <EdgeTree graphId={graphId} tree={data.edges} data={data} eventChannel={eventChannel} />
              <NodeTree
                graphId={graphId}
                isNodeResizable={isNodeResizable}
                tree={data.nodes}
                data={data}
                isNodeEditDisabled={isNodeEditDisabled}
                eventChannel={eventChannel}
                getNodeAriaLabel={props.getNodeAriaLabel ?? defaultGetNodeAriaLabel}
                getPortAriaLabel={props.getPortAriaLabel ?? defaultGetPortAriaLabel}
              />
            </VirtualizationProvider>
          )}
          {state.dummyNodes.isVisible && (
            <AnimatingNodeGroup dummyNodes={state.dummyNodes} graphData={state.data.present} />
          )}
          <AlignmentLines style={props.styles?.alignmentLine} />
        </Transform>
        {(!isMultiSelectDisabled || isLassoSelectEnable) && (
          <SelectBox selectBoxPosition={state.selectBoxPosition} style={props.styles?.selectBox} />
        )}
        {state.connectState && (
          <Connecting
            graphConfig={graphConfig}
            eventChannel={eventChannel}
            viewport={state.viewport}
            styles={props.styles?.connectingLine}
            movingPoint={state.connectState.movingPoint}
          />
        )}
      </svg>
      {(!isVerticalScrollDisabled || !isHorizontalScrollDisabled || !isPanDisabled) &&
        isLimitBoundary &&
        isViewportComplete(state.viewport) && (
          <Scrollbar
            viewport={state.viewport}
            offsetLimit={getOffsetLimit({
              data,
              graphConfig,
              rect: state.viewport.rect,
              transformMatrix: viewport.transformMatrix,
              canvasBoundaryPadding: state.settings.canvasBoundaryPadding,
              groupPadding: data.groups[0]?.padding
            })}
            dispatch={dispatch}
            horizontal={!isHorizontalScrollDisabled}
            vertical={!isVerticalScrollDisabled}
            eventChannel={eventChannel}
          />
        )}
      <GraphContextMenu state={state} onClick={onContextMenuClick} data-automation-id="context-menu-container" />
      {renderNodeTooltip()}
      {renderPortTooltip()}
    </div>
  );
}
