// @ts-nocheck
import { useEffect, useCallback, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { dataUriToBlob } from "@/components/ui/document-preview-modal";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  fileName?: string;
  onClose: () => void;
}

export function ImageLightbox({
  src,
  alt = "",
  fileName,
  onClose,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const isImage = src
    ? src.startsWith("data:image/") ||
      /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(src)
    : false;

  const isPdf = src
    ? src.startsWith("data:application/pdf") || /\.pdf(\?|$)/i.test(src)
    : false;

  useEffect(() => {
    if (!src) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    if (src.startsWith("blob:") || src.startsWith("http")) {
      setBlobUrl(src);
      return;
    }

    if (src.startsWith("data:")) {
      const mime = isPdf
        ? "application/pdf"
        : isImage
        ? "image/jpeg"
        : "application/octet-stream";
      const blob = dataUriToBlob(src, mime);
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }
  }, [src, isPdf, isImage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!src) return;
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
    },
    [onClose, src],
  );

  useEffect(() => {
    if (!src) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [src, handleKeyDown]);

  // Reset zoom/rotation when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [src]);

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = blobUrl || src;
    a.download = fileName || (isPdf ? "document.pdf" : "image.jpg");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    } else if (src) {
      if (src.startsWith("data:")) {
        const blob = dataUriToBlob(
          src,
          isPdf ? "application/pdf" : "application/octet-stream",
        );
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        window.open(src, "_blank");
      }
    }
  };

  return (
    <Dialog
      open={!!src}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-none w-full h-full p-0 border-none bg-transparent shadow-none [&>button]:hidden flex items-center justify-center overflow-hidden"
        srTitle={fileName || "Image Viewer"}
        style={{
          transform: "none",
          top: 0,
          left: 0,
          translate: "none",
          margin: 0,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="fixed inset-0 z-0 bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <span className="text-white/80 text-sm font-medium truncate max-w-[50%] px-4">
            {fileName || alt || ""}
          </span>
          <div className="flex items-center gap-1.5 px-4">
            {isImage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                  title="Zoom out (−)"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-white/70 text-xs w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                  title="Zoom in (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleOpenNewTab}
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Image/Content */}
        <div className="relative z-10 flex items-center justify-center w-full h-full p-4 sm:p-12 pointer-events-none">
          {isImage ? (
            <div
              className="overflow-auto max-w-full max-h-full flex items-center justify-center pointer-events-auto"
              style={{ cursor: zoom > 1 ? "grab" : "default" }}
            >
              <img
                src={blobUrl || src || ""}
                alt={alt}
                draggable={false}
                className="rounded-lg shadow-2xl object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: zoom <= 1 ? "min(90vw, 1000px)" : undefined,
                  maxHeight: zoom <= 1 ? "80vh" : undefined,
                }}
              />
            </div>
          ) : isPdf ? (
            <div className="w-full max-w-4xl h-[82vh] rounded-xl overflow-hidden shadow-2xl bg-card pointer-events-auto border border-white/10 flex flex-col">
              <iframe
                src={`${blobUrl || src}#toolbar=1`}
                title={fileName || "PDF Viewer"}
                className="w-full h-full border-0 bg-background"
              />
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 text-center shadow-2xl max-w-sm w-full pointer-events-auto">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-primary" />
              </div>
              <p className="text-foreground font-semibold mb-1">
                {fileName || "Document"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                This file cannot be previewed inline.
              </p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenNewTab}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Click-outside hint */}
        <div className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
          <span className="text-white/40 text-xs">
            Click outside or press Esc to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
