RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "INR": 87.5
}

def convert_currency(amount: float, from_curr: str, to_curr: str) -> float:
    from_rate = RATES.get(from_curr.upper(), 1.0)
    to_rate = RATES.get(to_curr.upper(), 1.0)
    amount_in_usd = amount / from_rate
    return amount_in_usd * to_rate
