import Image from "../ProcesamientoImagen/Imagen";
//Definimos la interfaz para los puntos
export interface Punto {
  x: number;
  y: number;
}

export class RegionEntrePuntos {
  public puntos: Punto[];
  public limites: { topLeft: Punto; bottomRight: Punto };
  //Usaremos puntos y límites
  constructor(puntos: Punto[], topLeft: Punto, bottomRight: Punto) {
    this.puntos = puntos;
    this.limites = { topLeft, bottomRight };
  }
  get width() {
    return this.limites.bottomRight.x - this.limites.topLeft.x;
  }
  get height() {
    return this.limites.bottomRight.y - this.limites.topLeft.y;
  }
  get aspectRatio() {
    return this.width / this.height;
  }
}

export function getRegionEntrePuntos(
  image: Image,
  x: number,
  y: number
): RegionEntrePuntos {
  const { width, height, bytes } = image;
  let minX = x;
  let minY = y;
  let maxX = x;
  let maxY = y;
  const points: Punto[] = [];
  const frontier: Punto[] = [];
  points.push({ x, y });
  frontier.push({ x, y });
  bytes[y * width + x] = 0;
  while (frontier.length > 0) {
    const seed = frontier.pop()!;
    minX = Math.min(seed.x, minX);
    maxX = Math.max(seed.x, maxX);
    minY = Math.min(seed.y, minY);
    maxY = Math.max(seed.y, maxY);
    for (
      let dy = Math.max(0, seed.y - 1);
      dy < height && dy <= seed.y + 1;
      dy++
    ) {
      for (
        let dx = Math.max(0, seed.x - 1);
        dx < width && dx <= seed.x + 1;
        dx++
      ) {
        if (bytes[dy * width + dx] === 255) {
          points.push({ x: dx, y: dy });
          frontier.push({ x: dx, y: dy });
          bytes[dy * width + dx] = 0;
        }
      }
    }
  }
  return new RegionEntrePuntos(
    points,
    { x: minX, y: minY },
    { x: maxX, y: maxY }
  );
}

type ConnectedComponentOptions = {
  minAspectRatio: number;
  maxAspectRatio: number;
  minSize: number;
  maxSize: number;
};

/**
 *
 * @param image Input image
 * @param options: Filtering options
 */
export default function getLargestConnectedComponent(
  image: Image,
  {
    minAspectRatio,
    maxAspectRatio,
    minSize,
    maxSize,
  }: ConnectedComponentOptions
): RegionEntrePuntos | null {
  let regionMaxima: RegionEntrePuntos | null = null;
  // clone the input image as this is a destructive operation
  const tmp = image.clone();
  const { width, height, bytes } = tmp;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (bytes[row + x] === 255) {
        const region = getRegionEntrePuntos(tmp, x, y);
        const width = region.limites.bottomRight.x - region.limites.topLeft.x;
        const height = region.limites.bottomRight.y - region.limites.topLeft.y;
        if (
          region.aspectRatio >= minAspectRatio &&
          region.aspectRatio <= maxAspectRatio &&
          height >= minSize &&
          width >= minSize &&
          height <= maxSize &&
          width <= maxSize
        ) {
          if (!regionMaxima || region.puntos.length > regionMaxima.puntos.length) {
            regionMaxima = region;
          }
        }
      }
    }
  }
  return regionMaxima;
}