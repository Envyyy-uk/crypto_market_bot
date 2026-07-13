"""
Тести авторизації: хешування паролів і JWT (частина Завдання 25).
"""

from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        h = hash_password("correct horse battery staple")
        assert h != "correct horse battery staple"
        assert h.startswith("$2")  # bcrypt-формат

    def test_verify_correct_password(self):
        h = hash_password("my-secret-password")
        assert verify_password("my-secret-password", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("my-secret-password")
        assert verify_password("not-the-password", h) is False

    def test_same_password_different_hashes(self):
        # bcrypt має вбудовану сіль — два хеші одного пароля різні
        assert hash_password("abc12345") != hash_password("abc12345")

    def test_verify_handles_garbage_hash(self):
        assert verify_password("whatever", "not-a-bcrypt-hash") is False


class TestJWT:
    def test_roundtrip(self):
        token = create_access_token(user_id=42)
        assert decode_access_token(token) == 42

    def test_tampered_token_rejected(self):
        token = create_access_token(user_id=42)
        tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
        assert decode_access_token(tampered) is None

    def test_garbage_token_rejected(self):
        assert decode_access_token("not.a.token") is None
        assert decode_access_token("") is None
