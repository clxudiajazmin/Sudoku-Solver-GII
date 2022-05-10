import StrictEventEmitter from "strict-event-emitter-types";
import { EventEmitter } from "events";
//Extracción de modelo y sudoku solver
import fillInPrediction from "../ReconocimientoImagen/Loadmodel";
import SudokuSolver from "../Solver/sudokusolver";
//Funciones procesamiento de imagen
import getLargestConnectedComponent, {
  Punto,
} from "../ProcesamientoImagen/LargerComponent";
import findHomographicTransform, {
  Transform,
  transformPoint,
} from "../ProcesamientoImagen/EncontrarHomographic";
import getCornerPoints from "../ProcesamientoImagen/Esquinas";
import extractSquareFromRegion from "../ProcesamientoImagen/AplicarHomographic";
import extractBoxes from "../ProcesamientoImagen/ExtraerRecuadros";
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
   * @param video 
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
    // Convertimos a blanco y negro
    const bytes = new Uint8ClampedArray(width * height);
    console.log(bytes);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        //const r = imageData.data[(y * width + x) * 4];
        const g = imageData.data[(row + x) * 4 + 1];
        // const b = imageData.data[(y * width + x) * 4 + 2];
        // https://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
        // const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        bytes[row + x] = g;
      }
    }
    return new Image(bytes, width, height);
  }


  /**
   * Applies adaptive thresholding to an image. Uses a fast box blur for speed.
   * @param image Image to threshold
   * @param threshold Threshold value - higher removes noise, lower more noise
   */
  adaptiveThreshold(
    image: Image,
    threshold: number,
    blurSize: number
  ): Image {
    const { width, height, bytes } = image;
    const blurred = boxBlur(image, blurSize, blurSize);
    const blurredBytes = blurred.bytes;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        bytes[row + width + x] =
          blurredBytes[row + x] - bytes[row + width + x] > threshold ? 255 : 0;
      }
    }
    return image;
  }



  /**
   * Creates a set of grid lines mapped onto video space
   * @param transform The homographic transform to video space
   */
  createGridLines(transform: Transform) {
    const boxSize = PROCESSING_SIZE / 9;
    const gridLines = [];
    for (let l = 1; l < 9; l++) {
      // horizonal line
      gridLines.push({
        p1: transformPoint({ x: 0, y: l * boxSize }, transform),
        p2: transformPoint({ x: PROCESSING_SIZE, y: l * boxSize }, transform),
      });
      // vertical line
      gridLines.push({
        p1: transformPoint({ y: 0, x: l * boxSize }, transform),
        p2: transformPoint({ y: PROCESSING_SIZE, x: l * boxSize }, transform),
      });
    }
    return gridLines;
  }

  /**
   * Create a set of cells with coordinates in video space for drawing digits
   * @param x Cell X
   * @param y Cell Y
   * @param digit The digit
   * @param isKnown Is it a known digit?
   * @param transform The homographic transform to video space
   */
  getTextDetailsForBox(
    x: number,
    y: number,
    digit: number,
    isKnown: boolean,
    transform: Transform
  ): SolvedBox {
    const boxSize = PROCESSING_SIZE / 9;
    // work out the line that runs vertically through the box in the original image space
    const p1 = transformPoint(
      { x: (x + 0.5) * boxSize, y: y * boxSize },
      transform
    );
    const p2 = transformPoint(
      { x: (x + 0.5) * boxSize, y: (y + 1) * boxSize },
      transform
    );
    // the center of the box
    const textPosition = transformPoint(
      { x: (x + 0.5) * boxSize, y: (y + 0.5) * boxSize },
      transform
    );
    // approximate angle of the text in the box
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const digitRotation = Math.atan2(dx, dy);

    // appriximate height of the text in the box
    const digitHeight = 0.8 * Math.sqrt(dx * dx + dy * dy);

    return {
      digit,
      digitHeight,
      digitRotation,
      conocido: isKnown,
      position: textPosition,
    };
  }

  /**
   * Map from the found solution to something that can be displayed in video space
   * @param solver The solver with the solution
   * @param transform The transform to video space
   */
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
  /**
   * Process a frame of video
   */
  async processFrame() {
    if (!this.isVideoRunning) {
      // no video stream so give up immediately
      return;
    }
    if (this.isProcessing) {
      // we're already processing a frame. Don't kill the computer!
      return;
    }
    try {
      // grab an image from the video camera
      const image = this.captureImagen(this.video);
      // apply adaptive thresholding to the image
      const thresholded = this.adaptiveThreshold(image.clone(), 20, 20);
      // extract the most likely candidate connected region from the image
      
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
      // if we actually found something
      if (largestConnectedComponent) {
        // make a guess at where the corner points are using manhattan distance
        
        const potentialCorners = getCornerPoints(largestConnectedComponent);
        
        if (this.sanityCheckCorners(potentialCorners)) {
          this.corners = potentialCorners;

          // compute the transform to go from a square puzzle of size PROCESSING_SIZE to the detected corner points
          
          const transform = findHomographicTransform(
            PROCESSING_SIZE,
            this.corners
          );

          // we've got the transform so we can show where the gridlines are
          this.gridLines = this.createGridLines(transform);

          // extract the square puzzle from the original grey image
          const extractedImageGreyScale = extractSquareFromRegion(
            image,
            PROCESSING_SIZE,
            transform
          );
          // extract the square puzzle from the thresholded image - we'll use the thresholded image for determining where the digits are in the cells
          const extractedImageThresholded = extractSquareFromRegion(
            thresholded,
            PROCESSING_SIZE,
            transform
          );
          // extract the boxes that should contain the numbers
         
          const boxes = extractBoxes(
            extractedImageGreyScale,
            extractedImageThresholded
          );
          // did we find sufficient boxes for a potentially valid sudoku puzzle?
          if (boxes.length > MIN_BOXES) {
            // apply the neural network to the found boxes and work out what the digits are
          
            await fillInPrediction(boxes);
            
            // solve the suoku puzzle using the dancing links and algorithm X - https://en.wikipedia.org/wiki/Knuth%27s_Algorithm_X
         
            const solver = new SudokuSolver();
            // set the known values
            boxes.forEach((box) => {
              if (box.contents !== 0) {
                solver.setNumber(box.x, box.y, box.contents - 1);
              }
            });
            // search for a solution
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
    // process again
    setTimeout(() => this.processFrame(), 20);
  }
}