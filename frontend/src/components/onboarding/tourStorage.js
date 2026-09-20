const STORAGE_PREFIX = "civicai_tour_seen_";

export const hasTourBeenSeen = (userId) => {
  if (!userId) return true;
  return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) === "true";
};

export const markTourSeen = (userId) => {
  if (!userId) return;
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, "true");
};

export const resetTour = (userId) => {
  if (!userId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
};