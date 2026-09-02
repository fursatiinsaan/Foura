import asyncio
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

async def send_recovery_email(
    to_email: str,
    subject: str,
    body_text: str,
    amount_inr: float,
    payment_link: str,
    ai_reasoning: str
) -> dict:
    """
    Dispatches a real HTML recovery email via SMTP if credentials are configured in .env,
    otherwise logs simulated delivery trace.
    """
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    sender_email = os.getenv("SENDER_EMAIL", smtp_user or "notifications@foura.io")

    # Build rich HTML template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAFAFA; margin: 0; padding: 24px; color: #111111; }}
        .container {{ max-width: 540px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E8E8; border-radius: 12px; padding: 32px; }}
        .header {{ border-bottom: 1px solid #E8E8E8; padding-bottom: 16px; margin-bottom: 24px; }}
        .logo {{ font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }}
        .badge {{ display: inline-block; background: #111111; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; margin-top: 6px; }}
        .body-text {{ font-size: 15px; line-height: 1.6; color: #333333; margin-bottom: 24px; }}
        .order-card {{ background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 8px; padding: 16px; margin-bottom: 24px; }}
        .order-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }}
        .order-total {{ font-size: 18px; font-weight: 800; color: #111111; }}
        .btn {{ display: block; text-align: center; background: #111111; color: #FFFFFF; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; }}
        .footer {{ margin-top: 24px; font-size: 12px; color: #888888; text-align: center; line-height: 1.5; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Foura Autonomous Concierge</div>
          <div class="badge">Order Reservation Active</div>
        </div>
        <div class="body-text">
          {body_text}
        </div>
        <div class="order-card">
          <div class="order-row">
            <span>Order Value:</span>
            <span class="order-total">₹{amount_inr:,.2f}</span>
          </div>
          <div style="font-size: 12px; color: #666666;">Hold Status: 15-Minute Guaranteed Inventory Lock</div>
        </div>
        <a href="{payment_link}" class="btn" target="_blank" style="color: #ffffff;">Complete Order Safely &rarr;</a>
        <div class="footer">
          Verified Autonomous Payment Recovery &middot; Powered by Foura AI Engine<br>
          Diagnostic reason: {ai_reasoning}
        </div>
      </div>
    </body>
    </html>
    """

    if smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Foura Concierge <{sender_email}>"
            msg["To"] = to_email

            part1 = MIMEText(body_text, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _send_smtp, smtp_server, smtp_port, smtp_user, smtp_password, sender_email, to_email, msg.as_string())
            print(f"[LIVE EMAIL SENT] Successfully delivered to {to_email} via {smtp_server}", flush=True)
            return {"status": "sent", "recipient": to_email, "provider": smtp_server}
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send live email via SMTP: {e}", flush=True)
            return {"status": "error", "detail": str(e)}
    else:
        print(f"[EMAIL DISPATCH (SIMULATED)] Sent to {to_email} | Subject: {subject}", flush=True)
        print(f"[EMAIL NOTICE] To receive actual emails in your Gmail inbox, add SMTP_USER & SMTP_PASSWORD to ai_backend/.env", flush=True)
        return {"status": "simulated", "recipient": to_email, "link": payment_link}

def _send_smtp(server, port, user, password, from_addr, to_addr, msg_str):
    with smtplib.SMTP(server, port) as s:
        s.ehlo()
        s.starttls()
        s.login(user, password)
        s.sendmail(from_addr, [to_addr], msg_str)
