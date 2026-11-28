import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Loader2, Upload, Camera } from "lucide-react";
import { uploadImage } from "../../services/uploadService";
import { uploadsBaseUrl } from "../../services/api";
import { useErrorToast } from "../../hooks/useDiagnostics";

// Mirrored from the accept attribute and the hint below: a file the citizen
// cannot attach is caught here rather than after a round trip to the server.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
const MAX_BYTES = 8 * 1024 * 1024;

const formatMB = (bytes) => {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
};

const typeOf = (file) =>
  file.type ? file.type.replace("image/", "").toUpperCase() : "unsupported";

const rejectionReason = (file) => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `"${file.name}" is a ${typeOf(file)} image. Attach a JPEG, PNG or WEBP instead — a phone camera set to HEIC needs changing to compatible format.`;
  }
  if (file.size > MAX_BYTES) {
    return `"${file.name}" is ${formatMB(file.size)}, above the ${formatMB(MAX_BYTES)} limit. Send a smaller photo, or crop it.`;
  }
  if (!file.size) return `"${file.name}" arrived empty, so there is nothing to upload.`;
  return null;
};

// A cancelled request is the app or the citizen stopping it, not a fault in the
// platform, so it is explained instead of filed.
const wasAborted = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const ImageUploader = ({ attachments, onChange }) => {
  const inputRef = useRef();
  const cameraInputRef = useRef();
  const menuRef = useRef();

  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const noticeId = useRef(0);

  const fail = useErrorToast();

  const note = (text, retryFiles) =>
    setNotices((prev) => [...prev.slice(-3), { id: ++noticeId.current, text, retryFiles }]);

  // Close the "Upload image / Take photo" menu when clicking outside it
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  const handleFiles = async (files) => {
    setUploading(true);

    const accepted = [];
    for (const file of Array.from(files)) {
      const reason = rejectionReason(file);
      if (reason) note(reason);
      else accepted.push(file);
    }

    const attached = [...attachments];
    for (const file of accepted) {
      try {
        const res = await uploadImage(file);
        attached.push(res.data);
        // One upload at a time, appended as it lands: a file that is rejected
        // or fails must never take the ones already accepted with it.
        onChange(attached.slice());
      } catch (error) {
        if (wasAborted(error)) {
          note(`"${file.name}" stopped uploading part-way, so nothing was attached for it.`);
        } else {
          fail(error, {
            feature: "file_upload",
            message: `"${file.name}" could not be uploaded.`,
            onRetry: () => handleFiles([file]),
          });
          note(`"${file.name}" never reached the server. The photo is still on this device.`, [file]);
        }
      }
    }

    setUploading(false);
  };

  const remove = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const openUploadPicker = () => {
    setMenuOpen(false);
    setNotices([]);
    inputRef.current?.click();
  };

  const openCamera = () => {
    setMenuOpen(false);
    setNotices([]);
    cameraInputRef.current?.click();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {attachments.map((a, i) => (
          <div key={i} style={{ position: "relative", width: 84, height: 84 }}>
            <img
              src={`${uploadsBaseUrl}${a.url}`}
              alt={a.filename || "attachment"}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove image"
              style={{
                position: "absolute", top: -6, right: -6, width: 20, height: 20,
                borderRadius: "50%", background: "var(--danger)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)",
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {/* "Add photo" trigger + its Upload/Camera choice menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={uploading}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{ width: 84, height: 84, flexDirection: "column" }}
          >
            {uploading ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <ImagePlus size={18} />}
            <span style={{ fontSize: 11 }}>{uploading ? "Uploading" : "Add photo"}</span>
          </button>

          {menuOpen && (
            <div
              className="profile-dropdown"
              role="menu"
              aria-label="Add photo options"
              style={{ top: "calc(100% + 8px)", left: 0, right: "auto", width: 190 }}
            >
              <button type="button" className="profile-menu-item" role="menuitem" onClick={openUploadPicker}>
                <Upload size={16} />
                <span>Upload image</span>
              </button>

              <button type="button" className="profile-menu-item" role="menuitem" onClick={openCamera}>
                <Camera size={16} />
                <span>Take photo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Choose from device gallery / files */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Opens the device camera directly (rear camera on phones) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          if (e.target.files.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {notices.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {notices.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <p className="form-error" style={{ flex: 1, margin: 0, fontWeight: 500, color: "var(--text-muted)" }}>
                {item.text}
              </p>
              {item.retryFiles && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={uploading}
                  onClick={() => {
                    setNotices((prev) => prev.filter((n) => n.id !== item.id));
                    handleFiles(item.retryFiles);
                  }}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                aria-label="Dismiss"
                onClick={() => setNotices((prev) => prev.filter((n) => n.id !== item.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="form-hint">JPEG, PNG or WEBP. Max {formatMB(MAX_BYTES)} per image.</p>
    </div>
  );
};

export default ImageUploader;