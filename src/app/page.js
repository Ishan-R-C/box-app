"use client";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // State for recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Dynamically load MediaPipe scripts
  useEffect(() => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
    ];

    scripts.forEach((src) => {
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.async = true;
      document.head.appendChild(script);
    });
  }, []); // Run only once on component mount

  useEffect(() => {
    // Ensure refs are available
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let camera = null;
    let pose = null;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas(); // Initial resize

    const interval = setInterval(() => {
      if (window.Pose && window.Camera && window.drawLandmarks) {
        clearInterval(interval);

        const { Pose, Camera, drawLandmarks } = window;

        pose = new Pose({
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

          ctx.strokeStyle = allInside ? "green" : "red";
          ctx.lineWidth = 4;
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          if (detected && !allInside) {
            ctx.font = "bold 32px sans-serif";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 10;
            ctx.fillText(
              "Fit the subject within the box",
              canvas.width / 2,
              canvas.height - 50
            );
            ctx.shadowBlur = 0;
          }
        });

        camera = new Camera(video, {
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

      if (camera && camera.video && camera.video.srcObject) {
        camera.video.srcObject.getTracks().forEach((track) => track.stop());
      }

      if (pose && typeof pose.close === "function") {
        pose.close();
      }
    };
  }, []);

  const handleToggleRecording = () => {
    if (isRecording) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const stream = canvasRef.current?.captureStream(30);
      if (!stream) {
        console.error("No canvas stream available to record.");
        return;
      }

      recordedChunksRef.current = [];
      const options = { mimeType: "video/webm; codecs=vp9" };
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
      } catch (e) {
        console.error("Failed to create MediaRecorder:", e);
        return;
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = `recorded-pose-${new Date().toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <main className="w-screen h-screen bg-black overflow-hidden">
      {/* This relative container ensures correct layering */}
      <div className="relative w-full h-full">
        {/* Hidden video element (no z-index needed) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: "none" }}
        />

        {/* Canvas is layer 1 */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full z-10"
        />

        {/* UI Controls are layer 2, ensuring they are on top of the canvas */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={handleToggleRecording}
            className={`px-6 py-3 rounded-full text-white font-semibold shadow-lg transition-all duration-300 flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
              isRecording
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-400"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-400"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full transition-all ${
                isRecording ? "bg-white animate-pulse" : "bg-red-500"
              }`}
            ></span>
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
        </div>
      </div>
    </main>
  );
}
