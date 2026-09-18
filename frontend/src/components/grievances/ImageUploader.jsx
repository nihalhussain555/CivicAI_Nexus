import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Loader2, Upload, Camera } from "lucide-react";
import { uploadImage } from "../../services/uploadService";
import { uploadsBaseUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const ImageUploader = ({ attachments, onChange }) => {
  const inputRef = useRef();
  const cameraInputRef = useRef();
  const menuRef = useRef();

  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toast = useToast();

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
    try {
      for (const file of Array.from(files)) {
        const res = await uploadImage(file);
        onChange([...attachments, res.data]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const remove = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const openUploadPicker = () => {
    setMenuOpen(false);
    inputRef.current?.click();
  };

  const openCamera = () => {
    setMenuOpen(false);
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
        accept="image/jpeg,image/png,image/webp"
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

      <p className="form-hint">JPEG, PNG or WEBP. Max 8MB per image.</p>
    </div>
  );
};

export default ImageUploader;