SUPPORTED_LANGUAGES = {

    "English": "en",

    "Hindi": "hi",

    "Tamil": "ta"
}


def detect_language(text):

    """
    Basic language detection.

    Full multilingual detection will be added
    using a dedicated language model.
    """

    if not text:

        return "English"

    # Tamil Unicode range
    if any(
        "\u0B80" <= char <= "\u0BFF"
        for char in text
    ):

        return "Tamil"

    # Hindi / Devanagari
    if any(
        "\u0900" <= char <= "\u097F"
        for char in text
    ):

        return "Hindi"

    return "English"


def translate_text(
    text,
    source_language,
    target_language="English"
):

    if (
        source_language
        == target_language
    ):

        return text

    # Translation provider can be
    # connected here later.

    return text