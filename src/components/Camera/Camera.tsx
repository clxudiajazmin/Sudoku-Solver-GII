import React, {useRef, useEffect, useState} from 'react';
import './camera.css';
import Processor, { VideoReadyPayload } from "../Procesador/Processor";


const processor = new Processor();

function Camera() {

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef(null);

  const [videoWidth, setVideoWidth] = useState(100);
  const [videoHeight, setVideoHeight] = useState(100);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isProceso, setProceso] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      processor.startVideo(video).then(
        () => console.log("Vídeo Iniciado"),
        (error) => alert(error.message)
      );
    }
  }, [videoRef]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const canvas = previewCanvasRef.current;
      if (canvas && processor.isVideoRunning && isProceso) {
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(processor.video, 0, 0);
          if (processor.corners) {
            const {
              topLeft,
              topRight,
              bottomLeft,
              bottomRight,
            } = processor.corners;
            context.strokeStyle = "rgba(0,0,0,1)";
            context.fillStyle = "rgba(0,0,0,0.1)";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(topLeft.x, topLeft.y);
            context.lineTo(topRight.x, topRight.y);
            context.lineTo(bottomRight.x, bottomRight.y);
            context.lineTo(bottomLeft.x, bottomLeft.y);
            context.closePath();
            context.stroke();
            context.fill();
          }
          if (processor.gridLines) {
            context.strokeStyle = "rgba(0,0,0,1)";
            context.lineWidth = 2;
            processor.gridLines.forEach((line) => {
              context.moveTo(line.p1.x, line.p1.y);
              context.lineTo(line.p2.x, line.p2.y);
            });
            context.stroke();
          }
          if (processor.solvedPuzzle) {
            context.fillStyle = "rgba(230,14,14,1)";
            for (let y = 0; y < 9; y++) {
              for (let x = 0; x < 9; x++) {
                if (processor.solvedPuzzle[y][x]) {
                  const {
                    digit,
                    digitHeight,
                    digitRotation,
                    position,
                    conocido,
                  } = processor.solvedPuzzle[y][x];
                  if (!conocido) {
                    context.font = `bold ${digitHeight}px sans-serif`;
                    context.translate(position.x, position.y);
                    context.rotate(Math.PI - digitRotation);
                    context.fillText(
                      digit.toString(),
                      -digitHeight / 4,
                      digitHeight / 3
                    );
                    context.setTransform();
                  }
                }
              }
            }
          }
        }
      }
    }, 100);
    return () => {
      window.clearInterval(interval);
    };
  }, [previewCanvasRef, isProceso]);

  useEffect(() => {
    function videoReadyListener({ width, height }: VideoReadyPayload) {
      setVideoWidth(width);
      setVideoHeight(height);
    }
    processor.on("videoReady", videoReadyListener);
    return () => {
      processor.off("videoReady", videoReadyListener);
    };
  });

  const photo= () =>{
    const width= videoWidth;
    const height = videoHeight;
    let video = previewCanvasRef.current;
    let photo = photoRef.current;

    photo.width = width;
    photo.height = height;

    let ctx = photo.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    setProceso(false);
    setHasPhoto(true);
  }

  const close= () =>{
    let photo = photoRef.current;
    let ctx = photo.getContext('2d');
    ctx.clearRect(0,0,photo.width, photo.height);
    setProceso(true);
    setHasPhoto(false);
  }

  return (
      <div className="sudoku__camera">
        <div className="sudoku__camera-video">
      {}
            <video
              ref={videoRef}
              className="video-preview"
              width={10}
              height={10}
              playsInline
              muted
            />
            <canvas
              ref={previewCanvasRef}
              className="preview-canvas"
              width={videoWidth}
              height={videoHeight}
            />
            <button className ="photoB " onClick={photo}>Capturar</button>

            <div className={'result ' + (hasPhoto ? 'hasPhoto' : '')}>
              <canvas ref={photoRef}/>
              <button className ="closeB " onClick={close} >Cerrar</button>
            </div>
      </div>
    </div>
    
  );
}

export default Camera