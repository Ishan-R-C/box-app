"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // back camera
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Initialize camera and pose
  const startCamera = () => {
    if (!window.Camera || !window.Pose || !videoRef.current) return;

    // Stop previous camera and pose
    cameraRef.current?.stop?.();
    poseRef.current?.close?.();

    const pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    poseRef.current = pose;
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!canvas || !overlayCanvas || !results.image) return;

      const ctx = canvas.getContext("2d");
      const overlayCtx = overlayCanvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

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

        try {
          // Draw landmarks
          const drawLandmarksFn =
            window.drawLandmarks ||
            function (ctx, landmarks = [], opts = {}) {
              const color = opts.color || "cyan";
              const lineWidth = opts.lineWidth || 2;
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.lineWidth = lineWidth;
              landmarks.forEach((p) => {
                if (typeof p.x === "number" && typeof p.y === "number") {
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
              });
            };
          drawLandmarksFn(ctx, remappedLandmarks, {
            color: "cyan",
            lineWidth: 2,
          });
        } catch (e) {}
      }

      overlayCtx.strokeStyle = allInside ? "green" : "red";
      overlayCtx.lineWidth = 4;
      overlayCtx.strokeRect(box.x, box.y, box.w, box.h);

      if (detected && !allInside) {
        overlayCtx.font = "28px sans-serif";
        overlayCtx.fillStyle = "red";
        overlayCtx.textAlign = "center";
        overlayCtx.fillText(
          "Fit the subject within the box",
          box.x + box.w / 2,
          box.y + box.h - 24
        );
      }
    });

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => await pose.send({ image: videoRef.current }),
      facingMode,
    });
    cameraRef.current = camera;
    camera.start();
  };

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (canvas && overlayCanvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        overlayCanvas.width = window.innerWidth;
        overlayCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    startCamera();
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cameraRef.current?.stop?.();
      poseRef.current?.close?.();
    };
  }, []);

  const handleToggleRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const stream = canvas.captureStream(30);
    recordedChunksRef.current = [];
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: "video/webm",
    });

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recorded-${new Date().toISOString()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    startCamera();
  };

  const bottomButtonStyle = {
    position: "absolute",
    zIndex: 999999,
    left: "50%",
    bottom: "80px",
    transform: "translateX(-50%)",
    padding: "16px 32px",
    fontSize: "18px",
    borderRadius: "999px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    background: isRecording ? "#e03b3b" : "#2563eb",
    color: "#fff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
    border: "none",
  };

  const switchButtonStyle = {
    position: "absolute",
    zIndex: 999999,
    left: "50%",
    bottom: "30px",
    transform: "translateX(-50%)",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "999px",
    fontWeight: 700,
    cursor: "pointer",
    background: "#f59e0b",
    color: "#fff",
    border: "none",
  };

  const canvasStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  };
  const hiddenVideoStyle = { display: "none" };

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" />
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" />
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" />

      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
          background: "black",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={hiddenVideoStyle}
        />

        <button onClick={handleToggleRecording} style={bottomButtonStyle}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isRecording ? "#fff" : "#ff7b7b",
              display: "inline-block",
              animation: isRecording ? "pulse 1s infinite" : "none",
            }}
          />
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        <button onClick={handleSwitchCamera} style={switchButtonStyle}>
          Switch Camera
        </button>

        <canvas ref={canvasRef} style={canvasStyle} />
        <canvas
          ref={overlayCanvasRef}
          style={{ ...canvasStyle, zIndex: 1, pointerEvents: "none" }}
        />

        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.6; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
