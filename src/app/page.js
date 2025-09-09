"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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

          if (!results.image) return;

          // Fit video into canvas with aspect ratio preserved
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

          // Bounding box (relative to video area)
          const box = {
            x: offsetX + drawWidth * 0.2,
            y: offsetY + drawHeight * 0.2,
            w: drawWidth * 0.6,
            h: drawHeight * 0.6,
          };

          let allInside = false;
          let detected = false;

          if (results.poseLandmarks?.length) {
            detected = true;
            allInside = true;

            const remappedLandmarks = results.poseLandmarks.map((lm) => ({
              x: offsetX + lm.x * drawWidth,
              y: offsetY + lm.y * drawHeight,
              z: lm.z,
              visibility: lm.visibility,
            }));

            for (const lm of remappedLandmarks) {
              if (
                lm.x < box.x ||
                lm.x > box.x + box.w ||
                lm.y < box.y ||
                lm.y > box.y + box.h
              ) {
                allInside = false;
                break;
              }
            }

            drawLandmarks(ctx, remappedLandmarks, {
              color: "cyan",
              lineWidth: 2,
            });
          }

          // Draw bounding box
          ctx.strokeStyle = allInside ? "green" : "red";
          ctx.lineWidth = 4;
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          // If box is red, show text right below
          if (detected && !allInside) {
            ctx.font = "45px sans-serif";
            ctx.fillStyle = "red";
            ctx.textAlign = "center";
            ctx.fillText(
              "Fit the subject within the box",
              box.x + box.w / 2,
              box.y + box.h + 50
            );
          }
        });

        const camera = new Camera(video, {
          onFrame: async () => {
            await pose.send({ image: video });
          },
          facingMode: "environment",
        });

        camera.start();
      }
    }, 150);

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
          style={{ display: "none" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </>
  );
}
