import { uploadsBaseUrl } from "../../services/api";

const initialsOf = (name = "?") =>
  name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/**
 * Shows the user's uploaded profile photo if they have one, otherwise
 * falls back to initials on a solid accent circle — used anywhere a user
 * avatar appears (profile page, topbar, officer lists) so they all stay
 * in sync automatically once a photo is uploaded.
 */
const Avatar = ({ user, size = 40, fontSize }) => {
  const computedFontSize = fontSize || Math.round(size * 0.36);

  if (user?.profile_image) {
    return (
      <img
        src={`${uploadsBaseUrl}${user.profile_image}`}
        alt={user.name || "Profile photo"}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)",
        }}
      />
    );
  }

  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: computedFontSize, flexShrink: 0 }}
    >
      {initialsOf(user?.name)}
    </div>
  );
};

export default Avatar;