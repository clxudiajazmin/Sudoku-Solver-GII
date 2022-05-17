import * as tf from "@tensorflow/tfjs";
import { PuzzleBox } from "../Procesador/Processor";

const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const IMAGE_SIZE = 20;
let modelo: tf.LayersModel = undefined;
let modelLoadingPromise: Promise<tf.LayersModel> = undefined;

async function loadModel() {
  if (modelo) {
    return modelo;
  }
  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }
  modelLoadingPromise = new Promise(async (resolve, reject) => {
    modelo = await tf.loadLayersModel('https://storage.googleapis.com/bucket_tfjs/model.json');
    resolve(modelo);
    console.log("Model Cargado")
  });
}
loadModel().then(() => console.log("Model Loaded", console.error));

/**
 * Work out what the class should be from the results of the neural network prediction
 * @param logits
 */
export async function getClasses(logits: tf.Tensor<tf.Rank>) {
  const logitsArray = (await logits.array()) as number[][];
  const classes = logitsArray.map((values) => {
    let maxProb = 0;
    let maxIndex = 0;
    values.forEach((value, index) => {
      if (value > maxProb) {
        maxProb = value;
        maxIndex = index;
      }
    });
    return CLASSES[maxIndex];
  });
  return classes;
}

export default async function fillInPrediction(boxes: PuzzleBox[]) {
  const model = await loadModel();
  const logits = tf.tidy(() => {
    const images = boxes.map((box) => {
      const img = tf.browser
        .fromPixels(box.numberImage.toImageData(), 1)
        .resizeBilinear([IMAGE_SIZE, IMAGE_SIZE])
        .toFloat();
      const mean = img.mean();
      const std = tf.moments(img).variance.sqrt();
      const normalized = img.sub(mean).div(std);
      const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 1]);
      return batched;
    });
    const input = tf.concat(images);
    console.log(input)
    return model.predict(input, {
      batchSize: boxes.length,
    });
  });
  const classes = await getClasses(logits as tf.Tensor<tf.Rank>);
  classes.forEach((className, index) => (boxes[index].contents = className));
}