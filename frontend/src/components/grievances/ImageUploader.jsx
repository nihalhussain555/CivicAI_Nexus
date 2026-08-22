import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { uploadImage } from "../../services/uploadService";
import { uploadsBaseUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const ImageUploader = ({ attachments, onChange }) => {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ width: 84, height: 84, flexDirection: "column" }}
        >
          {uploading ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <ImagePlus size={18} />}
          <span style={{ fontSize: 11 }}>{uploading ? "Uploading" : "Add photo"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => e.target.files.length && handleFiles(e.target.files)}
      />
      <p className="form-hint">JPEG, PNG or WEBP. Max 8MB per image.</p>
    </div>
  );
};

export default ImageUploader;
