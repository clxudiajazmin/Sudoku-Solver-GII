import { Punto, RegionEntrePuntos } from "../ProcesamientoImagen/LargerComponent";

/**
 * Finds the nearest point to another point using manhattan distance
 * @param points Array of points
 * @param x x coordinate of point
 * @param y y coordinate of point
 */
function getNearestPoint(points: Punto[], x: number, y: number) {
  let closestPoint = points[0];
  let minDistance = Number.MAX_SAFE_INTEGER;
  points.forEach((point) => {
    const dx = Math.abs(point.x - x);
    const dy = Math.abs(point.y - y);
    const distance = dx + dy;
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  });
  return closestPoint;
}

export type CornerPoints = {
  topLeft: Punto;
  topRight: Punto;
  bottomLeft: Punto;
  bottomRight: Punto;
};

/**
 * Locate the corner points of a connected region
 * @param region A connected region
 */
export default function getCornerPoints(region: RegionEntrePuntos): CornerPoints {
  // get the extents
  const { x: minX, y: minY } = region.limites.topLeft;
  const { x: maxX, y: maxY } = region.limites.bottomRight;
  const { puntos } = region;
  // find the points closest to the topleft, topright, bottomleft, and bottomright
  return {
    topLeft: getNearestPoint(puntos, minX, minY),
    topRight: getNearestPoint(puntos, maxX, minY),
    bottomLeft: getNearestPoint(puntos, minX, maxY),
    bottomRight: getNearestPoint(puntos, maxX, maxY),
  };
}