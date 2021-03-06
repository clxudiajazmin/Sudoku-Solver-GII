import Image from "./Imagen";
import { Punto } from "./RegionEntrePuntos";
import * as math from "mathjs";

export interface Transform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

export default function findHomographicTransform(
  size: number,
  corners: {
    topLeft: Punto;
    topRight: Punto;
    bottomLeft: Punto;
    bottomRight: Punto;
  }
): Transform {
  const A = math.zeros(8, 8) as math.Matrix;

  A.set([0, 2], 1);
  A.set([1, 5], 1);
  A.set([2, 0], size);
  A.set([2, 2], 1);
  A.set([2, 6], -size * corners.topRight.x);
  A.set([3, 3], size);
  A.set([3, 5], 1);
  A.set([3, 6], -size * corners.topRight.y);
  A.set([4, 1], size);
  A.set([4, 2], 1);
  A.set([4, 7], -size * corners.bottomLeft.x);
  A.set([5, 4], size);
  A.set([5, 5], 1);
  A.set([5, 7], -size * corners.bottomLeft.y);
  A.set([6, 0], size);
  A.set([6, 1], size);
  A.set([6, 2], 1);
  A.set([6, 6], -size * corners.bottomRight.x);
  A.set([6, 7], -size * corners.bottomRight.x);
  A.set([7, 3], size);
  A.set([7, 4], size);
  A.set([7, 5], 1);
  A.set([7, 6], -size * corners.bottomRight.y);
  A.set([7, 7], -size * corners.bottomRight.y);

  const B = math.matrix([
    corners.topLeft.x,
    corners.topLeft.y,
    corners.topRight.x,
    corners.topRight.y,
    corners.bottomLeft.x,
    corners.bottomLeft.y,
    corners.bottomRight.x,
    corners.bottomRight.y,
  ]);

  const A_t = math.transpose(A);
  const lamda = math.multiply(
    math.multiply(math.inv(math.multiply(A_t, A)), A_t),
    B
  );

  const a = lamda.get([0]);
  const b = lamda.get([1]);
  const c = lamda.get([2]);
  const d = lamda.get([3]);
  const e = lamda.get([4]);
  const f = lamda.get([5]);
  const g = lamda.get([6]);
  const h = lamda.get([7]);
  return { a, b, c, d, e, f, g, h };
}

export function transformPoint(point: Punto, tranform: Transform) {
  const { a, b, c, d, e, f, g, h } = tranform;
  const { x, y } = point;

  const sxPre1 = b * y + c;
  const sxPre2 = h * y + 1;
  const syPre1 = e * y + f;
  const syPre2 = h * y + 1;

  const sx = Math.floor((a * x + sxPre1) / (g * x + sxPre2));
  const sy = Math.floor((d * x + syPre1) / (g * x + syPre2));
  return { x: sx, y: sy };
}

export function extractSquareFromRegion(
  source: Image,
  size: number,
  tranform: Transform
) {
  const { a, b, c, d, e, f, g, h } = tranform;

  const result = Image.withSize(size, size);
  for (let y = 0; y < size; y++) {
    const sxPre1 = b * y + c;
    const sxPre2 = h * y + 1;
    const syPre1 = e * y + f;
    const syPre2 = h * y + 1;

    for (let x = 0; x < size; x++) {
      const sx = Math.floor((a * x + sxPre1) / (g * x + sxPre2));
      const sy = Math.floor((d * x + syPre1) / (g * x + syPre2));
      result.bytes[y * size + x] = source.bytes[sy * source.width + sx];
    }
  }
  return result;
}