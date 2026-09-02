import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_recovery_email_sync(to_email: str, subject: str, body_text: str, amount_inr: float, payment_link: str, ai_reasoning: str) -> bool:
    """
    Sends a real transactional recovery email via SMTP or Resend API.
    """
    # 1. Try Resend API if configured
    resend_key = os.getenv("RESEND_API_KEY", "")
    if resend_key:
        try:
            import httpx
            from_addr = os.getenv("RESEND_FROM", "recovery@resend.dev")
            payload = {
                "from": from_addr,
                "to": [to_email],
                "subject": subject,
                "html": _generate_html(body_text, amount_inr, payment_link, ai_reasoning)
            }
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=10.0
            )
            if resp.status_code in [200, 201]:
                print(f"[EMAIL SERVICE] Sent via Resend to {to_email}", flush=True)
                return True
            else:
                print(f"[EMAIL SERVICE] Resend failed with code {resp.status_code}: {resp.text}", flush=True)
        except Exception as e:
            print(f"[EMAIL SERVICE] Resend error: {e}", flush=True)

    # 2. Try SMTP if configured (Gmail, Outlook, Amazon SES, etc.)
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from or "noreply@razorpay-recovery.com"
            msg["To"] = to_email

            part_text = MIMEText(f"{body_text}\n\nRetry Payment: {payment_link}", "plain")
            part_html = MIMEText(_generate_html(body_text, amount_inr, payment_link, ai_reasoning), "html")

            msg.attach(part_text)
            msg.attach(part_html)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(msg["From"], [to_email], msg.as_string())

            print(f"[EMAIL SERVICE] Real email sent via SMTP to {to_email}", flush=True)
            return True
        except Exception as e:
            print(f"[EMAIL SERVICE] SMTP send failed: {e}", flush=True)
            return False

    print(f"[EMAIL DISPATCH] Target: {to_email} | Subject: {subject} | (Configure SMTP_USER & SMTP_PASSWORD or RESEND_API_KEY in .env for live inbox delivery)", flush=True)
    return False

async def send_recovery_email(to_email: str, subject: str, body_text: str, amount_inr: float, payment_link: str, ai_reasoning: str):
    """Async wrapper around email dispatcher."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        send_recovery_email_sync,
        to_email,
        subject,
        body_text,
        amount_inr,
        payment_link,
        ai_reasoning
    )

def _generate_html(body_text: str, amount_inr: float, payment_link: str, ai_reasoning: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }}
        .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e1e4e8; }}
        .header {{ background: #0c2340; color: #ffffff; padding: 24px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 600; }}
        .content {{ padding: 32px 24px; color: #333333; line-height: 1.6; }}
        .card {{ background: #f8fafc; border-left: 4px solid #3366FF; padding: 16px; border-radius: 4px; margin: 20px 0; }}
        .cta {{ display: block; width: fit-content; margin: 24px auto; background: #3366FF; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; border-radius: 4px; text-align: center; }}
        .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Foura Autonomous Payment Recovery</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px;">{body_text}</p>
          <div class="card">
            <strong>Amount:</strong> ₹{amount_inr:,.2f}<br/>
            <strong>Diagnostic Note:</strong> {ai_reasoning}
          </div>
          <a href="{payment_link}" class="cta">Complete Your Payment</a>
          <p style="font-size: 13px; color: #64748b; text-align: center;">This link is secure and valid for the next 24 hours.</p>
        </div>
        <div class="footer">
          Powered by Foura AI-Driven Revenue Recovery Engine
        </div>
      </div>
    </body>
    </html>
    """
