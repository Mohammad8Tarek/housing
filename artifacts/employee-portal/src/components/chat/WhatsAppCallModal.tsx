import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";

interface WhatsAppCallModalProps {
  isOpen: boolean;
  callType: "voice" | "video";
  contactName: string;
  contactPhoto: string | null;
  onEndCall: (callType: "voice" | "video", durationSec: number) => void;
  isDark?: boolean;
  isRtl?: boolean;
}

export const WhatsAppCallModal: React.FC<WhatsAppCallModalProps> = ({
  isOpen,
  callType,
  contactName,
  contactPhoto,
  onEndCall,
  isDark = true,
  isRtl = true,
}) => {
  const [callState, setCallState] = useState<"calling" | "ringing" | "connected">("calling");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);

  // Sound generator for realistic WhatsApp ringtone
  const playRingTone = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.setValueAtTime(0.12, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    } catch {
      // AudioContext unavailable
    }
  };

  // Start Camera Stream for Video Call
  const startCamera = async (facing: "user" | "environment") => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch {
      // Camera permission denied or not available
    }
  };

  // Lifecycle
  useEffect(() => {
    if (!isOpen) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
      }
      setDuration(0);
      setCallState("calling");
      return;
    }

    setDuration(0);
    setCallState("calling");
    setIsVideoEnabled(callType === "video");

    if (callType === "video") {
      startCamera(facingMode);
    }

    // Calling -> Ringing
    const t1 = setTimeout(() => {
      setCallState("ringing");
      playRingTone();
      ringIntervalRef.current = setInterval(playRingTone, 2800);
    }, 1200);

    // Ringing -> Connected
    const t2 = setTimeout(() => {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      setCallState("connected");
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, callType]);

  // Duration Timer when connected
  useEffect(() => {
    if (callState !== "connected" || !isOpen) return;
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, isOpen]);

  // Format Duration
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Flip Camera
  const toggleCameraFacing = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleEnd = () => {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    onEndCall(callType, duration);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between select-none animate-in fade-in duration-200"
      style={{
        background: "linear-gradient(180deg, #091a1a 0%, #0d2b27 50%, #061413 100%)",
        color: "#ffffff",
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Background Video (if Video Call) */}
      {callType === "video" && isVideoEnabled && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-70"
        />
      )}

      {/* Top Header: WhatsApp Call Info */}
      <div className="relative z-10 pt-12 pb-6 px-6 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[12px] font-medium text-[#25d366] mb-4 border border-white/10">
          {callType === "video" ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <Phone className="w-3.5 h-3.5" />
          )}
          <span>
            {callType === "video"
              ? isRtl
                ? "مكالمة فيديو مشفرة"
                : "Encrypted Video Call"
              : isRtl
              ? "مكالمة صوتية مشفرة"
              : "Encrypted Voice Call"}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative mb-3">
          {contactPhoto ? (
            <img
              src={contactPhoto}
              alt={contactName}
              className={`w-28 h-28 rounded-full object-cover border-4 border-[#00a884]/40 shadow-2xl ${
                callState === "ringing" ? "animate-pulse" : ""
              }`}
            />
          ) : (
            <div
              className={`w-28 h-28 rounded-full bg-gradient-to-tr from-[#008069] to-[#00a884] text-white flex items-center justify-center text-4xl font-bold border-4 border-white/20 shadow-2xl ${
                callState === "ringing" ? "animate-pulse" : ""
              }`}
            >
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}

          {callState === "ringing" && (
            <span className="absolute -inset-2 rounded-full border-2 border-[#25d366] animate-ping opacity-60 pointer-events-none" />
          )}
        </div>

        {/* Contact Name */}
        <h2 className="text-2xl font-bold text-white tracking-wide mb-1 drop-shadow-md">
          {contactName}
        </h2>

        {/* Call Status */}
        <p className="text-base text-white/80 font-medium">
          {callState === "calling" && (isRtl ? "جارٍ الاتصال..." : "Calling...")}
          {callState === "ringing" && (
            <span className="text-[#25d366] font-semibold animate-pulse">
              {isRtl ? "يرن..." : "Ringing..."}
            </span>
          )}
          {callState === "connected" && (
            <span className="text-white font-mono text-lg font-bold tracking-wider">
              {formatDuration(duration)}
            </span>
          )}
        </p>
      </div>

      {/* Middle Interactive Visualizer (for audio call) */}
      {callType === "voice" && (
        <div className="relative z-10 flex-1 flex items-center justify-center px-4">
          <div className="flex items-center gap-1.5 h-16">
            {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 55, 85].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-[#25d366] transition-all duration-300"
                style={{
                  height:
                    callState === "connected"
                      ? `${Math.max(12, h * (0.4 + (i % 3) * 0.3))}px`
                      : "8px",
                  opacity: callState === "connected" ? 0.9 : 0.3,
                  animation:
                    callState === "connected"
                      ? `pulse ${0.6 + (i % 5) * 0.2}s ease-in-out infinite alternate`
                      : "none",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="relative z-10 pb-10 px-8">
        <div className="max-w-sm mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-around gap-2">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={() => setIsMuted((v) => !v)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-white text-gray-900 shadow-lg"
                : "bg-white/15 text-white hover:bg-white/25 active:scale-95"
            }`}
            title={isRtl ? (isMuted ? "إلغاء كتم الصوت" : "كتم الصوت") : isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Speaker Toggle */}
          <button
            type="button"
            onClick={() => setIsSpeaker((v) => !v)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isSpeaker
                ? "bg-white text-gray-900 shadow-lg"
                : "bg-white/15 text-white hover:bg-white/25 active:scale-95"
            }`}
            title={isRtl ? "مكبر الصوت" : "Speaker"}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Video Toggle / Flip for Video Call */}
          {callType === "video" ? (
            <>
              <button
                type="button"
                onClick={() => setIsVideoEnabled((v) => !v)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  !isVideoEnabled
                    ? "bg-white text-gray-900 shadow-lg"
                    : "bg-white/15 text-white hover:bg-white/25 active:scale-95"
                }`}
                title={isRtl ? "تبديل الكاميرا" : "Toggle Camera"}
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="w-12 h-12 rounded-full bg-white/15 text-white hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all"
                title={isRtl ? "تدوير الكاميرا" : "Flip Camera"}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </>
          ) : null}

          {/* End Call Button (Red WhatsApp Button) */}
          <button
            type="button"
            onClick={handleEnd}
            className="w-13 h-13 rounded-full bg-[#ea0038] hover:bg-red-700 active:scale-90 text-white flex items-center justify-center shadow-2xl transition-all"
            title={isRtl ? "إنهاء المكالمة" : "End Call"}
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
