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
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

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
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Fit the video frame to canvas
          const videoAspect = results.image.width / results.image.height;
          const canvasAspect = canvas.width / canvas.height;

          let drawWidth, drawHeight, offsetX, offsetY;
          if (videoAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / videoAspect;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
          } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * videoAspect;
            offsetY = 0;
            offsetX = (canvas.width - drawWidth) / 2;
          }

          ctx.drawImage(results.image, offsetX, offsetY, drawWidth, drawHeight);

          // Draw bounding box
          const box = {
            x: canvas.width * 0.2,
            y: canvas.height * 0.2,
            w: canvas.width * 0.6,
            h: canvas.height * 0.6,
          };

          let allInside = false;
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
              } else {
                allInside = true;
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
        {/* video is hidden but used by MediaPipe */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: "none" }}
        />

        {/* canvas fills the screen */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />

        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-lg font-bold bg-black/50 px-4 py-2 rounded z-10">
          {insideBox ? "All landmarks inside" : "Landmarks outside"}
        </p>
      </div>
    </>
  );
}
