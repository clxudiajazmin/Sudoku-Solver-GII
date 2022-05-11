import StrictEventEmitter from "strict-event-emitter-types";
import { EventEmitter } from "events";
//Extracción de modelo y sudoku solver
import fillInPrediction from "../ReconocimientoImagen/Loadmodel";
import SudokuSolver from "../Solver/sudokusolver";
//Funciones procesamiento de imagen
import getLargestConnectedComponent, {
  getRegionEntrePuntos,
  Punto,
} from "../ProcesamientoImagen/RegionEntrePuntos";
import getCornerPoints from "../ProcesamientoImagen/Esquinas";
import findHomographicTransform, {transformPoint, extractSquareFromRegion, Transform} from "../ProcesamientoImagen/Homographic";
import Image from "../ProcesamientoImagen/Imagen";
import boxBlur from "../ProcesamientoImagen/Blur";

// Mínimo de celdas del sudoku
const MIN_BOXES = 17;
// tamaño de la imagen a procesar
const PROCESSING_SIZE = 900;

export type VideoReadyPayload = { width: number; height: number };

interface ProcessorEvents {
  videoReady: VideoReadyPayload;
}

type ProcessorEventEmitter = StrictEventEmitter<EventEmitter, ProcessorEvents>;
export interface PuzzleBox {
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  numberImage: Image;
  contents: number;
}

type SolvedBox = {
  // El número es conocido o no?
  conocido: boolean;
  // El digito 
  digit: number;
  // Altura de digito
  digitHeight: number;
  // Rotación de dígito
  digitRotation: number;
  // Posición para dibujar
  position: Punto;
};



