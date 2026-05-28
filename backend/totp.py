"""TOTP MFA helpers for RIVITED Solutions."""
import base64
import io
from typing import Tuple

import pyotp
import qrcode

ISSUER = "RIVITED Solutions"


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, account_name: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=account_name, issuer_name=ISSUER
    )


def verify_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or not (6 <= len(code) <= 8):
        return False
    totp = pyotp.TOTP(secret)
    # valid_window=1 → 30s before/after, tolerates clock drift
    return totp.verify(code, valid_window=1)


def qr_data_url(uri: str) -> str:
    """Return a base64-encoded PNG data URL for the provisioning URI QR code."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def enroll_payload(secret: str, account_email: str) -> Tuple[str, str]:
    """Return (qr_data_url, provisioning_uri) for the TOTP enrollment screen."""
    uri = provisioning_uri(secret, account_email)
    return qr_data_url(uri), uri
