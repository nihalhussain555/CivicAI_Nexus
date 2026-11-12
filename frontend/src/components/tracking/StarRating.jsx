import { Star } from "lucide-react";

// Satisfaction rating.
//
// Buttons rather than a range input: on a phone a star row you can tap with a
// thumb is the whole point, and the same component has to render read-only on
// a resolved case, so the two modes share one layout.
const StarRating = ({ value = 0, onChange, size = 26, readOnly = false, caption }) => {
  const labels = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

  return (
    <div className="track-rating">
      <div className="track-rating-stars" role={readOnly ? "img" : "radiogroup"}
           aria-label={`Satisfaction: ${value || "not rated"}`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= value;
          const className = `track-star ${filled ? "filled" : ""}`;

          return readOnly ? (
            <Star key={star} size={size} className={className} aria-hidden={filled ? undefined : true} />
          ) : (
            <button
              key={star}
              type="button"
              className="track-star-button"
              onClick={() => onChange?.(star)}
              aria-label={`${star} of 5 — ${labels[star - 1]}`}
              aria-checked={filled}
              role="radio"
            >
              <Star size={size} className={className} />
            </button>
          );
        })}
      </div>

      <div className="track-rating-caption">
        {caption || (value ? labels[value - 1] : readOnly ? "Not rated yet" : "Tap to rate the fix")}
      </div>
    </div>
  );
};

export default StarRating;
