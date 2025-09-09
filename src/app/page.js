"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [insideBox, setInsideBox] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resizeCanvas = () => {
      if (video.videoWidth && video.videoHeight) {
        const aspect = video.videoWidth / video.videoHeight;
        const windowAspect = window.innerWidth / window.innerHeight;

        if (aspect > windowAspect) {
          // video is wider than screen
          canvas.width = window.innerWidth;
          canvas.height = window.innerWidth / aspect;
        } else {
          // video is taller than screen
          canvas.height = window.innerHeight;
          canvas.width = window.innerHeight * aspect;
        }
      }
    };

    window.addEventListener("resize", resizeCanvas);

    const interval = setInterval(() => {
      if (window.Pose && window.Camera && window.drawLandmarks) {
        clearInterval(interval);

        const { Pose, Camera, drawLandmarks } = window;

        const pose = new Pose({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results) => {
          if (!video.videoWidth || !video.videoHeight) return;
          resizeCanvas();

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

          const box = {
            x: canvas.width * 0.2,
            y: canvas.height * 0.2,
            w: canvas.width * 0.6,
            h: canvas.height * 0.6,
          };

          let allInside = true;
          if (results.poseLandmarks) {
            results.poseLandmarks.forEach((lm) => {
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              if (
                x < box.x ||
                x > box.x + box.w ||
                y < box.y ||
                y > box.y + box.h
              ) {
                allInside = false;
              }
            });
            drawLandmarks(ctx, results.poseLandmarks, {
              color: "blue",
              lineWidth: 2,
            });
          }

          ctx.strokeStyle = allInside ? "green" : "red";
          ctx.lineWidth = 4;
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          setInsideBox(allInside);
        });

        const camera = new Camera(video, {
          onFrame: async () => {
            await pose.send({ image: video });
          },
          facingMode: "environment",
        });

        camera.start();
      }
    }, 200);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" />
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" />
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" />

      <div className="w-full h-screen relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{ zIndex: 1 }}
        />
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-lg font-bold bg-black/50 px-4 py-2 rounded z-10">
          {insideBox ? "All landmarks inside" : "Landmarks outside"}
        </p>
      </div>
    </>
  );
}
