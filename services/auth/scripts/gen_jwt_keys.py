from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

out = Path("../../secrets")
out.mkdir(exist_ok=True)

private_key = Ed25519PrivateKey.generate()

(out / "jwt_private.pem").write_bytes(
    private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
)
(out / "jwt_public.pem").write_bytes(
    private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
)
print("Wrote secrets/jwt_private.pem and secrets/jwt_public.pem")