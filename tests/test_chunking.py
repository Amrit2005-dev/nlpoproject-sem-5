from app.chunking import CHUNK_OVERLAP, CHUNK_SIZE, split_into_chunks


def test_short_text_is_one_trimmed_chunk() -> None:
    assert split_into_chunks("  hello   world  ") == ["hello world"]


def test_long_text_is_split_with_overlap_and_without_losing_text() -> None:
    text = " ".join(f"word{i}" for i in range(1000))

    chunks = split_into_chunks(text)

    assert len(chunks) > 1
    assert all(len(chunk) <= CHUNK_SIZE for chunk in chunks)
    assert all(left[-CHUNK_OVERLAP :].strip() in right for left, right in zip(chunks, chunks[1:]))
    assert chunks[0].startswith("word0")
    assert chunks[-1].endswith("word999")


def test_empty_text_returns_no_chunks() -> None:
    assert split_into_chunks(" \n\t ") == []
