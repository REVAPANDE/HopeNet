from __future__ import annotations

import os
from threading import Lock
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.models.schemas import Assignment, PriorityConfig, SystemEventRecord, Task, Volunteer

T = TypeVar("T", bound=BaseModel)


class InMemoryCollection(Generic[T]):
    def __init__(self) -> None:
        self._items: dict[str, T] = {}
        self._lock = Lock()

    def list(self) -> list[T]:
        with self._lock:
            return list(self._items.values())

    def get(self, item_id: str) -> T | None:
        with self._lock:
            return self._items.get(item_id)

    def upsert(self, item_id: str, item: T) -> T:
        with self._lock:
            self._items[item_id] = item
            return item

    def bulk_upsert(self, entries: dict[str, T]) -> None:
        with self._lock:
            self._items.update(entries)


class FirestoreCollection(Generic[T]):
    def __init__(self, client, collection_name: str, model_cls: type[T], fallback: InMemoryCollection[T]) -> None:
        self._client = client
        self._collection_name = collection_name
        self._model_cls = model_cls
        self._fallback = fallback

    @property
    def _collection(self):
        return self._client.collection(self._collection_name)

    def list(self) -> list[T]:
        try:
            documents = self._collection.stream()
            items = []
            for document in documents:
                payload = document.to_dict() or {}
                payload.setdefault("id", document.id)
                items.append(self._model_cls.model_validate(payload))
            if items:
                self._fallback.bulk_upsert({item.id: item for item in items})
            return items or self._fallback.list()
        except Exception:
            return self._fallback.list()

    def get(self, item_id: str) -> T | None:
        try:
            document = self._collection.document(item_id).get()
            if document.exists:
                payload = document.to_dict() or {}
                payload.setdefault("id", item_id)
                item = self._model_cls.model_validate(payload)
                self._fallback.upsert(item_id, item)
                return item
            return self._fallback.get(item_id)
        except Exception:
            return self._fallback.get(item_id)

    def upsert(self, item_id: str, item: T) -> T:
        self._fallback.upsert(item_id, item)
        try:
            self._collection.document(item_id).set(item.model_dump(mode="json"))
        except Exception:
            pass
        return item

    def bulk_upsert(self, entries: dict[str, T]) -> None:
        self._fallback.bulk_upsert(entries)
        try:
            batch = self._client.batch()
            for item_id, item in entries.items():
                batch.set(self._collection.document(item_id), item.model_dump(mode="json"))
            batch.commit()
        except Exception:
            pass


class DataStore:
    def __init__(self) -> None:
        self.firestore_enabled = False
        self.collection_prefix = os.getenv("FIRESTORE_COLLECTION_PREFIX", "hopenet")

        self._volunteers_memory: InMemoryCollection[Volunteer] = InMemoryCollection()
        self._tasks_memory: InMemoryCollection[Task] = InMemoryCollection()
        self._assignments_memory: InMemoryCollection[Assignment] = InMemoryCollection()
        self._config_memory: InMemoryCollection[PriorityConfig] = InMemoryCollection()
        self._events_memory: InMemoryCollection[SystemEventRecord] = InMemoryCollection()

        self.volunteers: InMemoryCollection[Volunteer] | FirestoreCollection[Volunteer] = self._volunteers_memory
        self.tasks: InMemoryCollection[Task] | FirestoreCollection[Task] = self._tasks_memory
        self.assignments: InMemoryCollection[Assignment] | FirestoreCollection[Assignment] = self._assignments_memory
        self.priority_config: InMemoryCollection[PriorityConfig] | FirestoreCollection[PriorityConfig] = self._config_memory
        self.events: InMemoryCollection[SystemEventRecord] | FirestoreCollection[SystemEventRecord] = self._events_memory

        self._try_firestore()

    def _collection_name(self, suffix: str) -> str:
        return f"{self.collection_prefix}_{suffix}"

    def _try_firestore(self) -> None:
        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project:
            return
        try:
            from google.cloud import firestore  # type: ignore

            self.client = firestore.Client(project=project)
            self.firestore_enabled = True
            self.volunteers = FirestoreCollection(
                self.client,
                self._collection_name("volunteers"),
                Volunteer,
                self._volunteers_memory,
            )
            self.tasks = FirestoreCollection(
                self.client,
                self._collection_name("tasks"),
                Task,
                self._tasks_memory,
            )
            self.assignments = FirestoreCollection(
                self.client,
                self._collection_name("assignments"),
                Assignment,
                self._assignments_memory,
            )
            self.priority_config = FirestoreCollection(
                self.client,
                self._collection_name("priority_config"),
                PriorityConfig,
                self._config_memory,
            )
            self.events = FirestoreCollection(
                self.client,
                self._collection_name("events"),
                SystemEventRecord,
                self._events_memory,
            )
        except Exception:
            self.firestore_enabled = False


store = DataStore()
