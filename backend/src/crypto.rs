//! Encryption for third-party credentials stored in the database (Razorpay tokens, GSP sessions, KYC
//! provider references). AES-256-GCM with a random 96-bit nonce per value; output is base64(nonce || ciphertext).
//! The key comes from `DATA_ENCRYPTION_KEY` (base64 of 32 random bytes). Without it, integrations stay switched off.

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;

use crate::error::AppError;

const NONCE_LEN: usize = 12;

#[derive(Clone)]
pub struct Cipher {
    key: [u8; 32],
}

impl Cipher {
    /// Parses a base64 32-byte key; `None` for a missing or malformed key, so callers can report "not configured".
    pub fn from_base64(key_b64: &str) -> Option<Self> {
        let bytes = B64.decode(key_b64.trim()).ok()?;
        let key: [u8; 32] = bytes.try_into().ok()?;
        Some(Self { key })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, AppError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| AppError::Internal("encryption failed".into()))?;
        let mut out = nonce.to_vec();
        out.extend_from_slice(&ct);
        Ok(B64.encode(out))
    }

    pub fn decrypt(&self, encoded: &str) -> Result<String, AppError> {
        let raw = B64
            .decode(encoded)
            .map_err(|_| AppError::Internal("stored secret is not valid base64".into()))?;
        if raw.len() <= NONCE_LEN {
            return Err(AppError::Internal("stored secret is truncated".into()));
        }
        let (nonce, ct) = raw.split_at(NONCE_LEN);
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        let pt = cipher
            .decrypt(Nonce::from_slice(nonce), ct)
            .map_err(|_| AppError::Internal("stored secret could not be decrypted (wrong key?)".into()))?;
        String::from_utf8(pt).map_err(|_| AppError::Internal("stored secret is not UTF-8".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> Cipher {
        Cipher::from_base64(&B64.encode([7u8; 32])).unwrap()
    }

    #[test]
    fn round_trips_and_uses_a_fresh_nonce() {
        let c = key();
        let a = c.encrypt("rzp_access_token").unwrap();
        let b = c.encrypt("rzp_access_token").unwrap();
        assert_ne!(a, b);
        assert_eq!(c.decrypt(&a).unwrap(), "rzp_access_token");
    }

    #[test]
    fn rejects_tampering_and_the_wrong_key() {
        let c = key();
        let mut raw = B64.decode(c.encrypt("secret").unwrap()).unwrap();
        let last = raw.len() - 1;
        raw[last] ^= 1;
        assert!(c.decrypt(&B64.encode(&raw)).is_err());
        let other = Cipher::from_base64(&B64.encode([8u8; 32])).unwrap();
        assert!(other.decrypt(&c.encrypt("secret").unwrap()).is_err());
    }

    #[test]
    fn refuses_short_or_bad_keys() {
        assert!(Cipher::from_base64("not-base64!").is_none());
        assert!(Cipher::from_base64(&B64.encode([1u8; 16])).is_none());
    }
}
