# This exact list must stay in sync with frontend/src/utils/constants.js —
# district values are validated against this set on both the citizen's
# report form (dropdown) and here (server-side), so a grievance's district
# and an officer's assigned district always match exactly. Without this,
# free-text geocoding output could easily drift from a fixed dropdown
# value (different capitalization, "Chennai district" vs "Chennai", etc.)
# and silently break district-based routing.
DISTRICTS = ["Chennai", "Coimbatore", "Madurai", "Salem", "Erode", "Tiruchirappalli"]