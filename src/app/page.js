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

    // Resize canvas to container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const interval = setInterval(() => {
      if (window.Pose && window.Camera && window.drawLandmarks) {
        clearInterval(interval);

        const Pose = window.Pose;
        const Camera = window.Camera;
        const { drawLandmarks } = window;

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

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await pose.send({ image: videoRef.current });
          },
          width: canvas.width,
          height: canvas.height,
        });

        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: { exact: "environment" } },
          })
          .then((stream) => {
            videoRef.current.srcObject = stream;
            camera.start();
          })
          .catch((err) => {
            console.warn(
              "Back camera not available, falling back to default:",
              err
            );
            camera.start();
          });
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

      <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: "none" }}
        />
        <canvas ref={canvasRef} className="responsive-canvas border" />
        <p className="mt-2">
          {insideBox ? "All landmarks inside" : "Landmarks outside"}
        </p>
      </div>
    </>
  );
}
