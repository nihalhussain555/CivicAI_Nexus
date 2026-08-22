from math import radians, sin, cos, sqrt, atan2


EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/lon points, in kilometers."""
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def make_point(lat, lon, address=None):
    """Build a GeoJSON Point document (MongoDB 2dsphere-compatible)."""
    point = {
        "type": "Point",
        "coordinates": [lon, lat],  # GeoJSON order: [lng, lat]
    }
    if address:
        point["address"] = address
    return point


def point_lat_lon(point):
    if not point or "coordinates" not in point:
        return None, None
    lon, lat = point["coordinates"]
    return lat, lon
