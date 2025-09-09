"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [insideBox, setInsideBox] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Resize canvas to full screen
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
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
          const ctx = canvas.getContext("2d");
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

        // Initialize MediaPipe Camera
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await pose.send({ image: videoRef.current });
          },
          width: canvas.width,
          height: canvas.height,
          facingMode: "environment", // back camera
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

      <div className="w-full h-screen relative">
        {/* Hidden video input */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: "none" }}
        />

        {/* Fullscreen canvas */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />

        {/* Overlay text */}
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-lg font-bold bg-black/50 px-4 py-2 rounded">
          {insideBox ? "All landmarks inside" : "Landmarks outside"}
        </p>
      </div>
    </>
  );
}
