import uuid

import pytest
from fastapi import HTTPException
from pgvector import Vector

from app import main


class FakeConnection:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, *_: object) -> "FakeConnection":
        return self

    def fetchall(self) -> list[dict[str, object]]:
        return self.rows


def test_list_document_chunks_returns_embedding_values(monkeypatch: pytest.MonkeyPatch) -> None:
    vector = Vector(list(range(main.VECTOR_DIMENSIONS)))
    connection = FakeConnection(
        [{"chunk_index": 0, "content": "Stored text", "embedding": vector}]
    )
    monkeypatch.setattr(main, "get_connection", lambda: connection)

    result = main.list_document_chunks(uuid.uuid4())

    assert result[0].content == "Stored text"
    assert result[0].embedding == vector.to_list()


@pytest.mark.parametrize("limit,offset", [(0, 0), (51, 0), (5, -1)])
def test_list_document_chunks_rejects_invalid_pagination(
    limit: int, offset: int
) -> None:
    with pytest.raises(HTTPException) as error:
        main.list_document_chunks(uuid.uuid4(), limit=limit, offset=offset)

    assert error.value.status_code == 422
