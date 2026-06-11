from stream_clipper.detect.markers import parse_markers_text, parse_time


def test_parse_time_formats():
    assert parse_time("932.5") == 932.5
    assert parse_time("15:30") == 930.0
    assert parse_time("01:23:45") == 5025.0
    assert parse_time("01:23:45.5") == 5025.5
    assert parse_time("no-es-tiempo") is None


def test_parse_markers_text_with_comments_and_labels():
    text = """
    # marcas del directo de hoy
    932.5 clutch increíble
    15:30
    basura sin tiempo
    01:00:00 reacción del chat
    """
    markers = parse_markers_text(text)
    assert [(m.time, m.label) for m in markers] == [
        (932.5, "clutch increíble"),
        (930.0, ""),
        (3600.0, "reacción del chat"),
    ]
