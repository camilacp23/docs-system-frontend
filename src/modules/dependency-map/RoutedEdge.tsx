// RoutedEdge: the edge type of the map. It draws the route the router found for the line (see edgeRouting): a polyline with
// rounded corners that runs on its own lane, leaves and enters through its own ports and never crosses a box. React Flow's
// built-in types cannot do this: smoothstep is one path with at most two bends computed from the middle of the side of each box,
// so two lines between the same columns lie on the same lane and a line between distant boxes goes over the ones in between.
// Cost: the path is a string of a few segments, built from points that were computed once with the layout; a line is as light to
// draw as a built-in one (the measurement is in the geometry test: routing 150 elements and 250 lines is done once per answer).
// Props: the ones React Flow gives an edge. `data.route` is the polyline and the label slot, `data.labelShown` whether the label is
// drawn: the label sits on a horizontal piece of the line where nothing else is, with a surface background (never black).
import { BaseEdge, type EdgeProps } from '@xyflow/react';

import type { MapFlowEdge } from './graphModel';
import { pathOfPoints } from './routePath';

export function RoutedEdge({ id, data, style, interactionWidth }: EdgeProps<MapFlowEdge>) {
  const route = data?.route;
  if (!route || route.points.length < 2) return null;
  const label = data.labelShown ? route.label : null;
  return (
    <BaseEdge
      id={id}
      path={pathOfPoints(route.points)}
      style={style}
      interactionWidth={interactionWidth}
      {...(label
        ? {
            label: label.text,
            labelX: label.x + label.width / 2,
            labelY: label.y + label.height / 2,
            labelStyle: style?.opacity === undefined ? undefined : { opacity: style.opacity },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 4,
          }
        : {})}
    />
  );
}
