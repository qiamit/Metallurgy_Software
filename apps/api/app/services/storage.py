from __future__ import annotations

import io
import mimetypes
import os
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.client import Config

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.local_root = Path(self.settings.local_storage_path)
        self.local_root.mkdir(parents=True, exist_ok=True)
        self._s3 = None
        if self.settings.storage_backend == "s3" and self.settings.s3_endpoint:
            self._s3 = boto3.client(
                "s3",
                endpoint_url=self.settings.s3_endpoint,
                aws_access_key_id=self.settings.s3_access_key,
                aws_secret_access_key=self.settings.s3_secret_key,
                region_name=self.settings.s3_region,
                config=Config(signature_version="s3v4"),
            )

    def save_bytes(self, data: bytes, filename: str, folder: str = "uploads") -> str:
        ext = Path(filename).suffix or ".bin"
        key = f"{folder}/{uuid4().hex}{ext}"
        if self._s3:
            content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            self._s3.put_object(
                Bucket=self.settings.s3_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return key

        path = self.local_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read_bytes(self, key: str) -> bytes:
        if self._s3:
            obj = self._s3.get_object(Bucket=self.settings.s3_bucket, Key=key)
            return obj["Body"].read()
        path = self.local_root / key
        if not path.exists():
            raise FileNotFoundError(key)
        return path.read_bytes()

    def absolute_path(self, key: str) -> Path:
        return self.local_root / key

    def public_url_path(self, key: str) -> str:
        return f"/files/{key}"


storage = StorageService()