export default class Processor extends (EventEmitter as {
  new (): ProcessorEventEmitter;
}) {
  video: HTMLVideoElement;
  // El video está corriendo?
  isVideoRunning: boolean = false;
  // Se está procesando?
  isProcessing: boolean = false;
  // Definición de las esquinas
  corners: {
    topLeft: Punto;
    topRight: Punto;
    bottomLeft: Punto;
    bottomRight: Punto;
  };
  // Punto para calculo de area
  gridLines: { p1: Punto; p2: Punto }[];
  // Sudoku resuelto
  solvedPuzzle: SolvedBox[][];

  /**
   * Empieza a usar la cámara
   */
  async startVideo(video: HTMLVideoElement) {
    this.video = video;
    //Solo video no audio
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: 640 },
      audio: false,
    });
    // Obtener las dimensiones del video capturado
    const canPlayListener = () => {
      this.video.removeEventListener("canplay", canPlayListener);
      this.emit("videoReady", {
        width: this.video.videoWidth,
        height: this.video.videoHeight,
      });
      //Definimos la variable a true -> Se está ejecutando la cámara
      this.isVideoRunning = true;
      // Empieza el procesamiento
      this.processFrame();
    };
    this.video.addEventListener("canplay", canPlayListener);
    this.video.srcObject = stream;
    this.video.play();
  }

  captureImagen(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    // Dibujamos el video capturado por la cámara al canvas
    context!.drawImage(video, 0, 0, width, height);
    // Obtenemos los bytes
    const imageData = context!.getImageData(0, 0, width, height);
    const bytes = new Uint8ClampedArray(width * height);
    // Convertimos a blanco y negro
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const r = imageData.data[(y * width + x) * 4];
        const g = imageData.data[(row + x) * 4 + 1];
        const b = imageData.data[(y * width + x) * 4 + 2];
        const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        bytes[row + x] = grey;
      }
    }
    return new Image(bytes, width, height);
  }


  /**
   * THRESHOLD
   */
  adaptiveThreshold(
    imagen: Image,
    threshold: number,
    blurSize: number
  ): Image {
    const { width, height, bytes } = imagen;
    const blurred = boxBlur(imagen, blurSize, blurSize);
    const blurredBytes = blurred.bytes;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        bytes[row + width + x] =
          blurredBytes[row + x] - bytes[row + width + x] > threshold ? 255 : 0;
      }
    }
    return imagen;
  }



  /**
   * Crear los grids
   */
  createGridLines(transform: Transform) {
    const boxSize = PROCESSING_SIZE / 9;
    const gridLines = [];
    for (let l = 1; l < 9; l++) {
      // LINEA HORIZONTAL
      gridLines.push({
        p1: transformPoint({ x: 0, y: l * boxSize }, transform),
        p2: transformPoint({ x: PROCESSING_SIZE, y: l * boxSize }, transform),
      });
      // LINEA VERTICAL
      gridLines.push({
        p1: transformPoint({ y: 0, x: l * boxSize }, transform),
        p2: transformPoint({ y: PROCESSING_SIZE, x: l * boxSize }, transform),
      });
    }
    return gridLines;
  }


   extractBoxes(greyScale: Image, thresholded: Image) {
    const results: PuzzleBox[] = [];
    const size = greyScale.width;
    const boxSize = size / 9;
    const searchSize = boxSize / 5;
    //Recorrer cada celda
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        let minX = Number.MAX_SAFE_INTEGER;
        let minY = Number.MAX_SAFE_INTEGER;
        let maxX = 0;
        let maxY = 0;
        let pointsCount = 0;
        const searchX1 = x * boxSize + searchSize;
        const searchY1 = y * boxSize + searchSize;
        const searchX2 = x * boxSize + boxSize - searchSize;
        const searchY2 = y * boxSize + boxSize - searchSize;
        for (let searchY = searchY1; searchY < searchY2; searchY++) {
          for (let searchX = searchX1; searchX < searchX2; searchX++) {
            if (thresholded.bytes[searchY * size + searchX] === 255) {
              const component = getRegionEntrePuntos(
                thresholded,
                searchX,
                searchY
              );
              const foundWidth =
                component.limites.bottomRight.x - component.limites.topLeft.x;
              const foundHeight =
                component.limites.bottomRight.y - component.limites.topLeft.y;
              if (
                component.puntos.length > 10 &&
                foundWidth < boxSize &&
                foundHeight < boxSize
              ) {
                minX = Math.min(minX, component.limites.topLeft.x);
                minY = Math.min(minY, component.limites.topLeft.y);
                maxX = Math.max(maxX, component.limites.bottomRight.x);
                maxY = Math.max(maxY, component.limites.bottomRight.y);
                pointsCount += component.puntos.length;
              }
            }
          }
        }

        const foundWidth = maxX - minX;
        const foundHeight = maxY - minY;
        if (
          pointsCount > 10 &&
          foundWidth < boxSize &&
          foundHeight < boxSize &&
          foundWidth > boxSize / 10 &&
          foundHeight > boxSize / 3
        ) {
          const numberImage = greyScale.subImage(
            Math.max(0, minX - 2),
            Math.max(0, minY - 2),
            Math.min(size - 1, maxX + 2),
            Math.min(size - 1, maxY + 2)
          );
          results.push({
            x,
            y,
            minX,
            maxX,
            minY,
            maxY,
            numberImage,
            contents: 0,
          });
        }
      }
    }
    return results;
  }

  /**
   * Celdas en el video
   */
  getTextDetailsForBox(
    x: number,
    y: number,
    digit: number,
    isKnown: boolean,
    transform: Transform
  ): SolvedBox {
    const boxSize = PROCESSING_SIZE / 9;
    const p1 = transformPoint(
      { x: (x + 0.5) * boxSize, y: y * boxSize },
      transform
    );
    const p2 = transformPoint(
      { x: (x + 0.5) * boxSize, y: (y + 1) * boxSize },
      transform
    );
    // Centro
    const textPosition = transformPoint(
      { x: (x + 0.5) * boxSize, y: (y + 0.5) * boxSize },
      transform
    );
    // Angulo de texto
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const digitRotation = Math.atan2(dx, dy);

    // Altura de texto aprox.
    const digitHeight = 0.8 * Math.sqrt(dx * dx + dy * dy);

    return {
      digit,
      digitHeight,
      digitRotation,
      conocido: isKnown,
      position: textPosition,
    };
  }

  createSolvedPuzzle(solver: SudokuSolver, transform: Transform) {
    const results: SolvedBox[][] = new Array(9);
    for (let y = 0; y < 9; y++) {
      results[y] = new Array(9);
    }
    solver.solution.forEach((sol) => {
      const { x, y, entry, isKnown } = sol.guess;
      results[y][x] = this.getTextDetailsForBox(
        x,
        y,
        entry,
        isKnown,
        transform
      );
    });
    return results;
  }

  sanityCheckCorners({
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  }: {
    topLeft: Punto;
    topRight: Punto;
    bottomLeft: Punto;
    bottomRight: Punto;
  }) {
    function length(p1: Punto, p2: Punto) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    const topLineLength = length(topLeft, topRight);
    const leftLineLength = length(topLeft, bottomLeft);
    const rightLineLength = length(topRight, bottomRight);
    const bottomLineLength = length(bottomLeft, bottomRight);
    if (
      topLineLength < 0.5 * bottomLineLength ||
      topLineLength > 1.5 * bottomLineLength
    )
      return false;
    if (
      leftLineLength < 0.7 * rightLineLength ||
      leftLineLength > 1.3 * rightLineLength
    )
      return false;
    if (
      leftLineLength < 0.5 * bottomLineLength ||
      leftLineLength > 1.5 * bottomLineLength
    )
      return false;
    return true;
  }
  
  //Empieza procesado de video
  async processFrame() {
    if (!this.isVideoRunning) {
      // No hay video 
      return;
    }
    if (this.isProcessing) {
      // Se está procesando
      return;
    }
    try {
      // capturar imagen
      const image = this.captureImagen(this.video);

      // Aplicar threshold
      const thresholded = this.adaptiveThreshold(image.clone(), 20, 20);
      // Extraer la región más grande entre los puntos
      const largestConnectedComponent = getLargestConnectedComponent(
        thresholded,
        {
          minAspectRatio: 0.5,
          maxAspectRatio: 1.5,
          minSize:
            Math.min(this.video.videoWidth, this.video.videoHeight) * 0.3,
          maxSize:
            Math.min(this.video.videoWidth, this.video.videoHeight) * 0.9,
        }
      );
      // Si se encuentra
      if (largestConnectedComponent) {
        // Calcular esquinas (Manhattan)
        const potentialCorners = getCornerPoints(largestConnectedComponent);
        
        if (this.sanityCheckCorners(potentialCorners)) {
          this.corners = potentialCorners;
          const transform = findHomographicTransform(
            PROCESSING_SIZE,
            this.corners
          );

          // Mostrar gridlines
          this.gridLines = this.createGridLines(transform);

          // Extraer tablero grayscale
          const extractedImageGreyScale = extractSquareFromRegion(
            image,
            PROCESSING_SIZE,
            transform
          );
          // Extraer tablero de imagen threshold
          const extractedImageThresholded = extractSquareFromRegion(
            thresholded,
            PROCESSING_SIZE,
            transform
          );
          // Extraer celdas con números
          const boxes = this.extractBoxes(
            extractedImageGreyScale,
            extractedImageThresholded
          );
          // Se cumple la condición de mínimos?
          if (boxes.length > MIN_BOXES) {
            // Aplicar la red neuronal
            await fillInPrediction(boxes);
            // Dancing Links
            const solver = new SudokuSolver();
            boxes.forEach((box) => {
              if (box.contents !== 0) {
                solver.setNumber(box.x, box.y, box.contents - 1);
              }
            });
            // Crear solución
            if (solver.search(0)) {
              this.solvedPuzzle = this.createSolvedPuzzle(solver, transform);
            } else {
              this.solvedPuzzle = null;
            }
          }
        } else {
          this.corners = null;
          this.gridLines = null;
          this.solvedPuzzle = null;
        }
      } else {
        this.corners = null;
        this.gridLines = null;
        this.solvedPuzzle = null;
      }
    } catch (error) {
      console.error(error);
    }
    this.isProcessing = false;
    setTimeout(() => this.processFrame(), 20);
  }
}