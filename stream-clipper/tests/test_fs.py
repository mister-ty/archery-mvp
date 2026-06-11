from pathlib import Path

from stream_clipper.utils.fs import file_signature, safe_slug, write_json_atomic, read_json


def test_safe_slug_normalizes_dangerous_names():
    assert safe_slug("Stream Épico!! (parte 2) #final.mp4") == "stream-epico-parte-2-final"
    assert safe_slug("../../etc/passwd") == "passwd"  # solo el basename: sin traversal
    assert safe_slug("$(rm -rf);.mkv") == "rm-rf"
    assert safe_slug("ñandú vs ñoño.mov") == "nandu-vs-nono"


def test_safe_slug_never_empty_and_bounded():
    assert safe_slug("!!!.mp4") == "video"
    assert len(safe_slug("a" * 500)) <= 60


def test_file_signature_changes_with_content(tmp_path: Path):
    a, b = tmp_path / "a.bin", tmp_path / "b.bin"
    a.write_bytes(b"hola" * 1000)
    b.write_bytes(b"chau" * 1000)
    assert file_signature(a) != file_signature(b)
    assert file_signature(a) == file_signature(a)


def test_write_json_atomic_roundtrip(tmp_path: Path):
    target = tmp_path / "meta.json"
    write_json_atomic(target, {"título": "ñ", "n": 1})
    assert read_json(target) == {"título": "ñ", "n": 1}
    assert not target.with_suffix(".json.tmp").exists()
