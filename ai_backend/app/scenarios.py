# Multi-currency payment failure scenarios matrix
EURO_SCENARIOS = [
    {"code": "3DS2_FRICTIONLESS_REJECTED", "rail": "SEPA Instant", "currency": "EUR"},
    {"code": "GATEWAY_TIMEOUT_PEAK_TRAFFIC", "rail": "iDEAL", "currency": "EUR"}
]

USD_SCENARIOS = [
    {"code": "ISSUER_HIGH_VALUE_VELOCITY_CHECK", "rail": "Visa Direct", "currency": "USD"},
    {"code": "3DS_OTP_CHALLENGE_TIMEOUT", "rail": "Mastercard ID", "currency": "USD"}
]
