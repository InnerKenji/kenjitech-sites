#ifndef SWNACL_H
#define SWNACL_H
/* Chiffrement NaCl crypto_box (TweetNaCl, domaine public) pour le code d'activation SoftWEIGHT Online. */
#ifdef __cplusplus
extern "C" {
#endif
void sw_random(unsigned char *buf, unsigned long long n);
long sw_seal(unsigned char *out, const unsigned char *msg, unsigned long long mlen, const unsigned char pk[32]);
#ifdef __cplusplus
}
#endif
#endif
