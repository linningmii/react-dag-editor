import * as React from "react";
import { useTheme } from "../../hooks";
import { useGraphConfig } from "../../hooks/context";
import type { NodeModel } from "../../models/NodeModel";
import { getNodeConfig, getRectHeight, getRectWidth } from "../../utils";

interface IStaticNodeProps {
  node: NodeModel;
}

const StaticNode: React.FunctionComponent<IStaticNodeProps> = props => {
  const { node } = props;
  const graphConfig = useGraphConfig();
  const { theme } = useTheme();

  const nodeConfig = getNodeConfig(node, graphConfig);

  if (nodeConfig?.renderStatic) {
    return <g>{nodeConfig.renderStatic({ model: node, theme })}</g>;
  }

  const rectHeight = getRectHeight(nodeConfig, node);
  const rectWidth = getRectWidth(nodeConfig, node);

  return (
    <rect
      transform={`translate(${node.x}, ${node.y})`}
      height={rectHeight}
      width={rectWidth}
      fill={theme.dummyNodeStroke}
    />
  );
};

const StaticNodeWithMemo = React.memo(StaticNode, (prevProps, nextProps) => {
  const prevNode = prevProps.node;
  const nextNode = nextProps.node;

  return (
    prevNode.x === nextNode.x &&
    prevNode.y === nextNode.y &&
    prevNode.height === nextNode.height &&
    prevNode.width === nextNode.width &&
    prevNode.isInSearchResults === nextNode.isInSearchResults &&
    prevNode.isCurrentSearchResult === nextNode.isCurrentSearchResult
  );
});

export { StaticNodeWithMemo as StaticNode };
