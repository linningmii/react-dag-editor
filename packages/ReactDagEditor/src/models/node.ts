import { ICanvasPort } from "./port";
import { GraphNodeState } from "./element-state";

export interface ICanvasNode<T = unknown, P = unknown> {
  readonly shape?: string;
  readonly x: number;
  readonly y: number;
  readonly name?: string;
  readonly id: string;
  readonly state?: GraphNodeState;
  readonly height?: number;
  readonly width?: number;
  readonly automationId?: string;
  readonly isInSearchResults?: boolean;
  readonly isCurrentSearchResult?: boolean;
  readonly ports?: ReadonlyArray<ICanvasPort<P>>;
  readonly ariaLabel?: string;
  readonly data?: Readonly<T>;
}
