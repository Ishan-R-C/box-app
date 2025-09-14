"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // recording canvas
  const overlayCanvasRef = useRef(null); // overlay-only canvas

  const cameraRef = useRef(null);
  const poseRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current)
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const overlayCtx = overlayCanvas.getContext("2d");

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      overlayCanvas.width = window.innerWidth;
      overlayCanvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    let interval = setInterval(() => {
      if (window.Pose && window.Camera) {
        clearInterval(interval);

        const { Pose, Camera } = window;

        const drawLandmarksFn =
          window.drawLandmarks ||
          function (ctx, landmarks = [], opts = {}) {
            const color = opts.color || "cyan";
            const lineWidth = opts.lineWidth || 2;
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            for (let i = 0; i < landmarks.length; i++) {
              const p = landmarks[i];
              if (typeof p.x === "number" && typeof p.y === "number") {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          };

        const pose = new Pose({
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
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

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

          // Draw video on recording canvas
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
              // Draw landmarks on recording canvas
              drawLandmarksFn(ctx, remappedLandmarks, {
                color: "cyan",
                lineWidth: 2,
              });
            } catch (e) {}
          }

          // Draw guidance box + text only on overlay canvas
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

        const camera = new Camera(video, {
          onFrame: async () => {
            await pose.send({ image: video });
          },
          facingMode: "environment",
        });
        cameraRef.current = camera;
        camera.start();
      }
    }, 150);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);

      try {
        if (cameraRef.current?.video) {
          const tracks = cameraRef.current.video.srcObject?.getTracks();
          tracks?.forEach((t) => t.stop());
        }
      } catch (e) {}

      try {
        if (cameraRef.current?.stop) cameraRef.current.stop();
      } catch (e) {}

      try {
        poseRef.current?.close?.();
      } catch (e) {}
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
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas not available for recording.");
      return;
    }

    const stream =
      typeof canvas.captureStream === "function"
        ? canvas.captureStream(30)
        : videoRef.current?.srcObject;

    if (!stream) {
      console.error("No capture stream available.");
      return;
    }

    recordedChunksRef.current = [];

    const preferredTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    let options = {};
    for (const t of preferredTypes) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        options.mimeType = t;
        break;
      }
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(stream, options);
    } catch (err) {
      try {
        mediaRecorderRef.current = new MediaRecorder(stream);
      } catch (e) {
        console.error("MediaRecorder creation failed:", e);
        return;
      }
    }

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `recorded-pose-${new Date().toISOString()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const bottomButtonStyle = {
    position: "absolute",
    zIndex: 999999,
    left: "50%",
    bottom: "30px",
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
    color: "#ffffff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
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
              background: isRecording ? "#ffffff" : "#ff7b7b",
              display: "inline-block",
              animation: isRecording ? "pulse 1s infinite" : "none",
            }}
          />
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        {/* Recording canvas */}
        <canvas ref={canvasRef} style={canvasStyle} />

        {/* Overlay canvas (not recorded) */}
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
